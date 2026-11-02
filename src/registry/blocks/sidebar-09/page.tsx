"use client"

import * as React from "react"
import { ArrowLeft, Check, Clock, Copy, ExternalLink, Forward as ForwardIcon, PenSquare, Reply as ReplyIcon, RotateCcw, Star, Trash2 } from "lucide-react"

import { ADDRESSES, PEOPLE_ADDRESSES, addressFor, keptThread, loadDrafts, nameOf, newThread, saveDrafts, shownRecipients, snippet, when, type Attached, type Folder, type Message, type Thread } from "@/lib/agents/inbox"
import { applyFiling, fileThread, isAgentBox, listTime, marksOf, readFolder, showsIn, snoozeTime, type Counts, type Filing, type Kept } from "@/lib/mail/client"
import { PENDING_DRAFT } from "@/lib/agents/pending-draft"
import { fieldingRequest } from "@/lib/agents/live"
import { cn } from "@/lib/utils"
import { useShellPanel } from "@/components/shell"
import { SaveToDrive } from "@/components/connectors/save-to-drive"
import { Prose, RunSteps } from "@/app/agents/transcript"
import { BankFrame } from "@/components/bank/bank-frame"
import type { Split } from "@/components/bank/card-list"
import { myNotes } from "@/app/note-actions"
import { NOTES_CHANGED, openDrawnNote } from "@/lib/drawn-notes"
import { MenuRow, MenuSeparator } from "@/components/kebab-menu"
import { ArchiveIcon, MailList, MarkUnreadIcon, UnarchiveIcon, type MailActions, type MailRowView, type SelectBy } from "@/registry/blocks/sidebar-09/components/mail-list"
import { InboxRail, THREAD_DRAG } from "@/registry/blocks/sidebar-09/components/app-sidebar"
import { SnoozeMenu } from "@/registry/blocks/sidebar-09/components/snooze-menu"
import { BoxMark, MailboxChip, ownersFor, type Owner } from "@/registry/blocks/sidebar-09/components/mailbox-chip"
import { Compose, EMPTY_DRAFT, type Draft } from "@/registry/blocks/sidebar-09/components/compose"
import { ComposeWindow } from "@/registry/blocks/sidebar-09/components/compose-window"
import { TemplateList } from "@/registry/blocks/sidebar-09/components/template-list"
import type { Template } from "@/lib/agents/templates"
import { requestOf } from "@/lib/agents/requests"
import { isTrace } from "@/lib/agents/report-modes"
import { reportFor, save } from "@/lib/agents/report-pdf"
import { AttachmentGroup } from "@/registry/blocks/sidebar-09/components/attachment"
import { TraceReport } from "@/registry/blocks/sidebar-09/components/trace-report"
import { Marker } from "@/registry/blocks/sidebar-09/components/thread-list"
import { Button } from "@govblock/ui/components/nova/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@govblock/ui/components/ny4/resizable"
import { Separator } from "@govblock/ui/components/ny4/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/ny4/tooltip"

// The Agentic Inbox — shadcn's sidebar-09 mail block, repurposed, and since
// 2026-09-02 laid out the way shadcn's mail example is: the icon rail, then a
// resizable row of the thread list and the reading pane, the whole thing the
// height of its frame with each pane scrolling on its own.
//
// It is mail all the way down because half a mail metaphor reads as a broken one
// (Brendan, 2026-09-07: "you are still treating this like chat instead of like
// email"). Since 2026-11-02 it is Gmail (Brendan: "literally a Google knock off…
// from there we can refine it"), and the mail is the server's (lib/mail/store.ts
// through /api/inbox/mail): every folder, every read, star, archive and trash is
// a row there, so the inbox is the same on any browser. Opening a thread marks
// it read, as Gmail does. The super admin can open the agents' mailboxes from the
// chip at the rail's foot; everyone else reads their own. What stays in this
// browser is the drafts, until the server keeps them.

function monogram(name: string) {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

/** Who a message is from, as mail shows it: the open mailbox's own mark for its sent mail, an agent's mark, a person's face, or a monogram. */
function Sender({ from, name, owner, className }: { from: string; name: string; owner: Owner; className?: string }) {
  if (from === "you") return <BoxMark owner={owner} className={cn("size-10 text-sm", className)} />
  if (isAgentBox(from)) return <BoxMark owner={{ box: from, name: nameOf(from), email: "" }} className={cn("size-10 text-sm", className)} />
  const image = addressFor(from)?.image
  if (image) return <img src={image} alt="" className={cn("size-10 shrink-0 rounded-full object-cover", className)} />
  return <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground", className)}>{monogram(name)}</span>
}

/** A kept message as it was sent: its own HTML in a frame that runs no script, as tall as the mail. */
function MailFrame({ html }: { html: string }) {
  const frame = React.useRef<HTMLIFrameElement>(null)
  const [height, setHeight] = React.useState(160)
  const base = '<base target="_blank">'
  const doc = /<html[\s>]/i.test(html)
    ? html.replace(/<head([^>]*)>/i, (head) => head + base)
    : `<!doctype html><html><head><meta charset="utf-8">${base}<style>body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#202124}</style></head><body>${html}</body></html>`
  return (
    <iframe
      ref={frame}
      title="Message"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={doc}
      onLoad={() => {
        const root = frame.current?.contentDocument?.documentElement
        if (root) setHeight(root.scrollHeight)
      }}
      style={{ height }}
      className="w-full border-0"
    />
  )
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

/** A handle as the send route takes it: an agent by its AgentMail address, a person or partner by theirs, a bare address as it is. Groups and channels are no one's mailbox. */
function recipientsOf(handles: string[]) {
  return handles.flatMap((handle) => {
    const a = addressFor(handle)
    if (!a) return handle.includes("@") ? [{ email: handle }] : []
    if (a.kind === "agent") return [{ email: a.email }]
    if (a.kind === "person" || a.kind === "partner") return [{ email: a.email, name: a.name }]
    return []
  })
}

/** An address as the composer's lines hold it: the book's handle where it knows it, else the address. */
const handleOf = (email: string) => ADDRESSES.find((a) => a.email.toLowerCase() === email.toLowerCase())?.agent ?? email

/** Who a reply goes to, Gmail's Reply: the sender of the latest message the mailbox received, else whom its own latest went to. */
function replyLines(t: Kept): string[] {
  const received = [...t.messages].reverse().find((m) => m.folder !== "sent")
  return received ? [handleOf(received.from.email)] : t.latest.to.map((p) => handleOf(p.email))
}

/** One row of the list: a kept thread, or one of this browser's drafts. */
type Row = { id: string; kept?: Kept; draft?: Thread }

/** The reader, as the account chip names them: /api/auth/me's name, the staff photo where there is one. */
function useMe(): { name: string; email: string } | null {
  const [me, setMe] = React.useState<{ name: string; email: string } | null>(null)
  React.useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { user?: { name: string; email: string } | null }) => setMe(d.user ?? null))
      .catch(() => setMe(null))
  }, [])
  return me
}

export default function Page() {
  const { superAdmin } = useShellPanel()
  const account = useMe()
  // Whose mail: "me", or an agent's slug (the super admin's choice, from the chip).
  const [mailbox, setMailbox] = React.useState("me")
  // The address the server reads as "me" (lib/mail/store.ts personMailbox), learned from its first answer.
  const [myBox, setMyBox] = React.useState<string | null>(null)
  const [folder, setFolder] = React.useState<Folder>("inbox")
  // The open folder as the server keeps it, keyed so a late answer for another folder is dropped.
  const [mail, setMail] = React.useState<{ key: string; threads: Kept[] }>({ key: "", threads: [] })
  const [counts, setCounts] = React.useState<Counts>({})
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [drafts, setDrafts] = React.useState<Thread[]>([])
  const [restored, setRestored] = React.useState(false)
  const [selected, setSelected] = React.useState<string | null>(null)
  const [unreadOnly, setUnreadOnly] = React.useState(false)
  const [composing, setComposing] = React.useState(false)
  // The composer popped out into Gmail's floating window (compose-window.tsx); the draft is the same one.
  const [popped, setPopped] = React.useState(false)
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT)
  const [draftId, setDraftId] = React.useState<string | null>(null)
  const [replyDraft, setReplyDraft] = React.useState<Draft>(EMPTY_DRAFT)
  // The reply composer is asked for, not always there.
  const [replying, setReplying] = React.useState(false)
  // Gmail's "Message sent" bar, for a few seconds: when it went, and the thread the server kept it in.
  const [sent, setSent] = React.useState<{ at: number; threadId?: string } | null>(null)
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
  // The list alone, or the list beside the reading pane (Brendan, 2026-09-07: Gmail's split toggle).
  const [split, setSplit] = React.useState<Split>("none")

  // Whose mail is open, as the chip and the reading pane name them.
  const me: Owner = React.useMemo(() => {
    const email = myBox ?? account?.email ?? ""
    const staff = PEOPLE_ADDRESSES.find((p) => p.email.toLowerCase() === email.toLowerCase())
    return { box: "me", name: staff?.name ?? account?.name ?? (email.split("@")[0] || "My inbox"), email, image: staff?.image }
  }, [myBox, account])
  const owner: Owner = React.useMemo(() => ownersFor(me).find((o) => o.box === mailbox) ?? me, [me, mailbox])
  const mine = mailbox === "me"

  // The drafts, this browser's; a question card handed over from /consensus opens as a New test.
  React.useEffect(() => {
    setDrafts(loadDrafts())
    setRestored(true)
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
    if (restored) saveDrafts(drafts)
  }, [drafts, restored])

  // The open folder, read from the server; Templates reads the inbox for the counts alone.
  const key = `${mailbox}:${folder}`
  const keyRef = React.useRef(key)
  keyRef.current = key
  const load = React.useCallback(
    async (quiet = false) => {
      const asked = `${mailbox}:${folder}`
      if (!quiet) setLoading(true)
      try {
        const res = await readFolder(mailbox, folder === "templates" ? "inbox" : folder)
        if (keyRef.current !== asked) return
        if (mailbox === "me") setMyBox(res.mailbox)
        setMail({ key: asked, threads: folder === "templates" ? [] : res.threads })
        setCounts(res.counts)
        setError(null)
      } catch (e) {
        if (keyRef.current === asked) setError(e instanceof Error ? e.message : "The mail could not be read just now.")
      } finally {
        if (keyRef.current === asked) setLoading(false)
      }
    },
    [mailbox, folder]
  )
  React.useEffect(() => {
    void load()
    const every = window.setInterval(() => void load(true), 60_000)
    return () => window.clearInterval(every)
  }, [load])

  // My notes, read on arrival and again whenever a drawn note is kept or deleted.
  const [notes, setNotes] = React.useState<{ id: string; title: string }[]>([])
  React.useEffect(() => {
    const read = () => void myNotes().then((r) => setNotes(r.notes.map((n) => ({ id: n.id, title: n.title }))), () => {})
    read()
    window.addEventListener(NOTES_CHANGED, read)
    return () => window.removeEventListener(NOTES_CHANGED, read)
  }, [])

  // The rows: the folder's kept threads, and in my Drafts this browser's drafts.
  const kept = mail.key === key ? mail.threads : []
  const rows: Row[] = React.useMemo(
    () => [...(folder === "drafts" && mine ? drafts.map((d) => ({ id: d.id, draft: d })) : []), ...kept.map((t) => ({ id: t.threadId, kept: t }))],
    [folder, mine, drafts, kept]
  )
  const byId = React.useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows])

  // The list through the search and the unread filter.
  const shown = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => {
      if (unreadOnly && !(r.kept && r.kept.unreadCount > 0)) return false
      if (!q) return true
      const hay = r.kept
        ? [r.kept.latest.subject, ...r.kept.messages.flatMap((m) => [m.from.name, m.from.email, m.snippet, m.markdown ?? ""])]
        : [r.draft!.subject, ...r.draft!.messages.map((m) => m.body)]
      return hay.join(" ").toLowerCase().includes(q)
    })
  }, [rows, query, unreadOnly])

  const openRow = selected ? byId.get(selected) : undefined
  const open: Thread | null = React.useMemo(() => (openRow?.draft ? openRow.draft : openRow?.kept ? keptThread(openRow.kept) : null), [openRow])

  // A filing: the list moves at once (a thread leaving the folder leaves the list), the server takes it,
  // and the folder and its counts are read again.
  const file = React.useCallback(
    async (threadIds: string[], patch: Filing) => {
      if (!threadIds.length) return
      setMail((current) => ({ ...current, threads: current.threads.map((t) => (threadIds.includes(t.threadId) ? applyFiling(t, patch) : t)).filter((t) => folder === "templates" || showsIn(t, folder)) }))
      await Promise.all(threadIds.map((id) => fileThread(mailbox, id, patch)))
      void load(true)
    },
    [mailbox, folder, load]
  )

  // Opening a thread marks it read, as Gmail does: on the open, not on a reply.
  const openThread = (id: string) => {
    setSelected(id)
    setComposing(false)
    setSplit("vertical")
    const row = byId.get(id)
    if (row?.kept && row.kept.unreadCount > 0) void file([id], { read: true })
  }

  // Marking an open thread unread puts it away, as Gmail does, so it stays unread.
  const markUnread = (id: string) => {
    if (selected === id) setSelected(null)
    void file([id], { read: false })
  }
  // Archive and trash take the thread out of the folder; the open one closes.
  const fileAway = (id: string, patch: Filing) => {
    if (selected === id) setSelected(null)
    void file([id], patch)
  }

  // Gmail's bar: the send went, and View opens it where the server kept it.
  const announce = React.useCallback((threadId?: string) => {
    const at = Date.now()
    setSent({ at, threadId })
    window.setTimeout(() => setSent((current) => (current?.at === at ? null : current)), 6000)
  }, [])

  // A send through /api/inbox/send: people are mailed, an agent's copy is kept in its mailbox, and the
  // server keeps it in my Sent. Sending closes the composer and leaves you where you were, mail's way.
  const send = React.useCallback(
    async (draft: Draft, existingId?: string) => {
      const everyone = [...draft.to, ...draft.cc, ...draft.bcc]
      if (!everyone.length) return
      if (existingId) setDrafts((current) => current.filter((d) => d.id !== existingId))
      if (selected === existingId) setSelected(null)
      setComposing(false)
      setPopped(false)
      setDraft(EMPTY_DRAFT)
      setDraftId(null)
      setMailNote(null)
      announce()

      const to = recipientsOf(draft.to)
      const cc = recipientsOf(draft.cc)
      if (to.length || cc.length)
        void fetch("/api/inbox/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to, cc, subject: draft.subject, markdown: draft.body }),
        })
          .then((res) => res.json())
          .then((res: { sent?: string[]; held?: string[]; error?: string; threadIds?: string[] }) => {
            if (res.threadIds?.[0]) setSent((current) => (current ? { ...current, threadId: res.threadIds![0] } : current))
            const held = res.held?.length ? `${res.held.length} held by the allowlist` : ""
            setMailNote(res.error ? `Not sent: ${res.error}` : res.sent?.length ? [`Sent to ${res.sent.join(", ")}`, held].filter(Boolean).join(" · ") : held || null)
            void load(true)
          })
          .catch(() => setMailNote("Not sent"))

      // A New test or New survey to the Pollster naming a real group starts it going out.
      const request = fieldingRequest(draft.to, draft.cc, draft.body)
      if (request)
        void fetch("/api/fielding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) })
          .then((res) => res.json())
          .then((res: { sent?: number; held?: number; error?: string }) => setMailNote(res.error ? `Not sent: ${res.error}` : `${res.sent} invitations sent${res.held ? `, ${res.held} held` : ""}`))
          .catch(() => setMailNote("Not sent"))
    },
    [announce, selected, load]
  )

  // A reply joins its thread: the server keeps it there in my Sent and in each recipient's Inbox.
  const sendReply = React.useCallback(
    async (thread: Thread, lines: { to: string[]; cc: string[] }, text: string) => {
      setReplying(false)
      announce(thread.id)
      const subject = /^re:/i.test(thread.subject) ? thread.subject : `Re: ${thread.subject}`
      try {
        const res = await fetch("/api/inbox/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: recipientsOf(lines.to), cc: recipientsOf(lines.cc), subject, markdown: text, threadId: thread.id }),
        })
        const body = (await res.json()) as { error?: string; held?: string[] }
        setMailNote(body.error ? `Not sent: ${body.error}` : body.held?.length ? `${body.held.length} held by the allowlist` : null)
      } catch {
        setMailNote("Not sent")
      }
      void load(true)
    },
    [announce, load]
  )

  // A reply addresses the thread's sender, Gmail's Reply. Opening another thread puts the composer away.
  const openId = open?.id ?? null
  React.useEffect(() => {
    setReplying(false)
    setFolded(new Set())
    setEditingTo(false)
    if (!openRow?.kept) return
    setReplyDraft({ ...EMPTY_DRAFT, to: replyLines(openRow.kept) })
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
  // quotes one, so the reader picks recipients and sends it on.
  const startForward = (thread: Thread, message: Message) => {
    const name = message.from === "you" ? owner.name : (message.fromName ?? nameOf(message.from))
    const email = message.from === "you" ? owner.email : (message.fromEmail ?? addressFor(message.from)?.email ?? "")
    const to = message.toParties?.map((p) => p.name || p.email).join(", ") ?? shownRecipients(thread).join(", ")
    setDraft({
      to: [],
      cc: [],
      bcc: [],
      subject: /^fwd:/i.test(thread.subject) ? thread.subject : `Fwd: ${thread.subject}`,
      body: `---------- Forwarded message ---------\nFrom: ${name} <${email}>\nDate: ${new Date(message.at).toLocaleString()}\nSubject: ${thread.subject}\nTo: ${to}\n\n${message.body}`,
    })
    setDraftId(null)
    setPopped(false)
    setComposing(true)
  }

  // New test and New survey: a request to the Pollster with the fields sending it needs.
  const startRequest = (kind: "test" | "survey") => {
    const r = requestOf(kind)
    setDraft({ ...EMPTY_DRAFT, to: [...r.to], subject: r.subject, body: r.body })
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
  // The rail's Templates (Brendan, 2026-10-31): a template picked while writing fills the message being written,
  // its sender, subject and body, and keeps who it goes to; otherwise it starts a new one.
  const applyTemplate = (template: Template) => {
    if (!composing) return fromTemplate(template)
    setDraft((d) => ({ ...d, from: template.from, subject: template.subject, body: template.body }))
  }

  // A row dropped on a folder files it there: Trash, Starred, back to the Inbox, or out of it to All mail.
  const moveToFolder = (id: string, target: Folder) => {
    const row = byId.get(id)
    if (row?.draft) {
      if (target === "trash") setDrafts((current) => current.filter((d) => d.id !== id))
      return
    }
    if (target === "trash") fileAway(id, { trashed: true })
    else if (target === "starred") void file([id], { starred: true, trashed: false })
    else if (target === "inbox") void file([id], { archived: false, trashed: false, snoozedUntil: null })
    else if (target === "all") fileAway(id, { archived: true, trashed: false })
  }

  // Writes the draft into Drafts, replacing the one it was opened from.
  const keepDraft = () => {
    const thread = newThread({ to: draft.to, cc: draft.cc, bcc: draft.bcc, subject: draft.subject, body: draft.body, reportType: draft.reportType, status: "draft" })
    setDrafts((current) => [thread, ...current.filter((entry) => entry.id !== draftId)])
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
    const thread = keepDraft()
    setComposing(false)
    setMailbox("me")
    setFolder("drafts")
    setSelected(thread.id)
  }

  const editDraft = (thread: Thread) => {
    setDraft({ to: thread.to ?? [], cc: thread.cc ?? [], bcc: thread.bcc ?? [], subject: thread.subject === "(no subject)" ? "" : thread.subject, body: thread.messages[0]?.body ?? "", reportType: thread.reportType })
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
      save(await reportFor(`${thread.id}:${message.id}`, { subject: thread.subject, reportType: thread.reportType, body: message.body, steps: message.run?.steps, at: message.at }))
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : "Could not set the PDF")
    }
  }, [])

  // The latest message someone else wrote is what Copy and Save to Drive act on.
  const latestReply = open ? [...open.messages].reverse().find((message) => message.from !== "you" && message.body && !message.run?.failed) : undefined
  const openMarks = openRow?.kept ? marksOf(openRow.kept) : null

  // The folders' counts: the server's unread threads, and my drafts in Drafts.
  const railCounts: Partial<Record<Folder, number>> = { ...counts, drafts: mine ? drafts.length + (counts.drafts ?? 0) : (counts.drafts ?? 0) }

  const switchMailbox = (box: string) => {
    if (box === mailbox) return
    setMailbox(box)
    setFolder("inbox")
    setSelected(null)
    setComposing(false)
    setChecked(new Set())
  }

  return (
    // America Thinks' frame (Brendan, 2026-10-31): bare, one bar all the way
    // down, the folders in its rail, the thread list and the reading pane
    // beside it. The rail opens with the page, Gmail's (the lead, 2026-11-02):
    // the folders and the mailbox chip are always there.
    <BankFrame
      bare
      tone="rail"
      crumb="Inbox"
      search={{ query, onQuery: setQuery, placeholder: "Search mail" }}
      rail={
        <InboxRail
          counts={railCounts}
          folder={folder}
          onFolder={(next) => {
            setFolder(next)
            setComposing(false)
            setSelected(null)
            setChecked(new Set())
          }}
          onCompose={startCompose}
          onNew={startRequest}
          onDropThread={moveToFolder}
          notes={notes}
          onOpenNote={openDrawnNote}
          onTemplate={applyTemplate}
          chip={<MailboxChip owner={owner} me={me} superAdmin={superAdmin} onPick={switchMailbox} />}
        />
      }
    >
      {(() => {
        // Gmail's rows (mail-list.tsx): who, the subject, the snippet, the time, the marks.
        const views: MailRowView[] = shown.map((row) => {
          if (row.draft) {
            const t = row.draft
            return { id: t.id, sender: `To: ${shownRecipients(t).join(", ") || "(no recipients)"}`, subject: t.subject, snippet: snippet(t.messages[0] ?? { id: "", from: "you", at: 0, body: "" }), span: listTime(new Date(t.updatedAt).toISOString()), unread: false, starred: false, important: false, draft: true }
          }
          const t = row.kept!
          const marks = marksOf(t)
          const names = [...new Set(t.messages.map((m) => (m.folder === "sent" ? "me" : m.from.name || m.from.email)))]
          return {
            id: t.threadId,
            sender: folder === "sent" ? `To: ${t.latest.to.map((p) => p.name || p.email).join(", ")}` : names.join(", "),
            count: t.messages.length,
            subject: t.latest.subject,
            snippet: t.latest.snippet,
            // In Snoozed, the time it comes back, as Gmail's Snoozed shows it.
            span: folder === "snoozed" && marks.snoozedUntil ? snoozeTime(new Date(marks.snoozedUntil)) : listTime(t.latest.createdAt),
            unread: marks.unread,
            starred: marks.starred,
            important: marks.important,
            archived: marks.archived,
            trashed: marks.trashed,
            snoozed: !!marks.snoozedUntil,
          }
        })
        const viewOf = new Map(views.map((v) => [v.id, v]))
        const discard = (id: string) => {
          setDrafts((current) => current.filter((d) => d.id !== id))
          if (selected === id) setSelected(null)
        }
        const actions: MailActions = {
          onOpen: openThread,
          onCheck: (id) =>
            setChecked((current) => {
              const next = new Set(current)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            }),
          onStar: (id) => void file([id], { starred: !viewOf.get(id)?.starred }),
          onImportant: (id) => void file([id], { important: !viewOf.get(id)?.important }),
          onArchive: (id) => fileAway(id, { archived: !viewOf.get(id)?.archived }),
          onTrash: (id) => (viewOf.get(id)?.draft ? discard(id) : fileAway(id, { trashed: !viewOf.get(id)?.trashed })),
          onRead: (id, read) => (read ? void file([id], { read: true }) : markUnread(id)),
          // Snoozed, it leaves the Inbox for Snoozed until its time; the open one closes.
          snooze: (id, trigger) => (
            <SnoozeMenu trigger={trigger} snoozed={!!viewOf.get(id)?.snoozed} onSnooze={(at) => fileAway(id, { snoozedUntil: at.toISOString() })} onUnsnooze={() => void file([id], { snoozedUntil: null })} />
          ),
          onDragStart: (id, event) => {
            event.dataTransfer.setData(THREAD_DRAG, id)
            event.dataTransfer.effectAllowed = "move"
          },
        }
        // The select box's menu, Gmail's.
        const select = (by: SelectBy) => {
          const pick = (keep: (v: MailRowView) => boolean) => setChecked(new Set(views.filter(keep).map((v) => v.id)))
          if (by === "none") setChecked(new Set())
          else if (by === "all") pick(() => true)
          else if (by === "read") pick((v) => !v.unread)
          else if (by === "unread") pick((v) => v.unread)
          else if (by === "starred") pick((v) => v.starred)
          else pick((v) => !v.starred)
        }
        // What the bar does to the checked rows; the open one closes if it leaves.
        const bulk = (act: "archive" | "trash" | "read" | "unread" | Date) => {
          const ids = [...checked].filter((id) => viewOf.get(id) && !viewOf.get(id)!.draft)
          if (act === "trash") checked.forEach((id) => viewOf.get(id)?.draft && discard(id))
          if (act !== "read" && selected && checked.has(selected)) setSelected(null)
          setChecked(new Set())
          void file(ids, act instanceof Date ? { snoozedUntil: act.toISOString() } : act === "archive" ? { archived: true } : act === "trash" ? { trashed: true } : { read: act === "read" })
        }
        // The kebab: the unread filter, mark all read, and the split.
        const listMenu = (
          <>
            <MenuRow label="Unread only" checked={unreadOnly} onClick={() => setUnreadOnly((v) => !v)} />
            <MenuRow label="Mark all as read" onClick={() => void file(views.filter((v) => v.unread && !v.draft).map((v) => v.id), { read: true })} />
            <MenuSeparator />
            <MenuRow label="No split" checked={split === "none"} onClick={() => setSplit("none")} />
            <MenuRow label="Vertical split" checked={split === "vertical"} onClick={() => setSplit("vertical")} />
          </>
        )
        const list =
          folder === "templates" ? (
            <TemplateList onUse={fromTemplate} />
          ) : (
            <MailList
              rows={views}
              open={selected}
              checked={checked}
              layout={split === "vertical" ? "stacked" : "line"}
              actions={actions}
              onSelect={select}
              onBulk={bulk}
              bulkSnooze={(trigger) => <SnoozeMenu align="left" trigger={trigger} onSnooze={(at) => bulk(at)} />}
              onRefresh={() => void load()}
              menu={listMenu}
              query={query}
              onQuery={setQuery}
              loading={loading}
              error={error}
              empty={query.trim() ? `Nothing matching “${query.trim()}”.` : unreadOnly ? "Nothing unread." : folder === "inbox" ? "Nothing has arrived yet." : "Nothing here."}
            />
          )
        // Gmail's empty reading pane: nothing chosen, and the small print at the foot.
        const latest = kept.reduce((at, t) => Math.max(at, Date.parse(t.latest.createdAt) || 0), 0)
        const empty = (
          <div className="flex h-full flex-col items-center px-8 py-16 text-center">
            <p className="text-lg">No conversations selected</p>
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
                    the actions on this thread at the left, a new message at the
                    right. */}
                      <div className="flex h-[52px] shrink-0 items-center gap-1 border-b px-2">
                        {back}
                        {openMarks && (
                          <>
                            <Tip label={openMarks.archived ? "Move to Inbox" : "Archive"}>
                              <Button variant="ghost" size="sm" aria-label={openMarks.archived ? "Move to Inbox" : "Archive"} onClick={() => fileAway(open.id, { archived: !openMarks.archived })}>
                                {openMarks.archived ? <UnarchiveIcon className="size-4" /> : <ArchiveIcon className="size-4" />}
                              </Button>
                            </Tip>
                            <Tip label={openMarks.trashed ? "Restore" : "Move to trash"}>
                              <Button variant="ghost" size="sm" aria-label={openMarks.trashed ? "Restore" : "Move to trash"} onClick={() => fileAway(open.id, { trashed: !openMarks.trashed })}>
                                {openMarks.trashed ? <RotateCcw className="size-4" /> : <Trash2 className="size-4" />}
                              </Button>
                            </Tip>
                            <Tip label="Mark as unread">
                              <Button variant="ghost" size="sm" aria-label="Mark as unread" onClick={() => markUnread(open.id)}>
                                <MarkUnreadIcon className="size-4" />
                              </Button>
                            </Tip>
                            <SnoozeMenu
                              align="left"
                              trigger={
                                <span aria-hidden title="Snooze" className="inline-flex h-8 items-center rounded-md px-2.5 hover:bg-accent">
                                  <Clock className="size-4" />
                                </span>
                              }
                              snoozed={!!openMarks.snoozedUntil}
                              onSnooze={(at) => fileAway(open.id, { snoozedUntil: at.toISOString() })}
                              onUnsnooze={() => void file([open.id], { snoozedUntil: null })}
                            />
                            <Tip label={openMarks.starred ? "Remove star" : "Star"}>
                              <Button variant="ghost" size="sm" aria-label={openMarks.starred ? "Remove star" : "Star"} onClick={() => void file([open.id], { starred: !openMarks.starred })}>
                                <Star className={cn("size-4", openMarks.starred && "fill-yellow-400 text-yellow-500")} />
                              </Button>
                            </Tip>
                          </>
                        )}
                        {open.status === "draft" && (
                          <Tip label="Discard draft">
                            <Button variant="ghost" size="sm" aria-label="Discard draft" onClick={() => (setDrafts((current) => current.filter((d) => d.id !== open.id)), setSelected(null))}>
                              <Trash2 className="size-4" />
                            </Button>
                          </Tip>
                        )}
                        {latestReply && (
                          <>
                            <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />
                            <Tip label="Copy the message">
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label="Copy the message"
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
                          kind of act — take this message somewhere of your own —
                          and it saves the string the reader is looking at. */}
                            <SaveToDrive name={open.subject || "pax message"} markdown={latestReply.body} />
                          </>
                        )}
                        <div className="ml-auto flex items-center gap-1">
                          {open.status !== "draft" && mine && (
                            <Tip label="Reply">
                              <Button variant="ghost" size="sm" aria-label="Reply" onClick={() => setReplying(true)}>
                                <ReplyIcon className="size-4" />
                              </Button>
                            </Tip>
                          )}
                          <Tip label="New message">
                            <Button variant="ghost" size="sm" aria-label="New message" onClick={startCompose}>
                              <PenSquare className="size-4" />
                            </Button>
                          </Tip>
                        </div>
                      </div>

                      {/* The thread, Gmail's way: the subject as its title, then
                    every message as mail — who sent it, who it went to, when. */}
                      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                        <div className="flex items-start gap-4 px-6 pt-5 pb-2">
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                            <h2 className="min-w-0 truncate text-xl font-medium">{open.subject}</h2>
                            <Marker thread={open} onToggle={openMarks ? () => void file([open.id], { important: !openMarks.important }) : undefined} />
                          </div>
                          {openMarks?.trashed && <div className="ml-auto shrink-0 pt-1 text-right text-xs text-muted-foreground">in trash</div>}
                        </div>

                        <div className="divide-y">
                          {open.messages.map((message) => {
                            const self = message.from === "you"
                            const trace = isTrace(open.reportType)
                            const name = self ? owner.name : (message.fromName ?? nameOf(message.from))
                            const email = self ? owner.email : (message.fromEmail ?? addressFor(message.from)?.email)
                            const to = message.toParties
                              ? message.toParties.map((p) => (p.email.toLowerCase() === owner.email.toLowerCase() ? "me" : p.name || p.email)).join(", ")
                              : self
                                ? shownRecipients(open).join(", ") || open.agentName
                                : "me"
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
                                  <Sender from={message.from} name={name} owner={owner} />
                                  <div className="min-w-0 flex-1 pt-0.5">
                                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                                      <span className="shrink-0 font-semibold">{name}</span>
                                      {isFolded ? (
                                        <span className="min-w-0 truncate text-sm text-muted-foreground">{snippet(message) || "…"}</span>
                                      ) : (
                                        email && <span className="text-xs text-muted-foreground">&lt;{email}&gt;</span>
                                      )}
                                    </div>
                                    {!isFolded && <div className="text-xs text-muted-foreground">to {to}</div>}
                                  </div>
                                  <time className="shrink-0 pt-0.5 text-xs text-muted-foreground" dateTime={new Date(message.at).toISOString()}>
                                    {when(message.at)}
                                  </time>
                                  {open.status !== "draft" && (
                                    <span className="flex shrink-0 items-center" onClick={(event) => event.stopPropagation()}>
                                      {mine && (
                                        <Tip label="Reply">
                                          <Button variant="ghost" size="sm" aria-label="Reply" className="size-7 p-0" onClick={() => setReplying(true)}>
                                            <ReplyIcon className="size-4" />
                                          </Button>
                                        </Tip>
                                      )}
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
                                  {message.html ? (
                                    <MailFrame html={message.html} />
                                  ) : self ? (
                                    <div className="text-sm whitespace-pre-wrap">
                                      <Prose text={message.body} />
                                    </div>
                                  ) : (
                                    (message.body || (trace && calls(message) > 0)) && (
                                      <div className="rounded-lg bg-muted/60 p-4">
                                        <div className={cn("text-sm whitespace-pre-wrap", message.run?.failed && "text-destructive")}>
                                          {trace && message.run && !message.run.failed ? (
                                            <TraceReport steps={message.run.steps} body={message.body} running={!message.run.done} />
                                          ) : (
                                            <Prose text={message.body} />
                                          )}
                                        </div>
                                      </div>
                                    )
                                  )}

                                  {calls(message) > 0 && (
                                    <details className="rounded-lg border p-3">
                                      <summary className="cursor-pointer text-sm text-muted-foreground">
                                        {calls(message)} tool call
                                        {calls(message) === 1 ? "" : "s"}
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
                            message, sticky so they never scroll off. The composer card
                            opens in the same spot. An agent's mailbox is read and filed
                            here; replies go from one's own. */}
                        <div className="sticky bottom-0 bg-background px-6 pt-2 pb-6 pl-[76px]">
                        {open.status === "draft" ? (
                          <Button size="sm" className="self-start" onClick={() => editDraft(open)}>
                            Edit draft
                          </Button>
                        ) : replying && mine ? (
                          <div className="flex flex-col rounded-2xl border bg-background shadow-sm">
                            <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
                              <Sender from="you" name={owner.name} owner={owner} />
                              {editingTo ? (
                                <span className="text-sm text-muted-foreground">Reply</span>
                              ) : (
                                <button type="button" className="flex min-w-0 items-center gap-3 text-left" title="Edit recipients" onClick={() => setEditingTo(true)}>
                                  <ReplyIcon className="size-4 shrink-0 text-muted-foreground" />
                                  <span className="min-w-0 truncate text-sm text-muted-foreground">{replyDraft.to.map(nameOf).join(", ")}</span>
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
                                  void sendReply(open, { to: current.to, cc: current.cc }, text)
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
                            {mine && (
                              <Button variant="outline" size="sm" className="rounded-full" onClick={() => setReplying(true)}>
                                <ReplyIcon className="size-4" />
                                Reply
                              </Button>
                            )}
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
          {sent && (
            // Gmail's bar: dark, bottom left, gone in a few seconds. "View"
            // opens the thread in Sent, where the server kept it.
            <div role="status" className="absolute bottom-4 left-4 z-20 flex items-center gap-4 rounded-md bg-foreground px-4 py-2.5 text-sm text-background shadow-lg">
              <span>Message sent{mailNote ? ` · ${mailNote}` : ""}</span>
              {sent.threadId && (
                <button
                  type="button"
                  className="font-medium text-background/80 hover:text-background"
                  onClick={() => {
                    setMailbox("me")
                    setFolder("sent")
                    setSelected(sent.threadId!)
                    setComposing(false)
                    setSplit("vertical")
                    setSent(null)
                  }}
                >
                  View
                </button>
              )}
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
