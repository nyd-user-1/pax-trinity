"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { Archive, ChevronDown, ChevronLeft, ChevronRight, CircleAlert, EllipsisVertical, ExternalLink, FolderInput, Forward, Image as ImageIcon, Link2, Lock, Mail, MoveLeft, Paperclip, PenLine, Printer, Reply, Smile, Sparkles, Star, Trash2, X } from "lucide-react"

import { KebabMenu, MenuRow, MenuSeparator } from "@/components/kebab-menu"
import { cn } from "@/lib/utils"

// The report as true email (Brendan, 2026-11-01): Gmail is the roadmap, the agentic inbox the
// address book. The thread opens under Gmail's toolbar and subject line; the Analyst's readout is
// the first message, kept exactly as derived; Reply opens Gmail's inline composer seeded with the
// latest version of the report, and Send files the edit as a new message on the thread — a whole
// immutable version in the ledger (/api/clips/report-thread). Forward addresses real people and
// goes out through the inbox's allowlisted send (/api/inbox/send). The exports (.md, .doc, .pdf)
// sit in each message's kebab, where Gmail keeps Download message.

const NotesEditor = dynamic(() => import("@/components/notes/notes-editor").then((m) => m.NotesEditor), { ssr: false })

export type ReportVersion = { at: string; author: string; body: string }
export type MailNav = { index: number; count: number; onBack?: () => void; onStep?: (d: 1 | -1) => void }

const ANALYST = { name: "Analyst", email: "pax-analyst@agentmail.to" }

const monogram = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")

const when = (iso: string, withTime = false) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}) })

const download = (name: string, blob: Blob) => {
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

/** Markdown to HTML through the editor's own schema, so .doc carries what the editor holds. */
async function toHtml(md: string, title: string) {
  const [{ parser, schema }, { DOMSerializer }] = await Promise.all([import("@/lib/markdown/editor-schema"), import("prosemirror-model")])
  const div = document.createElement("div")
  div.appendChild(DOMSerializer.fromSchema(schema).serializeFragment(parser.parse(md).content, { document }))
  return `<html><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:Georgia,serif;max-width:640px;line-height:1.5">${div.innerHTML}</body></html>`
}

async function exportAs(kind: "md" | "doc" | "pdf", title: string, body: string) {
  const fileName = title.replace(/[^\w ,-]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "report"
  if (kind === "md") return download(`${fileName}.md`, new Blob([body], { type: "text/markdown" }))
  if (kind === "doc") return download(`${fileName}.doc`, new Blob([await toHtml(body, title)], { type: "application/msword" }))
  const { jsPDF } = await import("jspdf")
  const pdf = new jsPDF({ unit: "pt", format: "letter" })
  const plain = body.replace(/^#{1,6}\s*/gm, "").replace(/\*\*|__|`/g, "").replace(/\[(.+?)\]\([^)]*\)/g, "$1")
  pdf.setFont("times", "bold").setFontSize(14).text(title, 56, 64)
  pdf.setFont("times", "normal").setFontSize(11)
  let y = 88
  for (const line of pdf.splitTextToSize(plain, 500) as string[]) {
    if (y > 742) {
      pdf.addPage()
      y = 64
    }
    pdf.text(line, 56, y)
    y += 15
  }
  download(`${fileName}.pdf`, pdf.output("blob"))
}

const toolBtn = "flex size-9 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900 disabled:opacity-40"

/** Gmail's top strip: back to the list, the mail actions, the thread's place in the list and the stepper. */
export function MailToolbar({ nav }: { nav?: MailNav }) {
  const dead = (label: string) => ({ "aria-label": label, title: label, onClick: () => {} })
  return (
    <div className="sticky top-0 z-10 flex items-center gap-1 border-b border-slate-200/70 bg-pax2-surface px-2 py-1.5">
      <button type="button" aria-label="Back to the reports" title="Back to the reports" onClick={nav?.onBack} disabled={!nav?.onBack} className={toolBtn}>
        <MoveLeft className="size-[18px]" />
      </button>
      <span aria-hidden className="mx-1 h-5 w-px bg-slate-200" />
      <button type="button" {...dead("Archive")} className={toolBtn}>
        <Archive className="size-[17px]" />
      </button>
      <button type="button" {...dead("Report spam")} className={toolBtn}>
        <CircleAlert className="size-[17px]" />
      </button>
      <button type="button" {...dead("Delete")} className={toolBtn}>
        <Trash2 className="size-[17px]" />
      </button>
      <span aria-hidden className="mx-1 h-5 w-px bg-slate-200" />
      <button type="button" {...dead("Mark as unread")} className={toolBtn}>
        <Mail className="size-[17px]" />
      </button>
      <button type="button" {...dead("Move to")} className={toolBtn}>
        <FolderInput className="size-[17px]" />
      </button>
      <button type="button" {...dead("More")} className={toolBtn}>
        <EllipsisVertical className="size-[17px]" />
      </button>
      <span className="flex-1" />
      {nav && nav.index >= 0 && (
        <span className="px-1 text-xs text-slate-500 tabular-nums">
          {nav.index + 1} of {nav.count}
        </span>
      )}
      <button type="button" aria-label="Newer" title="Newer" onClick={() => nav?.onStep?.(-1)} disabled={!nav?.onStep} className={toolBtn}>
        <ChevronLeft className="size-[18px]" />
      </button>
      <button type="button" aria-label="Older" title="Older" onClick={() => nav?.onStep?.(1)} disabled={!nav?.onStep} className={toolBtn}>
        <ChevronRight className="size-[18px]" />
      </button>
    </div>
  )
}

// The stars, kept per browser as Gmail keeps them per account.
const STAR_KEY = "pax2-report-stars"
const readStars = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(STAR_KEY) ?? "[]") as string[]
  } catch {
    return []
  }
}

/** One message of the thread, Gmail's sender row over the body: avatar, name and address, the date
 *  and the message actions at the right, "to me" beneath with the details fold. */
function Message({ who, email, date, starred, onStar, onReply, title, exportBody, children }: { who: string; email?: string; date: string; starred?: boolean; onStar?: () => void; onReply: () => void; title: string; exportBody: () => string; children: React.ReactNode }) {
  const [details, setDetails] = React.useState(false)
  const act = "flex size-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-900"
  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-pax2-lavender text-sm font-semibold text-pax2-blue">{monogram(who)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-bold text-slate-900">{who}</span>
            {email && <span className="hidden truncate text-xs text-slate-500 sm:inline">&lt;{email}&gt;</span>}
            <span className="ml-auto flex shrink-0 items-center">
              <span className="mr-1 text-xs text-slate-500 whitespace-nowrap">{date}</span>
              {onStar && (
                <button type="button" aria-label={starred ? "Starred" : "Not starred"} aria-pressed={starred} onClick={onStar} className={act}>
                  <Star className={cn("size-4", starred && "fill-amber-400 text-amber-400")} />
                </button>
              )}
              <button type="button" aria-label="React" title="React" className={act}>
                <Smile className="size-4" />
              </button>
              <button type="button" aria-label="Reply" title="Reply" onClick={onReply} className={act}>
                <Reply className="size-4" />
              </button>
              <KebabMenu label="More message options" align="left" width="w-52" trigger={<EllipsisVertical className="size-4" />} triggerClassName={act}>
                <MenuRow icon={<Printer />} label="Print" onClick={() => window.print()} />
                <MenuSeparator />
                <MenuRow label="Download .md" onClick={() => void exportAs("md", title, exportBody())} />
                <MenuRow label="Download .doc" onClick={() => void exportAs("doc", title, exportBody())} />
                <MenuRow label="Download .pdf" onClick={() => void exportAs("pdf", title, exportBody())} />
              </KebabMenu>
            </span>
          </div>
          <button type="button" onClick={() => setDetails((v) => !v)} aria-expanded={details} className="flex items-center gap-0.5 text-xs text-slate-500 hover:text-slate-700">
            to me <ChevronDown className={cn("size-3.5 transition-transform", details && "rotate-180")} />
          </button>
          {details && (
            <div className="mt-1.5 grid w-fit grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-lg border border-slate-200 bg-pax2-surface px-3 py-2 text-xs shadow-e1">
              <span className="text-slate-400">from:</span>
              <span className="text-slate-700">{who}{email ? ` <${email}>` : ""}</span>
              <span className="text-slate-400">to:</span>
              <span className="text-slate-700">me</span>
              <span className="text-slate-400">date:</span>
              <span className="text-slate-700">{date}</span>
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 sm:pl-13">{children}</div>
    </div>
  )
}

type ComposeMode = "reply" | "forward"
type Chip = { name: string; email: string }

/** Gmail's inline composer at the thread's foot: the reply arrow and To chips, the body, Send and
 *  its strip, the discard trash. A reply goes to the Analyst and files a new version of the report;
 *  a forward addresses anyone and goes out through the inbox's allowlisted send. */
function Composer({ mode, subject, seedBody, thread, onClose, onSaved }: { mode: ComposeMode; subject: string; seedBody: string; thread: string; onClose: () => void; onSaved: (v: ReportVersion) => void }) {
  const [to, setTo] = React.useState<Chip[]>(mode === "reply" ? [ANALYST] : [])
  const [toInput, setToInput] = React.useState("")
  const [body, setBody] = React.useState(mode === "reply" ? seedBody : `---------- Forwarded report ----------\n\n${seedBody}`)
  const [busy, setBusy] = React.useState(false)
  const [status, setStatus] = React.useState<string | null>(null)
  const addChip = () => {
    const email = toInput.trim().replace(/,$/, "")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
    setTo((t) => (t.some((c) => c.email === email) ? t : [...t, { name: email.split("@")[0], email }]))
    setToInput("")
  }
  const ready = !busy && body.trim() && (mode === "reply" ? to.length > 0 : to.length > 0)
  const send = async () => {
    if (!ready) return
    setBusy(true)
    setStatus(null)
    try {
      if (mode === "reply") {
        const r = await fetch("/api/clips/report-thread", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: thread, body }) })
        const d = (await r.json()) as { version?: ReportVersion; error?: string }
        if (!r.ok || !d.version) throw new Error(d.error ?? "The send did not land.")
        onSaved(d.version)
        onClose()
      } else {
        const r = await fetch("/api/inbox/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ to: to.map((c) => ({ email: c.email, name: c.name })), subject: `Fwd: ${subject}`, markdown: body }) })
        const d = (await r.json()) as { sent?: string[]; held?: string[]; error?: string }
        if (!r.ok && d.error) throw new Error(d.error)
        setStatus([d.sent?.length ? `Sent to ${d.sent.join(", ")}.` : null, d.held?.length ? `Held by the allowlist: ${d.held.join(", ")}.` : null].filter(Boolean).join(" ") || "Nothing went out.")
        if (d.sent?.length && !d.held?.length) onClose()
      }
    } catch (e) {
      setStatus((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const strip = "flex size-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-900"
  return (
    <div className="mx-4 my-3 flex items-start gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/avatars/default.jpg" alt="" className="mt-1 size-10 shrink-0 rounded-full object-cover" />
      <div className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-pax2-surface shadow-e2">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200/70 px-3 py-2">
          {mode === "reply" ? <Reply className="size-4 shrink-0 text-slate-500" /> : <Forward className="size-4 shrink-0 text-slate-500" />}
          <ChevronDown className="size-3 shrink-0 text-slate-500" />
          <span className="ml-1 text-sm text-slate-500">To</span>
          {to.map((c) => (
            <span key={c.email} className="flex items-center gap-1.5 rounded-full border border-slate-300 py-0.5 pr-1 pl-1" title={c.email}>
              <span className="flex size-5 items-center justify-center rounded-full bg-pax2-lavender text-[9px] font-semibold text-pax2-blue">{monogram(c.name)}</span>
              <span className="max-w-40 truncate text-sm text-slate-800">{c.name}</span>
              <button type="button" aria-label={`Remove ${c.name}`} onClick={() => setTo((t) => t.filter((x) => x.email !== c.email))} className="flex size-4 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200">
                <X className="size-3" />
              </button>
            </span>
          ))}
          {mode === "forward" && (
            <input
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === ",") && (e.preventDefault(), addChip())}
              onBlur={addChip}
              placeholder={to.length ? "" : "Recipients"}
              aria-label="Recipients"
              className="min-w-32 flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-slate-400"
            />
          )}
          <span className="ml-auto flex items-center gap-2 text-xs text-slate-500">
            <button type="button" className="hover:text-slate-800">Cc</button>
            <button type="button" className="hover:text-slate-800">Bcc</button>
          </span>
        </div>
        <div className="max-h-[48vh] overflow-y-auto px-3 py-2">
          <NotesEditor value={body} onChange={setBody} onSave={() => void send()} autoFocus placeholder="" />
        </div>
        {status && <p className="px-3 pb-1 text-xs text-slate-500">{status}</p>}
        <div className="flex items-center gap-0.5 px-3 pt-1 pb-2.5">
          <span className="mr-1 flex overflow-hidden rounded-full">
            <button type="button" onClick={() => void send()} disabled={!ready} className="bg-pax2-light-blue px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
              {busy ? "Sending…" : "Send"}
            </button>
            <button type="button" aria-label="More send options" className="border-l border-white/30 bg-pax2-light-blue px-1.5 text-white transition-opacity hover:opacity-90">
              <ChevronDown className="size-3.5" />
            </button>
          </span>
          <button type="button" aria-label="Formatting options" title="Formatting options" className={strip}>
            <span className="text-[13px] font-semibold">Aa</span>
          </button>
          <button type="button" aria-label="Help me write" title="Help me write" className={strip}>
            <Sparkles className="size-4" />
          </button>
          <button type="button" aria-label="Attach files" title="Attach files" className={strip}>
            <Paperclip className="size-4" />
          </button>
          <button type="button" aria-label="Insert link" title="Insert link" className={strip}>
            <Link2 className="size-4" />
          </button>
          <button type="button" aria-label="Insert emoji" title="Insert emoji" className={strip}>
            <Smile className="size-4" />
          </button>
          <button type="button" aria-label="Insert photo" title="Insert photo" className={strip}>
            <ImageIcon className="size-4" />
          </button>
          <button type="button" aria-label="Confidential mode" title="Confidential mode" className={strip}>
            <Lock className="size-4" />
          </button>
          <button type="button" aria-label="Insert signature" title="Insert signature" className={strip}>
            <PenLine className="size-4" />
          </button>
          <button type="button" aria-label="More options" title="More options" className={strip}>
            <EllipsisVertical className="size-4" />
          </button>
          <span className="flex-1" />
          <button type="button" aria-label="Discard draft" title="Discard draft" onClick={onClose} className={strip}>
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

/** The report's thread: Gmail's subject line, the Analyst's message, every saved version as a
 *  reply, and the Reply and Forward pills that open the inline composer. */
export function MailThread({ subject, tag, reportHref, thread, canVersion = true, seed, date, children }: { subject: string; tag?: string; reportHref?: string; thread: string; canVersion?: boolean; seed: () => string; date: string; children: React.ReactNode }) {
  const [versions, setVersions] = React.useState<ReportVersion[]>([])
  const [compose, setCompose] = React.useState<ComposeMode | null>(null)
  const [chip, setChip] = React.useState(true)
  const [stars, setStars] = React.useState<string[]>([])
  React.useEffect(() => setStars(readStars()), [])
  const star = (id: string) => {
    const next = stars.includes(id) ? stars.filter((x) => x !== id) : [...stars, id]
    setStars(next)
    try {
      localStorage.setItem(STAR_KEY, JSON.stringify(next))
    } catch {}
  }
  React.useEffect(() => {
    if (!canVersion) return
    let on = true
    fetch(`/api/clips/report-thread?t=${encodeURIComponent(thread)}`)
      .then((r) => (r.ok ? r.json() : { versions: [] }))
      .then((d: { versions?: ReportVersion[] }) => on && setVersions(d.versions ?? []))
      .catch(() => on && setVersions([]))
    return () => {
      on = false
    }
  }, [thread, canVersion])
  const latest = () => (versions.length ? versions[versions.length - 1].body : seed())
  const pill = "flex items-center gap-2 rounded-full border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
  // Replying takes the thread's place (Brendan, 2026-11-01): the composer opens at the top, under the
  // toolbar, where the report stood — not beneath it; Send or the trash brings the thread back.
  if (compose) return <Composer mode={compose} subject={subject} seedBody={latest()} thread={thread} onClose={() => setCompose(null)} onSaved={(v) => setVersions((x) => [...x, v])} />
  return (
    <section>
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <h2 className="min-w-0 truncate text-[22px] leading-snug font-normal text-slate-900">{subject}</h2>
        {tag && chip && (
          <span className="flex shrink-0 items-center gap-1 rounded bg-slate-200/70 px-1.5 py-0.5 text-xs text-slate-600">
            {tag}
            <button type="button" aria-label={`Remove the ${tag} label`} onClick={() => setChip(false)} className="rounded-full hover:text-slate-900">
              <X className="size-3" />
            </button>
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center">
          <button type="button" aria-label="Print all" title="Print all" onClick={() => window.print()} className={toolBtn}>
            <Printer className="size-[17px]" />
          </button>
          {reportHref ? (
            <Link href={reportHref} aria-label="Open the report in a new window" title="Open the report" className={toolBtn}>
              <ExternalLink className="size-[17px]" />
            </Link>
          ) : (
            <span className={cn(toolBtn, "opacity-40")}>
              <ExternalLink className="size-[17px]" />
            </span>
          )}
        </span>
      </div>

      <Message who={ANALYST.name} email={ANALYST.email} date={when(date)} starred={stars.includes(thread)} onStar={() => star(thread)} onReply={() => canVersion && setCompose("reply")} title={subject} exportBody={latest}>
        {children}
      </Message>

      {versions.map((v, i) => (
        <div key={v.at} className="border-t border-slate-200/70">
          <Message who={v.author} date={when(v.at, true)} onReply={() => setCompose("reply")} title={`${subject} (v${i + 1})`} exportBody={() => v.body}>
            <NotesEditor value={v.body} onChange={() => {}} readOnly />
          </Message>
        </div>
      ))}

      {(
        <div className="flex items-center gap-2 px-4 pt-2 pb-4 sm:pl-[68px]">
          <button type="button" onClick={() => setCompose("reply")} disabled={!canVersion} title={canVersion ? "Reply — edit the report as a new version" : "A drawn test takes no versions"} className={cn(pill, !canVersion && "opacity-40")}>
            <Reply className="size-4" /> Reply
          </button>
          <button type="button" onClick={() => setCompose("forward")} className={pill}>
            <Forward className="size-4" /> Forward
          </button>
          <button type="button" aria-label="Add reaction" title="Add reaction" className="flex size-10 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100">
            <Smile className="size-4" />
          </button>
        </div>
      )}
    </section>
  )
}
