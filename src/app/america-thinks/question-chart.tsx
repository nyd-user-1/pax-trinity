"use client"

import * as React from "react"
import { init, use, type ComposeOption, type EChartsType } from "echarts/core"
import { LineChart, type LineSeriesOption } from "echarts/charts"
import { GridComponent, LegendComponent, TooltipComponent, type GridComponentOption, type LegendComponentOption, type TooltipComponentOption } from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"

import { reducedMotion } from "@/components/reveal"

import { num, year, type MetricInfo, type SourceRow } from "./audience-data"
import { retheme, useThemeVersion } from "@/lib/theme-client"

// A question's trend as the line chart a pollster puts in a report: one line
// per answer option across the waves, toplines only. ECharts from its core
// with the five pieces this chart uses, so the full build never ships.

use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer])

type Option = ComposeOption<LineSeriesOption | GridComponentOption | TooltipComponentOption | LegendComponentOption>

const MAX_LINES = 8
const HEIGHT = 380
const GRID = { top: 44, bottom: 28, left: 8 }

// pax2-blue as an ordinal ramp, dark to light, anchored on pax2-blue (#1e3a8a)
// and chart-2 (#60a5fa): answer options run in their coded order, which is
// usually a scale. Validated (dataviz validate_palette --ordinal, white
// surface): monotone lightness, every step 0.067 apart, the light end 2.5:1.
const RAMP = ["#0f1b49", "#1a2b64", "#1e3a8a", "#1e45bd", "#2057e0", "#2e71f0", "#448cf7", "#60a5fa"]
// Shapes carry identity beside lightness, so no line is told by color alone.
const SYMBOLS = ["circle", "rect", "triangle", "diamond", "emptyCircle", "emptyRect", "emptyTriangle", "emptyDiamond"]
const INK = "#0f172a"
const MUTED = "#64748b"
const SECONDARY = "#475569"
const RULE = "#cbd5e1"
const MIST = "#f5f7fb"

type Line = { option: string | null; name: string; points: Map<number, SourceRow> }
type Trend = { type: string; waves: number[]; lines: Line[]; total: number; capped: boolean }

/** The question's toplines at its baseline geography, one line per option in
 *  recorded order, each wave's row read the way the crosstab's trend reads it
 *  (the latest period_end within the year). Null when there is nothing to
 *  draw: a lift, or fewer than two waves. */
function trendOf(rows: SourceRow[], info: MetricInfo, title: string): Trend | null {
  if (info.type === "lift_pp") return null
  const top = rows.filter((r) => !r[5] && r[1] === info.baseGeo && r[8] === info.type)
  const options = info.options.length ? info.options : [info.option]
  let lines: Line[] = options
    .map((option) => {
      const points = new Map<number, SourceRow>()
      for (const r of top) {
        if ((r[4] ?? null) !== option) continue
        const y = Number(year(r[3]))
        const had = points.get(y)
        if (!had || r[3] > had[3]) points.set(y, r)
      }
      return { option, name: option ?? title, points }
    })
    .filter((l) => l.points.size > 0)
  const total = lines.length
  const capped = total > MAX_LINES
  if (capped) {
    // The crosstab's cap: the options highest at their latest wave, kept in recorded order.
    const latest = (l: Line) => l.points.get(Math.max(...l.points.keys()))![7]
    const keep = new Set([...lines].sort((a, b) => latest(b) - latest(a)).slice(0, MAX_LINES))
    lines = lines.filter((l) => keep.has(l))
  }
  const waves = [...new Set(lines.flatMap((l) => [...l.points.keys()]))].sort((a, b) => a - b)
  if (waves.length < 2) return null
  return { type: info.type, waves, lines, total, capped }
}

/** Ramp steps for k lines: up to six start at pax2-blue and spread to the light end. */
function rampFor(k: number): string[] {
  if (k >= 8) return RAMP
  if (k === 7) return RAMP.slice(1)
  if (k === 1) return [RAMP[2]]
  return Array.from({ length: k }, (_, i) => RAMP[Math.round(2 + (i * 5) / (k - 1))])
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })

function fmt(v: number, type: string): string {
  if (type === "pct") return `${num(v)}%`
  if (type === "count") return num(v, 0)
  return num(v)
}

/** The tooltip: the wave, then each visible option's value with its margin, then the base. */
function tooltipFor(t: Trend, visible: number[], wave: number): HTMLElement {
  const box = document.createElement("div")
  box.style.cssText = `min-width:160px;color:var(--t-ink, ${INK});font-size:12px;line-height:1.5`
  const head = document.createElement("div")
  head.style.cssText = "font-weight:600;margin-bottom:4px"
  head.textContent = String(wave)
  box.appendChild(head)
  const colors = rampFor(t.lines.length)
  let n: number | null = null
  for (const i of visible) {
    const r = t.lines[i].points.get(wave)
    const row = document.createElement("div")
    row.style.cssText = "display:flex;align-items:baseline;gap:6px;white-space:nowrap"
    const key = document.createElement("span")
    key.style.cssText = `display:inline-block;width:12px;height:2px;border-radius:1px;align-self:center;background:${colors[i]}`
    const val = document.createElement("strong")
    val.style.cssText = "font-weight:600;font-variant-numeric:tabular-nums"
    val.textContent = r ? fmt(r[7], t.type) : "—"
    row.append(key, val)
    if (r && r[9] != null) {
      const moe = document.createElement("span")
      moe.style.cssText = `color:var(--t-ink-3, ${MUTED});font-size:11px;font-variant-numeric:tabular-nums`
      moe.textContent = `± ${num(r[9], t.type === "count" ? 0 : 1)}`
      row.appendChild(moe)
    }
    const name = document.createElement("span")
    name.style.cssText = `color:var(--t-ink-2, ${SECONDARY})`
    name.textContent = t.lines[i].name
    row.appendChild(name)
    box.appendChild(row)
    const rn = r?.[11]
    if (n == null && rn != null) n = rn
  }
  if (n != null) {
    const base = document.createElement("div")
    base.style.cssText = `margin-top:4px;color:var(--t-ink-3, ${MUTED});font-size:11px;font-variant-numeric:tabular-nums`
    base.textContent = `n ${num(n, 0)}`
    box.appendChild(base)
  }
  return box
}

function optionFor(t: Trend): Option {
  const colors = rampFor(t.lines.length)
  const values = t.lines.flatMap((l) => [...l.points.values()].map((r) => r[7]))
  const peak = Math.max(...values)
  const pct = t.type === "pct"
  // Shares keep their zero baseline; the top is 100 once any line passes 60,
  // else the next ten above the peak, so a 5% option is not flattened.
  const yMax = pct ? (peak > 60 ? 100 : Math.max(10, Math.ceil((peak + 5) / 10) * 10)) : undefined
  // End labels for up to four lines, dropped where two would collide:
  // ECharts' own label layout is a module this chart does not load.
  const plot = HEIGHT - GRID.top - GRID.bottom
  const span = (yMax ?? peak) || 1
  const last = t.lines.map((l) => l.points.get(Math.max(...l.points.keys()))![7])
  const labeled = t.lines.map((_, i) => t.lines.length <= 4 && last.every((v, j) => j === i || (Math.abs(v - last[i]) / span) * plot >= 14))
  return {
    // Each question's lines draw left to right as it opens (Brendan, 2026-10-29); a legend pick eases.
    animation: !reducedMotion(),
    animationDuration: 900,
    animationEasing: "cubicOut",
    animationDurationUpdate: 300,
    color: colors,
    grid: { ...GRID, right: labeled.some(Boolean) ? 56 : 16 },
    legend: t.lines.length > 1
      ? { type: "scroll", top: 0, left: 0, itemWidth: 18, itemHeight: 8, itemGap: 16, textStyle: { color: SECONDARY, fontSize: 12 }, pageIconColor: SECONDARY, pageIconInactiveColor: RULE, pageTextStyle: { color: MUTED } }
      : { show: false },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line", snap: true, lineStyle: { color: RULE, width: 1, type: "solid" } },
      backgroundColor: "#fff",
      borderColor: "#e2e8f0",
      borderWidth: 1,
      padding: [8, 10],
      extraCssText: "box-shadow:0 4px 14px -4px rgb(15 23 42 / 0.1), 0 2px 4px -2px rgb(15 23 42 / 0.06);border-radius:8px;",
      formatter: (params) => {
        const list = Array.isArray(params) ? params : [params]
        const visible = list.map((p) => p.seriesIndex ?? -1).filter((i) => i >= 0)
        const at = Number((list[0] as unknown as { axisValue?: number | string }).axisValue)
        const wave = t.waves.reduce((b, w) => (Math.abs(w - at) < Math.abs(b - at) ? w : b), t.waves[0])
        return tooltipFor(t, visible, wave)
      },
    },
    xAxis: {
      type: "value",
      min: t.waves[0],
      max: t.waves[t.waves.length - 1],
      minInterval: 1,
      axisLine: { lineStyle: { color: RULE } },
      axisTick: { show: false },
      axisLabel: { color: MUTED, fontSize: 11, formatter: (v: number) => String(v), hideOverlap: true },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      min: 0,
      max: yMax,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: MUTED, fontSize: 11, formatter: (v: number) => (pct ? `${v}%` : t.type === "count" ? compact.format(v) : num(v)) },
      splitLine: { lineStyle: { color: MIST, width: 1, type: "solid" } },
    },
    series: t.lines.map((l, i): LineSeriesOption => {
      const empty = SYMBOLS[i].startsWith("empty")
      return {
        type: "line",
        name: l.name,
        data: t.waves.filter((w) => l.points.has(w)).map((w) => [w, l.points.get(w)![7]]),
        lineStyle: { color: colors[i], width: 2, cap: "round", join: "round" },
        symbol: SYMBOLS[i],
        symbolSize: 8,
        showSymbol: true,
        // A filled mark wears a white ring; a hollow one is drawn in the line's color.
        itemStyle: empty ? { color: colors[i], borderWidth: 2 } : { color: colors[i], borderColor: "#fff", borderWidth: 1.5 },
        emphasis: { focus: "series", lineStyle: { width: 2.5 } },
        endLabel: labeled[i] ? { show: true, color: SECONDARY, fontSize: 11, distance: 6, formatter: () => fmt(last[i], t.type) } : { show: false },
      }
    }),
  }
}

export function QuestionChart({
  rows,
  info,
  title,
  place,
  flush = false,
}: {
  /** The question's rows alone, already filtered by the caller. */
  rows: SourceRow[]
  info: MetricInfo
  title: string
  place: (code: string) => string
  /** Inside a card that already pads it. */
  flush?: boolean
}) {
  const trend = React.useMemo(() => trendOf(rows, info, title), [rows, info, title])
  const option = React.useMemo(() => (trend ? optionFor(trend) : null), [trend])

  if (!trend || !option) return <p className="px-5 py-10 text-center text-sm text-muted-foreground">No trend to draw</p>

  const first = trend.waves[0]
  const last = trend.waves[trend.waves.length - 1]
  return (
    <div className={flush ? undefined : "px-5 pt-5 pb-3"}>
      <Canvas option={option} label={`${title}, ${place(info.baseGeo)}, ${first}–${last}: ${trend.lines.map((l) => l.name).join(", ")}`} />
      {trend.capped && <p className="mt-2 text-xs text-muted-foreground">The first {MAX_LINES} of {trend.total} options by the latest value.</p>}
    </div>
  )
}

/** The canvas: init on mount, dispose on unmount, one ResizeObserver. A legend
 *  click isolates its line; clicking the lone line again brings all back. */
function Canvas({ option, label }: { option: Option; label: string }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const chart = React.useRef<EChartsType | null>(null)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const c = init(el, undefined, { renderer: "canvas" })
    chart.current = c
    c.on("legendselectchanged", (e: unknown) => {
      const { name, selected } = e as { name: string; selected: Record<string, boolean> }
      const before = { ...selected, [name]: !selected[name] }
      const alone = Object.entries(before).every(([k, on]) => on === (k === name))
      c.setOption({ legend: { selected: Object.fromEntries(Object.keys(before).map((k) => [k, alone || k === name])) } })
    })
    // Only a real change of size: the observer's first call, at once, would cut the entrance animation short.
    const ro = new ResizeObserver(() => (el.clientWidth !== c.getWidth() || el.clientHeight !== c.getHeight()) && c.resize())
    ro.observe(el)
    return () => {
      ro.disconnect()
      c.dispose()
      chart.current = null
    }
  }, [])

  // Drawn in the theme's colours (lib/theme-client.ts retheme), and again whenever the theme changes.
  const themeV = useThemeVersion()
  React.useEffect(() => {
    const el = ref.current
    if (!chart.current || !el) return
    chart.current.setOption(retheme({ ...option, textStyle: { fontFamily: getComputedStyle(el).fontFamily } }), { notMerge: true })
  }, [option, themeV])

  return <div ref={ref} role="img" aria-label={label} style={{ height: HEIGHT }} className="w-full" />
}
