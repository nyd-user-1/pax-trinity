import { AGENTS, type AgentDefinition } from "@/lib/agents/registry"
import { reportBody } from "@/lib/agents/report-modes"
import { emptyRun, type RunState } from "@/lib/agents/run-client"

// The Agentic Inbox's store, which is this browser's localStorage and nothing
// else.
//
// That is a deliberate choice, not an oversight: govblock is public and has no
// accounts, so a server-side inbox would be one shared inbox — every visitor
// reading every other visitor's tasks and paying for them. Per-browser is the
// only honest place to keep them until there is an identity to key them to, and
// the surface says so rather than letting anyone assume otherwise. §4 prices
// what close-the-tab delivery would take.
//
// The model is mail, because that is the thing it is pretending to be and half
// measures read as a broken version of the real one. A task is a thread: the
// message you send is in Sent the moment you send it, and the report arrives as
// an unread reply on the same thread. Stars, drafts, and a trash you can undo
// are all local state on that thread.

export type Folder = "inbox" | "sent" | "drafts" | "starred" | "templates" | "trash"

export type Address = {
  /** An agent's slug, or a person's, partner's or channel's handle. */
  agent: string
  name: string
  email: string
  monogram: string
  speciality: string
  kind: "agent" | "person" | "partner" | "group" | "channel"
  /** A face or a mark: a staff photo, a partner's channel art, a channel's logo. */
  image?: string
}

function monogramOf(name: string) {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

// The PAX roster (Brendan, 2026-10-29): three agents, one for each stage of
// the loop. The Pollster fields everything that asks people questions
// (Consensus conversations, recruitment surveys, tests) and follows up until a
// quota closes; the Analyst turns what comes back into question cards,
// toplines, reports and Lift; the Assistant keeps staff and partners told and
// reminded, and onboards them. Each sends from its own AgentMail inbox. The
// Pollster and the Analyst keep the slugs the threads on file carry.
const ROSTER: { slug: string; name: string; email: string; speciality: string }[] = [
  { slug: "tracker", name: "Pollster", email: "pax-pollster@agentmail.to", speciality: "Fields Consensus conversations, surveys and tests, and follows up until each quota closes." },
  { slug: "bill-reader", name: "Analyst", email: "pax-analyst@agentmail.to", speciality: "Writes the question cards, toplines and reports, and updates Lift and America Thinks." },
  { slug: "assistant", name: "Assistant", email: "pax-assistant@agentmail.to", speciality: "Notices, reminders, digests and onboarding for staff and partners." },
]

export const AGENT_ADDRESSES: Address[] = ROSTER.map((agent) => ({
  agent: agent.slug,
  name: agent.name,
  email: agent.email,
  monogram: monogramOf(agent.name),
  speciality: agent.speciality,
  kind: "agent",
}))

/** The registry's own address for an agent, for agents outside the roster. */
export function addressOf(definition: AgentDefinition): Address {
  return {
    agent: definition.slug,
    name: definition.name,
    email: `${definition.slug.replace(/-/g, "")}@pax`,
    monogram: monogramOf(definition.name),
    speciality: definition.speciality,
    kind: "agent",
  }
}

// The staff, with their photos and their real addresses (lib/roles.ts names
// them). Real mail to anyone but Brendan is held by the allowlist in
// lib/mail/allowlist.ts until he widens it.
const STAFF: { handle: string; name: string; email: string; image: string }[] = [
  { handle: "brendan", name: "Brendan Stanton", email: "brendan@nysgpt.com", image: "/brendan.jpg" },
  { handle: "sajeela", name: "Sajeela Padder", email: "sajeela@parallaxinnovations.com", image: "/sajeela.jpeg" },
  { handle: "garrett", name: "Garrett Hernandez Rimer", email: "garrett@parallaxinnovations.com", image: "/garrett.jpeg" },
  { handle: "ted", name: "Ted Delicath", email: "ted@parallaxinnovations.com", image: "/ted.jpeg" },
]

export const PEOPLE_ADDRESSES: Address[] = STAFF.map((person) => ({
  agent: person.handle,
  name: person.name,
  email: person.email,
  monogram: monogramOf(person.name),
  speciality: "",
  kind: "person",
  image: person.image,
}))

// The partners on the Clips page, with their YouTube channel art.
const PARTNERS: { handle: string; name: string; email: string; image: string }[] = [
  { handle: "voterfreedom", name: "Voter Freedom", email: "voterfreedom@partners.pax.com", image: "/partners/voter-freedom.jpg" },
  { handle: "uniteamerica", name: "Unite America", email: "ted@uniteamerica.org", image: "/partners/unite-america.jpg" },
  { handle: "yeson3", name: "Yes on 3", email: "yeson3@partners.pax.com", image: "/partners/yeson3.jpg" },
]

export const PARTNER_ADDRESSES: Address[] = PARTNERS.map((partner) => ({
  agent: partner.handle,
  name: partner.name,
  email: partner.email,
  monogram: monogramOf(partner.name),
  speciality: "",
  kind: "partner",
  image: partner.image,
}))

// The respondent groups the Pollster's surveys built: a test or a survey goes
// to a group, and the test page randomizes each respondent to the video or the
// placebo when they arrive. Groups define who is invited, never who sees what.
export const GROUPS: { handle: string; name: string; size: number; built: string }[] = [
  { handle: "group-ma-adults", name: "MA adults panel", size: 2410, built: "Open primaries survey, Oct 20–23" },
  { handle: "group-ma-independents", name: "MA independents", size: 812, built: "Open primaries survey, party: independent or other" },
  { handle: "group-ma-undecided", name: "MA undecided on Question 3", size: 377, built: "Open primaries survey, Question 3: undecided" },
  { handle: "group-consensus-ma", name: "Consensus: MA open primaries", size: 412, built: "Voters in the Oct 17–21 Consensus conversation" },
]

export const GROUP_ADDRESSES: Address[] = GROUPS.map((group) => ({
  agent: group.handle,
  name: group.name,
  email: `${group.size.toLocaleString("en-US")} people`,
  monogram: monogramOf(group.name.replace(/^Consensus: /, "")),
  speciality: group.built,
  kind: "group",
}))

// Where a message can go besides a mailbox.
export const CHANNEL_ADDRESSES: Address[] = [
  { agent: "@slack", name: "Slack", email: "@slack", monogram: "S", speciality: "", kind: "channel", image: "/logos/slack.png" },
  { agent: "@discord", name: "Discord", email: "@discord", monogram: "D", speciality: "", kind: "channel", image: "/logos/discord-icon.svg" },
  { agent: "@frame.io", name: "Frame.io", email: "@frame.io", monogram: "F", speciality: "", kind: "channel", image: "/logos/frameio.png" },
]

export const ADDRESSES: Address[] = [...AGENT_ADDRESSES, ...PEOPLE_ADDRESSES, ...PARTNER_ADDRESSES, ...GROUP_ADDRESSES, ...CHANNEL_ADDRESSES]

/** The To line's groups, in the order the picker lists them. */
export const ADDRESS_GROUPS: { value: string; items: Address[] }[] = [
  { value: "Agents", items: AGENT_ADDRESSES },
  { value: "Staff", items: PEOPLE_ADDRESSES },
  { value: "Partners", items: PARTNER_ADDRESSES },
  { value: "Groups", items: GROUP_ADDRESSES },
  { value: "Channels", items: CHANNEL_ADDRESSES },
]

export function addressFor(handle: string): Address | undefined {
  return ADDRESSES.find((a) => a.agent === handle) ?? (AGENTS.find((a) => a.slug === handle) && addressOf(AGENTS.find((a) => a.slug === handle)!))
}

/** Whether a recipient runs the task in this tab. None does today: the three
 *  agents work through their AgentMail inboxes, and govblock's legislative runs
 *  that stood behind the old slugs no longer answer here. */
export function runs(_handle: string) {
  return false
}

export function isPerson(handle: string) {
  return !runs(handle)
}

export function findAddress(query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return undefined
  return ADDRESSES.find((a) => a.email.toLowerCase() === q || a.agent === q || a.name.toLowerCase() === q)
}

export function matchAddresses(query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return ADDRESSES
  return ADDRESSES.filter((a) => a.email.toLowerCase().includes(q) || a.name.toLowerCase().includes(q) || a.speciality.toLowerCase().includes(q))
}

/**
 * A file delivered with a message — the report's PDF, chiefly.
 *
 * `href` is a link to something that exists. `build` says the opposite: the
 * file is set in the browser out of the message it rides on, when someone asks
 * for it. A report's PDF is the second kind, because this host cannot render
 * one and a blob URL does not survive a reload — so the card promises a file it
 * can actually produce rather than a link that would be dead by morning.
 */
export type Attached = { name: string; meta?: string; href: string; build?: "report-pdf" | "form-pdf" }

export type Message = {
  id: string
  /** "you" is the reader; an agent replies by its slug. */
  from: "you" | string
  at: number
  body: string
  unread?: boolean
  /** Present on an agent's reply: the run that produced it. */
  run?: RunState
  /** Files that ride with the message: the report as a PDF, and the like. */
  attachments?: Attached[]
  /**
   * A filled form's making: the form and the values it was filled from, at
   * fill time — so a `form-pdf` attachment builds the file that was
   * delivered, even after the profile has changed.
   */
  form?: { id: "ldss-2921" | "ocfs-6025"; values: Record<string, string> }
}

export type ThreadStatus = "draft" | "running" | "delivered" | "failed"

export type Thread = {
  id: string
  /** The first recipient. Kept because most of the surface asks "who is this
   *  thread with", and for one recipient — the common case — that is the
   *  answer. `to` is the truth when there are several. */
  agent: string
  agentName: string
  /** Agent slugs. Every one of them runs the task and replies on the thread. */
  to: string[]
  cc: string[]
  /** Blind: the same run, whose recipient line the thread does not show. */
  bcc: string[]
  subject: string
  createdAt: number
  updatedAt: number
  status: ThreadStatus
  /** Which report format was asked for; absent means the default (Traditional). */
  reportType?: string
  starred?: boolean
  trashed?: boolean
  /** Gmail's importance marker, set by hand; a running or failed thread lights it on its own. */
  important?: boolean
  /** Where the report was delivered, if a connection took it. */
  deliveredTo?: string
  messages: Message[]
}

// A new key rather than a migration: the old store held tasks, not threads, and
// it lived for a few hours in one browser.
const KEY = "govblock:inbox:threads"

export function loadThreads(): Thread[] {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return []
    const threads = JSON.parse(raw) as Thread[]
    return Array.isArray(threads) ? threads : []
  } catch {
    return []
  }
}

export function saveThreads(threads: Thread[]) {
  try {
    // Sixty threads is a long history for one browser and keeps the store well
    // inside localStorage's few megabytes — a Researcher report with its run
    // attached is tens of kilobytes. (Thirty until 2026-09-07, when the fifty
    // placeholders arrived.)
    window.localStorage.setItem(KEY, JSON.stringify(threads.slice(0, 60)))
  } catch {}
}

function id() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function newThread({ to, cc = [], bcc = [], subject, body, status, reportType }: { to: string[]; cc?: string[]; bcc?: string[]; subject: string; body: string; status: ThreadStatus; reportType?: string }): Thread {
  const at = Date.now()
  const first = to[0] ?? ""
  return {
    id: id(),
    agent: first,
    agentName: nameOf(first),
    to,
    cc,
    bcc,
    subject: subject.trim() || "(no subject)",
    createdAt: at,
    updatedAt: at,
    status,
    reportType,
    messages: [{ id: id(), from: "you", at, body }],
  }
}

export function nameOf(slug: string) {
  return addressFor(slug)?.name ?? slug
}

/** Only the agents on the lines actually run. Everyone else is recorded, not run. */
export function runners(thread: Thread) {
  return allRecipients(thread).filter(runs)
}

/** Everyone who ran it. Bcc is deliberately absent — that is what bcc means. */
export function shownRecipients(thread: Thread) {
  const lines = [...(thread.to ?? []), ...(thread.cc ?? [])]
  // Threads written before recipients were plural carry only `agent`.
  return (lines.length ? lines : [thread.agent]).filter(Boolean).map(nameOf)
}

/** Everyone who ran it, including the blind ones. */
export function allRecipients(thread: Thread) {
  const lines = [...(thread.to ?? []), ...(thread.cc ?? []), ...(thread.bcc ?? [])]
  return (lines.length ? lines : [thread.agent]).filter(Boolean)
}

/** One thread's whole bill: every recipient's run added up. */
export function threadCost(thread: Thread) {
  return thread.messages.reduce((total, message) => total + (message.run?.usd ?? 0), 0)
}

/** A fresh id for the message one run will write. */
export function messageId() {
  return id()
}

/**
 * An agent's reply, written by one run. `messageId` names the message that run
 * owns: the first call appends it, every call after updates it as the run
 * streams. A second run on the same thread — a reply to your reply — writes a
 * second message, the way a second email does. (Until 2026-09-07 the agent
 * had one message per thread and each run overwrote the last, which is a
 * chat transcript's habit, not mail's.)
 */
export function reply(thread: Thread, from: string, run: RunState, status: ThreadStatus, messageId: string): Thread {
  const at = Date.now()
  const existing = thread.messages.find((message) => message.id === messageId)
  // A report's body starts at its headline; what the Clerk wrote on the way
  // there stays on the run, where it belongs, rather than on top of the
  // document someone is about to copy or print.
  const body = reportBody(run.text, thread.reportType)
  const next: Message = existing ? { ...existing, at, body, run, unread: existing.unread ?? true } : { id: messageId, from, at, body, run, unread: true }

  const messages = existing ? thread.messages.map((message) => (message.id === messageId ? next : message)) : [...thread.messages, next]

  return {
    ...thread,
    status,
    updatedAt: at,
    deliveredTo: deliveredTo(run) ?? thread.deliveredTo,
    messages,
  }
}

/** The replies since the last thing you wrote: the round now owed. */
function latestRound(thread: Thread) {
  let from = 0
  thread.messages.forEach((message, index) => {
    if (message.from === "you") from = index + 1
  })
  return thread.messages.slice(from).filter((message) => message.from !== "you")
}

/**
 * What a thread's status is once its recipients have run.
 *
 * Running while any run is still going or any recipient has yet to answer the
 * latest message; failed only when every reply in that round failed, because
 * one agent tripping is not the thread failing.
 */
export function settle(thread: Thread): ThreadStatus {
  const replies = thread.messages.filter((message) => message.from !== "you")
  if (!replies.length) return thread.status
  if (replies.some((message) => message.run && !message.run.done)) return "running"
  const round = latestRound(thread)
  if (round.length < runners(thread).length) return "running"
  return round.every((message) => message.run?.failed) ? "failed" : "delivered"
}

/** A reply that has actually arrived: it says something, or its run is over. */
export function arrived(message: Message) {
  return message.from !== "you" && Boolean(message.body || message.run?.done)
}

export function inFolder(thread: Thread, folder: Folder) {
  if (folder === "trash") return Boolean(thread.trashed)
  if (thread.trashed) return false
  switch (folder) {
    case "drafts":
      return thread.status === "draft"
    case "starred":
      return Boolean(thread.starred) && thread.status !== "draft"
    case "sent":
      // What you sent: a notice an agent wrote you is not in Sent.
      return thread.status !== "draft" && thread.messages.some((message) => message.from === "you")
    case "templates":
      return false
    case "inbox":
      // A thread reaches the inbox when a reply has arrived — the same rule
      // mail follows, and the reason a running task sits in Sent until it has
      // something to say.
      return thread.messages.some(arrived)
  }
}

export function unreadIn(threads: Thread[], folder: Folder) {
  return threads.filter((thread) => inFolder(thread, folder) && thread.messages.some((message) => message.from !== "you" && message.unread)).length
}

export function isUnread(thread: Thread) {
  return thread.messages.some((message) => message.from !== "you" && message.unread)
}

export function matches(thread: Thread, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = [thread.subject, thread.agentName, ...thread.messages.map((m) => m.body)].join(" ").toLowerCase()
  return hay.includes(q)
}

/** A preview reads as prose, not as the markdown it happens to be written in. */
function flatten(body: string) {
  return body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s*\|.*\|\s*$/gm, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")
    .replace(/[*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** One line of a message's body, for a collapsed message in the thread. */
export function snippet(message: Message) {
  return flatten(message.body).slice(0, 160)
}

/** The line under a thread's subject in the list. */
export function teaser(thread: Thread) {
  if (thread.status === "running") return running(thread)
  const last = thread.messages.at(-1)
  if (!last) return ""
  if (thread.status === "failed") return flatten(last.body).slice(0, 160) || "Failed."
  return flatten(last.body).slice(0, 160)
}

/** What a running thread is doing right now, for the pulse. */
export function running(thread: Thread) {
  const live = thread.messages.filter((message) => message.from !== "you" && !message.run?.done)
  const run = (live.at(-1) ?? thread.messages.at(-1))?.run ?? emptyRun()
  const step = [...run.steps].reverse().find((s) => s.kind === "tool")
  if (step && step.kind === "tool") {
    if (step.summary === undefined) return `Reading — ${step.name}…`
    return `${step.name} → ${step.summary}`
  }
  return run.rounds ? `Round ${run.rounds}, thinking…` : "Starting…"
}

export function when(at: number) {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000))
  if (seconds < 60) return "just now"
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  return days === 1 ? "yesterday" : `${days} days ago`
}

/** Whether the run's own steps show it delivered, and where. */
export function deliveredTo(run: RunState) {
  const post = run.steps.find((step) => step.kind === "tool" && (step.name.startsWith("post_to") || step.name === "deliver_report") && step.ok)
  if (post && post.kind === "tool" && post.summary) return post.summary.replace(/^(posted|delivered) to /, "")
  return undefined
}
