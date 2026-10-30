"use client"

import * as React from "react"

import { studioSrc, VERSIONS_CHANGED } from "@/lib/studio"
import { cn } from "@/ui/lib/utils"

// Remotion Studio in a frame (/studio and the right panel's Studio view). It is served from this origin,
// so its settings are this page's localStorage: unless the reader has chosen otherwise, its list of
// compositions starts open, where Remotion would fold it on a frame narrower than a laptop screen. When a
// video version is saved in this window (Chat), the frame reloads onto it, so the Studio lists it, and
// tells `onMove` where it went.

const LEFT_SIDEBAR = "remotion.sidebarCollapsing"

export function StudioFrame({ id, onMove, className }: { id?: string | null; onMove?: (id: string) => void; className?: string }) {
  const [at, setAt] = React.useState<{ id: string | null; n: number } | null>(null)
  React.useEffect(() => {
    try {
      if (!window.localStorage.getItem(LEFT_SIDEBAR)) window.localStorage.setItem(LEFT_SIDEBAR, "expanded")
    } catch {}
    // The frame may already stand where the caller now points (it moved there itself on a save).
    setAt((cur) => (cur && cur.id === (id ?? null) ? cur : { id: id ?? null, n: 0 }))
  }, [id])
  const moved = React.useRef(onMove)
  React.useEffect(() => {
    moved.current = onMove
  })
  React.useEffect(() => {
    const saved = (e: Event) => {
      const next = (e as CustomEvent<{ id?: string }>).detail?.id
      setAt((cur) => ({ id: next ?? cur?.id ?? null, n: (cur?.n ?? 0) + 1 }))
      if (next) moved.current?.(next)
    }
    window.addEventListener(VERSIONS_CHANGED, saved)
    return () => window.removeEventListener(VERSIONS_CHANGED, saved)
  }, [])
  const frame = cn("block min-h-0 w-full flex-1 border-0 bg-[#0f172a]", className)
  if (!at) return <div className={frame} />
  return <iframe key={`${at.id}-${at.n}`} title="Studio" src={studioSrc(at.id)} allow="autoplay; fullscreen; clipboard-write" className={frame} />
}
