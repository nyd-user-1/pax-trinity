"use client"

import * as React from "react"
import { File, Inbox, LayoutTemplate, PenSquare, Send, Star, StickyNote, Trash2 } from "lucide-react"

import { unreadIn, type Folder, type Thread } from "@/lib/agents/inbox"
import { BankRail, RailGroup, RailRow } from "@/components/bank/bank-rail"
import { TEMPLATES, type Template } from "@/lib/agents/templates"
import { REQUESTS } from "@/lib/agents/requests"
import { useNoteFavorites } from "@/lib/drawn-notes"
import { TemplateThumb } from "@/registry/blocks/sidebar-09/components/template-thumb"

// The Agentic Inbox's rail: Compose above the folders, where mail clients put
// it, and the folders with their unread counts. Since 2026-10-31 (Brendan) it
// is drawn in the rail parts America Thinks and Survey use (bank-rail.tsx),
// in the same frame, so the three inboxes' rails look alike; the folders, their
// icons and their counts are the Inbox's own. A thread dragged from the list
// drops onto a folder.

const FOLDERS: { title: string; icon: typeof Inbox; folder: Folder }[] = [
  { title: "Inbox", icon: Inbox, folder: "inbox" },
  { title: "Sent", icon: Send, folder: "sent" },
  { title: "Drafts", icon: File, folder: "drafts" },
  { title: "Starred", icon: Star, folder: "starred" },
  { title: "Templates", icon: LayoutTemplate, folder: "templates" },
  { title: "Trash", icon: Trash2, folder: "trash" },
]

// The rail's Templates by what each is for (Brendan, 2026-10-31): the requests to the Pollster first, then the mail
// that invites, reminds, updates, reports, thanks, and keeps an account. A template named in none falls to Other.
const INTENTS: { label: string; names: string[] }[] = [
  { label: "Invitations", names: ["Consensus invite", "Survey invitation", "Test invitation"] },
  { label: "Reminders", names: ["Survey reminder", "Test reminder", "Review reminder", "Approval reminder"] },
  { label: "Updates", names: ["Fielding started", "Quota closed", "Cuts ready for review", "Clip ready to test", "Test approved"] },
  { label: "Results", names: ["Consensus summary", "Question card ready", "Results readout", "Survey topline", "Lift updated", "Report filed", "Weekly digest"] },
  { label: "Thank-yous", names: ["Survey thank-you"] },
  { label: "Account", names: ["Invitation", "Your login", "Password reset"] },
]
const NAMED = new Set(INTENTS.flatMap((i) => i.names))
const OTHER = TEMPLATES.filter((t) => !NAMED.has(t.name))

function Intent({ label }: { label: string }) {
  return <p className="px-2.5 pt-2 pb-0.5 text-[11px] font-medium text-slate-400">{label}</p>
}

/** The data type a dragged thread carries. */
export const THREAD_DRAG = "application/x-thread-id"

export function InboxRail({
  threads,
  folder,
  onFolder,
  onCompose,
  onNew,
  onDropThread,
  notes,
  onOpenNote,
  onTemplate,
}: {
  threads: Thread[]
  folder: Folder
  onFolder: (folder: Folder) => void
  onCompose: () => void
  /** A structured request to the Pollster: a test of a clip, or a survey. */
  onNew: (kind: "test" | "survey") => void
  /** A list row dragged onto a folder lands here. */
  onDropThread: (id: string, folder: Folder) => void
  /** My notes: the reader's own notes, drawn anywhere with Shift (components/notes/draw-notes.tsx). */
  notes: { id: string; title: string }[]
  onOpenNote: (id: string) => void
  /** A template picked from the rail: into the message being written, else a new one. */
  onTemplate: (template: Template) => void
}) {
  // The notes starred from a note's menu come first, with the star for their icon.
  const { favs } = useNoteFavorites()
  const mine = [...notes].sort((a, b) => Number(favs.includes(b.id)) - Number(favs.includes(a.id)))
  return (
    <BankRail title="Inbox">
      <RailGroup>
        <RailRow onClick={onCompose} icon={PenSquare} label="Compose" />
      </RailGroup>
      <RailGroup label="Folders" collapsible>
        {FOLDERS.map((item) => {
          const unread = unreadIn(threads, item.folder)
          return (
            <RailRow
              key={item.title}
              on={folder === item.folder}
              onClick={() => onFolder(item.folder)}
              icon={item.icon}
              label={item.title}
              count={unread > 0 ? unread : null}
              drop={{ type: THREAD_DRAG, onDrop: (id) => onDropThread(id, item.folder) }}
            />
          )
        })}
      </RailGroup>
      {/* Templates (Brendan, 2026-10-31), as America Thinks' Data: each with its mail's thumbnail, folding past ten. */}
      <RailGroup label="Templates" collapsible maxRows={10}>
        <Intent label="Requests" />
        {REQUESTS.map((r) => (
          <RailRow key={r.kind} onClick={() => onNew(r.kind)} lead={<TemplateThumb template={r} />} label={r.name} />
        ))}
        {[...INTENTS.map((i) => ({ label: i.label, rows: i.names.map((n) => TEMPLATES.find((t) => t.name === n)).filter((t): t is Template => !!t) })), { label: "Other", rows: OTHER }]
          .filter((g) => g.rows.length)
          .map((g) => (
            <React.Fragment key={g.label}>
              <Intent label={g.label} />
              {g.rows.map((t) => (
                <RailRow key={t.id} onClick={() => onTemplate(t)} lead={<TemplateThumb template={t} />} label={t.name} />
              ))}
            </React.Fragment>
          ))}
      </RailGroup>
      {/* My notes (Brendan, 2026-10-31), at the foot: each opens as its card. */}
      <RailGroup label="My notes" collapsible>
        {mine.length ? mine.map((n) => <RailRow key={n.id} onClick={() => onOpenNote(n.id)} icon={favs.includes(n.id) ? Star : StickyNote} label={n.title} />) : <p className="px-3 py-2 text-sm text-slate-400">None yet</p>}
      </RailGroup>
    </BankRail>
  )
}
