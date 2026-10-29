"use client"

import * as React from "react"
import { init, use, type EChartsCoreOption, type EChartsType } from "echarts/core"
import { BarChart, LineChart, ScatterChart } from "echarts/charts"
import { DataZoomInsideComponent, DataZoomSliderComponent, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent } from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"

// The readout's charts on ECharts canvas (Brendan, 2026-10-29), each sized to its block's width and
// to its rows' height, so none scrolls. Three shapes. SubgroupLines: pax2's Multi-Modal Viometric Line
// Chart (CompositeChart in pax2's viometrics/charts.tsx) made a wave's: every subgroup along the axis,
// each video's level a line and the placebo's a dashed one, each dimension a shaded band, a mark where
// a video beat the placebo inside a subgroup, the crosshair readout, and the zoom (drag inside, or the
// slider under it) down to a handful of subgroups. PanelBars: rows of bars across one or more side-by-
// side panels on a shared scale (lifts from zero, levels on 0–100 against a dashed reference). The
// Fingerprint: pax2's viometric heat bar (src/components/viometrics/charts.tsx in pax2) made a wave's
// signature, one cell per subgroup per video, each band in its own hue and a cell's strength in its
// depth, the whole column read out under the chart on hover. Specs arrive built on the server
// (report-doc.tsx), so no result set crosses the wire.

use([BarChart, LineChart, ScatterChart, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent, DataZoomInsideComponent, DataZoomSliderComponent, CanvasRenderer])

export type Tone = "detect" | "quiet" | "campaign" | "placebo"
/** A bar: its value, its color, the figure printed past it and the word after that, and its hover lines. */
export type BarCell = { value: number; tone: Tone; text: string; note?: string; tip: string[]; small?: boolean; edge?: boolean }
export type BarRow = { label: string; muted?: boolean; cells: (BarCell | null)[] }
export type BarSpec = {
  panels: { title: string; ref?: number | null }[]
  rows: BarRow[]
  min: number
  max: number
  /** "pp" draws a zero line and signs the ticks; "%" a level scale with each panel's dashed reference. */
  unit: "pp" | "%"
  rowHeight?: number
  /** The room after each panel for its bars' printed figures, in percent of the width. */
  valueRoom?: number
}
export type FingerprintSpec = {
  rows: string[]
  columns: { band: string; label: string }[]
  bands: { name: string; hue: number }[]
  /** cells[row][column]: the cell's depth, 0 to 1, or null where nothing was read. */
  cells: (number | null)[][]
  /** Each column's readout, a line per row, the first line the column's own name. */
  readout: string[][]
}

const COLOR: Record<Tone, string> = { detect: "#2563eb", quiet: "#cbd5e1", campaign: "#1e3a8a", placebo: "#dbeafe" }
const INK = "#0f172a"
const MUTED = "#64748b"
const RULE = "#e2e8f0"
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!)
const lines = (xs: string[]) => xs.map((x, i) => (i === 0 ? `<b>${esc(x)}</b>` : esc(x))).join("<br/>")
const TIP = {
  appendTo: "body",
  backgroundColor: "#fff",
  borderColor: RULE,
  borderWidth: 1,
  padding: [8, 10],
  textStyle: { color: INK, fontSize: 12 },
  extraCssText: "box-shadow:0 4px 14px -4px rgb(15 23 42 / .12);border-radius:8px;font-size:12px;line-height:1.5;",
}
const signedTick = (v: number) => (v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : "0")

/** An ECharts canvas drawn when it nears the screen (or the page prints), resized with its block. */
function Canvas({ option, height, label }: { option: EChartsCoreOption | null; height: number; label: string }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const chart = React.useRef<EChartsType | null>(null)
  const seen = React.useRef(false)
  const latest = React.useRef(option)
  latest.current = option
  // Draws once the canvas has been near the screen and its option is ready, whichever comes last.
  const draw = React.useCallback(() => {
    const el = ref.current
    if (!el || !seen.current || !latest.current) return
    chart.current ??= init(el, undefined, { renderer: "canvas" })
    chart.current.setOption(latest.current, true)
  }, [])
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const near = new IntersectionObserver((xs) => {
      if (xs.some((x) => x.isIntersecting)) {
        seen.current = true
        draw()
        near.disconnect()
      }
    }, { rootMargin: "400px" })
    near.observe(el)
    const sized = new ResizeObserver(() => chart.current?.resize())
    sized.observe(el)
    const print = () => {
      seen.current = true
      draw()
    }
    window.addEventListener("beforeprint", print)
    return () => {
      near.disconnect()
      sized.disconnect()
      window.removeEventListener("beforeprint", print)
      chart.current?.dispose()
      chart.current = null
    }
  }, [draw])
  React.useEffect(() => draw(), [option, draw])
  return <div ref={ref} role="img" aria-label={label} style={{ height }} className="w-full" />
}

/** The width a chart's container has, read as it changes. */
function useWidth() {
  const ref = React.useRef<HTMLDivElement>(null)
  const [width, setWidth] = React.useState(0)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const read = () => setWidth(Math.round(el.getBoundingClientRect().width))
    read()
    const o = new ResizeObserver(read)
    o.observe(el)
    return () => o.disconnect()
  }, [])
  return [ref, width] as const
}

/** The panels' columns in pixels: the rows' names first, then equal panels, each followed by the room
 *  its printed figures need, so no label runs into the next panel. */
function layout(width: number, n: number, room: number) {
  const labelW = Math.round(Math.min(280, Math.max(150, width * 0.24)))
  const roomW = Math.round((width * room) / 100)
  const w = Math.max(60, (width - labelW - roomW * n) / n)
  return { labelW, w, leftOf: (i: number) => Math.round(labelW + i * (w + roomW)) }
}

/** Rows of bars across side-by-side panels on one scale. */
export function PanelBars({ spec, label }: { spec: BarSpec; label: string }) {
  const [box, width] = useWidth()
  const rowH = spec.rowHeight ?? 34
  const small = rowH < 30
  const top = 30
  const bottom = 26
  const height = top + bottom + spec.rows.length * rowH
  const { labelW, w, leftOf } = layout(width || 900, spec.panels.length, spec.valueRoom ?? 8)
  const option = React.useMemo<EChartsCoreOption | null>(() => {
    if (!width) return null
    // ECharts lays a category axis bottom up; the rows read top down.
    const rows = [...spec.rows].reverse()
    return {
      animation: false,
      textStyle: { fontFamily: "inherit" },
      grid: spec.panels.map((_, i) => ({ left: leftOf(i), width: w, top, bottom })),
      xAxis: spec.panels.map((_, i) => ({
        gridIndex: i,
        type: "value",
        min: spec.min,
        max: spec.max,
        splitNumber: 4,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "#f1f5f9" } },
        axisLabel: { color: MUTED, fontSize: 11, formatter: spec.unit === "pp" ? signedTick : (v: number) => `${v}%` },
      })),
      yAxis: spec.panels.map((_, i) => ({
        gridIndex: i,
        type: "category",
        data: rows.map((r) => r.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: i === 0 ? { color: INK, fontSize: small ? 12 : 13, width: labelW - 14, overflow: "truncate", margin: 12 } : { show: false },
      })),
      tooltip: { trigger: "item", ...TIP, formatter: (p: { data?: { tip?: string[] } }) => (p.data?.tip ? lines(p.data.tip) : "") },
      series: spec.panels.map((p, i) => ({
        type: "bar",
        xAxisIndex: i,
        yAxisIndex: i,
        barWidth: Math.min(18, Math.round(rowH * 0.55)),
        data: rows.map((r) => {
          const c = r.cells[i]
          if (!c) return { value: null }
          return {
            value: c.value,
            tip: c.tip,
            itemStyle: {
              color: COLOR[c.tone],
              borderRadius: 2,
              ...(c.edge ? { borderColor: "#1e3a8a", borderWidth: 1.5 } : {}),
              ...(c.small ? { decal: { symbol: "rect", dashArrayX: [1, 0], dashArrayY: [2, 3], rotation: -Math.PI / 4, color: "rgba(255,255,255,0.7)" } } : {}),
            },
            label: {
              show: true,
              position: c.value < 0 ? "left" : "right",
              formatter: c.note ? `{v|${c.text}}{n| · ${c.note}}` : `{v|${c.text}}`,
              rich: {
                v: { color: r.muted ? MUTED : INK, fontSize: 12, fontWeight: 600 },
                n: { color: /^detectable|· detectable/.test(c.note ?? "") ? COLOR.detect : MUTED, fontSize: 12 },
              },
            },
          }
        }),
        markLine:
          spec.unit === "pp"
            ? { silent: true, symbol: "none", label: { show: false }, lineStyle: { color: INK, width: 1, type: "solid", opacity: 0.55 }, data: [{ xAxis: 0 }] }
            : p.ref != null
              ? { silent: true, symbol: "none", label: { show: false }, lineStyle: { color: INK, width: 1, type: "dashed" }, data: [{ xAxis: p.ref }] }
              : undefined,
      })),
    }
  }, [spec, rowH, small, width, labelW, w, leftOf])
  return (
    <div ref={box} className="relative">
      <div className="pointer-events-none absolute inset-x-0 top-1 h-5">
        {spec.panels.map((p, i) => (
          <span key={`${p.title}-${i}`} className="absolute truncate text-[13px] font-semibold text-slate-900" style={{ left: leftOf(i), width: w }}>
            {p.title}
          </span>
        ))}
      </div>
      <Canvas option={option} height={height} label={label} />
    </div>
  )
}

/** The wave's fingerprint: a cell per subgroup per video, each band its own hue, the column read out under it. */
export function Fingerprint({ spec, label }: { spec: FingerprintSpec; label: string }) {
  const rowH = 28
  const bottom = 30
  const height = 6 + bottom + spec.rows.length * rowH
  const option = React.useMemo<EChartsCoreOption>(() => {
    const n = spec.rows.length
    const hue = new Map(spec.bands.map((b) => [b.name, b.hue]))
    // The names' column fits the longest name, within reason.
    const nameW = Math.round(Math.min(300, Math.max(140, Math.max(...spec.rows.map((r) => r.length)) * 6.6)))
    // Each band's name sits under its middle column, in the band's own hue.
    const middle = new Map<number, string>()
    let from = 0
    spec.columns.forEach((c, i) => {
      if (spec.columns[i + 1]?.band !== c.band) {
        middle.set(Math.floor((from + i) / 2), c.band)
        from = i + 1
      }
    })
    return {
      animation: false,
      textStyle: { fontFamily: "inherit" },
      grid: { left: nameW + 14, right: 8, top: 6, bottom },
      xAxis: [
        { type: "category", data: spec.columns.map((_, i) => String(i)), axisLabel: { show: false }, axisTick: { show: false }, axisLine: { show: false } },
        {
          type: "category",
          gridIndex: 0,
          position: "bottom",
          data: spec.columns.map((_, i) => middle.get(i) ?? ""),
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { interval: 0, fontSize: 10, fontWeight: 700, formatter: (v: string) => v.toUpperCase(), color: (v?: string) => `hsl(${hue.get(v ?? "") ?? 220} 60% 38%)` },
        },
      ],
      yAxis: [
        { type: "value", min: 0, max: n, show: false },
        { type: "category", position: "left", data: [...spec.rows].reverse(), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: INK, fontSize: 12, width: nameW, overflow: "truncate", margin: 10 } },
      ],
      tooltip: {
        // As pax2's heat bar: the axis with a column shadow, the readout pinned under the chart and
        // clamped to its width, so it never sits under the cursor.
        trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: "rgba(100,116,139,0.10)" } },
        transitionDuration: 0,
        ...TIP,
        position: (pt: number[], _p: unknown, _d: unknown, _r: unknown, size: { contentSize: number[]; viewSize: number[] }) => [
          Math.min(Math.max(pt[0] - size.contentSize[0] / 2, 4), size.viewSize[0] - size.contentSize[0] - 4),
          size.viewSize[1] - 2,
        ],
        formatter: (ps: { dataIndex: number }[] | { dataIndex: number }) => {
          const p = Array.isArray(ps) ? ps[0] : ps
          return p ? lines(spec.readout[p.dataIndex]) : ""
        },
      },
      // Rows stack bottom up, so the last series is the first row.
      series: spec.rows.map((_, s) => {
        const row = n - 1 - s
        return {
          type: "bar",
          stack: "fingerprint",
          barCategoryGap: "12%",
          emphasis: { disabled: true },
          data: spec.cells[row].map((v, ci) => ({
            value: 1,
            itemStyle: {
              color: v == null ? "#f1f5f9" : `hsl(${hue.get(spec.columns[ci].band) ?? 220} ${40 + v * 45}% ${90 - v * 48}%)`,
              borderRadius: 3,
              borderColor: "#fff",
              borderWidth: 2,
            },
          })),
        }
      }),
    }
  }, [spec])
  return <Canvas option={option} height={height} label={label} />
}

export type LinesSpec = {
  /** Every subgroup along the axis, the overall level first. */
  columns: { band: string; label: string }[]
  /** Each dimension's run of columns, for its shaded band. */
  bands: { name: string; from: number; to: number }[]
  /** The placebo first, then each video: its level in every column, and where it was significant. */
  series: { name: string; placebo?: boolean; values: (number | null)[]; marks: boolean[] }[]
}

const LINE_COLORS = ["#2563eb", "#dc2626", "#d97706", "#059669", "#7c3aed", "#0891b2", "#db2777", "#65a30d"]

/** A wave's every subgroup as lines, pax2's viometric line chart in shape and in hand. */
export function SubgroupLines({ spec, label }: { spec: LinesSpec; label: string }) {
  const height = 400
  const option = React.useMemo<EChartsCoreOption>(() => {
    const keys = spec.columns.map((_, i) => String(i))
    const videos = spec.series.filter((x) => !x.placebo)
    const colorOf = (name: string) => (spec.series.find((x) => x.name === name)?.placebo ? MUTED : LINE_COLORS[videos.findIndex((x) => x.name === name) % LINE_COLORS.length])
    // The scale hugs the levels, in tens, so the lines part where they differ.
    const all = spec.series.flatMap((x) => x.values).filter((v): v is number => v != null)
    const yMin = Math.max(0, Math.floor((Math.min(...all) - 4) / 10) * 10)
    const yMax = Math.min(100, Math.ceil((Math.max(...all) + 4) / 10) * 10)
    return {
      animation: false,
      textStyle: { fontFamily: "inherit" },
      grid: { left: 44, right: 16, top: 30, bottom: 92 },
      legend: { bottom: 0, icon: "roundRect", itemWidth: 14, itemHeight: 5, textStyle: { color: "#475569", fontSize: 11 } },
      dataZoom: [
        { type: "inside", xAxisIndex: 0 },
        { type: "slider", xAxisIndex: 0, height: 16, bottom: 30, borderColor: RULE, fillerColor: "rgba(37,99,235,0.08)", labelFormatter: (v: number) => spec.columns[v]?.label ?? "" },
      ],
      xAxis: {
        type: "category",
        data: keys,
        boundaryGap: false,
        axisLine: { lineStyle: { color: "#cbd5e1" } },
        axisTick: { show: false },
        axisLabel: { color: MUTED, fontSize: 10, hideOverlap: true, formatter: (v: string) => spec.columns[Number(v)]?.label ?? "" },
      },
      yAxis: { type: "value", min: yMin, max: yMax, axisLabel: { color: MUTED, fontSize: 11, formatter: (v: number) => `${v}%` }, splitLine: { lineStyle: { color: "#f1f5f9" } } },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "cross", label: { backgroundColor: "#334155", formatter: (p: { axisDimension: string; value: number | string }) => (p.axisDimension === "x" ? (spec.columns[Number(p.value)]?.label ?? "") : `${Math.round(Number(p.value))}%`) } },
        ...TIP,
        formatter: (ps: { dataIndex: number; seriesName: string; value: number | null; color: string }[]) => {
          const i = ps[0]?.dataIndex ?? 0
          const col = spec.columns[i]
          const rows = spec.series
            .map((x) => {
              const v = x.values[i]
              if (v == null) return null
              return `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:6px;background:${colorOf(x.name)}"></span>${esc(x.name)}: <b>${v}%</b>${x.marks[i] ? " · significant" : ""}`
            })
            .filter(Boolean)
          return `<b>${esc(col ? `${col.band} · ${col.label}` : "")}</b><br/>${rows.join("<br/>")}`
        },
      },
      series: [
        ...spec.series.map((x, k) => ({
          name: x.name,
          type: "line",
          data: x.values,
          connectNulls: false,
          showSymbol: true,
          symbol: "circle",
          symbolSize: 4,
          lineStyle: { color: colorOf(x.name), width: x.placebo ? 1.5 : 1.75, type: x.placebo ? "dashed" : "solid" },
          itemStyle: { color: colorOf(x.name) },
          z: x.placebo ? 2 : 3,
          // The dimensions' bands, shaded in turn under every line, each named at its top.
          ...(k === 0
            ? {
                markArea: {
                  silent: true,
                  label: { show: true, position: "insideTop", color: "#64748b", fontSize: 10, fontWeight: 700, formatter: (p: { name: string }) => p.name.toUpperCase() },
                  // A band of one column (the overall level) is too narrow to name.
                  data: spec.bands.filter((b) => b.to > b.from).map((b, i) => [
                    { xAxis: String(b.from), name: b.name, itemStyle: { color: i % 2 ? "rgba(241,245,249,0.9)" : "rgba(255,255,255,0)" } },
                    { xAxis: String(b.to) },
                  ]),
                },
              }
            : {}),
        })),
        // A mark above the line wherever the video beat the placebo inside that subgroup.
        ...videos.map((x) => ({
          name: x.name,
          type: "scatter",
          data: x.values.map((v, i) => (v != null && x.marks[i] ? [String(i), v] : null)).filter(Boolean),
          symbol: "diamond",
          symbolSize: 9,
          itemStyle: { color: colorOf(x.name), borderColor: "#fff", borderWidth: 1 },
          tooltip: { show: false },
          z: 4,
        })),
      ],
    }
  }, [spec])
  return <Canvas option={option} height={height} label={label} />
}
