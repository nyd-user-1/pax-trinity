"use client"

import * as React from "react"

import { Reveal } from "@/components/reveal"
import { cn } from "@/lib/utils"

import { num } from "../america-thinks/audience-data"
import { levelOf, POINT_LEFT, POINT_RIGHT, signed, significance, type Cell } from "./lift-data"

// The marks /lift draws in its cells: the bar view's candle, the heatmap's
// fill, and the emotion column's stacked bar. The candle and the stacked bar
// grow in the first time they come into view (components/reveal.tsx).

/** Where zero sits and how far a point reaches, for a table whose lifts run from -neg to +pos (Brendan,
 *  2026-10-29: no half-empty cells): zero only as far in as the largest negative needs, the bars the rest of the
 *  width; the control's number keeps room left of zero, the lift's label room right of the longest bar. */
export function axisOf(neg: number, pos: number) {
  const left = neg > 0 ? 16 : 12
  const right = pos > 0 ? 16 : 6
  const span = neg + pos || 1
  const usable = 100 - left - right
  return { axis: left + (usable * neg) / span, scale: usable / span }
}

/** A result as Swayable draws it: the control group's level at zero, a bar of the lift from it (its tip
 *  pointing the way the treatment moved), the lift past the tip. A lift that does not clear its test is gray. */
export function Candle({ cell, axis, scale, baseTitle }: { cell: Cell; axis: number; scale: number; baseTitle?: string }) {
  const d = cell.lift[7]
  const quiet = significance(cell.lift) === false
  const up = d >= 0
  const tip = Math.min(100, Math.max(0, axis + d * scale))
  return (
    <Reveal as="span" className="relative block h-6 w-full text-[13px]">
      {cell.control && (
        <span className="absolute top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground" style={up ? { right: `calc(${100 - axis}% + 5px)` } : { left: `calc(${axis}% + 5px)` }} title={baseTitle ?? `Control group ${levelOf(cell.control)}`}>
          {num(cell.control[7])}
        </span>
      )}
      <span
        aria-hidden
        className={cn("absolute top-1/2 h-3.5 -translate-y-1/2", up ? "grow-x" : "grow-x-neg", quiet ? "bg-muted-foreground/25" : up ? "bg-linear-to-r from-pax2-light-blue/45 to-pax2-light-blue" : "bg-linear-to-l from-pax2-red/45 to-pax2-red")}
        style={{ left: `${Math.min(axis, tip)}%`, width: `max(6px, ${Math.abs(tip - axis)}%)`, clipPath: up ? POINT_RIGHT : POINT_LEFT }}
      />
      <span
        className={cn("grow-in absolute top-1/2 -translate-y-1/2 font-semibold whitespace-nowrap", quiet ? "font-medium text-muted-foreground" : !up && "text-pax2-red")}
        style={up ? { left: `calc(${tip}% + ${tip - axis < 1 ? 8 : 3}px)` } : { right: `calc(${100 - tip}% + ${axis - tip < 1 ? 8 : 3}px)` }}
      >
        {signed(d)}
      </span>
    </Reveal>
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

/** A stacked bar of parts that add to 100: a 2px gap between, each named with its share on hover. It grows
 *  in on its own unless `inChart`, where it rides the reveal of the row around it. */
function StackBar({ parts, inChart }: { parts: { name: string; color: string; pct: number }[]; inChart?: boolean }) {
  const segments = parts.map((p) =>
    p.pct > 0 ? <span key={p.name} title={`${p.name} ${p.pct}%`} className="h-full first:rounded-l-[4px] last:rounded-r-[4px]" style={{ width: `${p.pct}%`, background: p.color }} /> : null
  )
  const frame = "grow-x flex h-5 w-full gap-[2px]"
  return inChart ? (
    <span className={frame}>{segments}</span>
  ) : (
    <Reveal as="span" className={frame}>
      {segments}
    </Reveal>
  )
}

/** One row's emotional response: the shares stacked. */
export function EmotionBar({ shares, inChart }: { shares: number[]; inChart?: boolean }) {
  return <StackBar inChart={inChart} parts={EMOTIONS.map((e, i) => ({ name: e.name, color: e.color, pct: shares[i] }))} />
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

/** The archive's coded emotional appeal: what each ad's coders rated it as appealing to, 0 to 1 per emotion
 *  (independent ratings, so not shares), the dataviz reference palette's eight slots in order. */
export const APPEALS = [
  { key: "anger", name: "Anger", color: "#2a78d6" },
  { key: "disgust", name: "Disgust", color: "#eb6834" },
  { key: "enthusiasm", name: "Enthusiasm", color: "#1baf7a" },
  { key: "fear", name: "Fear", color: "#eda100" },
  { key: "humor", name: "Humor", color: "#e87ba4" },
  { key: "pride", name: "Pride", color: "#008300" },
  { key: "sadness", name: "Sadness", color: "#6250d6" },
  { key: "somber", name: "Somber", color: "#e34948" },
] as const

/** One ad's coded appeal in the same stacked bar: each emotion's share of all its rated appeal. */
export function AppealBar({ emotions, inChart }: { emotions: Record<string, number>; inChart?: boolean }) {
  const v = APPEALS.map((e) => Math.max(0, emotions[e.key] ?? 0))
  const total = v.reduce((a, b) => a + b, 0) || 1
  const pct = v.map((x) => Math.round((x / total) * 100))
  return <StackBar inChart={inChart} parts={APPEALS.map((e, i) => ({ name: e.name, color: e.color, pct: pct[i] }))} />
}

export function AppealKey({ className }: { className?: string }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      {APPEALS.map((e) => (
        <span key={e.key} className={cn("flex items-center gap-1 text-[10.5px] whitespace-nowrap", className ?? "text-muted-foreground")}>
          <span className="size-2 rounded-[2px]" style={{ background: e.color }} />
          {e.name}
        </span>
      ))}
    </span>
  )
}
