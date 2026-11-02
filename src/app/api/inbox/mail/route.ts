import { NextResponse } from "next/server"

import { currentUser } from "@/lib/auth"
import { isFolderView, mailboxRows, patchThread, personMailbox, returnSnoozed, threadPatchOf, threadsOf, unreadCounts } from "@/lib/mail/store"
import { orgBox } from "@/lib/partners/mailboxes"
import { lensOf } from "@/lib/partners/sponsors"

// The Inbox's kept mail (lib/mail/store.ts, Brendan 2026-11-02): a mailbox's folder as threads.
//
//   GET /api/inbox/mail?mailbox=<me|email|slug>&folder=<inbox|sent|drafts|starred|snoozed|trash|all>
//   → { mailbox, threads: [{ threadId, messages: [rows], latest, unreadCount }], counts }, newest latest
//   first; counts is each folder's unread threads, so one call refreshes the folder list too. A snooze that
//   has run out comes back on the read, once: unread, and on top of the inbox (returnedAt).
//
//   PATCH /api/inbox/mail { mailbox, threadId, read?, starred?, important?, trashed?, archived?, snoozedUntil? }
//   → { mailbox, threadId, updated }: the thread's rows in that mailbox take the change (opening a
//   thread is what marks it read); snoozedUntil null clears a snooze. 404 when the mailbox holds no such thread.
//
// "me" (the default) is the signed-in person's own mailbox. A partner may also open its organization's
// (org:<id>). An agent's mailbox (tracker, bill-reader, assistant), another person's or another organization's
// is the super admin's alone; anyone else gets 403. The folder defaults
// to inbox.

type User = NonNullable<Awaited<ReturnType<typeof currentUser>>>

/** The mailbox a request names, for this user: their own, or (for the super admin alone) any. */
function mailboxFor(user: User, asked: unknown): { mailbox: string } | { status: number; error: string } {
  const own = personMailbox(user.email)
  const a = (typeof asked === "string" ? asked : "me").trim().toLowerCase()
  const mailbox = !a || a === "me" ? own : a.includes("@") ? personMailbox(a) : a
  // A partner opens its own organization's mailbox beside its own (lib/partners/mailboxes.ts, 2026-11-02).
  const org = orgBox(mailbox)
  const theirOrg = !!org && org.box === mailbox && lensOf(user) === org.org
  if (mailbox !== own && !user.superAdmin && !theirOrg) return { status: 403, error: "Only the super admin reads another mailbox." }
  return { mailbox }
}

export async function GET(request: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Sign in to read mail." }, { status: 401 })
  const params = new URL(request.url).searchParams
  const box = mailboxFor(user, params.get("mailbox") ?? "me")
  if ("error" in box) return NextResponse.json({ error: box.error }, { status: box.status })
  const { mailbox } = box
  const folder = params.get("folder") ?? "inbox"
  if (!isFolderView(folder)) return NextResponse.json({ error: "folder is inbox, sent, drafts, starred, snoozed, trash or all" }, { status: 400 })
  try {
    const now = new Date().toISOString()
    const rows = await returnSnoozed(await mailboxRows(mailbox), now)
    return NextResponse.json({ mailbox, threads: threadsOf(rows, folder, now), counts: unreadCounts(rows, now) })
  } catch (error) {
    console.error("inbox mail: unreadable", error)
    return NextResponse.json({ error: "The mail could not be read just now." }, { status: 503 })
  }
}

export async function PATCH(request: Request) {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: "Sign in to file mail." }, { status: 401 })
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body !== "object") return NextResponse.json({ error: "expected a JSON body" }, { status: 400 })
  const box = mailboxFor(user, body.mailbox ?? "me")
  if ("error" in box) return NextResponse.json({ error: box.error }, { status: box.status })
  const threadId = typeof body.threadId === "string" ? body.threadId.trim() : ""
  if (!threadId) return NextResponse.json({ error: "threadId is required" }, { status: 400 })
  const patch = threadPatchOf(body)
  if (!patch.ok) return NextResponse.json({ error: patch.error }, { status: 400 })
  try {
    const updated = await patchThread(box.mailbox, threadId, patch.patch)
    if (!updated) return NextResponse.json({ error: "No such thread in that mailbox." }, { status: 404 })
    return NextResponse.json({ mailbox: box.mailbox, threadId, updated })
  } catch (error) {
    console.error("inbox mail: not filed", error)
    return NextResponse.json({ error: "The mail could not be filed just now." }, { status: 503 })
  }
}
