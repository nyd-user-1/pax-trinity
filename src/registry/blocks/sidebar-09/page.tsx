"use client"

import * as React from "react"
import { ArrowLeft, Check, Copy, ExternalLink, Forward as ForwardIcon, PenSquare, Reply as ReplyIcon, RotateCcw, Star, Trash2, UserRound } from "lucide-react"

import { agent as findAgent, maxRounds } from "@/lib/agents/registry"
import { addressFor, findAddress, inFolder, isPerson, isUnread, loadThreads, matches, messageId, nameOf, newThread, reply, running, runners, saveThreads, settle, shownRecipients, snippet, teaser, threadCost, when, type Attached, type Folder, type Message, type Thread } from "@/lib/agents/inbox"
import { emptyRun, runAgent, type RunTurn } from "@/lib/agents/run-client"
import { HISTORY } from "@/lib/agents/history"
import { PENDING_DRAFT } from "@/lib/agents/pending-draft"
import { fieldingRequest, liveThread, type LiveFielding } from "@/lib/agents/live"
import { cn } from "@/lib/utils"
import { ADMIN_USER } from "@/components/admin/account-footer"
import { SaveToDrive } from "@/components/connectors/save-to-drive"
import { Prose, RunSteps } from "@/app/agents/transcript"
import { BankFrame } from "@/components/bank/bank-frame"
import { CardList, type Card, type Split } from "@/components/bank/card-list"
import { InboxRail, THREAD_DRAG } from "@/registry/blocks/sidebar-09/components/app-sidebar"
import { Compose, EMPTY_DRAFT, type Draft } from "@/registry/blocks/sidebar-09/components/compose"
import { ComposeWindow } from "@/registry/blocks/sidebar-09/components/compose-window"
import { TemplateList } from "@/registry/blocks/sidebar-09/components/template-list"
import type { Template } from "@/lib/agents/templates"
import { isReportType, isTrace, reportBody } from "@/lib/agents/report-modes"
import { attachmentMeta, reportFor, save } from "@/lib/agents/report-pdf"
import { AttachmentGroup } from "@/registry/blocks/sidebar-09/components/attachment"
import { TraceReport } from "@/registry/blocks/sidebar-09/components/trace-report"
import { Marker, TITLES, type ListTab } from "@/registry/blocks/sidebar-09/components/thread-list"
import { Progress } from "@govblock/ui/components/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@govblock/ui/components/ny4/avatar"
import { Button } from "@govblock/ui/components/nova/button"
import { DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator } from "@govblock/ui/components/ny4/dropdown-menu"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@govblock/ui/components/ny4/resizable"
import { Separator } from "@govblock/ui/components/ny4/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/ny4/tooltip"

// The Agentic Inbox — shadcn's sidebar-09 mail block, repurposed, and since
// 2026-09-02 laid out the way shadcn's mail example is: the icon rail, then a
// resizable row of the thread list and the reading pane, the whole thing the
// height of its frame with each pane scrolling on its own.
//
// Live chat is what /agents already is. This is its long-form sibling, and it is
// mail all the way down because half a mail metaphor reads as a broken one
// (Brendan, 2026-09-07: "you are still treating this like chat instead of like
// email"). So: you write a message and send it, and you are back at your list
// with a "Message sent" bar, not parked in the thread watching it. The sent
// message sits in Sent while the agent works; the reply lands in the Inbox as
// an unread message on the same thread, and you open it when you like. In the
// thread every message reads as mail — who it is from, who it went to, when —
// yours included, and a reply is something you ask for with the Reply button,
// which opens a composer under the last message, Gmail's way. Each reply the
// agent sends is its own message; nothing is overwritten.
//
// The hook that produces the reply is Send itself: sending to an agent marks
// the thread running (that is the flag) and dispatches one run per agent on
// the lines; each run writes its reply onto the thread as it arrives. v1 runs
// in this tab, because the store is this browser and there is no account to
// key a server-side inbox to. What makes it feel delivered anyway is Discord —
// the agent delivers the finished report into the channel under the same
// subject line, so it arrives somewhere that outlives the tab.

// Set when the inbox is cleared from its menu, so an inbox that was emptied on
// purpose stays empty instead of refilling with the placeholders. Recorded by
// the clearing itself, never by the load: a flag written during the mount
// effect ran ahead of the save, and Strict Mode's second pass of that effect
// found the flag set and the store still empty, and kept the empty (the
// inbox read "1 KB used" and nothing else, 2026-09-07).
const CLEARED = "govblock:inbox:cleared"

function monogram(name: string) {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

/** Distinct background colours for each agent's monogram dot, Google Drive palette. */
const AGENT_COLORS: Record<string, string> = {
  "bill-reader":          "bg-[#4285F4] text-white",   // Clerk — Google blue
  "jurisdiction-guide":   "bg-[#EA4335] text-white",   // Parliamentarian — Google red
  "money-follower":       "bg-[#FBBC05] text-white",   // Treasurer — Google yellow
  "tracker":              "bg-[#34A853] text-white",   // Whip — Google green
  "researcher":           "bg-[#9C27B0] text-white",   // Librarian — purple
  "reporter":             "bg-[#FF6D00] text-white",   // Reporter — orange
}

/** Who a message is from, as mail shows it: your account, or the agent by its monogram. */
function Sender({ from, className }: { from: string; className?: string }) {
  if (from === "you") {
    return (
      <Avatar className={cn("size-10", className)}>
        <AvatarImage src={ADMIN_USER.avatar} alt={ADMIN_USER.name} />
        <AvatarFallback className="bg-blue-200 text-blue-600 dark:bg-blue-900 dark:text-blue-200">
          <UserRound className="size-5" />
        </AvatarFallback>
      </Avatar>
    )
  }
  // Pax wears its own mark; the other agents keep their coloured monograms.
  if (from === "bill-reader") return <img src="/pax-avatar.svg" alt="Pax" className={cn("size-10 shrink-0 rounded-full", className)} />
  const color = AGENT_COLORS[from] ?? "bg-muted text-foreground"
  return <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-medium", color, className)}>{monogram(nameOf(from))}</span>
}

/** The exchange as one agent saw it: your messages and its own replies, in turn. */
function turnsFor(thread: Thread, slug: string): RunTurn[] {
  const turns: RunTurn[] = []
  for (const message of thread.messages) {
    if (message.from !== "you" && message.from !== slug) continue
    if (!message.body.trim()) continue
    const role = message.from === "you" ? "user" : "assistant"
    const last = turns.at(-1)
    // Two of yours in a row read as one turn; the model takes them alternately.
    if (last && last.role === role) last.text = `${last.text}\n\n${message.body}`
    else turns.push({ role, text: message.body })
  }
  return turns
}

/** How many calls a run made. A Trace Report's steps also carry its prose. */
function calls(message: Message) {
  return (message.run?.steps ?? []).filter((step) => step.kind === "tool").length
}

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** The skeletons New test and New survey open with. */
const REQUESTS: Record<"test" | "survey", Pick<Draft, "to" | "subject" | "body">> = {
  test: {
    to: ["tracker"],
    subject: "New test: ",
    body: "**Test:** ma-wave-3\n\n**Question card:** \n\n**Quota:** per the test\n\n**Close by:** ",
  },
  survey: {
    to: ["tracker"],
    subject: "New survey: ",
    body: "**Survey:** open-primaries\n\n**Quota:** \n\n**Close by:** \n\n**Panels to build from it:** ",
  },
}

export default function Page() {
  const [threads, setThreads] = React.useState<Thread[]>([])
  const [selected, setSelected] = React.useState<string | null>(null)
  const [folder, setFolder] = React.useState<Folder>("inbox")
  const [tab, setTab] = React.useState<ListTab>("all")
  const [composing, setComposing] = React.useState(false)
  // The composer popped out into Gmail's floating window (compose-window.tsx); the draft is the same one.
  const [popped, setPopped] = React.useState(false)
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT)
  const [draftId, setDraftId] = React.useState<string | null>(null)
  const [restored, setRestored] = React.useState(false)
  const [replyDraft, setReplyDraft] = React.useState<Draft>(EMPTY_DRAFT)
  // The reply composer is asked for, not always there.
  const [replying, setReplying] = React.useState(false)
  // Gmail's "Message sent" bar: the id of what just went, for a few seconds.
  const [sent, setSent] = React.useState<string | null>(null)
  // What the real send did: who was mailed, how many the allowlist held.
  const [mailNote, setMailNote] = React.useState<string | null>(null)
  // The list bar's search: a press on the bar's empty run opens it; it filters the list as you type.
  const [query, setQuery] = React.useState("")
  // The rows' boxes, Gmail's selection.
  const [checked, setChecked] = React.useState<Set<string>>(() => new Set())
  // Messages folded to their one-line state, Gmail's collapse. Fresh per thread.
  const [folded, setFolded] = React.useState<Set<string>>(() => new Set())
  // The reply card's recipient row: a summary line until clicked, then the editable To/Cc/Bcc.
  const [editingTo, setEditingTo] = React.useState(false)
  const [copied, setCopied] = React.useState<string | null>(null)
  // The list alone, or the list beside the reading pane (Brendan, 2026-09-07:
  // Gmail's split toggle). America Thinks' anatomy since 2026-10-31 (Brendan):
  // the rows alone on load, a thread opening beside the list, the kebab's No
  // split giving it the screen, and Back going one layer up.
  const [split, setSplit] = React.useState<Split>("none")
  const [, setTick] = React.useState(0)

  React.useEffect(() => {
    // Two weeks of the platform (lib/agents/history.ts) stand in every inbox,
    // refreshed to their authored text on load with only the reader's own flags
    // kept. govblock's placeholders and featured deliveries are gone
    // (2026-10-29); the reader's own threads stay. A cleared inbox gets the
    // history back too; Trash is how one goes away.
    const kept = loadThreads().filter((thread) => !/^(sample|featured|live)-/.test(thread.id))
    const authored = new Map(HISTORY.map((thread) => [thread.id, thread]))
    const flags = new Map(kept.filter((thread) => authored.has(thread.id)).map((thread) => [thread.id, thread]))
    const history = HISTORY.map((fresh) => {
      const mine = flags.get(fresh.id)
      if (!mine) return fresh
      const read = new Set(mine.messages.filter((message) => !message.unread).map((message) => message.id))
      return {
        ...fresh,
        starred: mine.starred ?? fresh.starred,
        trashed: mine.trashed ?? fresh.trashed,
        important: mine.important ?? fresh.important,
        messages: fresh.messages.map((message) => (read.has(message.id) ? { ...message, unread: false } : message)),
      }
    })
    const stored = [...history, ...kept.filter((thread) => !authored.has(thread.id))].sort((x, y) => y.updatedAt - x.updatedAt)
    // A run that was in flight when the tab closed did not survive it. Say so
    // on that reply — and only that one; earlier replies on the thread stand —
    // rather than leave a spinner that will never stop.
    const lost = (message: Message) => message.from !== "you" && Boolean(message.run) && !message.run!.done
    const settled = stored.map((thread): Thread => {
      if (thread.status !== "running" && !thread.messages.some(lost)) return thread
      const messages = thread.messages.map((message) =>
        lost(message)
          ? {
              ...message,
              body: message.body + (message.body ? "\n\n" : "") + "This task was still running when the tab was closed, and tasks run in the tab. Send it again.",
              run: { ...message.run!, done: true, failed: true },
            }
          : message
      )
      const next = { ...thread, messages }
      return { ...next, status: settle(next) === "running" ? "failed" : settle(next) }
    })
    setThreads(settled)
    setRestored(true)
    // A question card handed over from /consensus opens as a New test.
    const pending = window.localStorage.getItem(PENDING_DRAFT)
    if (pending) {
      window.localStorage.removeItem(PENDING_DRAFT)
      try {
        setDraft({ ...EMPTY_DRAFT, ...(JSON.parse(pending) as Partial<Draft>) })
        setComposing(true)
      } catch {
        // A card that does not parse is dropped; the inbox opens as usual.
      }
    }
  }, [])

  React.useEffect(() => {
    if (restored) saveThreads(threads)
  }, [threads, restored])

  // The Pollster's real fieldings (lib/agents/live.ts): a tick first, so reminders and closes
  // that fell due go out, then the counts, each fielding a thread that rewrites itself.
  const refreshLive = React.useCallback(async () => {
    try {
      await fetch("/api/fielding/tick", { method: "POST" })
      const res = (await (await fetch("/api/fielding")).json()) as { fieldings?: LiveFielding[] }
      const live = (res.fieldings ?? []).map(liveThread)
      if (!res.fieldings) return
      setThreads((current) => {
        const flags = new Map(current.filter((t) => t.id.startsWith("live-")).map((t) => [t.id, t]))
        const read = new Set(current.flatMap((t) => t.messages).filter((m) => !m.unread).map((m) => m.id))
        const fresh = live.map((t) => ({ ...t, starred: flags.get(t.id)?.starred, trashed: flags.get(t.id)?.trashed, messages: t.messages.map((m) => (read.has(m.id) ? { ...m, unread: false } : m)) }))
        return [...fresh, ...current.filter((t) => !t.id.startsWith("live-"))].sort((x, y) => y.updatedAt - x.updatedAt)
      })
    } catch {
      // Signed out, or the table unreachable: the inbox stands on what it has.
    }
  }, [])

  React.useEffect(() => {
    if (!restored) return
    void refreshLive()
    const every = window.setInterval(() => void refreshLive(), 60_000)
    return () => window.clearInterval(every)
  }, [restored, refreshLive])

  const patch = React.useCallback((id: string, change: (thread: Thread) => Thread) => {
    setThreads((current) => current.map((thread) => (thread.id === id ? change(thread) : thread)))
  }, [])

  // One agent's run on a thread, writing its reply as it goes. This is the
  // hook behind every send: the message is on the thread already, in Sent, and
  // the reply arrives on it whether or not anyone is looking.
  const dispatch = React.useCallback(
    async (threadId: string, slug: string, turns: RunTurn[], subject: string, reportType?: string) => {
      const definition = findAgent(slug)
      if (!definition) return
      const id = messageId()
      patch(threadId, (current) => reply(current, slug, emptyRun(), "running", id))
      const finished = await runAgent({
        agent: definition.slug,
        maxRounds: maxRounds(definition, reportType),
        subject,
        reportType,
        turns,
        onUpdate: (run) => patch(threadId, (current) => reply(current, slug, run, "running", id)),
      })
      patch(threadId, (current) => {
        const next = reply(current, slug, finished, "running", id)
        return { ...next, status: settle(next) }
      })

      // A report arrives with the paper version attached. It is set here, once,
      // so the card can say how many pages it runs to — the file itself is made
      // again when someone asks for it, because nothing that big belongs in
      // this browser's five megabytes. A build that fails attaches nothing: a
      // card promising a file that will not open is worse than no card.
      if (!isReportType(reportType) || finished.failed || !finished.text.trim()) return
      try {
        const at = Date.now()
        const built = await reportFor(`${threadId}:${id}`, {
          subject,
          reportType,
          body: reportBody(finished.text, reportType),
          steps: finished.steps,
          at,
        })
        patch(threadId, (current) => ({
          ...current,
          messages: current.messages.map((message) =>
            message.id === id
              ? { ...message, attachments: [{ name: built.filename, meta: attachmentMeta(built), href: "", build: "report-pdf" as const }] }
              : message
          ),
        }))
      } catch {
        // No attachment, and the report itself is on the thread regardless.
      }
    },
    [patch]
  )

  // Sending closes the composer and leaves you where you were, with the bar
  // that says it went — mail's way, not a chat's, which would park you in the
  // thread to watch. The reply arrives in the Inbox as unread.
  const announce = React.useCallback((id: string) => {
    setSent(id)
    window.setTimeout(() => setSent((current) => (current === id ? null : current)), 6000)
  }, [])

  const send = React.useCallback(
    async (draft: Draft, existingId?: string) => {
      const everyone = [...draft.to, ...draft.cc, ...draft.bcc]
      if (!everyone.length) return
      // People are recorded on the thread; agents are the ones that run.
      const recipients = everyone.filter((slug) => !isPerson(slug))

      const thread = newThread({
        to: draft.to,
        cc: draft.cc,
        bcc: draft.bcc,
        subject: draft.subject,
        body: draft.body,
        reportType: draft.reportType,
        // Addressed only to people: it is sent, and it sits in Sent. Nothing
        // runs and nothing replies.
        status: recipients.length ? "running" : "delivered",
      })
      // Sending a draft replaces it in place, so the thread keeps its position
      // rather than appearing twice.
      setThreads((current) => [thread, ...current.filter((entry) => entry.id !== existingId)])
      if (selected === existingId) setSelected(null)
      setComposing(false)
      setPopped(false)
      setDraft(EMPTY_DRAFT)
      setDraftId(null)
      announce(thread.id)

      // Staff and partners on the To and Cc lines get the message for real,
      // through /api/inbox/send and its allowlist; agents, groups and channels
      // stay on the thread.
      const mailable = (handles: string[]) =>
        handles.map((handle) => addressFor(handle)).filter((a) => a && (a.kind === "person" || a.kind === "partner")).map((a) => ({ email: a!.email, name: a!.name }))
      const mailTo = mailable(draft.to)
      const mailCc = mailable(draft.cc)
      setMailNote(null)
      if (mailTo.length || mailCc.length)
        void fetch("/api/inbox/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from: draft.from ?? "you", to: mailTo, cc: mailCc, subject: draft.subject, markdown: draft.body }),
        })
          .then((res) => res.json())
          .then((res: { sent?: string[]; held?: string[]; error?: string }) => {
            const held = res.held?.length ? `${res.held.length} held by the allowlist` : ""
            setMailNote(res.error ? `Not mailed: ${res.error}` : res.sent?.length ? [`Mailed to ${res.sent.join(", ")}`, held].filter(Boolean).join(" · ") : held || null)
          })
          .catch(() => setMailNote("Not mailed"))

      // A New test or New survey to the Pollster naming a real group starts a fielding.
      const request = fieldingRequest(draft.to, draft.cc, draft.body)
      if (request)
        void fetch("/api/fielding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) })
          .then((res) => res.json())
          .then((res: { sent?: number; held?: number; error?: string }) => {
            setMailNote(res.error ? `Not fielded: ${res.error}` : `Fielding: ${res.sent} invitations sent${res.held ? `, ${res.held} held` : ""}`)
            void refreshLive()
          })
          .catch(() => setMailNote("Not fielded"))

      // Every recipient runs the task — that is what Cc means here. They run
      // together; each one's reply lands on the thread as it finishes.
      const turns: RunTurn[] = [{ role: "user", text: draft.body }]
      await Promise.all(recipients.map((slug) => dispatch(thread.id, slug, turns, thread.subject, thread.reportType)))
    },
    [announce, dispatch, selected, refreshLive]
  )

  // A reply on an existing thread: your message joins it, and every agent on
  // the lines answers with the whole exchange, as it saw it, for context.
  const followUp = React.useCallback(
    async (thread: Thread, text: string) => {
      const at = Date.now()
      const mine: Message = { id: `${at.toString(36)}-you`, from: "you", at, body: text }
      const next: Thread = { ...thread, status: "running", updatedAt: at, messages: [...thread.messages, mine] }
      patch(thread.id, (current) => ({ ...current, status: "running", updatedAt: at, messages: [...current.messages, mine] }))
      setReplying(false)
      announce(thread.id)

      await Promise.all(runners(thread).map((slug) => dispatch(thread.id, slug, turnsFor(next, slug), thread.subject, thread.reportType)))
    },
    [announce, dispatch, patch]
  )

  const open = threads.find((thread) => thread.id === selected) ?? null

  // The open folder's threads, through the search and the unread filter.
  const shown = React.useMemo(
    () => threads.filter((thread) => inFolder(thread, folder)).filter((thread) => matches(thread, query)).filter((thread) => tab === "all" || isUnread(thread)),
    [threads, folder, query, tab]
  )
  const ids = React.useMemo(() => shown.map((thread) => thread.id), [shown])
  const byId = React.useMemo(() => new Map(threads.map((thread) => [thread.id, thread])), [threads])
  const openThread = (id: string) => {
    setSelected(id)
    setComposing(false)
    setSplit("vertical")
  }

  // Opening a thread marks its reply read, the way opening a message does.
  React.useEffect(() => {
    if (!open || composing || !isUnread(open) || open.status === "running") return
    patch(open.id, (thread) => ({
      ...thread,
      messages: thread.messages.map((message) => (message.from === "you" ? message : { ...message, unread: false })),
    }))
  }, [open, composing, patch])

  // A reply addresses the whole thread, Cc and Bcc included. Opening another
  // thread puts the composer away.
  const openId = open?.id ?? null
  React.useEffect(() => {
    setReplying(false)
    setFolded(new Set())
    setEditingTo(false)
    if (!open) return
    setReplyDraft({ ...EMPTY_DRAFT, to: open.to ?? [], cc: open.cc ?? [], bcc: open.bcc ?? [] })
    // Only when a different thread opens; a reply that is being typed must not
    // be wiped by the thread updating underneath it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId])

  const startCompose = () => {
    // A popped-out message is still being written; Compose leaves it be.
    if (popped) return
    setDraft(EMPTY_DRAFT)
    setDraftId(null)
    setComposing(true)
  }

  // Forward opens the full composer with the message quoted the way mail
  // quotes one, so the reader picks recipients and sends it as a new task.
  const startForward = (thread: Thread, message: Message) => {
    const name = message.from === "you" ? ADMIN_USER.name : nameOf(message.from)
    const email = message.from === "you" ? ADMIN_USER.email : (findAddress(message.from)?.email ?? "")
    const to = message.from === "you" ? shownRecipients(thread).join(", ") || thread.agentName : "me"
    setDraft({
      to: [],
      cc: [],
      bcc: [],
      subject: /^fwd:/i.test(thread.subject) ? thread.subject : `Fwd: ${thread.subject}`,
      body: `---------- Forwarded message ---------\nFrom: ${name} <${email}>\nDate: ${new Date(message.at).toLocaleString()}\nSubject: ${thread.subject}\nTo: ${to}\n\n${message.body}`,
      reportType: thread.reportType,
    })
    setDraftId(null)
    setPopped(false)
    setComposing(true)
  }

  // New test and New survey: a request to the Pollster with the fields fielding needs.
  const startRequest = (kind: "test" | "survey") => {
    setDraft({ ...EMPTY_DRAFT, ...REQUESTS[kind] })
    setDraftId(null)
    setPopped(false)
    setSelected(null)
    setComposing(true)
  }

  // A template fills the composer: its sender on the From line, its subject and body ready to edit.
  const fromTemplate = (template: Template) => {
    setDraft({ ...EMPTY_DRAFT, from: template.from, subject: template.subject, body: template.body })
    setDraftId(null)
    setPopped(false)
    setComposing(true)
  }

  // A row dropped on a folder: trash and starred take it, inbox and sent restore
  // it; a sent thread cannot become a draft again, so that drop is a no-op.
  const moveToFolder = (id: string, target: Folder) => {
    patch(id, (t) => {
      if (target === "trash") return { ...t, trashed: true }
      if (target === "starred") return { ...t, starred: true, trashed: false }
      if (target === "inbox" || target === "sent") return { ...t, trashed: false }
      return t
    })
  }

  // Writes the draft into Drafts, replacing the one it was opened from.
  const keepDraft = () => {
    const thread = newThread({
      to: draft.to,
      cc: draft.cc,
      bcc: draft.bcc,
      subject: draft.subject,
      body: draft.body,
      reportType: draft.reportType,
      status: "draft",
    })
    setThreads((current) => [thread, ...current.filter((entry) => entry.id !== draftId)])
    setDraft(EMPTY_DRAFT)
    setDraftId(null)
    return thread
  }

  // Closing the popped-out window keeps anything written as a draft, Gmail's way, and leaves you where you are.
  const closeWindow = () => {
    if (draft.subject.trim() || draft.body.trim() || draft.to.length || draft.cc.length || draft.bcc.length) keepDraft()
    else {
      setDraft(EMPTY_DRAFT)
      setDraftId(null)
    }
    setPopped(false)
  }

  const saveDraft = () => {
    setPopped(false)
    const thread = newThread({
      to: draft.to,
      cc: draft.cc,
      bcc: draft.bcc,
      subject: draft.subject,
      body: draft.body,
      reportType: draft.reportType,
      status: "draft",
    })
    setThreads((current) => [thread, ...current.filter((entry) => entry.id !== draftId)])
    setComposing(false)
    setFolder("drafts")
    setSelected(thread.id)
    setDraft(EMPTY_DRAFT)
    setDraftId(null)
  }

  const editDraft = (thread: Thread) => {
    setDraft({
      to: thread.to ?? [],
      cc: thread.cc ?? [],
      bcc: thread.bcc ?? [],
      subject: thread.subject === "(no subject)" ? "" : thread.subject,
      body: thread.messages[0]?.body ?? "",
      reportType: thread.reportType,
    })
    setDraftId(thread.id)
    setComposing(true)
  }

  // Handing over the paper version: built from the message on the thread, so the
  // file and the page cannot say different things. A filled form is built the
  // same way, from the values the message carries.
  const [pdfError, setPdfError] = React.useState<string | null>(null)
  const openPdf = React.useCallback(async (thread: Thread, message: Message, build: Attached["build"] = "report-pdf") => {
    setPdfError(null)
    try {
      if (build === "form-pdf" && message.form) {
        const [{ fillForm }, { specFor }] = await Promise.all([import("@/lib/forms/fill"), import("@/components/chat/delivery-card")])
        const filled = await fillForm(await specFor(message.form.id), message.form.values)
        save({ blob: filled.blob, pages: filled.pages, bytes: filled.bytes.length, filename: filled.filename })
        return
      }
      save(
        await reportFor(`${thread.id}:${message.id}`, {
          subject: thread.subject,
          reportType: thread.reportType,
          body: message.body,
          steps: message.run?.steps,
          at: message.at,
        })
      )
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : "Could not set the PDF")
    }
  }, [])

  // The latest finished reply is what Copy and Save to Drive act on.
  const latestReply = open ? [...open.messages].reverse().find((message) => message.from !== "you" && message.body && !message.run?.failed) : undefined

  return (
    // America Thinks' frame (Brendan, 2026-10-31): bare, one bar all the way
    // down, the folders in its rail, the thread list and the reading pane
    // beside it.
    <BankFrame
      bare
      tone="rail"
      railDefaultOpen={false}
      crumb="Inbox"
      search={{ query, onQuery: setQuery, placeholder: "Search mail" }}
      rail={
        <InboxRail
          threads={threads}
          folder={folder}
          onFolder={(next) => {
            setFolder(next)
            setComposing(false)
            setSelected(null)
          }}
          onCompose={startCompose}
          onNew={startRequest}
          onDropThread={moveToFolder}
        />
      }
    >
      {(() => {
        const cardOf = (id: string): Card => {
          const thread = byId.get(id)
          if (!thread) return { title: "" }
          const who = folder === "sent" || folder === "drafts" ? `To: ${shownRecipients(thread).join(", ")}` : shownRecipients(thread).join(", ") || thread.agentName
          return {
            title: thread.subject,
            hint: thread.subject,
            from: who,
            snippet: thread.status === "running" ? running(thread) : teaser(thread),
            span: when(thread.updatedAt),
            unread: isUnread(thread),
            marks: {
              column: checked.has(id),
              atCap: false,
              boxLabel: `Select ${thread.subject}`,
              onColumn: () =>
                setChecked((current) => {
                  const next = new Set(current)
                  if (next.has(id)) next.delete(id)
                  else next.add(id)
                  return next
                }),
              // A task still running or one that failed lights the arrow on its own.
              important: Boolean(thread.important) || thread.status === "running" || thread.status === "failed",
              onImportant: () => patch(id, (t) => ({ ...t, important: !t.important })),
              pinned: Boolean(thread.starred),
              onPin: () => patch(id, (t) => ({ ...t, starred: !t.starred })),
            },
            onDragStart: (event) => {
              event.dataTransfer.setData(THREAD_DRAG, id)
              event.dataTransfer.effectAllowed = "move"
            },
          }
        }
        // The thread list's toolbar, in the list kebab: the unread filter, the selection, refresh, mark read, clear.
        const listMenu = (
          <>
            <DropdownMenuRadioGroup value={tab} onValueChange={(value) => setTab(value as ListTab)}>
              <DropdownMenuRadioItem value="all">All {TITLES[folder].toLowerCase()}</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="unread">Unread only</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setChecked(new Set(ids))}>Select all</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setChecked(new Set())}>Select none</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setChecked(new Set(shown.filter(isUnread).map((t) => t.id)))}>Select unread</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setChecked(new Set(shown.filter((t) => t.starred).map((t) => t.id)))}>Select starred</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTick((n) => n + 1)}>Refresh</DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setThreads((current) => current.map((thread) => ({ ...thread, messages: thread.messages.map((message) => (message.from === "you" ? message : { ...message, unread: false })) })))}
            >
              Mark all as read
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                window.localStorage.setItem(CLEARED, "1")
                setThreads([])
                setSelected(null)
              }}
            >
              Clear every thread
            </DropdownMenuItem>
          </>
        )
        const list =
          folder === "templates" ? (
            <TemplateList onUse={fromTemplate} />
          ) : (
            <CardList
              ids={ids}
              card={cardOf}
              selected={selected}
              onOpen={openThread}
              split={split}
              onSplit={setSplit}
              query={query}
              onQuery={setQuery}
              placeholder="Search mail"
              menu={listMenu}
              compact
              loading={false}
              error={null}
              empty={
                query.trim()
                  ? `Nothing matching “${query.trim()}”.`
                  : tab === "unread"
                    ? "Nothing unread."
                    : folder === "inbox"
                      ? "Nothing has arrived yet. Compose a task and the reply lands here."
                      : "Nothing here."
              }
            />
          )
        // Gmail's empty reading pane: nothing chosen, how much of this
        // browser's store the threads take, and the small print at the foot.
        const bytes = new Blob([JSON.stringify(threads)]).size
        const budget = 5 * 1024 * 1024
        const latest = threads.reduce((at, thread) => Math.max(at, thread.updatedAt), 0)
        const empty = (
          <div className="flex h-full flex-col items-center px-8 py-16 text-center">
            <p className="text-lg">No conversations selected</p>
            <div className="mt-12 w-64">
              <Progress value={Math.min(100, (bytes / budget) * 100)} className="*:data-[slot=progress-track]:h-1.5" />
              <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                {bytes < 1024 * 100 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`} of 5 MB used in this browser
                <span className="text-muted-foreground" aria-label="About the agents">
                  <ExternalLink className="size-4" />
                </span>
              </p>
            </div>
            <div className="mt-auto flex flex-col items-center gap-1 pt-16 text-sm text-muted-foreground">
              <p>Last activity: {latest ? when(latest) : "none yet"}</p>
              <p>
                <span>Terms</span>
                {" · "}
                <span>Privacy</span>
                {" · "}
                <span>Program Policies</span>
              </p>
            </div>
          </div>
        )
        const showList = split === "vertical" || (!open && !composing)
        const showPane = split === "vertical" || open || composing
        // Back, one layer up: the full screen to the split, the split to the rows alone.
        const back = (open || composing) && (
          <Tip label="Back">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Back"
              onClick={() => {
                if (split === "vertical") {
                  setSelected(null)
                  setComposing(false)
                  setSplit("none")
                } else setSplit("vertical")
              }}
            >
              <ArrowLeft className="size-4" />
            </Button>
          </Tip>
        )
        const justSent = sent ? threads.find((thread) => thread.id === sent) : undefined
        return (
          <div className="relative flex min-h-0 min-w-0 flex-1">
          <ResizablePanelGroup orientation="horizontal" className="min-h-0 min-w-0 flex-1">
            {/* react-resizable-panels v4 reads bare numbers as pixels. */}
            {showList && (
              <ResizablePanel defaultSize={split === "vertical" ? 420 : 100000} minSize={320} maxSize={split === "vertical" ? 640 : undefined} className="min-w-0">
                {list}
              </ResizablePanel>
            )}
            {showList && showPane && <ResizableHandle withHandle />}
            {showPane && (
              <ResizablePanel className="min-w-0">
                <div className="flex h-full min-h-0 flex-col">
                  {composing ? (
                    <>
                      <div className="flex h-[52px] shrink-0 items-center gap-2 border-b px-4">
                        {back}
                        <span className="text-sm font-medium">New message</span>
                        <Tip label="Pop out">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Pop out"
                            className="ml-auto"
                            onClick={() => {
                              setComposing(false)
                              setPopped(true)
                            }}
                          >
                            <ExternalLink className="size-4" />
                          </Button>
                        </Tip>
                      </div>
                      <div className="flex min-h-0 flex-1 flex-col p-4">
                        <Compose
                          draft={draft}
                          onChange={setDraft}
                          onSend={(current) => void send(current, draftId ?? undefined)}
                          onDiscard={() => {
                            setComposing(false)
                            setDraft(EMPTY_DRAFT)
                            setDraftId(null)
                          }}
                          onSaveDraft={saveDraft}
                        />
                      </div>
                    </>
                  ) : open ? (
                    <>
                      {/* The reading pane's toolbar, as the mail example has it:
                    the actions on this thread at the left, a new task at the
                    right. */}
                      <div className="flex h-[52px] shrink-0 items-center gap-1 border-b px-2">
                        {back}
                        <Tip label={open.starred ? "Remove star" : "Star"}>
                          <Button variant="ghost" size="sm" aria-label={open.starred ? "Remove star" : "Star"} onClick={() => patch(open.id, (t) => ({ ...t, starred: !t.starred }))}>
                            <Star className={cn("size-4", open.starred && "fill-yellow-400 text-yellow-500")} />
                          </Button>
                        </Tip>
                        <Tip label={open.trashed ? "Restore" : "Move to trash"}>
                          <Button variant="ghost" size="sm" aria-label={open.trashed ? "Restore" : "Move to trash"} onClick={() => patch(open.id, (t) => ({ ...t, trashed: !t.trashed }))}>
                            {open.trashed ? <RotateCcw className="size-4" /> : <Trash2 className="size-4" />}
                          </Button>
                        </Tip>
                        {latestReply && (
                          <>
                            <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
                            <Tip label="Copy the report">
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label="Copy the report"
                                onClick={() => {
                                  void navigator.clipboard?.writeText(latestReply.body)
                                  setCopied(latestReply.id)
                                  window.setTimeout(() => setCopied(null), 1500)
                                }}
                              >
                                {copied === latestReply.id ? <Check className="size-4" /> : <Copy className="size-4" />}
                              </Button>
                            </Tip>
                            {/* Save to Drive sits beside Copy because it is the same
                          kind of act — take this reply somewhere of your own —
                          and it saves the string the reader is looking at, so
                          the document cannot differ from the report on the
                          page. */}
                            <SaveToDrive name={open.subject || "pax report"} markdown={latestReply.body} />
                          </>
                        )}
                        <div className="ml-auto flex items-center gap-1">
                          {open.status !== "draft" && (
                            <Tip label="Reply">
                              <Button variant="ghost" size="sm" aria-label="Reply" onClick={() => setReplying(true)}>
                                <ReplyIcon className="size-4" />
                              </Button>
                            </Tip>
                          )}
                          <Tip label="New task">
                            <Button variant="ghost" size="sm" aria-label="New task" onClick={startCompose}>
                              <PenSquare className="size-4" />
                            </Button>
                          </Tip>
                        </div>
                      </div>

                      {/* The thread, Gmail's way: the subject as its title, then
                    every message as mail — who sent it, who it went to, when —
                    yours included. The agent's reply is set on a quiet ground,
                    the "this came from a model" cue. */}
                      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                        <div className="flex items-start gap-4 px-6 pt-5 pb-2">
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                            <h2 className="min-w-0 truncate text-xl font-medium">{open.subject}</h2>
                            <Marker thread={open} onToggle={() => patch(open.id, (t) => ({ ...t, important: !t.important }))} />
                            {open.reportType && <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{open.reportType}</span>}
                          </div>
                          <div className="ml-auto shrink-0 pt-1 text-right text-xs text-muted-foreground">
                            {open.trashed && <div>in trash</div>}
                            {open.deliveredTo && <div>delivered to {open.deliveredTo}</div>}
                            {threadCost(open) > 0 && (
                              <div>
                                {runners(open).length} run{runners(open).length === 1 ? "" : "s"}, ${threadCost(open).toFixed(3)}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="divide-y">
                          {open.messages.map((message) => {
                            const mine = message.from === "you"
                            const trace = isTrace(open.reportType)
                            const name = mine ? ADMIN_USER.name : nameOf(message.from)
                            const email = mine ? ADMIN_USER.email : findAddress(message.from)?.email
                            const to = mine ? shownRecipients(open).join(", ") || open.agentName : "me"
                            const isFolded = folded.has(message.id)
                            const fold = () =>
                              setFolded((current) => {
                                const next = new Set(current)
                                if (next.has(message.id)) next.delete(message.id)
                                else next.add(message.id)
                                return next
                              })
                            return (
                              <article key={message.id} className="group/msg px-6 py-4">
                                {/* The header is the collapse, as in Gmail: click folds the message
                                    to its one-line state, the snippet standing in for the body. */}
                                <header className="flex cursor-pointer items-start gap-3" onClick={fold}>
                                  <Sender from={message.from} />
                                  <div className="min-w-0 flex-1 pt-0.5">
                                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                                      <span className="shrink-0 font-semibold">{name}</span>
                                      {isFolded ? (
                                        <span className="min-w-0 truncate text-sm text-muted-foreground">{snippet(message) || "…"}</span>
                                      ) : (
                                        <>
                                          {email && <span className="text-xs text-muted-foreground">&lt;{email}&gt;</span>}
                                          {message.unread && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Unread</span>}
                                        </>
                                      )}
                                    </div>
                                    {!isFolded && <div className="text-xs text-muted-foreground">to {to}</div>}
                                  </div>
                                  <time className="shrink-0 pt-0.5 text-xs text-muted-foreground" dateTime={new Date(message.at).toISOString()}>
                                    {when(message.at)}
                                  </time>
                                  {open.status !== "draft" && (
                                    <span className="flex shrink-0 items-center" onClick={(event) => event.stopPropagation()}>
                                      <Tip label="Reply">
                                        <Button variant="ghost" size="sm" aria-label="Reply" className="size-7 p-0" onClick={() => setReplying(true)}>
                                          <ReplyIcon className="size-4" />
                                        </Button>
                                      </Tip>
                                      <Tip label="Forward">
                                        <Button variant="ghost" size="sm" aria-label="Forward" className="size-7 p-0" onClick={() => startForward(open, message)}>
                                          <ForwardIcon className="size-4" />
                                        </Button>
                                      </Tip>
                                    </span>
                                  )}
                                </header>

                                {!isFolded && (
                                <div className="mt-3 flex flex-col gap-3 pl-[52px]">
                                  {mine ? (
                                    <div className="text-sm whitespace-pre-wrap">
                                      <Prose text={message.body} />
                                    </div>
                                  ) : (
                                    (message.body || (trace && calls(message) > 0)) && (
                                      <div className="rounded-lg bg-muted/60 p-4">
                                        <div className={cn("text-sm whitespace-pre-wrap", message.run?.failed && "text-destructive")}>
                                          {/* A Trace Report is the run, laid out — the steps are its
                                              sections. Every other format is markdown and renders as
                                              markdown, here and in the PDF alike. */}
                                          {trace && message.run && !message.run.failed ? (
                                            <TraceReport steps={message.run.steps} body={message.body} running={!message.run.done} />
                                          ) : (
                                            <Prose text={message.body} />
                                          )}
                                        </div>
                                      </div>
                                    )
                                  )}

                                  {message.run && !message.run.done && (
                                    // The reading pane's own sign of life, under whatever has
                                    // arrived so far. It names the tool in flight rather than
                                    // saying "working", so a long gather reads as progress
                                    // instead of as a hang.
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <span aria-hidden className="size-2 shrink-0 animate-pulse rounded-full bg-primary" />
                                      <span className="animate-pulse">{running(open)}</span>
                                    </div>
                                  )}

                                  {calls(message) > 0 && (
                                    <details className="rounded-lg border p-3">
                                      <summary className="cursor-pointer text-sm text-muted-foreground">
                                        {calls(message)} tool call
                                        {calls(message) === 1 ? "" : "s"}
                                        {message.run!.done ? "" : " so far"}
                                      </summary>
                                      <div className="pt-3">
                                        <RunSteps steps={message.run!.steps} />
                                      </div>
                                    </details>
                                  )}

                                  {message.attachments?.length ? (
                                    <div className="flex flex-col gap-1.5">
                                      <AttachmentGroup items={message.attachments} onBuild={(item) => void openPdf(open, message, item.build)} />
                                      {pdfError && <p className="text-destructive text-xs">{pdfError}</p>}
                                    </div>
                                  ) : null}
                                </div>
                                )}
                              </article>
                            )
                          })}
                        </div>

                        {/* Gmail's foot: Reply and Forward in flow right under the last
                            message, sticky so they never scroll off — a long thread pins them
                            to the shell's bottom and the messages scroll up behind them. The
                            composer card opens in the same spot. */}
                        <div className="sticky bottom-0 bg-background px-6 pt-2 pb-6 pl-[76px]">
                        {open.status === "draft" ? (
                          <Button size="sm" className="self-start" onClick={() => editDraft(open)}>
                            Edit draft
                          </Button>
                        ) : replying ? (
                          <div className="flex flex-col rounded-2xl border bg-background shadow-sm">
                            <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
                              <Sender from="you" />
                              {editingTo ? (
                                <span className="text-sm text-muted-foreground">Reply</span>
                              ) : (
                                <button
                                  type="button"
                                  className="flex min-w-0 items-center gap-3 text-left"
                                  title="Edit recipients"
                                  onClick={() => setEditingTo(true)}
                                >
                                  <ReplyIcon className="size-4 shrink-0 text-muted-foreground" />
                                  <span className="min-w-0 truncate text-sm text-muted-foreground">{shownRecipients(open).join(", ") || open.agentName}</span>
                                </button>
                              )}
                            </div>
                            <div className="flex flex-col p-4 pt-3">
                              <Compose
                                inline
                                reply={editingTo}
                                placeholder=""
                                draft={replyDraft}
                                onChange={setReplyDraft}
                                onSend={(current) => {
                                  const text = current.body
                                  setReplyDraft({ ...current, body: "" })
                                  setEditingTo(false)
                                  const lines = { to: current.to, cc: current.cc, bcc: current.bcc }
                                  patch(open.id, (t) => ({ ...t, ...lines }))
                                  void followUp({ ...open, ...lines }, text)
                                }}
                                onDiscard={() => {
                                  setReplying(false)
                                  setEditingTo(false)
                                  setReplyDraft((current) => ({ ...current, body: "" }))
                                }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" className="rounded-full" onClick={() => setReplying(true)}>
                              <ReplyIcon className="size-4" />
                              Reply
                            </Button>
                            <Button variant="outline" size="sm" className="rounded-full" onClick={() => startForward(open, open.messages.at(-1)!)}>
                              <ForwardIcon className="size-4" />
                              Forward
                            </Button>
                          </div>
                        )}
                        </div>
                      </div>
                    </>
                  ) : (
                    empty
                  )}
                </div>
              </ResizablePanel>
            )}
          </ResizablePanelGroup>
          {justSent && (
            // Gmail's bar: dark, bottom left, gone in a few seconds. "View"
            // opens the thread in Sent, where it is.
            <div role="status" className="absolute bottom-4 left-4 z-20 flex items-center gap-4 rounded-md bg-foreground px-4 py-2.5 text-sm text-background shadow-lg">
              <span>Message sent{mailNote ? ` · ${mailNote}` : ""}</span>
              <button
                type="button"
                className="font-medium text-background/80 hover:text-background"
                onClick={() => {
                  setFolder("sent")
                  openThread(justSent.id)
                  setSent(null)
                }}
              >
                View
              </button>
            </div>
          )}
          {popped && (
            <ComposeWindow title={draft.subject.trim() || "New message"} onClose={closeWindow}>
              <Compose
                draft={draft}
                onChange={setDraft}
                onSend={(current) => void send(current, draftId ?? undefined)}
                onDiscard={() => {
                  setPopped(false)
                  setDraft(EMPTY_DRAFT)
                  setDraftId(null)
                }}
              />
            </ComposeWindow>
          )}
          </div>
        )
      })()}
    </BankFrame>
  )
}
