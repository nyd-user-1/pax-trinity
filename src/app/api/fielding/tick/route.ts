import { NextResponse } from "next/server"

import { currentUser } from "@/lib/auth"
import { armName } from "@/lib/fielding/arms"
import { tick } from "@/lib/fielding/engine"
import { flowsTick } from "@/lib/flows/engine"
import { liveDeps } from "@/lib/flows/live"
import { origin } from "@/lib/mail/send"

// POST /api/fielding/tick: one pass over the fieldings (reminders, then the close at
// quota or deadline), then one over the marketing flows (lib/flows/engine.ts: each
// enrolled user's next due step, at most one a day). Run by a signed-in admin's Inbox when it opens and every minute
// while it is open. No scheduler calls it yet; one that does would send
// x-tick-secret: FIELDING_TICK_SECRET (unset today, so only admins can tick).

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const secret = process.env.FIELDING_TICK_SECRET
  const byCron = Boolean(secret) && request.headers.get("x-tick-secret") === secret
  if (!byCron && !(await currentUser())?.admin) return NextResponse.json({ error: "Admins only." }, { status: 401 })
  const base = origin(request)
  let ran: Awaited<ReturnType<typeof tick>>
  try {
    ran = await tick(base, armName)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "tick failed" }, { status: 500 })
  }
  // The flows pass runs after the fielding work and can't undo it: its own failure is reported beside the result.
  let flows: Awaited<ReturnType<typeof flowsTick>> | { error: string }
  try {
    flows = await flowsTick(base, liveDeps())
  } catch (error) {
    flows = { error: error instanceof Error ? error.message : "flows tick failed" }
  }
  return NextResponse.json({ ran, flows })
}
