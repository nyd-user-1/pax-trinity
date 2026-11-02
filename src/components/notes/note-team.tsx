"use client"

import * as React from "react"
import { MessageSquareText } from "lucide-react"
import type { Editor } from "@tiptap/react"

import { cn } from "@/lib/utils"
import { TEAM_PLACES, type TeamPlace } from "@/lib/note-team"
import { TaskSurface, TaskToolbar } from "@/registry/blocks/sidebar-09/components/rich-body"

// A note's Team shape (Brendan, 2026-11-02): the note posted to the team with the page it was written on. One row
// picks where, each place with its mark: a Dev Comment on this page (the stream every admin reads), Slack's #pax2,
// or Discord's #pax. Post sends the note's text and the page's link (app/api/notes/team). The note is the one text
// every shape edits.

type Status = { ok: true; where: string } | { ok: false; error: string }

export function NoteTeam({ editor, body }: { editor: Editor | null; body: string }) {
  const [to, setTo] = React.useState<TeamPlace>("comments")
  const [open, setOpen] = React.useState<Partial<Record<TeamPlace, boolean>>>({ comments: true })
  const [busy, setBusy] = React.useState(false)
  const [status, setStatus] = React.useState<Status | null>(null)
  const [here, setHere] = React.useState("")
  React.useEffect(() => {
    setHere(`${window.location.pathname}${window.location.search}`)
    fetch("/api/notes/team")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Partial<Record<TeamPlace, boolean>> | null) => d && setOpen(d))
      .catch(() => {})
  }, [])

  const post = async () => {
    if (!body.trim() || busy) return
    setBusy(true)
    setStatus(null)
    try {
      const res = await fetch("/api/notes/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, text: body, url: window.location.href, route: window.location.pathname }),
      })
      const out = (await res.json().catch(() => ({}))) as { ok?: boolean; where?: string; error?: string }
      setStatus(out.ok ? { ok: true, where: out.where ?? "" } : { ok: false, error: out.error ?? `Not posted (${res.status}).` })
    } catch {
      setStatus({ ok: false, error: "Not posted: the server can't be reached." })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-note-team>
      <TaskToolbar editor={editor} className="shrink-0 border-b border-slate-200 px-2 py-1" />
      <div className="min-h-0 flex-1 cursor-text overflow-y-auto px-4 py-3" onClick={() => editor?.commands.focus()}>
        <TaskSurface editor={editor} className="min-h-full [&_.ProseMirror]:min-h-full" />
      </div>
      <div className="shrink-0 border-t border-slate-200 px-3 py-2">
        <div role="radiogroup" aria-label="Post to" className="flex flex-wrap gap-1.5">
          {TEAM_PLACES.map(({ place, label, mark }) => {
            const ready = open[place] !== false
            return (
              <button
                key={place}
                type="button"
                role="radio"
                aria-checked={to === place}
                disabled={!ready}
                title={ready ? label : `${label} isn't connected`}
                onClick={() => setTo(place)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-40",
                  to === place ? "border-pax2-light-blue bg-pax2-lavender text-pax2-blue" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                )}
              >
                {mark ? <img src={mark} alt="" className="size-3.5 shrink-0 object-contain" /> : <MessageSquareText className="size-3.5 shrink-0" />}
                {label}
              </button>
            )
          })}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-400" title={here}>
            {here}
          </span>
          <button type="button" disabled={!body.trim() || busy} onClick={() => void post()} className="rounded-full bg-pax2-blue px-3.5 py-1 text-xs font-medium text-white disabled:opacity-40">
            {busy ? "Posting…" : "Post"}
          </button>
        </div>
        {status && (
          <p role="status" className={cn("pt-1.5 text-xs", status.ok ? "text-slate-500" : "text-pax2-red")}>
            {status.ok ? `Posted to ${status.where}` : status.error}
          </p>
        )}
      </div>
    </div>
  )
}
