import { NextResponse } from "next/server"

import { currentUser } from "@/lib/auth"
import { armName } from "@/lib/fielding/arms"
import { tick } from "@/lib/fielding/engine"
import { origin } from "@/lib/mail/send"

// POST /api/fielding/tick: one pass over the fieldings (reminders, then the close at
// quota or deadline). Run by a signed-in admin's Inbox when it opens and every minute
// while it is open. No scheduler calls it yet; one that does would send
// x-tick-secret: FIELDING_TICK_SECRET (unset today, so only admins can tick).

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const secret = process.env.FIELDING_TICK_SECRET
  const byCron = Boolean(secret) && request.headers.get("x-tick-secret") === secret
  if (!byCron && !(await currentUser())?.admin) return NextResponse.json({ error: "Admins only." }, { status: 401 })
  try {
    return NextResponse.json({ ran: await tick(origin(request), armName) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "tick failed" }, { status: 500 })
  }
}
