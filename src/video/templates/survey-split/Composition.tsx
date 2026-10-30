import * as React from "react"
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion"

import { draw, enter, fade } from "../../motion"
import { BANDS, COLOR, FONT, LAYOUT, MOTION, TYPE, sec } from "../../theme"
import type { SurveySplitProps } from "./schema"

// One question, its answers by group. The question and the answers' key land
// first; then each group rises in turn, its bars together, and once a bar
// lands its margin-of-error whisker draws over it. The whiskers are not
// optional: for a survey that is the honest default. Each group's n sits
// under its name; the source and wave hold the foot.

const GROUPS_AT = 1 // seconds
const TOP = 300
const FOOT = 170

export function SurveySplitComposition({ question, wave, source, bands, segments }: SurveySplitProps) {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()
  const head = enter(frame, fps)

  const plotW = width - LAYOUT.safe * 2
  const plotH = height - TOP - FOOT
  const top = Math.max(...segments.flatMap((s) => s.estimates.map((e) => e.est + e.moe)))
  const yMax = Math.min(100, Math.ceil(top / 10) * 10)
  const y = (v: number) => (v / yMax) * plotH
  const groupW = plotW / segments.length
  const barW = Math.min(96, (groupW - 64) / bands.length - 12)
  const ticks = Array.from({ length: yMax / 10 + 1 }, (_, i) => i * 10).filter((t) => t % (yMax > 50 ? 20 : 10) === 0)

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.mist, fontFamily: FONT.family, color: COLOR.ink }}>
      <div style={{ position: "absolute", left: LAYOUT.safe, right: LAYOUT.safe, top: LAYOUT.safe, opacity: head, transform: `translateY(${(1 - head) * 24}px)` }}>
        <div style={{ fontSize: TYPE.body + 4, fontWeight: 600, lineHeight: 1.3, maxWidth: 1600 }}>{question}</div>
        <div style={{ marginTop: 22, display: "flex", gap: 36 }}>
          {bands.map((b, i) => (
            <span key={b} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: TYPE.caption, color: COLOR.secondary }}>
              <span style={{ width: 22, height: 22, borderRadius: 6, backgroundColor: BANDS[i] }} />
              {b}
            </span>
          ))}
        </div>
      </div>

      <div style={{ position: "absolute", left: LAYOUT.safe, top: TOP, width: plotW, height: plotH }}>
        {ticks.map((t) => (
          <div key={t} style={{ position: "absolute", left: 0, right: 0, bottom: y(t), borderTop: `${t === 0 ? 2 : 1}px solid ${t === 0 ? COLOR.faint : COLOR.rule}`, opacity: head }}>
            <span style={{ position: "absolute", left: -8, transform: "translate(-100%, -50%)", fontSize: TYPE.small, color: COLOR.faint, fontVariantNumeric: "tabular-nums" }}>{t}</span>
          </div>
        ))}

        {segments.map((s, g) => {
          const at = sec(GROUPS_AT + MOTION.stagger * g, fps)
          const shown = enter(frame, fps, at)
          const rise = draw(frame, fps, at)
          const whiskers = draw(frame, fps, at + sec(MOTION.draw, fps), 0.5)
          const x0 = g * groupW + (groupW - (barW + 12) * bands.length + 12) / 2
          return (
            <React.Fragment key={s.label}>
              {s.estimates.map((e, b) => {
                const x = x0 + b * (barW + 12)
                const h = y(e.est) * rise
                return (
                  <React.Fragment key={b}>
                    <div style={{ position: "absolute", left: x, bottom: 0, width: barW, height: h, borderRadius: "10px 10px 0 0", backgroundColor: BANDS[b], opacity: shown }} />
                    {/* The whisker: est ± moe, drawn outward from the bar's top once it lands. */}
                    <div style={{ position: "absolute", left: x + barW / 2 - 1.5, bottom: y(e.est - e.moe * whiskers), width: 3, height: y(2 * e.moe * whiskers), backgroundColor: COLOR.ink, opacity: whiskers }} />
                    {[e.est - e.moe, e.est + e.moe].map((v, k) => (
                      <div key={k} style={{ position: "absolute", left: x + barW / 2 - 14, bottom: y(e.est + (v - e.est) * whiskers) - 1.5, width: 28, height: 3, backgroundColor: COLOR.ink, opacity: whiskers }} />
                    ))}
                    <div style={{ position: "absolute", left: x - 20, width: barW + 40, bottom: y(e.est + e.moe) + 10, textAlign: "center", fontSize: TYPE.small, fontWeight: 700, fontVariantNumeric: "tabular-nums", opacity: whiskers }}>{e.est.toFixed(1)}</div>
                  </React.Fragment>
                )
              })}
              <div style={{ position: "absolute", left: g * groupW, width: groupW, top: plotH + 22, textAlign: "center", opacity: shown }}>
                <div style={{ fontSize: TYPE.label, fontWeight: 600 }}>{s.label}</div>
                <div style={{ marginTop: 4, fontSize: TYPE.small, color: COLOR.muted, fontVariantNumeric: "tabular-nums" }}>n={s.n.toLocaleString("en-US")}</div>
              </div>
            </React.Fragment>
          )
        })}
      </div>

      <div style={{ position: "absolute", right: LAYOUT.safe, bottom: 28, fontSize: TYPE.small, color: COLOR.muted, opacity: fade(frame, fps, sec(GROUPS_AT, fps)) }}>
        {source} · {wave} · ± margin of error
      </div>
    </AbsoluteFill>
  )
}
