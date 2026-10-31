"use client"

import * as React from "react"
import { Check, Copy, RotateCcw, X } from "lucide-react"

import { cn } from "@/ui/lib/utils"
import { PANEL_KEY, THEMES, TOKENS, themeOf, themeVars, type Custom, type GridColorKey, type NumberKey, type Theme, type TokenKey } from "@/lib/theme"
import { applyTheme, savedCustom, savedThemeName } from "@/lib/theme-client"

// The theme panel (Brendan, 2026-10-30), on leuk's watercolor playground (leuk
// components/marketing/watercolor-playground.tsx): the palette button in the corner, a panel that opens
// there and drags by its header, presets first, then every value as a live control. The presets are the
// four themes (lib/theme.ts); each control edits one of the theme's sixteen colours, the animated grid's
// colours and opacities, or the shadows' depth, on the page as it is dragged. Edits are kept per theme in
// this browser; Reset puts the theme back; Copy CSS copies its variables. The account menu's Theme switch
// shows or hides all of it. The button sits 16px from the corner, clear of the inspector dock's 68px.

const PANEL_EVENT = "pax:theme-panel"

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

const SLIDERS: { key: NumberKey; label: string; min: number; max: number; step: number; group: "Depth" | "Background grid" }[] = [
  { key: "shadow", label: "Shadow depth", min: 0, max: 8, step: 0.1, group: "Depth" },
  { key: "gridOpacity", label: "Line opacity", min: 0, max: 0.5, step: 0.01, group: "Background grid" },
  { key: "gridFill", label: "Cell fill", min: 0, max: 0.3, step: 0.01, group: "Background grid" },
  { key: "gridSpotlight", label: "Spotlight", min: 0, max: 1, step: 0.05, group: "Background grid" },
]

export function ThemePalette() {
  const [open, setOpen] = React.useState(false)
  const [theme, setTheme] = React.useState<Theme>(THEMES[0])
  const [custom, setCustom] = React.useState<Custom>({})
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    const t = themeOf(savedThemeName())
    setTheme(t)
    setCustom(savedCustom(t.name))
  }, [])

  const pickTheme = (t: Theme) => {
    const c = savedCustom(t.name)
    setTheme(t)
    setCustom(c)
    applyTheme(t, c)
  }
  const edit = (k: TokenKey | GridColorKey | NumberKey, v: string | number) => {
    const next = { ...custom, [k]: v } as Custom
    setCustom(next)
    applyTheme(theme, next)
  }
  const reset = () => {
    setCustom({})
    applyTheme(theme, {})
  }
  const copyCss = async () => {
    const vars = themeVars(theme, custom)
    const css = `[data-theme="${theme.name}"] {\n${Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n}`
    await navigator.clipboard.writeText(css).catch(() => {})
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }
  const color = (k: TokenKey) => (custom[k] as string | undefined) ?? theme.colors[k]
  const num = (k: NumberKey) => (custom[k] as number | undefined) ?? theme.numbers[k]
  const edited = Object.keys(custom).length

  // Dragged by its header; `pos` is the top-left corner, null the corner dock.
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
    const w = el?.offsetWidth ?? 340
    const h = el?.offsetHeight ?? 400
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open the theme panel"
        title="Theme"
        className="fixed right-4 bottom-4 z-[60] flex size-12 items-center justify-center rounded-2xl border border-slate-300 bg-pax2-raised text-2xl shadow-e3 transition-transform hover:scale-105"
      >
        🎨
      </button>
    )
  }

  const groups = ["Surfaces", "Type", "Lines", "Accent", "Signals"] as const
  return (
    <div
      ref={panelRef}
      style={pos ? { left: pos.x, top: pos.y } : undefined}
      className={cn("fixed z-[60] flex max-h-[86vh] w-[340px] flex-col overflow-hidden rounded-2xl border border-slate-300 bg-pax2-raised text-slate-900 shadow-e3", !pos && "right-4 bottom-4")}
    >
      <div onPointerDown={onDragStart} onPointerMove={onDragMove} onPointerUp={onDragEnd} className="flex shrink-0 cursor-grab touch-none items-center justify-between border-b border-slate-200 px-4 py-3 select-none active:cursor-grabbing">
        <span className="flex items-center gap-2 text-[15px] font-semibold">🎨 Theme</span>
        <div className="flex items-center gap-3">
          <button type="button" onClick={reset} disabled={!edited} className="inline-flex items-center gap-1 text-xs font-semibold tracking-wide text-slate-500 uppercase hover:text-slate-900 disabled:opacity-40">
            <RotateCcw className="size-3" />
            Reset
          </button>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close the theme panel" className="text-slate-500 hover:text-slate-900">
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-4">
        <Section label="Themes">
          <div className="grid grid-cols-2 gap-2">
            {THEMES.map((t) => (
              <Preset key={t.name} theme={t} on={t.name === theme.name} onPick={() => pickTheme(t)} />
            ))}
          </div>
        </Section>

        {groups.map((g) => (
          <Section key={g} label={g}>
            {TOKENS.filter((t) => t.group === g).map((t) => (
              <ColorRow key={t.key} name={t.label} value={color(t.key)} edited={t.key in custom} onChange={(v) => edit(t.key, v)} />
            ))}
          </Section>
        ))}

        <Section label="Background grid">
          <ColorRow name="Grid" value={(custom.grid as string | undefined) ?? color("accent")} edited={"grid" in custom} onChange={(v) => edit("grid", v)} />
          <ColorRow name="Pulse" value={(custom.pulse as string | undefined) ?? color("negative")} edited={"pulse" in custom} onChange={(v) => edit("pulse", v)} />
          {SLIDERS.filter((s) => s.group === "Background grid").map((s) => (
            <Slider key={s.key} label={s.label} value={num(s.key)} min={s.min} max={s.max} step={s.step} onChange={(v) => edit(s.key, v)} />
          ))}
        </Section>

        <Section label="Depth">
          {SLIDERS.filter((s) => s.group === "Depth").map((s) => (
            <Slider key={s.key} label={s.label} value={num(s.key)} min={s.min} max={s.max} step={s.step} unit="×" onChange={(v) => edit(s.key, v)} />
          ))}
        </Section>
      </div>

      <div className="shrink-0 border-t border-slate-200 p-3">
        <button type="button" onClick={() => void copyCss()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-pax2-blue py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : `Copy ${theme.label} as CSS`}
        </button>
      </div>
    </div>
  )
}

/** A theme as a small picture of the app in its colours: the page, the sidebar, the main surface with a
 *  line of ink and the brand, and a raised card. */
function Preset({ theme, on, onPick }: { theme: Theme; on: boolean; onPick: () => void }) {
  const c = theme.colors
  return (
    <button type="button" onClick={onPick} aria-pressed={on} className={cn("overflow-hidden rounded-xl border text-left transition-shadow", on ? "border-pax2-light-blue ring-2 ring-pax2-light-blue/40" : "border-slate-200 hover:shadow-e2")}>
      <div className="flex h-16 gap-1 p-1.5" style={{ background: c.frame }}>
        <div className="w-1/4 rounded-md" style={{ background: c.sidebar, border: `1px solid ${c.rule}` }} />
        <div className="flex flex-1 flex-col gap-1 rounded-md p-1.5" style={{ background: c.surface, border: `1px solid ${c.rule}` }}>
          <div className="h-1.5 w-3/4 rounded-full" style={{ background: c.ink }} />
          <div className="h-1.5 w-1/2 rounded-full" style={{ background: c.ink3 }} />
          <div className="mt-auto flex gap-1">
            <div className="h-3 w-6 rounded" style={{ background: c.accent }} />
            <div className="h-3 flex-1 rounded" style={{ background: c.raised, border: `1px solid ${c.rule}` }} />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between px-2 py-1.5 text-xs font-semibold">
        {theme.label}
        {on && <Check className="size-3.5 text-pax2-light-blue" />}
      </div>
    </button>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{label}</p>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function ColorRow({ name, value, edited, onChange }: { name: string; value: string; edited: boolean; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2.5">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${name} colour`}
        className="size-7 shrink-0 cursor-pointer appearance-none rounded-full border border-slate-300 bg-transparent p-0 [&::-moz-color-swatch]:rounded-full [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch-wrapper]:p-0"
      />
      <span className="flex-1 text-[13px] text-slate-700">
        {name}
        {edited && <span className="ml-1.5 text-[10px] font-semibold text-pax2-light-blue">edited</span>}
      </span>
      <span className="font-mono text-xs text-slate-500 tabular-nums">{value}</span>
    </label>
  )
}

function Slider({ label, value, min, max, step, unit = "", onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between text-[13px] text-slate-700">
        <span>{label}</span>
        <span className="text-slate-500 tabular-nums">
          {value}
          {unit}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="mt-1 w-full accent-pax2-light-blue" />
    </div>
  )
}
