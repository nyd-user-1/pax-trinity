"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { Download, SquarePen } from "lucide-react"

import { useShellPanel } from "@/components/shell"
import { cn } from "@/lib/utils"

// A report as mail (Brendan, 2026-11-01): the Analyst's readout is the thread's first message,
// kept as it is, and every edit is a reply — a whole version of the report, by whoever saved it,
// never a change to the original. The ledger keeps the trail (/api/clips/report-thread); the
// exports write the latest version out as .md, .doc or .pdf.

const NotesEditor = dynamic(() => import("@/components/notes/notes-editor").then((m) => m.NotesEditor), { ssr: false })

export type ReportVersion = { at: string; author: string; body: string }

const monogram = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")

const when = (iso: string, withTime = false) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}) })

/** One message of the thread: the sender's monogram and name over the body, the inbox's dress. */
export function MailMessage({ who, date, note, children, tone = "analyst" }: { who: string; date?: string; note?: string; children: React.ReactNode; tone?: "analyst" | "person" }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-pax2-surface shadow-e1">
      <div className="flex items-center gap-2.5 border-b border-slate-200/70 px-4 py-2.5">
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", tone === "analyst" ? "bg-pax2-lavender text-pax2-blue" : "bg-slate-200 text-slate-600")}>{monogram(who)}</span>
        <span className="truncate text-sm font-semibold">{who}</span>
        {note && <span className="truncate text-xs text-muted-foreground">{note}</span>}
        <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{date}</span>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  )
}

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

/** The thread under a readout: its saved versions, each a mail message; Edit for admins, which
 *  replies with a new version seeded from the latest (or the readout itself); the exports. */
export function ReportThread({ thread, title, seed, canVersion = true }: { thread: string; title: string; seed: () => string; canVersion?: boolean }) {
  const { admin } = useShellPanel()
  const [versions, setVersions] = React.useState<ReportVersion[]>([])
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState("")
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
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

  const latest = versions.length ? versions[versions.length - 1].body : null
  const text = () => latest ?? seed()
  const fileName = title.replace(/[^\w ,-]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "report"

  const save = async () => {
    if (saving || !draft.trim()) return
    setSaving(true)
    setError(null)
    try {
      const r = await fetch("/api/clips/report-thread", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: thread, body: draft }) })
      const d = (await r.json()) as { version?: ReportVersion; error?: string }
      if (!r.ok || !d.version) throw new Error(d.error ?? "The save did not land.")
      setVersions((v) => [...v, d.version!])
      setEditing(false)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const exportAs = async (kind: "md" | "doc" | "pdf") => {
    const body = text()
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

  const exportBtn = (kind: "md" | "doc" | "pdf") => (
    <button key={kind} type="button" onClick={() => void exportAs(kind)} className="rounded-md px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
      .{kind}
    </button>
  )

  return (
    <div className="mt-3 flex flex-col gap-3">
      {versions.map((v, i) => (
        <MailMessage key={v.at} who={v.author} tone="person" note={`edited the report · v${i + 1}`} date={when(v.at, true)}>
          <NotesEditor value={v.body} onChange={() => {}} readOnly />
        </MailMessage>
      ))}
      {editing && (
        <MailMessage who="You" tone="person" note="a new version of the report">
          <NotesEditor value={draft} onChange={setDraft} onSave={() => void save()} autoFocus placeholder="The report, as you would have it read." />
          {error && <p className="mt-2 text-xs text-pax2-red">{error}</p>}
          <div className="mt-3 flex items-center gap-2">
            <button type="button" onClick={() => void save()} disabled={saving} className="rounded-full bg-pax2-blue px-3.5 py-1.5 text-xs font-semibold text-white transition-opacity disabled:opacity-50">
              {saving ? "Saving…" : "Save as a version"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </div>
        </MailMessage>
      )}
      <div className="flex items-center gap-1.5">
        {admin && canVersion && !editing && (
          <button type="button" onClick={() => (setDraft(text()), setEditing(true))} className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-pax2-blue hover:text-pax2-blue">
            <SquarePen className="size-3.5" /> Edit the report
          </button>
        )}
        <span className="ml-auto flex items-center gap-0.5">
          <Download aria-hidden className="mr-0.5 size-3.5 text-muted-foreground" />
          {(["md", "doc", "pdf"] as const).map(exportBtn)}
        </span>
      </div>
    </div>
  )
}
