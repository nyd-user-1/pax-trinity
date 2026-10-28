"use client"

import * as React from "react"
import { StarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Checkbox } from "@govblock/ui/components/checkbox"

// A question's three marks, Gmail's: the box (a compare-grid column, four at
// most), the importance arrow, the star. The pane's title row and the list's
// one-line row carry the same three on the same state.

export type MarkState = {
  column: boolean
  atCap: boolean
  onColumn: () => void
  important: boolean
  onImportant: () => void
  pinned: boolean
  onPin: () => void
}

export function Marks({ column, atCap, onColumn, important, onImportant, pinned, onPin }: MarkState) {
  return (
    <>
      <Checkbox aria-label="Add as column" checked={column} disabled={atCap} title={atCap ? "Four columns at most" : undefined} onCheckedChange={onColumn} />
      <button type="button" aria-pressed={important} aria-label={important ? "Marked important" : "Mark as important"} title={important ? "Marked important" : "Mark as important"} onClick={onImportant} className="shrink-0">
        <ImportantIcon className={cn("size-4 shrink-0", important ? "fill-amber-400 text-amber-400" : "fill-transparent text-muted-foreground/50")} />
      </button>
      <button type="button" aria-pressed={pinned} aria-label={pinned ? "Unpin" : "Pin"} title={pinned ? "Unpin" : "Pin"} onClick={onPin} className="shrink-0 text-muted-foreground/60 hover:text-foreground">
        <StarIcon className={cn("size-4", pinned && "fill-yellow-400 text-yellow-500")} />
      </button>
    </>
  )
}

/** Gmail's importance arrow, drawn in the current colour; the row menu's Important wears it too. */
export function ImportantIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden className={className}>
      <path d="M4 5h7l5 5-5 5H4l5-5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  )
}
