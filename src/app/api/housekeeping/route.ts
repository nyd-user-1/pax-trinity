import { NextResponse } from "next/server"

import { currentUser, forbidDemo } from "@/lib/auth"
import { canonical, dmKey, listThread, nameOf, PEOPLE, post, update } from "@/lib/housekeeping"

// Housekeeping's API (lib/housekeeping.ts). Signed-in admins read the stream and their own direct
// messages, and post to either; only the super admin edits or resolves.
//   GET   ?with=<email>                      a thread: the stream, or the direct messages with one person
//   POST  { text, to?, kind, page, … }       a message or a pointed comment, screenshots as data URLs
//   PATCH { pk, sk, status?, text? }         resolve / reopen / edit (super admin)

export const runtime = "nodejs"

async function admin() {
  const user = await currentUser()
  return user?.admin ? user : null
}

const known = (email: string) => PEOPLE.some((p) => p.email === email.toLowerCase())

export async function GET(req: Request) {
  const user = await admin()
  if (!user) return NextResponse.json({ error: "Admins only." }, { status: 403 })
  const params = new URL(req.url).searchParams
  // ?me=1: who is asking, alone (the pointer's pin initial).
  // The main address, so a super admin signed in by Gmail reads as himself.
  const me = { email: canonical(user.email), superAdmin: user.superAdmin, name: nameOf(user.email) }
  if (params.get("me")) return NextResponse.json({ me })
  const withEmail = params.get("with")
  if (withEmail && !known(withEmail)) return NextResponse.json({ error: "Not someone in Housekeeping." }, { status: 400 })
  const pk = withEmail ? dmKey(user.email, withEmail) : "STREAM"
  try {
    const messages = await listThread(pk)
    return NextResponse.json({ me, people: PEOPLE, messages })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const user = await admin()
  if (!user) return NextResponse.json({ error: "Admins only." }, { status: 403 })
  try {
    forbidDemo(user)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }
  const body = (await req.json().catch(() => null)) as {
    text?: string
    to?: string | null
    kind?: "comment" | "message"
    page?: string
    route?: string
    target?: string
    path?: string
    bundle?: string
    images?: { mime: string; data: string }[]
  } | null
  if (!body) return NextResponse.json({ error: "The body is not JSON." }, { status: 400 })
  const text = (body.text ?? "").trim()
  if (!text && !body.images?.length) return NextResponse.json({ error: "Nothing to send." }, { status: 400 })
  if (body.to && !known(body.to)) return NextResponse.json({ error: "Not someone in Housekeeping." }, { status: 400 })
  try {
    const message = await post({ ...body, author: user.email, text, kind: body.kind === "comment" ? "comment" : "message" })
    return NextResponse.json({ message })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  const user = await currentUser()
  if (!user?.superAdmin) return NextResponse.json({ error: "Only the super admin edits or resolves." }, { status: 403 })
  const body = (await req.json().catch(() => null)) as { pk?: string; sk?: string; status?: "open" | "resolved"; text?: string } | null
  if (!body?.pk || !body.sk) return NextResponse.json({ error: "Which message?" }, { status: 400 })
  if (body.status && body.status !== "open" && body.status !== "resolved") return NextResponse.json({ error: "status is open or resolved." }, { status: 400 })
  try {
    await update({ pk: body.pk, sk: body.sk }, { status: body.status, text: body.text }, user.email)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
