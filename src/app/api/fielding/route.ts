import { NextResponse } from "next/server"

import { currentUser } from "@/lib/auth"
import { armName } from "@/lib/fielding/arms"
import { readout, startFielding, summary } from "@/lib/fielding/engine"
import { fieldingIds } from "@/lib/fielding/store"
import { origin } from "@/lib/mail/send"
import { videoOf, type VideoState } from "@/lib/results/video"

// GET /api/fielding: every fielding with its counts, for the Inbox's live threads. A closed test's
// readout carries its result video, as its mail did (lib/results/video.ts).
// POST /api/fielding: the Pollster fields a test or a survey to a contact group
// ({ type, target, group, quota?, closeAt?, remindAfterHours?, finalBeforeHours? }). Admins only.

export const dynamic = "force-dynamic"

export async function GET() {
  if (!(await currentUser())?.admin) return NextResponse.json({ error: "Admins only." }, { status: 401 })
  try {
    const all = (await Promise.all((await fieldingIds()).map((fid) => summary(fid)))).filter((s) => s !== null)
    const fieldings = await Promise.all(
      all.map(async (s) => {
        const video: VideoState = s.report && s.def.type === "test" ? await videoOf(s.def.target).catch((): VideoState => ({ state: "none" })) : { state: "none" }
        return { ...s, arms: s.arms.map((a) => ({ ...a, name: a.arm ? armName(a.arm) : "" })), readout: s.report ? readout(s.def, s.report, armName, video) : null }
      }),
    )
    return NextResponse.json({ fieldings })
  } catch (error) {
    return NextResponse.json({ fieldings: [], error: error instanceof Error ? error.message : "unreadable" })
  }
}

export async function POST(request: Request) {
  if (!(await currentUser())?.admin) return NextResponse.json({ error: "Admins only." }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as { type?: string; target?: string; group?: string; quota?: number; closeAt?: string; remindAfterHours?: number; finalBeforeHours?: number }
  if ((body.type !== "test" && body.type !== "survey") || !body.target || !body.group) return NextResponse.json({ error: "type (test or survey), target and group are required." }, { status: 400 })
  try {
    return NextResponse.json(await startFielding({ type: body.type, target: body.target, group: body.group, quota: body.quota, closeAt: body.closeAt, remindAfterHours: body.remindAfterHours, finalBeforeHours: body.finalBeforeHours, base: origin(request) }))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not field it." }, { status: 400 })
  }
}
