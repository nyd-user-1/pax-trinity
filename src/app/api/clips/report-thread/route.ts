import { NextResponse } from "next/server"

import { currentUser, forbidDemo } from "@/lib/auth"
import { now, putOnce, query } from "@/lib/ledger"
import { memberByEmail } from "@/lib/roles"

// A report's thread (Brendan, 2026-11-01): the readout reads as mail, and an edit never touches
// the original — it is a new message on the thread, a whole version of the report, so the trail
// is immutable and the ledger is the history. Merging parallel threads comes later.
//
//   pk                 sk       item
//   RPTV#<thread>      <iso>    a version: body (markdown), author
//
// <thread> is the register's result set id and the arm's, joined by "~", so a wave's readout for
// one cut is one thread. Reads need a signed-in account; writes an admin.

export const dynamic = "force-dynamic"

const THREAD = /^[\w .:~-]{1,160}$/
const key = (t: string) => `RPTV#${t}`

export type ReportVersion = { at: string; author: string; body: string }

export async function GET(request: Request) {
  if (!(await currentUser())) return NextResponse.json({ error: "Sign in to read the thread." }, { status: 401 })
  const t = new URL(request.url).searchParams.get("t") ?? ""
  if (!THREAD.test(t)) return NextResponse.json({ error: "That thread id does not read." }, { status: 400 })
  const rows = await query<{ pk: string; sk: string; author?: string; body?: string }>(key(t))
  const versions: ReportVersion[] = rows.map((r) => ({ at: r.sk, author: String(r.author ?? ""), body: String(r.body ?? "") }))
  return NextResponse.json({ versions })
}

export async function POST(request: Request) {
  const user = await currentUser()
  if (!user?.admin) return NextResponse.json({ error: "Sign in as an admin to save a version." }, { status: 401 })
  forbidDemo(user)
  const { t, body } = (await request.json().catch(() => ({}))) as { t?: string; body?: string }
  if (!THREAD.test(String(t ?? ""))) return NextResponse.json({ error: "That thread id does not read." }, { status: 400 })
  const text = String(body ?? "").slice(0, 100_000)
  if (!text.trim()) return NextResponse.json({ error: "The version is empty." }, { status: 400 })
  const at = now()
  const author = memberByEmail(user.email)?.name ?? user.email.split("@")[0]
  const version: ReportVersion = { at, author, body: text }
  if (!(await putOnce({ pk: key(String(t)), sk: at, ...version }))) return NextResponse.json({ error: "Two saves landed in the same instant; try again." }, { status: 409 })
  return NextResponse.json({ version })
}
