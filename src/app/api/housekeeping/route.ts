import { NextResponse } from "next/server"

import { currentUser, forbidDemo } from "@/lib/auth"
import { canonical, dmKey, forClaude, getMessage, listThread, nameOf, openOnRoute, PEOPLE, post, reply, update } from "@/lib/housekeeping"
import { CLAUDE, forReader } from "@/lib/housekeeping-thread"

// Housekeeping's API (lib/housekeeping.ts). Signed-in admins read the stream and their own direct
// messages, and post to either; only the super admin edits or resolves.
//   GET   ?with=<email>                      a thread: the stream, or the direct messages with one person
//   GET   ?route=<path>                       the unresolved pointed comments on one page, for its markers
//   GET   ?claude=1                           the comments with Claude, with prompt, bundle, route, images
//                                             and replies so far (the super admin, or the dev server)
//   POST  { text, to?, kind, page, … }       a message or a pointed comment, screenshots as data URLs
//   POST  { kind: "reply", pk, sk, text }     a person's reply on a message's thread
//   POST  { kind: "claude-reply", pk, sk, text, commit?, diff? }  Claude's reply on a comment with Claude
//                                             or already answered (a follow-up): answers it, its commit and
//                                             unified diff beside it (the super admin, or the dev server)
//   PATCH { pk, sk, status?, text?, prompt? } resolve / reopen / send to Claude ("claude", a pointed
//                                             comment) / edit the text or the prompt (super admin)
// The prompt beside each comment, the locator bundle, Claude's replies (with their commit and diff) and the "claude" and "answered"
// statuses reach the super admin only: every thread read goes through forReader
// (lib/housekeeping-thread.ts), and the page markers carry no status.

export const runtime = "nodejs"

async function admin() {
  const user = await currentUser()
  return user?.admin ? user : null
}

const known = (email: string) => PEOPLE.some((p) => p.email === email.toLowerCase())

/** The loop's side (GET ?claude=1, claude-reply): the super admin, or the dev server, where the session
 *  acting for Claude reaches the API. A production build runs with NODE_ENV=production, so no deploy
 *  takes the second. */
const claudeSide = (user: { superAdmin: boolean }) => user.superAdmin || process.env.NODE_ENV === "development"

/** Whether this person reads the partition: the stream, or a direct-message thread they are in. */
const reads = (pk: string, email: string) => pk === "STREAM" || (pk.startsWith("DM#") && pk.slice(3).split("|").includes(canonical(email)))

export async function GET(req: Request) {
  const user = await admin()
  if (!user) return NextResponse.json({ error: "Admins only." }, { status: 403 })
  const params = new URL(req.url).searchParams
  // ?me=1: who is asking, alone (the pointer's pin initial).
  // The main address, so a super admin signed in by Gmail reads as himself.
  const me = { email: canonical(user.email), superAdmin: user.superAdmin, name: nameOf(user.email) }
  if (params.get("me")) return NextResponse.json({ me: { ...me, photo: PEOPLE.find((p) => p.email === me.email)?.photo } })
  if (params.get("claude")) {
    if (!claudeSide(user)) return NextResponse.json({ error: "The super admin only." }, { status: 403 })
    try {
      return NextResponse.json({ comments: await forClaude() })
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
  }
  const route = params.get("route")
  if (route) {
    try {
      const open = await openOnRoute(route, user.email)
      const marks = open.map((m) => ({ id: m.id, pk: m.pk, sk: m.sk, path: m.path, target: m.target, point: m.point, author: m.author, authorName: m.authorName, photo: PEOPLE.find((p) => p.email === m.author)?.photo, text: m.text.slice(0, 140) }))
      return NextResponse.json({ marks })
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
  }
  const withEmail = params.get("with")
  if (withEmail && !known(withEmail)) return NextResponse.json({ error: "Not someone in Housekeeping." }, { status: 400 })
  const pk = withEmail ? dmKey(user.email, withEmail) : "STREAM"
  try {
    const messages = forReader(await listThread(pk), user.superAdmin)
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
    pk?: string
    sk?: string
    commit?: string
    diff?: string
    text?: string
    to?: string | null
    kind?: "comment" | "message" | "reply" | "claude-reply"
    page?: string
    route?: string
    target?: string
    path?: string
    bundle?: string
    point?: { xf: number; yf: number }
    images?: { mime: string; data: string }[]
  } | null
  if (!body) return NextResponse.json({ error: "The body is not JSON." }, { status: 400 })
  if (body.kind === "reply" || body.kind === "claude-reply") {
    const byClaude = body.kind === "claude-reply"
    if (!body.pk || !body.sk) return NextResponse.json({ error: "Which message?" }, { status: 400 })
    if (!(body.text ?? "").trim()) return NextResponse.json({ error: "Nothing to send." }, { status: 400 })
    if (byClaude ? !claudeSide(user) : !reads(body.pk, user.email)) return NextResponse.json({ error: byClaude ? "The super admin only." : "Not a thread you are in." }, { status: 403 })
    try {
      const r = await reply({ pk: body.pk, sk: body.sk }, byClaude ? { author: CLAUDE, text: body.text!, commit: body.commit, diff: body.diff } : { author: user.email, text: body.text! })
      const [shown] = forReader([{ ...r.reply, status: r.status }], user.superAdmin)
      return NextResponse.json({ reply: r.reply, status: shown.status })
    } catch (e) {
      const m = (e as Error).message
      return NextResponse.json({ error: m }, { status: /not with Claude/.test(m) ? 409 : /No such/.test(m) ? 404 : 500 })
    }
  }
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
  const body = (await req.json().catch(() => null)) as { pk?: string; sk?: string; status?: "open" | "resolved" | "claude"; text?: string; prompt?: string } | null
  if (!body?.pk || !body.sk) return NextResponse.json({ error: "Which message?" }, { status: 400 })
  if (body.status && body.status !== "open" && body.status !== "resolved" && body.status !== "claude") return NextResponse.json({ error: "status is open, resolved or claude." }, { status: 400 })
  if (body.status === "claude") {
    const m = await getMessage({ pk: body.pk, sk: body.sk }).catch(() => null)
    if (m?.kind !== "comment") return NextResponse.json({ error: "Only a pointed comment goes to Claude." }, { status: 400 })
  }
  try {
    await update({ pk: body.pk, sk: body.sk }, { status: body.status, text: body.text, prompt: body.prompt }, user.email)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
