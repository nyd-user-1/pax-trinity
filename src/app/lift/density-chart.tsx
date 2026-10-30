"use client"

import * as React from "react"
import { init, use, type ComposeOption, type EChartsType } from "echarts/core"
import { LineChart, ScatterChart, type LineSeriesOption, type ScatterSeriesOption } from "echarts/charts"
import { GridComponent, type GridComponentOption } from "echarts/components"
import { CanvasRenderer } from "echarts/renderers"

import { reducedMotion } from "@/components/reveal"

import { num } from "../america-thinks/audience-data"
import { signed } from "./lift-data"

// A benchmark's lifts as a smoothed distribution, drawn by ECharts from its
// core with the pieces it uses (as America Thinks' question chart does): the
// density as a gray area, the baseline colored by quintile and ticked at the
// four cuts, the result marked on it with its margin. The density is computed
// here (a Gaussian kernel at Silverman's bandwidth) and handed over as points.
// About Result loads this file only when a benchmark card opens. Each draw animates (Brendan,
// 2026-10-29): the density rises, then the result's marker lands on it.

use([LineChart, ScatterChart, GridComponent, CanvasRenderer])

type Option = ComposeOption<LineSeriesOption | ScatterSeriesOption | GridComponentOption>

const QUINTILE_HEX = ["#ef4444", "#fb923c", "#facc15", "#22c55e", "#15803d"]
const INK = "#0f172a"
const MUTED = "#52514e"
const HEIGHT = 92

function shapeOf(values: number[], x: number, moe: number | null) {
  const s = [...values].sort((a, b) => a - b)
  const at = (p: number) => {
    const i = p * (s.length - 1)
    const lo = Math.floor(i)
    return s[lo] + (s[Math.min(lo + 1, s.length - 1)] - s[lo]) * (i - lo)
  }
  const mean = s.reduce((a, b) => a + b, 0) / s.length
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length)
  const lo = Math.min(s[0], x - (moe ?? 0))
  const hi = Math.max(s[s.length - 1], x + (moe ?? 0))
  const pad = (hi - lo || 1) * 0.06
  const min = lo - pad
  const max = hi + pad
  const bw = sd > 0 ? 1.06 * sd * s.length ** -0.2 : (max - min) / 12
  const N = 72
  const curve = Array.from({ length: N + 1 }, (_, i) => {
    const v = min + ((max - min) * i) / N
    let d = 0
    for (const t of s) d += Math.exp(-0.5 * ((v - t) / bw) ** 2)
    return [v, d] as [number, number]
  })
  const top = Math.max(...curve.map((p) => p[1])) || 1
  return { curve: curve.map(([v, d]) => [v, d / top] as [number, number]), cuts: [0.2, 0.4, 0.6, 0.8].map(at), min, max }
}

export function DensityChart({ values, x, moe }: { values: number[]; x: number; moe: number | null }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const chart = React.useRef<EChartsType | null>(null)

  const option = React.useMemo<Option>(() => {
    const { curve, cuts, min, max } = shapeOf(values, x, moe)
    // A cut's label stands only where it clears the last one drawn; a small pool's cuts crowd.
    const labeled: number[] = []
    for (const c of cuts) if (!labeled.length || (c - labeled[labeled.length - 1]) / (max - min) >= 0.09) labeled.push(c)
    const edges = [min, ...cuts, max]
    const line = (data: [number, number][], color: string, width: number, z = 2): LineSeriesOption => ({ type: "line", data, symbol: "none", silent: true, z, lineStyle: { color, width }, animationDuration: 500 })
    return {
      animation: !reducedMotion(),
      animationDuration: 700,
      animationEasing: "cubicOut",
      grid: { left: 6, right: 6, top: 22, bottom: 20 },
      xAxis: {
        type: "value",
        min,
        max,
        axisLine: { show: false },
        splitLine: { show: false },
        axisTick: { show: true, customValues: cuts, length: 4, lineStyle: { color: MUTED } },
        axisLabel: { customValues: labeled, formatter: (v: number) => num(v), fontSize: 10, color: MUTED, margin: 6 },
      },
      yAxis: { type: "value", min: 0, max: 1.3, show: false },
      series: [
        { type: "line", data: curve, smooth: true, symbol: "none", silent: true, lineStyle: { width: 0 }, areaStyle: { color: "#e7e6e2", opacity: 1 }, z: 1, animationDuration: 800 },
        ...edges.slice(0, -1).map((e, i) => line([[e, 0], [edges[i + 1], 0]], QUINTILE_HEX[i], 2.5)),
        ...(moe != null ? [line([[x - moe, 0.09], [x + moe, 0.09]], INK, 1.5, 3)] : []),
        { type: "scatter", data: [[x, 0.15]], symbol: "triangle", symbolRotate: 180, symbolSize: 10, itemStyle: { color: INK }, silent: true, z: 4, animationDelay: 550, animationDuration: 350 },
        {
          type: "scatter",
          data: [[x, 1.3]],
          symbolSize: 0,
          silent: true,
          z: 4,
          animationDelay: 550,
          animationDuration: 350,
          label: {
            show: true,
            position: "top",
            distance: 2,
            formatter: () => (moe != null ? `{v|${signed(x)}} {m|±${num(moe)}}` : `{v|${signed(x)}}`),
            rich: { v: { fontSize: 12, fontWeight: 600, color: "#0b0b0b" }, m: { fontSize: 10, color: MUTED } },
          },
        },
      ],
    }
  }, [values, x, moe])

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const c = init(el, undefined, { renderer: "canvas" })
    chart.current = c
    // Only a real change of size: the observer's first call, at once, would cut the entrance animation short.
    const ro = new ResizeObserver(() => (el.clientWidth !== c.getWidth() || el.clientHeight !== c.getHeight()) && c.resize())
    ro.observe(el)
    return () => {
      ro.disconnect()
      c.dispose()
      chart.current = null
    }
  }, [])

  React.useEffect(() => {
    const el = ref.current
    if (!chart.current || !el) return
    chart.current.setOption({ ...option, textStyle: { fontFamily: getComputedStyle(el).fontFamily } }, { notMerge: true })
  }, [option])

  return <div ref={ref} role="img" aria-label={`The result, ${signed(x)}, among the benchmark's lifts`} style={{ height: HEIGHT }} className="w-full" />
}
