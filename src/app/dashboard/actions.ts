"use server"

import { revalidatePath } from "next/cache"

import { currentUser, forbidDemo, type SessionUser } from "@/lib/auth"
import { isPartner, STAFF } from "@/lib/delivery/accounts"
import { ledger, newItemId, record } from "@/lib/delivery/store"
import { KINDS, STAGES, type Item, type Kind, type Stage } from "@/lib/delivery/types"
import { memberByEmail } from "@/lib/roles"

// The Delivery Board's writes. An admin works any partner's account; a partner works only their own,
// and only as a partner does: asks for work, answers a review, writes a note. Every write is an event
// (lib/delivery/store.ts), so nothing is lost and the item's history shows who did what.

export type Result = { error?: string }

type Who = { user: SessionUser; admin: boolean; /** The one address the person goes by (Brendan's Gmail is his own address). */ by: string }

async function who(partner: string): Promise<Who | string> {
  const user = await currentUser()
  if (!user) return "Sign in first."
  try {
    forbidDemo(user)
  } catch (err) {
    return (err as Error).message
  }
  if (!isPartner(partner)) return "No partner has that id."
  const m = memberByEmail(user.email)
  const by = (m?.email ?? user.email).toLowerCase()
  if (user.admin) return { user, admin: true, by }
  if (m?.role === "partner" && m.partner === partner) return { user, admin: false, by }
  return "That account isn't yours."
}

async function itemOf(partner: string, id: string): Promise<Item | null> {
  return (await ledger(partner)).items.find((it) => it.id === id) ?? null
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const isStaff = (email: string | null) => email === null || STAFF.some((s) => s.email === email)

async function write(fn: () => Promise<void>): Promise<Result> {
  try {
    await fn()
  } catch (err) {
    return { error: `The board could not be saved (${(err as Error).name}).` }
  }
  revalidatePath("/dashboard")
  return {}
}

/** New work. A partner's request starts Requested with their account's owner; an admin may set both. */
export async function openItem(partner: string, input: { type: Kind; title: string; detail: string; due: string | null; owner?: string | null; stage?: Stage }): Promise<Result> {
  const w = await who(partner)
  if (typeof w === "string") return { error: w }
  const title = String(input.title ?? "").trim().slice(0, 150)
  const detail = String(input.detail ?? "").trim().slice(0, 4000)
  const due = input.due && DATE.test(input.due) ? input.due : null
  if (!KINDS.includes(input.type)) return { error: "Pick what kind of work it is." }
  if (!title) return { error: "Give it a title." }
  const account = await ledger(partner)
  const owner = w.admin && input.owner !== undefined ? input.owner : account.owner
  if (!isStaff(owner)) return { error: "The owner must be on the PAX team." }
  const stage = w.admin && input.stage && STAGES.includes(input.stage) ? input.stage : "requested"
  return write(() => record(partner, { ev: "open", item: newItemId(), type: input.type, title, detail, due, owner, stage, by: w.by, at: new Date().toISOString() }))
}

/** A move between stages. A partner answers a review: approve (Delivered) or send back with a note (In production). */
export async function moveItem(partner: string, id: string, stage: Stage, note?: string): Promise<Result> {
  const w = await who(partner)
  if (typeof w === "string") return { error: w }
  const it = await itemOf(partner, id)
  if (!it) return { error: "That item is gone." }
  if (!STAGES.includes(stage) || stage === it.stage) return { error: "It's already there." }
  const text = String(note ?? "").trim().slice(0, 4000) || undefined
  if (!w.admin) {
    if (it.stage !== "review" || (stage !== "delivered" && stage !== "production")) return { error: "Only work in review is yours to answer." }
    if (stage === "production" && !text) return { error: "Say what should change." }
  }
  return write(() => record(partner, { ev: "stage", item: id, stage, note: text, by: w.by, at: new Date().toISOString() }))
}

export async function assignItem(partner: string, id: string, owner: string | null): Promise<Result> {
  const w = await who(partner)
  if (typeof w === "string") return { error: w }
  if (!w.admin) return { error: "Admins only." }
  if (!isStaff(owner)) return { error: "The owner must be on the PAX team." }
  if (!(await itemOf(partner, id))) return { error: "That item is gone." }
  return write(() => record(partner, { ev: "assign", item: id, owner, by: w.by, at: new Date().toISOString() }))
}

export async function dueItem(partner: string, id: string, due: string | null): Promise<Result> {
  const w = await who(partner)
  if (typeof w === "string") return { error: w }
  if (!w.admin) return { error: "Admins only." }
  if (due !== null && !DATE.test(due)) return { error: "That date doesn't read." }
  if (!(await itemOf(partner, id))) return { error: "That item is gone." }
  return write(() => record(partner, { ev: "due", item: id, due, by: w.by, at: new Date().toISOString() }))
}

/** Where the work lives: a page in the app (/clips?c=…) or a full address. */
export async function linkItem(partner: string, id: string, href: string): Promise<Result> {
  const w = await who(partner)
  if (typeof w === "string") return { error: w }
  if (!w.admin) return { error: "Admins only." }
  const h = String(href ?? "").trim().slice(0, 500)
  if (!/^(\/[^/]|https:\/\/)/.test(h)) return { error: "Give a page here (/clips?c=…) or an https address." }
  if (!(await itemOf(partner, id))) return { error: "That item is gone." }
  return write(() => record(partner, { ev: "link", item: id, href: h, by: w.by, at: new Date().toISOString() }))
}

export async function noteItem(partner: string, id: string, text: string): Promise<Result> {
  const w = await who(partner)
  if (typeof w === "string") return { error: w }
  const t = String(text ?? "").trim().slice(0, 4000)
  if (!t) return { error: "Write something first." }
  if (!(await itemOf(partner, id))) return { error: "That item is gone." }
  return write(() => record(partner, { ev: "note", item: id, text: t, by: w.by, at: new Date().toISOString() }))
}

/** The account's owner on the PAX side: new requests go to them. */
export async function ownAccount(partner: string, owner: string | null): Promise<Result> {
  const w = await who(partner)
  if (typeof w === "string") return { error: w }
  if (!w.admin) return { error: "Admins only." }
  if (!isStaff(owner)) return { error: "The owner must be on the PAX team." }
  return write(() => record(partner, { ev: "account", owner, by: w.by, at: new Date().toISOString() }))
}
