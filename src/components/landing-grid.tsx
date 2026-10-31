"use client"

import * as React from "react"

import CursorGrid from "@/components/cursor-grid"
import { SEQUENCE_MS } from "@/components/flap-hero"
import { THEME_EVENT } from "@/lib/theme"

// The page-wide grid: one viewport-sized layer fixed behind every section, so the
// effect rides along wherever the reader scrolls. It's there from the first paint and opens
// with one blue pulse; when the hero's board sequence finishes, one red pulse runs out through it. The colours feed
// WebGL uniforms, which cannot read CSS variables, so the tokens are resolved to their hex. No
// opening reveal: the curtain covers the grid's first moments.
// Themed (Brendan, 2026-10-30): its colours and opacities are the theme's (--t-grid, --t-pulse,
// --t-grid-opacity, --t-grid-fill, --t-grid-spotlight, lib/theme.ts), read again whenever the theme or
// the theme panel changes them; before a theme is set, PAX's blue and red at the original opacities.
type Look = { grid: string; pulse: string; opacity: number; fill: number; spotlight: number }

function readLook(): Look {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string) => css.getPropertyValue(name).trim()
  const n = (name: string, f: number) => {
    const x = parseFloat(v(name))
    return Number.isFinite(x) ? x : f
  }
  return {
    grid: v("--t-grid") || v("--pax2-blue"),
    pulse: v("--t-pulse") || v("--pax2-red"),
    opacity: n("--t-grid-opacity", 0.16),
    fill: n("--t-grid-fill", 0.08),
    spotlight: n("--t-grid-spotlight", 0.8),
  }
}

/** `pulseAt`: when the red pulse runs, in ms; the landing's is the end of the hero's board, /signup's the end of its header. */
export function LandingGrid({ pulseAt = SEQUENCE_MS }: { pulseAt?: number }) {
  const [look, setLook] = React.useState<Look | null>(null)
  const [pulse, setPulse] = React.useState(0)
  React.useEffect(() => {
    setLook(readLook())
    const t = window.setTimeout(() => setPulse(1), pulseAt)
    const changed = () => setLook(readLook())
    window.addEventListener(THEME_EVENT, changed)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener(THEME_EVENT, changed)
    }
  }, [pulseAt])
  if (!look) return null
  return (
    <div className="pointer-events-none fixed inset-0">
      <CursorGrid color={look.grid} gridColor={look.grid} pulseColor={look.pulse} pulseKey={pulse} startPulse intro={false} gridOpacity={look.opacity} fillOpacity={look.fill} spotlight={look.spotlight} />
    </div>
  )
}
