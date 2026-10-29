"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { ExpandIcon, MinimizeIcon, RestoreIcon, STRIP_BUTTON } from "@/components/notes/note-sheet"

// The composer popped out (Brendan, 2026-10-29): Gmail's New Message window in
// the note sheet's dress (components/notes/note-sheet.tsx, Leuk's port). The
// title strip carries minimize, expand and close; compact docks bottom-right
// with the inbox live around it, big centers on a scrim, minimized is the strip
// alone. Closing hands back to the page, which keeps what was written as a draft.
export function ComposeWindow({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const [minimized, setMinimized] = React.useState(false)
  const [big, setBig] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  if (!mounted) return null

  const strip = (
    <div className="flex h-11 shrink-0 items-center justify-between gap-1 bg-pax2-blue pl-4 pr-1">
      <button type="button" onClick={() => setMinimized((m) => !m)} className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-white/90">
        {title}
      </button>
      <span className="flex shrink-0 items-center gap-0.5">
        <button type="button" onClick={() => setMinimized((m) => !m)} aria-label={minimized ? "Restore" : "Minimize"} className={STRIP_BUTTON}>
          <MinimizeIcon />
        </button>
        <button
          type="button"
          onClick={() => {
            setMinimized(false)
            setBig((b) => !b)
          }}
          aria-label={big && !minimized ? "Exit full screen" : "Full screen"}
          className={STRIP_BUTTON}
        >
          {big && !minimized ? <RestoreIcon /> : <ExpandIcon />}
        </button>
        <button type="button" onClick={onClose} aria-label="Save and close" className={STRIP_BUTTON}>
          <X className="size-4" />
        </button>
      </span>
    </div>
  )

  if (minimized)
    return createPortal(
      <div className="fixed right-4 bottom-0 z-50 w-full max-w-xs overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-e3 sm:right-6">{strip}</div>,
      document.body
    )

  return createPortal(
    <>
      {big && <div className="fixed inset-0 z-40 bg-slate-950/40" aria-hidden onClick={() => setBig(false)} />}
      <div
        role="dialog"
        aria-label={title}
        className={cn(
          "fixed z-50 flex flex-col overflow-hidden border border-slate-200 bg-white shadow-e3 animate-in fade-in slide-in-from-bottom-4",
          big ? "inset-0 m-auto h-[85vh] max-h-[860px] w-[92vw] max-w-[1200px] rounded-2xl" : "right-4 bottom-0 h-[600px] max-h-[85vh] w-full max-w-[560px] rounded-t-2xl sm:right-6"
        )}
      >
        {strip}
        <div className="flex min-h-0 flex-1 flex-col px-4 pt-3 pb-3">{children}</div>
      </div>
    </>,
    document.body
  )
}
