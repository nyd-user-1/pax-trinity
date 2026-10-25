import { NextResponse, type NextRequest } from "next/server"

import { viewerOf } from "@/lib/clips/server"
import { COMMON_GROUND, STATEMENTS } from "@/lib/consensus/common-ground"
import { COOKIE, MIN_READ_MS, cookieOptions, deal, ipHash, readGround, ticketHolds, writeGround, type Ground } from "@/lib/consensus/ticket"
import { q } from "@/lib/policy/db"

// Common Ground's card (2026-09-24).
//
//   GET   the next statement for this reader, dealt at random, with its ticket;
//         the month's count of answers, from the read cache (an hour old at most)
//   POST  { tid, issued, ticket, answer: "agree" | "disagree" | "pass" }
//         records the answer and deals the next one in the same response
//
// Dealing reads nothing: the reader's answered statements ride in a signed
// cookie. Only an answer, which is a click, writes to the database.

export const dynamic = "force-dynamic"

const ANSWER = { agree: 1, disagree: -1, pass: 0 } as const

async function monthTotal() {
  try {
    const [row] = await q<{ n: number }>(`select count(*)::int as n from consensus_votes where slug = $1 and counted and month = date_trunc('month', now())::date`, [COMMON_GROUND.slug])
    return row ? Number(row.n) : 0
  } catch {
    return null
  }
}

function reply(g: Ground, body: Record<string, unknown>) {
  const res = NextResponse.json({ ...body, dealt: deal(g), answered: g.answered.length, of: STATEMENTS.length })
  res.cookies.set(COOKIE, writeGround(g), cookieOptions)
  return res
}

export async function GET(request: NextRequest) {
  const viewer = await viewerOf()
  const g = readGround(request.cookies.get(COOKIE)?.value, viewer?.id ?? null)
  return reply(g, { total: await monthTotal() })
}

export async function POST(request: NextRequest) {
  const viewer = await viewerOf()
  const g = readGround(request.cookies.get(COOKIE)?.value, viewer?.id ?? null)
  const body = (await request.json().catch(() => null)) as { tid?: number; issued?: number; ticket?: string; answer?: keyof typeof ANSWER } | null
  const tid = Number(body?.tid)
  const issued = Number(body?.issued)
  if (!body || !(body.answer! in ANSWER) || !STATEMENTS.some((s) => s.tid === tid) || !ticketHolds(g, tid, issued, String(body.ticket ?? ""))) {
    return NextResponse.json({ error: "That statement was not dealt to you." }, { status: 400 })
  }
  if (g.answered.includes(tid)) return reply(g, { counted: false })

  const read = Date.now() - issued >= MIN_READ_MS
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null
  const month = `${g.month}-01`
  let counted = false
  try {
    const rows = await q<{ counted: boolean }>(
      `insert into consensus_votes (slug, tid, voter, answer, month, ip_hash, counted)
       values ($1, $2, $3, $4, $5::date, $6, $7::boolean and (select count(*) from consensus_votes where slug = $1 and tid = $2 and month = $5::date and ip_hash = $6) < 3)
       on conflict (slug, tid, voter, month) do nothing
       returning counted`,
      [COMMON_GROUND.slug, tid, g.voter, ANSWER[body.answer!], month, ipHash(ip, g.month), read],
    )
    counted = rows[0]?.counted === true
  } catch (error) {
    console.error("common ground: answer not stored", error)
    return NextResponse.json({ error: "The answer could not be stored. Try again in a moment." }, { status: 503 })
  }
  g.answered = [...g.answered, tid]
  return reply(g, { counted })
}
