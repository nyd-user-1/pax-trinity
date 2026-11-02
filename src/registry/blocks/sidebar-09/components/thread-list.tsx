"use client"

import * as React from "react"

import type { Folder, Thread } from "@/lib/agents/inbox"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/ny4/tooltip"

// What is left of the Inbox's own thread list (Brendan, 2026-09-07) since its
// rows moved onto the list America Thinks and Survey use (components/bank/
// card-list.tsx, 2026-10-31): the folders' names, the unread filter, and the
// importance marker the reading pane's toolbar wears.

export type ListTab = "all" | "unread"

export const TITLES: Record<Folder, string> = { inbox: "Inbox", starred: "Starred", snoozed: "Snoozed", sent: "Sent", drafts: "Drafts", templates: "Templates", all: "All mail", trash: "Trash" }

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** Gmail's importance marker: a toggle the reader sets; a task still running or one that failed lights it on its own. */
export function Marker({ thread, onToggle }: { thread: Thread; onToggle?: () => void }) {
  const lit = Boolean(thread.important) || thread.status === "running" || thread.status === "failed"
  const mark = (
    <svg viewBox="0 0 20 20" aria-hidden className={cn("size-4 shrink-0", lit ? "fill-amber-400 text-amber-400" : "fill-transparent text-muted-foreground/50")}>
      <path d="M4 5h7l5 5-5 5H4l5-5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
  if (!onToggle) return mark
  return (
    <Tip label={thread.important ? "Marked important" : "Mark as important"}>
      <button
        type="button"
        aria-pressed={Boolean(thread.important)}
        aria-label={thread.important ? "Marked important" : "Mark as important"}
        onClick={(event) => {
          event.stopPropagation()
          onToggle()
        }}
        className="shrink-0"
      >
        {mark}
      </button>
    </Tip>
  )
}
