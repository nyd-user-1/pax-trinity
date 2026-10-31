"use client"

import * as React from "react"
import { Palette, X } from "lucide-react"

import { cn } from "@/ui/lib/utils"
import { whiteButton } from "@/components/white-button"
import { PANEL_KEY, THEME_KEY, THEMES, type ThemeName } from "@/lib/theme"

// Theme (Brendan, 2026-10-30): the account menu's Theme switch puts a palette button in the page's
// lower-right corner, and the palette opens the theme panel. The frame is leuk's watercolor
// playground (leuk components/marketing/watercolor-playground.tsx): a corner button, a panel that
// opens in the corner and drags by its header. To start it holds Light and Dark; more themes come
// later (lib/theme.ts). The palette sits 16px from the corner, clear of the inspector dock's 68px.

const PANEL_EVENT = "pax:theme-panel"

function applyTheme(t: ThemeName) {
  const root = document.documentElement
  root.classList.toggle("dark", t === "dark")
  root.style.colorScheme = t
  try {
    localStorage.setItem(THEME_KEY, t)
  } catch {}
}

function savedTheme(): ThemeName {
  try {
    return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light"
  } catch {
    return "light"
  }
}

/** Whether the account menu's Theme switch is on (the palette shows), kept in this browser. */
export function useThemePanel(): [boolean, (on: boolean) => void] {
  const [on, setOn] = React.useState(false)
  React.useEffect(() => {
    const read = () => {
      try {
        setOn(localStorage.getItem(PANEL_KEY) === "on")
      } catch {}
    }
    read()
    window.addEventListener(PANEL_EVENT, read)
    return () => window.removeEventListener(PANEL_EVENT, read)
  }, [])
  const set = React.useCallback((next: boolean) => {
    try {
      localStorage.setItem(PANEL_KEY, next ? "on" : "off")
    } catch {}
    window.dispatchEvent(new Event(PANEL_EVENT))
  }, [])
  return [on, set]
}

/** The palette in the corner, and the theme panel it opens. */
export function ThemePalette() {
  const [open, setOpen] = React.useState(false)
  const [theme, setTheme] = React.useState<ThemeName>("light")
  React.useEffect(() => setTheme(savedTheme()), [])
  const pick = (t: ThemeName) => {
    setTheme(t)
    applyTheme(t)
  }

  // Dragged by its header; `pos` is the top-left corner, null the corner dock (leuk's playground).
  const panelRef = React.useRef<HTMLDivElement>(null)
  const grab = React.useRef<{ dx: number; dy: number } | null>(null)
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null)
  const onDragStart = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return
    const el = panelRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    grab.current = { dx: e.clientX - r.left, dy: e.clientY - r.top }
    setPos({ x: r.left, y: r.top })
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onDragMove = (e: React.PointerEvent) => {
    if (!grab.current) return
    const el = panelRef.current
    const w = el?.offsetWidth ?? 280
    const h = el?.offsetHeight ?? 160
    setPos({
      x: Math.min(Math.max(0, e.clientX - grab.current.dx), window.innerWidth - w),
      y: Math.min(Math.max(0, e.clientY - grab.current.dy), window.innerHeight - h),
    })
  }
  const onDragEnd = (e: React.PointerEvent) => {
    grab.current = null
    e.currentTarget.releasePointerCapture(e.pointerId)
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label="Open the theme panel" title="Theme" className={whiteButton("circle", "fixed right-4 bottom-4 z-[60] size-11")}>
        <Palette className="size-5" style={{ color: "#033882" }} />
      </button>
    )
  }

  return (
    <div
      ref={panelRef}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      className={cn("fixed z-[60] flex w-[280px] flex-col overflow-hidden rounded-2xl border border-border bg-background text-foreground shadow-e2", !pos && "right-4 bottom-4")}
    >
      <div onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} className="flex shrink-0 cursor-grab touch-none items-center justify-between border-b border-border px-4 py-3 select-none active:cursor-grabbing">
        <span className="flex items-center gap-2 text-[15px] font-semibold">
          <Palette className="size-4" />
          Theme
        </span>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close the theme panel" className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
      <div className="p-4">
        <p className="mb-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Mode</p>
        <div className="flex gap-1.5">
          {THEMES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => pick(t.value)}
              aria-pressed={theme === t.value}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                theme === t.value ? "border-pax2-light-blue bg-pax2-lavender text-pax2-blue" : "border-border text-foreground hover:bg-muted",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
