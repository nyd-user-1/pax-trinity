import { NextResponse } from "next/server"

import { currentUser } from "@/lib/auth"
import { ingestAgentMail } from "@/lib/mail/inbound"

// GET /api/inbox/ingest: read the agents' AgentMail inboxes for new mail and keep it in their mailboxes
// (lib/mail/inbound.ts). The super admin's alone; the fielding tick runs the same pass.
//   → { [slug]: { listed, written, already, watermark, error? } }

export const dynamic = "force-dynamic"

export async function GET() {
  const user = await currentUser()
  if (!user?.superAdmin) return NextResponse.json({ error: "The super admin's alone." }, { status: 403 })
  return NextResponse.json(await ingestAgentMail())
}
