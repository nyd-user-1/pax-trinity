"use client"

import * as React from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { Columns2, Columns3, Maximize2, X } from "lucide-react"

import { cn } from "@/ui/lib/utils"
import { whiteButton } from "@/components/white-button"
import { PANE_MESSAGE, PANE_PARAM, isEmbedded, isPanePath } from "@/lib/pane"
import type { PanelSize } from "@/components/shell"

// The second panel's frame (lib/pane.ts): the right column's header, title and size and close, over the
// page in its frame. The frame's src is set once per opening; the page moves inside it on its own.
export function PaneFrame({ src, title, nextSize, onSize, onClose, dragging, frameRef }: { src: string; title: string; nextSize: PanelSize; onSize: () => void; onClose: () => void; dragging: boolean; frameRef: React.RefObject<HTMLIFrameElement | null> }) {
  return (
    <section className="fixed inset-0 z-50 flex flex-col bg-pax2-surface md:static md:z-auto md:h-full md:overflow-hidden md:rounded-2xl md:border md:border-slate-500 md:shadow-e2">
      <div className="relative z-10 flex min-h-[73px] shrink-0 items-center justify-between gap-3 bg-pax2-surface px-6 py-4 shadow-header">
        <p className="truncate font-display text-xl text-slate-900">{title}</p>
        <div className="flex shrink-0 items-center gap-2">
          {/* The icon shows the size the next press goes to: a third, half, then the whole area. */}
          <button type="button" onClick={onSize} className={whiteButton("circle", "hidden md:inline-flex")} aria-label={nextSize === "half" ? "Half the page" : nextSize === "full" ? "Full page" : "A third of the page"}>
            {nextSize === "half" ? <Columns2 className="size-4" /> : nextSize === "full" ? <Maximize2 className="size-4" /> : <Columns3 className="size-4" />}
          </button>
          <button type="button" onClick={onClose} className={whiteButton("circle")} aria-label="Close the panel">
            <X className="size-4" />
          </button>
        </div>
      </div>
      {/* While the divider is dragged the frame gives up the pointer, or it would swallow the drag. */}
      <iframe ref={frameRef} src={src} title={title} className={cn("min-h-0 w-full flex-1 border-0 bg-pax2-surface", dragging && "pointer-events-none")} />
    </section>
  )
}

/**
 * Both halves of keeping the address. Around the panel: opens it from ?pane on a load, and puts ?pane back
 * whenever the main page's own navigation drops it (or takes it off once the panel closes). Inside the
 * frame: tells the shell around it where the page now is. Needs useSearchParams, so the shell renders it
 * under Suspense.
 */
export function PaneSync({ href, onOpen }: { href: string | null; onOpen: (href: string) => void }) {
  const path = usePathname()
  const params = useSearchParams()
  const query = params.toString()
  const read = React.useRef(false)
  const open = React.useRef(onOpen)
  open.current = onOpen
  React.useEffect(() => {
    if (isEmbedded()) {
      window.parent.postMessage({ type: PANE_MESSAGE, href: path + (query ? `?${query}` : "") }, window.location.origin)
      return
    }
    const sp = new URLSearchParams(query)
    if (!read.current) {
      read.current = true
      const p = sp.get(PANE_PARAM)
      if (p && isPanePath(p)) return open.current(p)
    }
    if (href) sp.set(PANE_PARAM, href)
    else sp.delete(PANE_PARAM)
    const q = sp.toString()
    if (q !== query) window.history.replaceState(null, "", path + (q ? `?${q}` : "") + window.location.hash)
  }, [path, query, href])
  return null
}
