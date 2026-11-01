import { NextResponse } from "next/server"

import { currentUser } from "@/lib/auth"
import { enroll } from "@/lib/flows/engine"
import { liveDeps } from "@/lib/flows/live"

// POST /api/flows/enroll { path }: a signed-in user's visit enrolls them in the flow that teaches that page
// (lib/flows/engine.ts), once. The shell sends it on each main-pane arrival and never waits on it, so the
// answer is 204 whatever happened: enrolled, already enrolled, no flow for the page, or a demo account,
// whose enrollments are never written.

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { path?: unknown } | null
  const path = typeof body?.path === "string" ? body.path : ""
  if (path.startsWith("/") && path.length <= 500) {
    try {
      await enroll(user, path, liveDeps())
    } catch (error) {
      console.error("flows enroll failed", error instanceof Error ? error.message : error)
    }
  }
  return new Response(null, { status: 204 })
}
