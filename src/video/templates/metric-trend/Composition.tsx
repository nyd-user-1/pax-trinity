import * as React from "react"
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion"

import { CLAMP, enter } from "../../motion"
import { BANDS, COLOR, FONT, LAYOUT, TYPE, sec } from "../../theme"
import type { MetricTrendProps } from "./schema"

// A metric across waves. The title lands; then every line draws left to right
// together, a dot leading each, on a scale that hugs the data. When the reveal
// passes the annotated point, its callout springs in above it. Each line's last
// value is labeled at its end once the reveal finishes.

const REVEAL = [0.6, 6] as const // seconds
const TOP = 230
const BOTTOM = 150
const LEFT = 150
const RIGHT = 220

export function MetricTrendComposition({ title, series, unit = "", annotation }: MetricTrendProps) {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()
  const head = enter(frame, fps)

  const n = Math.max(...series.map((s) => s.points.length))
  const labels = (series.find((s) => s.points.length === n) ?? series[0]).points.map((p) => p.label)
  const values = series.flatMap((s) => s.points.map((p) => p.value))
  const lo = Math.floor(Math.min(...values) / 10) * 10
  const hi = Math.ceil(Math.max(...values) / 10) * 10 || lo + 10
  const plotW = width - LEFT - RIGHT
  const plotH = height - TOP - BOTTOM
  const x = (i: number) => LEFT + (n === 1 ? 0 : (i / (n - 1)) * plotW)
  const y = (v: number) => TOP + plotH - ((v - lo) / (hi - lo)) * plotH

  // The reveal's head, as a fractional point index.
  const at = interpolate(frame, [sec(REVEAL[0], fps), sec(REVEAL[1], fps)], [0, n - 1], { ...CLAMP, easing: Easing.inOut(Easing.cubic) })
  const done = at >= n - 1
  const step = Math.max(1, Math.ceil(n / 9))
  const ticks = Array.from({ length: (hi - lo) / 10 + 1 }, (_, i) => lo + i * 10).filter((_, i, all) => all.length <= 7 || i % 2 === 0)
  const callout = annotation ? enter(frame, fps, Math.ceil(interpolate(annotation.atIndex, [0, n - 1], [sec(REVEAL[0], fps), sec(REVEAL[1], fps)]))) : 0

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.mist, fontFamily: FONT.family, color: COLOR.ink }}>
      <div style={{ position: "absolute", left: LAYOUT.safe, right: LAYOUT.safe, top: LAYOUT.safe, display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: LAYOUT.gap, opacity: head, transform: `translateY(${(1 - head) * 24}px)` }}>
        <div style={{ fontSize: TYPE.heading, fontWeight: 700, letterSpacing: -0.5 }}>{title}</div>
        {series.length > 1 && (
          <div style={{ display: "flex", gap: 28 }}>
            {series.map((s, i) => (
              <span key={s.name} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: TYPE.caption, color: COLOR.secondary }}>
                <span style={{ width: 28, height: 6, borderRadius: 3, backgroundColor: BANDS[i] }} />
                {s.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        {ticks.map((t) => (
          <g key={t} opacity={head}>
            <line x1={LEFT} x2={LEFT + plotW} y1={y(t)} y2={y(t)} stroke={COLOR.rule} strokeWidth={t === lo ? 2 : 1} />
            <text x={LEFT - 20} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={TYPE.small} fill={COLOR.faint} fontFamily={FONT.family}>
              {t}
              {unit}
            </text>
          </g>
        ))}
        {labels.map((l, i) =>
          i % step === 0 || i === n - 1 ? (
            <text key={l + i} x={x(i)} y={TOP + plotH + 44} textAnchor="middle" fontSize={TYPE.small} fill={i <= at ? COLOR.muted : COLOR.rule} fontFamily={FONT.family}>
              {l}
            </text>
          ) : null,
        )}

        {series.map((s, si) => {
          const last = s.points.length - 1
          const upto = Math.min(at, last)
          const whole = Math.floor(upto)
          const pts = s.points.slice(0, whole + 1).map((p, i) => [x(i), y(p.value)] as const)
          if (whole < last && upto > whole) {
            const a = s.points[whole].value
            const b = s.points[whole + 1].value
            pts.push([x(upto), y(a + (b - a) * (upto - whole))])
          }
          const tip = pts[pts.length - 1]
          const color = BANDS[si]
          return (
            <g key={s.name}>
              <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={tip[0]} cy={tip[1]} r={12} fill={color} stroke={COLOR.white} strokeWidth={4} opacity={head} />
              {done && (
                <text x={tip[0] + 24} y={tip[1]} dominantBaseline="middle" fontSize={TYPE.label} fontWeight={700} fill={color} fontFamily={FONT.family}>
                  {s.points[last].value.toFixed(1)}
                  {unit}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {annotation && callout > 0 && (
        <Callout
          x={x(annotation.atIndex)}
          y={y((series[0].points[annotation.atIndex] ?? series[0].points[series[0].points.length - 1]).value)}
          text={annotation.text}
          t={callout}
          right={x(annotation.atIndex) > width / 2}
          below={y((series[0].points[annotation.atIndex] ?? series[0].points[series[0].points.length - 1]).value) < TOP + 160}
        />
      )}
    </AbsoluteFill>
  )
}

/** Above its point, or below it where the point sits near the top. */
function Callout({ x, y, text, t, right, below }: { x: number; y: number; text: string; t: number; right: boolean; below: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        left: x + (right ? -24 : 24),
        top: below ? y + 48 : y - 130,
        transform: `translateX(${right ? "-100%" : "0"}) scale(${0.85 + 0.15 * t})`,
        transformOrigin: `${below ? "top" : "bottom"} ${right ? "right" : "left"}`,
        opacity: t,
      }}
    >
      <div style={{ padding: "16px 24px", borderRadius: 18, backgroundColor: COLOR.white, boxShadow: "0 8px 24px rgb(15 23 42 / 0.10)", fontSize: TYPE.label, fontWeight: 600, color: COLOR.blue, whiteSpace: "nowrap" }}>{text}</div>
    </div>
  )
}
