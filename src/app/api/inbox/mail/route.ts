import { NextResponse } from "next/server"

import { currentUser } from "@/lib/auth"
import { isFolderView, mailboxRows, personMailbox, threadsOf } from "@/lib/mail/store"

// The Inbox's kept mail (lib/mail/store.ts, Brendan 2026-11-02): a mailbox's folder as threads.
//
//   GET /api/inbox/mail?mailbox=<me|email|slug>&folder=<inbox|sent|drafts|starred|snoozed|trash|all>
//   → { mailbox, threads: [{ threadId, messages: [rows], latest, unreadCount }] }, newest latest first
//
// "me" (the default) is the signed-in person's own mailbox. An agent's mailbox (tracker, bill-reader,
// assistant) or another person's is the super admin's alone; anyone else gets 403. The folder defaults
// to inbox.

export async function GET(request: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Sign in to read mail." }, { status: 401 })
  const params = new URL(request.url).searchParams
  const own = personMailbox(user.email)
  const asked = (params.get("mailbox") ?? "me").trim().toLowerCase()
  const mailbox = !asked || asked === "me" ? own : asked.includes("@") ? personMailbox(asked) : asked
  if (mailbox !== own && !user.superAdmin) return NextResponse.json({ error: "Only the super admin reads another mailbox." }, { status: 403 })
  const folder = params.get("folder") ?? "inbox"
  if (!isFolderView(folder)) return NextResponse.json({ error: "folder is inbox, sent, drafts, starred, snoozed, trash or all" }, { status: 400 })
  try {
    return NextResponse.json({ mailbox, threads: threadsOf(await mailboxRows(mailbox), folder) })
  } catch (error) {
    console.error("inbox mail: unreadable", error)
    return NextResponse.json({ error: "The mail could not be read just now." }, { status: 503 })
  }
}
