import "server-only"

import { putOnce, query } from "@/lib/ledger"
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
  trashed: boolean
  archived: boolean
  snoozedUntil?: string
  templateId?: string
  source: MailSource
  /** On the sender's row: the recipients the allowlist held back. */
  held?: string[]
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

/**
 * A message as sent: the sender's sent row, and an unread inbox row for every platform identity it
 * reached (a member or an agent; a plus-address or an outside address is no one's mailbox here). The
 * sender's own address among the recipients gets no second row: it is in their sent already.
 */
export async function recordMessage(m: {
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
}): Promise<Recorded> {
  const id = ulid(m.at ? Date.parse(m.at) : Date.now())
  const createdAt = m.at ?? new Date().toISOString()
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
  for (const box of reached) rows.push({ ...base, pk: pkOf(box), folder: "inbox", read: false })
  await Promise.all(rows.map((row) => putOnce(row)))
  return { id, threadId, mailboxes: rows.map((r) => r.pk.slice(5)) }
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
      const messages = rs.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).map(clean)
      return { threadId, messages, latest: messages[messages.length - 1], unreadCount: messages.filter((m) => !m.read).length }
    })
    .sort((a, b) => b.latest.createdAt.localeCompare(a.latest.createdAt))
}
