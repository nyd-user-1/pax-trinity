import type { FolderView, MailThread, ThreadPatch } from "@/lib/mail/store"

// The Inbox's side of the kept mail (Brendan, 2026-11-02: the inbox becomes Gmail, the server its
// one source): reading a mailbox's folder through /api/inbox/mail, filing a thread there, and the
// small rules the list needs between a filing and the next read. Client-safe: only types come from
// lib/mail/store.ts, whose own rules this mirrors where the list must move before the server answers.

export type KeptMessage = MailThread["messages"][number]
export type Kept = MailThread
/** Each folder's unread threads, as the API counts them. */
export type Counts = Partial<Record<FolderView, number>>
export type Filing = ThreadPatch

/** The three agents' mailboxes, in the chip's order, with the AgentMail address each keeps. */
export const AGENT_BOXES = [
  { box: "assistant", name: "Pax", email: "pax-assistant@agentmail.to" },
  { box: "tracker", name: "Pollster", email: "pax-pollster@agentmail.to" },
  { box: "bill-reader", name: "Analyst", email: "pax-analyst@agentmail.to" },
] as const

export const isAgentBox = (box: string) => AGENT_BOXES.some((a) => a.box === box)

/** One folder of one mailbox ("me", or an agent's slug for the super admin), with every folder's unread count. */
export async function readFolder(mailbox: string, folder: FolderView): Promise<{ mailbox: string; threads: Kept[]; counts: Counts }> {
  const res = await fetch(`/api/inbox/mail?mailbox=${encodeURIComponent(mailbox)}&folder=${folder}`, { cache: "no-store" })
  const body = (await res.json().catch(() => ({}))) as { mailbox?: string; threads?: Kept[]; counts?: Counts; error?: string }
  if (!res.ok) throw new Error(body.error || `The mail could not be read (${res.status}).`)
  return { mailbox: body.mailbox ?? mailbox, threads: body.threads ?? [], counts: body.counts ?? {} }
}

/** Files a thread in a mailbox: read, starred, important, archived, trashed, snoozed. True when the server took it. */
export async function fileThread(mailbox: string, threadId: string, patch: Filing): Promise<boolean> {
  try {
    const res = await fetch("/api/inbox/mail", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mailbox, threadId, ...patch }) })
    return res.ok
  } catch {
    return false
  }
}

/** A row in a folder, now: lib/mail/store.ts's inFolder, so a filing moves the list before the server answers. */
function rowIn(m: KeptMessage, folder: FolderView, now: string): boolean {
  const snoozed = !!m.snoozedUntil && m.snoozedUntil > now
  switch (folder) {
    case "inbox":
      return m.folder === "inbox" && !m.trashed && !m.archived && !snoozed
    case "sent":
      return m.folder === "sent" && !m.trashed
    case "drafts":
      return m.folder === "drafts" && !m.trashed
    case "starred":
      return m.starred && !m.trashed
    case "snoozed":
      return snoozed && !m.trashed
    case "trash":
      return m.trashed
    case "all":
      return !m.trashed
  }
}

/** Whether a thread still shows in a folder: any of its rows does. */
export const showsIn = (t: Kept, folder: FolderView, now = new Date().toISOString()) => t.messages.some((m) => rowIn(m, folder, now))

/** A filing as the server makes it: every row of the thread in this mailbox takes the change. */
export function applyFiling(t: Kept, patch: Filing): Kept {
  const messages = t.messages.map((m) => {
    const { snoozedUntil, ...rest } = patch
    const next: KeptMessage = { ...m, ...rest }
    if (snoozedUntil === null) delete next.snoozedUntil
    else if (snoozedUntil) next.snoozedUntil = snoozedUntil
    return next
  })
  return { ...t, messages, latest: messages[messages.length - 1], unreadCount: messages.filter((m) => !m.read).length }
}

/** The thread's marks as the row shows them. */
export function marksOf(t: Kept, now = new Date().toISOString()) {
  const until = t.messages.map((m) => m.snoozedUntil ?? "").filter((s) => s > now).sort().at(-1)
  return {
    unread: t.unreadCount > 0,
    starred: t.messages.some((m) => m.starred),
    important: t.messages.some((m) => m.important),
    trashed: t.messages.every((m) => m.trashed),
    // Out of the Inbox by hand: a received row archived and none left in it. Gmail's Move to Inbox.
    archived: t.messages.some((m) => m.folder === "inbox" && m.archived) && !t.messages.some((m) => m.folder === "inbox" && !m.archived && !m.trashed),
    snoozedUntil: until || null,
  }
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** Gmail's list time: the time today, the month and day this year, the short date before. */
export function listTime(iso: string, now = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  if (sameDay(d, now)) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  return d.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" })
}

/** A snooze's time as Gmail's menu and the Snoozed folder say it: "6:00 PM" today, "Tue, 8:00 AM" this coming week, else "Nov 20, 8:00 AM". */
export function snoozeTime(at: Date, now = new Date()): string {
  const time = at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  if (sameDay(at, now)) return time
  // Within the coming week the weekday names it (next Monday included), past that the date.
  const week = at.getTime() - now.getTime() < 8 * 86_400_000
  return week ? `${at.toLocaleDateString("en-US", { weekday: "short" })}, ${time}` : `${at.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`
}

export type SnoozeChoice = { key: "later" | "tomorrow" | "weekend" | "week"; label: string; at: Date }

/** Gmail's snooze presets: later today at 6 PM (until 5), tomorrow at 8 AM, Saturday at 8 AM on a weekday, next Monday at 8 AM. */
export function snoozeChoices(now = new Date()): SnoozeChoice[] {
  const at = (days: number, hour: number) => {
    const d = new Date(now)
    d.setDate(d.getDate() + days)
    d.setHours(hour, 0, 0, 0)
    return d
  }
  const day = now.getDay()
  const out: SnoozeChoice[] = []
  if (now.getHours() < 17) out.push({ key: "later", label: "Later today", at: at(0, 18) })
  out.push({ key: "tomorrow", label: "Tomorrow", at: at(1, 8) })
  if (day >= 1 && day <= 5) out.push({ key: "weekend", label: "This weekend", at: at(6 - day, 8) })
  out.push({ key: "week", label: "Next week", at: at((8 - day) % 7 || 7, 8) })
  return out
}
