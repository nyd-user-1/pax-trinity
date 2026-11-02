import type { LifeState } from "@/lib/lifecycle/rules"

// The Delivery Board's work, as data (Brendan, 2026-10-31): what PAX makes for a partner, one item per
// piece of work, moved through four stages. An item is the fold of its events, so its history is the
// list itself. Plain types and pure helpers, safe on the client and the server; the DynamoDB side is
// ./store.ts.

export type Stage = "requested" | "production" | "review" | "delivered"
export const STAGES: Stage[] = ["requested", "production", "review", "delivered"]
export const STAGE_LABEL: Record<Stage, string> = { requested: "Requested", production: "In production", review: "In review", delivered: "Delivered" }

export type Kind = "video" | "test" | "survey" | "report" | "analysis"
export const KINDS: Kind[] = ["video", "test", "survey", "report", "analysis"]
export const KIND_LABEL: Record<Kind, string> = { video: "Video", test: "Message test", survey: "Survey", report: "Report", analysis: "Channel analysis" }

type Base = { item: string; by: string; at: string }
export type OpenEvent = Base & { ev: "open"; type: Kind; title: string; detail: string; due: string | null; owner: string | null; stage: Stage }
export type StageEvent = Base & { ev: "stage"; stage: Stage; note?: string }
export type AssignEvent = Base & { ev: "assign"; owner: string | null }
export type DueEvent = Base & { ev: "due"; due: string | null }
export type NoteEvent = Base & { ev: "note"; text: string }
/** Where the work lives once made: a clip, a test, a report. */
export type LinkEvent = Base & { ev: "link"; href: string }
export type ItemEvent = OpenEvent | StageEvent | AssignEvent | DueEvent | NoteEvent | LinkEvent
/** The partner account's owner on the PAX side. */
export type AccountEvent = { ev: "account"; owner: string | null; by: string; at: string }
export type DeliveryEvent = ItemEvent | AccountEvent

export type Item = {
  id: string
  partner: string
  type: Kind
  title: string
  detail: string
  stage: Stage
  owner: string | null
  /** YYYY-MM-DD. */
  due: string | null
  href: string | null
  openedBy: string
  openedAt: string
  updatedAt: string
  /** When it entered the stage it is in. */
  stagedAt: string
  history: ItemEvent[]
}

/** A partner's events, oldest first, folded into its items and its account owner. */
export function fold(partner: string, events: DeliveryEvent[]): { items: Item[]; owner: string | null } {
  const items = new Map<string, Item>()
  let owner: string | null = null
  for (const e of events) {
    if (e.ev === "account") {
      owner = e.owner
      continue
    }
    if (e.ev === "open") {
      items.set(e.item, { id: e.item, partner, type: e.type, title: e.title, detail: e.detail, stage: e.stage, owner: e.owner, due: e.due, href: null, openedBy: e.by, openedAt: e.at, updatedAt: e.at, stagedAt: e.at, history: [e] })
      continue
    }
    const it = items.get(e.item)
    if (!it) continue
    it.history.push(e)
    it.updatedAt = e.at
    if (e.ev === "stage" && e.stage !== it.stage) {
      it.stage = e.stage
      it.stagedAt = e.at
    }
    if (e.ev === "assign") it.owner = e.owner
    if (e.ev === "due") it.due = e.due
    if (e.ev === "link") it.href = e.href
  }
  return { items: [...items.values()], owner }
}

export const isOpen = (it: Item) => it.stage !== "delivered"
/** Past its due date while still PAX's to finish. */
export const isOverdue = (it: Item, today: string) => !!it.due && it.due < today && (it.stage === "requested" || it.stage === "production")
/** Whole days from a to b (YYYY-MM-DD or ISO). */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86_400_000)

/** Most urgent first: overdue by how late, then by due date, then the oldest untouched. */
export function byUrgency(today: string) {
  const rank = (it: Item) => (isOverdue(it, today) ? 0 : it.due ? 1 : 2)
  return (a: Item, b: Item) => rank(a) - rank(b) || (a.due ?? "").localeCompare(b.due ?? "") || a.updatedAt.localeCompare(b.updatedAt)
}

export type Health = "overdue" | "risk" | "track" | "idle"
export const HEALTH_LABEL: Record<Health, string> = { overdue: "Overdue", risk: "At risk", track: "On track", idle: "Idle" }

/** An account's state: overdue work; work due within two days or waiting on the partner more than five; work moving; or none open. */
export function healthOf(items: Item[], today: string): Health {
  const open = items.filter(isOpen)
  if (open.some((it) => isOverdue(it, today))) return "overdue"
  const soon = (it: Item) => (it.stage === "requested" || it.stage === "production") && !!it.due && daysBetween(today, it.due) <= 2
  const stalled = (it: Item) => it.stage === "review" && daysBetween(it.stagedAt, today) > 5
  if (open.some((it) => soon(it) || stalled(it))) return "risk"
  return open.length ? "track" : "idle"
}

/** Someone on an account, as the board shows them. */
export type Person = { email: string; name: string; photo?: string }

/** A message test whose arms are the partner's videos. */
export type TestRow = { id: string; title: string; /** Its lifecycle state (lib/lifecycle), the word every screen shows. */ state: LifeState; arms: number; updatedAt?: string }

/** A partner video with a published result: its best outcome. */
export type ResultRow = { clipId: string; title: string; study: string; outcome: string; lift: number; persuasive: boolean }

export type Account = {
  id: string
  name: string
  image: string | null
  youtube: string | null
  /** The partner's own people with a login. */
  contacts: Person[]
  /** The PAX admin who owns the account. */
  owner: string | null
  /** Videos on the partner's desk in Clips. */
  desk: number
  tests: TestRow[]
  results: ResultRow[]
  items: Item[]
}
