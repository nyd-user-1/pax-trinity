"use client"

import { ClipboardList, File, FlaskConical, Inbox, LayoutTemplate, PenSquare, Send, Star, Trash2 } from "lucide-react"

import { unreadIn, type Folder, type Thread } from "@/lib/agents/inbox"
import { BankRail, RailGroup, RailRow } from "@/components/bank/bank-rail"

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

/** The data type a dragged thread carries. */
export const THREAD_DRAG = "application/x-thread-id"

export function InboxRail({
  threads,
  folder,
  onFolder,
  onCompose,
  onNew,
  onDropThread,
}: {
  threads: Thread[]
  folder: Folder
  onFolder: (folder: Folder) => void
  onCompose: () => void
  /** A structured request to the Pollster: a test of a clip, or a survey. */
  onNew: (kind: "test" | "survey") => void
  /** A list row dragged onto a folder lands here. */
  onDropThread: (id: string, folder: Folder) => void
}) {
  return (
    <BankRail title="Inbox">
      <RailGroup>
        <RailRow onClick={onCompose} icon={PenSquare} label="Compose" />
        <RailRow onClick={() => onNew("test")} icon={FlaskConical} label="New test" />
        <RailRow onClick={() => onNew("survey")} icon={ClipboardList} label="New survey" />
      </RailGroup>
      <RailGroup label="Folders">
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
    </BankRail>
  )
}
