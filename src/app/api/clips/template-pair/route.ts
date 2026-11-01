import { NextResponse } from "next/server"

import { currentUser } from "@/lib/auth"
import { drawPair, FROM, offerPair, RECORDING, recordPick, type From } from "@/lib/clips/template-pair"
import { now, putOnce, query } from "@/lib/ledger"

// The template pair's door (lib/clips/template-pair.ts): POST { recording, from } answers the recording's
// two templates, drawn and written once; POST { recording, from, shown, picked } writes a pick. Signed in
// only. A demo account sees a pair and picks as anyone does, and nothing it does is written: the demo world
// stays out of the experiment.

export const dynamic = "force-dynamic"

const ledger = { query, putOnce, now }

export async function POST(request: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Sign in to use a template." }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as { recording?: unknown; from?: unknown; shown?: unknown; picked?: unknown }
  const recording = String(body.recording ?? "")
  if (!RECORDING.test(recording)) return NextResponse.json({ error: "That recording id does not read." }, { status: 400 })
  const from = (FROM as readonly unknown[]).includes(body.from) ? (body.from as From) : "record"

  if (body.picked === undefined) {
    if (user.demo) return NextResponse.json({ shown: drawPair() })
    const { shown } = await offerPair(recording, from, ledger)
    return NextResponse.json({ shown })
  }

  if (user.demo) return NextResponse.json({ ok: true })
  const r = await recordPick(recording, { shown: body.shown, picked: body.picked, owner: user.email, from }, ledger)
  if (r === "bad") return NextResponse.json({ error: "That pick is not one of the templates shown." }, { status: 400 })
  if (r === "clash") return NextResponse.json({ error: "Two picks landed in the same instant; try again." }, { status: 409 })
  return NextResponse.json({ ok: true })
}
