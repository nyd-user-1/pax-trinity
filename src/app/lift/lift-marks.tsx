"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

import { num } from "../america-thinks/audience-data"
import { levelOf, POINT_LEFT, POINT_RIGHT, signed, significance, type Cell } from "./lift-data"

// The marks /lift draws in its cells: the bar view's candle, the heatmap's
// fill, and the Emotional Response bar.

/** The share of a cell the table's largest lift spans from the axis. */
const REACH = 40

/** A result as Swayable draws it: the control group's level at the axis, a
 *  bar of the lift from it (its tip pointing the way the treatment moved), the
 *  lift at the tip, and the margin through it as the resonant-topic chart
 *  draws its range (components/record/resonance-topic.tsx): an ink line with
 *  a cap at each end. A lift that does not clear its test is gray. */
export function Candle({ cell, extent }: { cell: Cell; extent: number }) {
  const d = cell.lift[7]
  const moe = cell.lift[9]
  const quiet = significance(cell.lift) === false
  const up = d >= 0
  const at = (x: number) => Math.min(100, Math.max(0, 50 + (extent > 0 ? (x / extent) * REACH : 0)))
  const tip = at(d)
  const ink = quiet ? "bg-muted-foreground/60" : "bg-slate-900"
  return (
    <span className="relative block h-6 w-full text-[13px]">
      {cell.control && (
        <span className="absolute top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground" style={up ? { right: "calc(50% + 5px)" } : { left: "calc(50% + 5px)" }} title={`Control group ${levelOf(cell.control)}`}>
          {num(cell.control[7])}
        </span>
      )}
      <span
        aria-hidden
        className={cn("absolute top-1/2 h-3.5 -translate-y-1/2", quiet ? "bg-muted-foreground/25" : up ? "bg-linear-to-r from-pax2-light-blue/45 to-pax2-light-blue" : "bg-linear-to-l from-pax2-red/45 to-pax2-red")}
        style={{ left: `${Math.min(50, tip)}%`, width: `max(6px, ${Math.abs(tip - 50)}%)`, clipPath: up ? POINT_RIGHT : POINT_LEFT }}
      />
      {moe != null && (
        <span aria-hidden className="absolute top-1/2 h-1.5 -translate-y-1/2" style={{ left: `${at(d - moe)}%`, width: `${at(d + moe) - at(d - moe)}%` }}>
          <span className={cn("absolute inset-x-0 top-1/2 h-[1.5px] -translate-y-1/2", ink)} />
          <span className={cn("absolute top-0 left-0 h-full w-[1.5px]", ink)} />
          <span className={cn("absolute top-0 right-0 h-full w-[1.5px]", ink)} />
        </span>
      )}
      <span
        className={cn("absolute top-1/2 -translate-y-1/2 font-semibold [text-shadow:0_0_3px_var(--background),0_0_3px_var(--background)]", quiet ? "font-medium text-muted-foreground" : !up && "text-pax2-red")}
        style={up ? { left: `calc(${tip}% + ${tip - 50 < 1 ? 8 : 3}px)` } : { right: `calc(${100 - tip}% + ${50 - tip < 1 ? 8 : 3}px)` }}
      >
        {signed(d)}
      </span>
    </span>
  )
}

/** The heatmap's fill: blue above the center, red below, gray at it (the
 *  dataviz diverging rule, the bars' own blue and red), four steps an arm. */
export function heat(v: number, center: number, extent: number) {
  const t = extent > 0 ? (v - center) / extent : 0
  const step = Math.min(4, Math.round(Math.abs(t) * 4))
  if (step === 0) return "#f0efec"
  return `color-mix(in oklab, var(${t > 0 ? "--pax2-light-blue" : "--pax2-red"}) ${[0, 16, 28, 40, 52][step]}%, white)`
}

/** The heatmap's key: the scale's two arms around its gray center. */
export function HeatKey({ center }: { center: string }) {
  const steps = [-4, -3, -2, -1, 0, 1, 2, 3, 4]
  return (
    <span className="flex items-center gap-1.5 px-2 text-[11px] text-muted-foreground">
      Below {center}
      <span className="flex gap-[2px]">
        {steps.map((s) => (
          <span key={s} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: heat(s, 0, 4) }} />
        ))}
      </span>
      Above
    </span>
  )
}

/** The Emotional Response column's emotions: the ANES battery's words, the
 *  dataviz reference palette's first six slots in order (validated: adjacent
 *  CVD ΔE ≥ 9.1, normal-vision ≥ 19.6), and gray for none of them. */
export const EMOTIONS = [
  { name: "Hopeful", color: "#2a78d6" },
  { name: "Proud", color: "#eb6834" },
  { name: "Happy", color: "#1baf7a" },
  { name: "Worried", color: "#eda100" },
  { name: "Irritated", color: "#e87ba4" },
  { name: "Angry", color: "#008300" },
  { name: "No strong feeling", color: "#c3c2b7" },
] as const

/** Placeholder shares (Brendan, 2026-10-29: "even if you have to use
 *  placeholder numbers"): no emotional-response data is on file. Seeded by the
 *  treatment and segment, so a row reads the same on every render; they sum
 *  to 100. Replace with the measured shares when a test asks the question. */
export function sampleEmotions(key: string) {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
  const w = EMOTIONS.map((_, i) => (i === EMOTIONS.length - 1 ? 0.15 + rand() * 0.35 : 0.4 + rand()))
  const total = w.reduce((a, b) => a + b, 0)
  const pct = w.map((x) => Math.round((x / total) * 100))
  pct[0] += 100 - pct.reduce((a, b) => a + b, 0)
  return pct
}

/** One row's emotional response: the shares stacked, a 2px gap between, each named on hover. */
export function EmotionBar({ shares }: { shares: number[] }) {
  return (
    <span className="flex h-5 w-full gap-[2px]">
      {shares.map((p, i) =>
        p > 0 ? (
          <span key={EMOTIONS[i].name} title={`${EMOTIONS[i].name} ${p}%`} className="h-full first:rounded-l-[4px] last:rounded-r-[4px]" style={{ width: `${p}%`, background: EMOTIONS[i].color }} />
        ) : null
      )}
    </span>
  )
}

/** The Emotional Response key, in the column's info tooltip. */
export function EmotionKey({ className }: { className?: string }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      {EMOTIONS.map((e) => (
        <span key={e.name} className={cn("flex items-center gap-1 text-[10.5px] whitespace-nowrap", className ?? "text-muted-foreground")}>
          <span className="size-2 rounded-[2px]" style={{ background: e.color }} />
          {e.name}
        </span>
      ))}
    </span>
  )
}
