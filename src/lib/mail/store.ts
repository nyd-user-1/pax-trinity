import "server-only"

import { put, putOnce, query } from "@/lib/ledger"
import { memberByEmail } from "@/lib/roles"
import { ulid } from "@/lib/tests/responses"

// The Inbox's mail, kept (Brendan, 2026-11-02: "the agents sent the mail, so the agents need their own
// inboxes"). Rows in the ledger table, which every compute role already holds; nothing in the browser.
//
//   pk                  sk                   item
//   MAIL#<mailbox>      <created iso>#<id>   one message as one mailbox holds it (MailRow)
//   MAIL#<slug>         WATERMARK            an agent's AgentMail high-water mark (inbound)
//
// A mailbox is a person's canonical email (lib/roles.ts) or an agent's slug (tracker, bill-reader,
// assistant). One message is one row per mailbox that holds it: the sender's in sent, each platform
// recipient's in inbox, all under the same id. A thread is the first message's id; replies carry it.
// The rows are written once; reading and filing (read, starred, trashed, archived, snoozed) are the
// only things that change a row. The ledger's own MAIL rows (no #) are lib/mail.ts's outbox, apart.

export type MailParty = { name: string; email: string }
export type MailFolder = "inbox" | "sent" | "drafts"
export type MailSource = "live" | "backfill" | "seed"

export type MailRow = {
  pk: string
  sk: string
  id: string
  threadId: string
  folder: MailFolder
  from: MailParty
  to: MailParty[]
  cc?: MailParty[]
  subject: string
  markdown?: string
  html: string
  /** The first ~120 characters of the text. */
  snippet: string
  createdAt: string
  read: boolean
  starred: boolean
  /** Gmail's importance marker, set by hand. */
  important?: boolean
  trashed: boolean
  archived: boolean
  snoozedUntil?: string
  /** When an expired snooze brought the thread back: it sorts by this, as Gmail floats it to the top. */
  returnedAt?: string
  templateId?: string
  source: MailSource
  /** On the sender's row: the recipients the allowlist held back. */
  held?: string[]
  /** An inbound row's AgentMail ids, so a message is written once and its AgentMail thread stays one. */
  agentmail?: { messageId: string; threadId: string }
}

/** The three agents' mailboxes: the name the Inbox shows and the AgentMail address they send from. */
export const AGENT_MAILBOX: Record<string, MailParty> = {
  tracker: { name: "Pollster", email: "pax-pollster@agentmail.to" },
  "bill-reader": { name: "Analyst", email: "pax-analyst@agentmail.to" },
  assistant: { name: "Pax", email: "pax-assistant@agentmail.to" },
}

export const pkOf = (mailbox: string) => `MAIL#${mailbox}`

/** A person's mailbox: their canonical address (an alias resolves to it), lower-cased. */
export const personMailbox = (email: string) => (memberByEmail(email)?.email ?? email).trim().toLowerCase()

/** The mailbox an address or slug lands in on the platform, or null when it is no platform identity:
 *  an agent (by slug or its AgentMail address) or a member (by any of their addresses). */
export function platformMailbox(addressOrSlug: string): string | null {
  const a = addressOrSlug.trim().toLowerCase()
  if (AGENT_MAILBOX[a]) return a
  const agent = Object.entries(AGENT_MAILBOX).find(([, p]) => p.email === a)
  if (agent) return agent[0]
  const member = memberByEmail(a)
  return member?.email ? member.email.toLowerCase() : null
}

/** A party as the Inbox shows it: an agent by its name, a member by theirs, anyone else by address. */
export function partyOf(address: string): MailParty {
  const box = platformMailbox(address)
  if (box && AGENT_MAILBOX[box]) return AGENT_MAILBOX[box]
  return { name: memberByEmail(address)?.name ?? "", email: address.trim().toLowerCase() }
}

/** The text's first ~120 characters, markdown dropped. */
export function snippetOf(markdown: string): string {
  const text = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[*_`#>~|]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return text.length > 120 ? `${text.slice(0, 119).trimEnd()}…` : text
}

export type Recorded = { id: string; threadId: string; mailboxes: string[] }

export type MessageInput = {
  /** The sender's mailbox: an agent's slug or a person's canonical email. */
  mailbox: string
  from: MailParty
  to: string[]
  cc?: string[]
  subject: string
  markdown?: string
  html: string
  threadId?: string
  templateId?: string
  held?: string[]
  source?: MailSource
  at?: string
  /** A fixed id, so a reconstruction written twice is written once (the backfill). */
  id?: string
  /** Whether the recipients' rows start read (the seed keeps its threads' unread marks). */
  read?: boolean
}

/**
 * A message's rows: the sender's in sent, and an unread inbox row for every platform identity it reached
 * (a member or an agent; a plus-address or an outside address is no one's mailbox here). The sender's own
 * address among the recipients gets no second row: it is in their sent already.
 */
export function messageRows(m: MessageInput): MailRow[] {
  const createdAt = m.at ?? new Date().toISOString()
  const id = m.id ?? ulid(Date.parse(createdAt))
  const threadId = m.threadId || id
  const base = {
    sk: `${createdAt}#${id}`,
    id,
    threadId,
    from: m.from,
    to: m.to.map(partyOf),
    ...(m.cc?.length ? { cc: m.cc.map(partyOf) } : {}),
    subject: m.subject,
    ...(m.markdown != null ? { markdown: m.markdown } : {}),
    html: m.html,
    snippet: snippetOf(m.markdown ?? m.html),
    createdAt,
    starred: false,
    trashed: false,
    archived: false,
    ...(m.templateId ? { templateId: m.templateId } : {}),
    source: m.source ?? "live",
  }
  const rows: MailRow[] = [{ ...base, pk: pkOf(m.mailbox), folder: "sent", read: true, ...(m.held?.length ? { held: m.held } : {}) }]
  const reached = new Set<string>()
  for (const address of [...m.to, ...(m.cc ?? [])]) {
    const box = platformMailbox(address)
    if (box && box !== m.mailbox && !reached.has(box)) reached.add(box)
  }
  for (const box of reached) rows.push({ ...base, pk: pkOf(box), folder: "inbox", read: m.read ?? false })
  return rows
}

/** A message as sent, kept: its rows written once each. */
export async function recordMessage(m: MessageInput): Promise<Recorded> {
  const rows = messageRows(m)
  await Promise.all(rows.map((row) => putOnce(row)))
  return { id: rows[0].id, threadId: rows[0].threadId, mailboxes: rows.map((r) => r.pk.slice(5)) }
}

/** A subject as threads match it: Re:, Fwd: and Fw: prefixes dropped, case and spacing ignored. */
export const subjectKey = (subject: string) =>
  subject
    .replace(/^\s*((re|fwd?|aw|sv)\s*(\[\d+\])?\s*:\s*)+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()

/** Who a message is between, as threads match it: each address as its platform mailbox where it has one
 *  (an alias is its member, an agent's address its slug), the set sorted. */
export const participantsKey = (addresses: string[]) =>
  [...new Set(addresses.map((a) => platformMailbox(a) ?? a.trim().toLowerCase()).filter(Boolean))].sort().join(",")

const partiesOf = (r: Pick<MailRow, "from" | "to" | "cc">) => [r.from.email, ...r.to.map((p) => p.email), ...(r.cc ?? []).map((p) => p.email)]

/** The thread in a mailbox a message joins by subject and participants (a reply arriving from outside,
 *  or an old send reconstructed), or null: the newest such thread when there are several. */
export function threadFor(rows: MailRow[], subject: string, addresses: string[]): string | null {
  const s = subjectKey(subject)
  const p = participantsKey(addresses)
  const match = rows
    .filter((r) => subjectKey(r.subject) === s && participantsKey(partiesOf(r)) === p)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  return match?.threadId ?? null
}

export const FOLDERS = ["inbox", "sent", "drafts", "starred", "snoozed", "trash", "all"] as const
export type FolderView = (typeof FOLDERS)[number]
export const isFolderView = (f: unknown): f is FolderView => typeof f === "string" && (FOLDERS as readonly string[]).includes(f)

/** Whether a row shows in a folder, now. */
export function inFolder(r: MailRow, folder: FolderView, now = new Date().toISOString()): boolean {
  const snoozed = !!r.snoozedUntil && r.snoozedUntil > now
  switch (folder) {
    case "inbox":
      return r.folder === "inbox" && !r.trashed && !r.archived && !snoozed
    case "sent":
      return r.folder === "sent" && !r.trashed
    case "drafts":
      return r.folder === "drafts" && !r.trashed
    case "starred":
      return r.starred && !r.trashed
    case "snoozed":
      return snoozed && !r.trashed
    case "trash":
      return r.trashed
    case "all":
      return !r.trashed
  }
}

export type MailThread = { threadId: string; messages: Omit<MailRow, "pk" | "sk">[]; latest: Omit<MailRow, "pk" | "sk">; unreadCount: number }

/**
 * Snoozes that have run out come back once, as Gmail's do (2026-11-02): each snoozed row of the thread loses
 * its snooze and takes returnedAt = now, and the thread's newest of them is marked unread, so the thread
 * is unread and floats to the top of the inbox. A second read finds no snooze to return and changes
 * nothing. Returns the rows as they now stand.
 */
export async function returnSnoozed(rows: MailRow[], now = new Date().toISOString()): Promise<MailRow[]> {
  const due = rows.filter((r) => r.snoozedUntil && r.snoozedUntil <= now)
  if (!due.length) return rows
  const newest = new Map<string, MailRow>()
  for (const r of due) {
    const n = newest.get(r.threadId)
    if (!n || r.createdAt > n.createdAt || (r.createdAt === n.createdAt && r.id > n.id)) newest.set(r.threadId, r)
  }
  const changed = new Map<string, MailRow>()
  for (const r of due) {
    const { snoozedUntil: _gone, ...rest } = r
    changed.set(`${r.pk}|${r.sk}`, { ...rest, returnedAt: now, ...(newest.get(r.threadId) === r ? { read: false } : {}) })
  }
  await Promise.all([...changed.values()].map((r) => put(r)))
  return rows.map((r) => changed.get(`${r.pk}|${r.sk}`) ?? r)
}

/** A mailbox's rows, messages only (the watermark is no message). */
export async function mailboxRows(mailbox: string): Promise<MailRow[]> {
  return (await query<MailRow>(pkOf(mailbox))).filter((r) => typeof r.threadId === "string" && typeof r.id === "string")
}

/**
 * A folder of a mailbox as threads: each thread with a row in the folder, holding every message of
 * it this mailbox has (the trash shows a thread's trashed rows; every other folder its rest), oldest
 * first; the threads newest-latest first.
 */
export function threadsOf(rows: MailRow[], folder: FolderView, now = new Date().toISOString()): MailThread[] {
  const shown = new Set(rows.filter((r) => inFolder(r, folder, now)).map((r) => r.threadId))
  const by = new Map<string, MailRow[]>()
  for (const r of rows) {
    if (!shown.has(r.threadId)) continue
    if (folder === "trash" ? !r.trashed : r.trashed) continue
    by.set(r.threadId, [...(by.get(r.threadId) ?? []), r])
  }
  const clean = ({ pk: _pk, sk: _sk, ...rest }: MailRow) => rest
  return [...by.entries()]
    .map(([threadId, rs]) => {
      // Oldest first; in a tie (the same millisecond), the message that began the thread leads.
      const first = (r: MailRow) => (r.id === r.threadId ? 0 : 1)
      const messages = rs.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || first(a) - first(b) || a.id.localeCompare(b.id)).map(clean)
      return { threadId, messages, latest: messages[messages.length - 1], unreadCount: messages.filter((m) => !m.read).length }
    })
    .sort((a, b) => sortedAt(b).localeCompare(sortedAt(a)))
}

/** Where a thread sorts: its newest message, or the moment a snooze brought it back if that is later. */
const sortedAt = (t: MailThread) => t.messages.reduce((at, m) => (m.returnedAt && m.returnedAt > at ? m.returnedAt : at), t.latest.createdAt)

/** What filing may change on a thread's rows; null clears a snooze. */
export type ThreadPatch = { read?: boolean; starred?: boolean; important?: boolean; trashed?: boolean; archived?: boolean; snoozedUntil?: string | null }

/** A patch from a request body, or the reason it is not one. */
export function threadPatchOf(body: Record<string, unknown>): { ok: true; patch: ThreadPatch } | { ok: false; error: string } {
  const patch: ThreadPatch = {}
  for (const k of ["read", "starred", "important", "trashed", "archived"] as const) {
    if (body[k] === undefined) continue
    if (typeof body[k] !== "boolean") return { ok: false, error: `${k} must be true or false` }
    patch[k] = body[k] as boolean
  }
  if (body.snoozedUntil !== undefined) {
    const v = body.snoozedUntil
    if (v !== null && (typeof v !== "string" || Number.isNaN(Date.parse(v)))) return { ok: false, error: "snoozedUntil must be a date and time, or null" }
    patch.snoozedUntil = v === null ? null : new Date(v as string).toISOString()
  }
  if (!Object.keys(patch).length) return { ok: false, error: "nothing to change: read, starred, important, trashed, archived or snoozedUntil" }
  return { ok: true, patch }
}

/** Files a thread in one mailbox: every row of it there takes the patch; other mailboxes' copies are theirs.
 *  Returns how many rows changed (0 when the mailbox holds no such thread). */
export async function patchThread(mailbox: string, threadId: string, patch: ThreadPatch): Promise<number> {
  const rows = (await mailboxRows(mailbox)).filter((r) => r.threadId === threadId)
  await Promise.all(
    rows.map((r) => {
      const { snoozedUntil, ...rest } = patch
      const next: MailRow = { ...r, ...rest }
      if (snoozedUntil === null) delete next.snoozedUntil
      else if (snoozedUntil) next.snoozedUntil = snoozedUntil
      return put(next)
    }),
  )
  return rows.length
}

/** Each folder's unread threads (a thread with an unread message showing in it), for the Inbox's counts. */
export function unreadCounts(rows: MailRow[], now = new Date().toISOString()): Record<FolderView, number> {
  return Object.fromEntries(FOLDERS.map((f) => [f, threadsOf(rows, f, now).filter((t) => t.unreadCount > 0).length])) as Record<FolderView, number>
}
