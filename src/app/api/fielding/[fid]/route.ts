import { NextResponse } from "next/server"

import { currentUser } from "@/lib/auth"
import { armName } from "@/lib/fielding/arms"
import { closeNow, linkFor, summary } from "@/lib/fielding/engine"
import { events, type InviteEvent } from "@/lib/fielding/store"
import { origin } from "@/lib/mail/send"

// GET /api/fielding/<fid>: one fielding's counts and each invitation with its link.
// POST /api/fielding/<fid> { action: "close" }: close it now. Admins only.

export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: Promise<{ fid: string }> }) {
  if (!(await currentUser())?.admin) return NextResponse.json({ error: "Admins only." }, { status: 401 })
  const { fid } = await params
  const s = await summary(fid)
  if (!s) return NextResponse.json({ error: "No such fielding." }, { status: 404 })
  const base = origin(request)
  const invites = (await events(fid)).filter((e): e is InviteEvent => e.kind === "invite").map((i) => ({ ...i, link: linkFor(s.def, i.pid, base), armName: i.arm ? armName(i.arm) : undefined }))
  return NextResponse.json({ ...s, invites })
}

export async function POST(request: Request, { params }: { params: Promise<{ fid: string }> }) {
  if (!(await currentUser())?.admin) return NextResponse.json({ error: "Admins only." }, { status: 401 })
  const { fid } = await params
  const body = (await request.json().catch(() => ({}))) as { action?: string }
  if (body.action !== "close") return NextResponse.json({ error: "action must be close" }, { status: 400 })
  return NextResponse.json({ closed: await closeNow(fid, origin(request), armName) })
}
