import * as React from "react"
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion"

import { CLAMP, draw, enter, pale, signed } from "../../motion"
import { COLOR, FONT, LAYOUT, LIFT, MOTION, TYPE, sec } from "../../theme"
import { LANES, type LiftLeaderboardProps } from "./schema"

// Treatments ranked on one outcome. The heading lands, then the rows slide in
// best first, half a second apart, each bar growing from a shared zero to its
// lift on one scale, right in blue or left in red, grey where the lift did not
// clear its test. The row the user asked about wears a ring. Eight lanes stand
// from the start, so fewer rows leave the rest empty. The caption types on last.

const ROWS_AT = 0.6 // seconds
const ROW_GAP = 0.5 // seconds
const TITLE_COL = 520
const VALUE_COL = 170

export function LiftLeaderboardComposition({ metric, segment, rows, highlightIndex, caption }: LiftLeaderboardProps) {
  const frame = useCurrentFrame()
  const { fps, width, height, durationInFrames } = useVideoConfig()
  const head = enter(frame, fps)

  const ranked = rows.map((r, i) => ({ ...r, i })).sort((a, b) => b.lift - a.lift)
  const posMax = Math.max(0, ...rows.map((r) => r.lift))
  const negMax = Math.max(0, ...rows.map((r) => -r.lift))
  const span = posMax + negMax || 1
  const area = width - LAYOUT.safe * 2 - TITLE_COL - VALUE_COL
  const px = area / span
  const zero = negMax * px

  const headH = 150
  const captionH = caption ? 90 : 0
  const laneH = (height - LAYOUT.safe * 2 - headH - captionH) / LANES

  const typedFrom = sec(ROWS_AT + ROW_GAP * (rows.length - 1) + MOTION.draw, fps)
  const chars = caption ? Math.round(interpolate(frame, [typedFrom, durationInFrames - sec(0.5, fps)], [0, caption.length], CLAMP)) : 0

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.mist, fontFamily: FONT.family, color: COLOR.ink, padding: LAYOUT.safe }}>
      <div style={{ height: headH, opacity: head, transform: `translateY(${(1 - head) * 24}px)` }}>
        <div style={{ fontSize: TYPE.title, fontWeight: 700, letterSpacing: -0.5 }}>{metric} lift</div>
        <div style={{ marginTop: 8, fontSize: TYPE.label, color: COLOR.muted }}>{segment} · points over the placebo</div>
      </div>

      <div style={{ position: "relative", height: laneH * LANES }}>
        {/* The shared zero, from the first lane to the last. */}
        <div style={{ position: "absolute", top: 0, bottom: 0, left: TITLE_COL + zero, width: 2, backgroundColor: COLOR.faint, opacity: head }} />
        {Array.from({ length: LANES }, (_, k) => {
          const r = ranked[k]
          if (!r) return <div key={k} style={{ position: "absolute", top: k * laneH + laneH * 0.2, left: 0, right: 0, height: laneH * 0.6, borderRadius: 16, border: `2px dashed ${COLOR.rule}` }} />
          const at = sec(ROWS_AT + ROW_GAP * k, fps)
          const shown = enter(frame, fps, at)
          const grow = draw(frame, fps, at + sec(0.15, fps))
          const up = r.lift >= 0
          const color = !r.significant ? LIFT.quiet : up ? LIFT.positive : LIFT.negative
          const w = Math.abs(r.lift) * px * grow
          const ringed = highlightIndex === r.i
          return (
            <div
              key={k}
              style={{
                position: "absolute",
                top: k * laneH + laneH * 0.1,
                left: 0,
                right: 0,
                height: laneH * 0.8,
                display: "flex",
                alignItems: "center",
                borderRadius: 18,
                backgroundColor: ringed ? COLOR.white : "transparent",
                boxShadow: ringed ? `0 0 0 4px ${COLOR.lightBlue}` : undefined,
                opacity: shown,
                transform: `translateX(${(1 - shown) * 80}px)`,
              }}
            >
              <div style={{ width: TITLE_COL, paddingLeft: 24, paddingRight: 24, boxSizing: "border-box", fontSize: TYPE.body, fontWeight: ringed ? 700 : 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
              <div style={{ position: "relative", width: area, height: "100%" }}>
                <div
                  style={{
                    position: "absolute",
                    top: "22%",
                    bottom: "22%",
                    left: up ? zero : zero - w,
                    width: w,
                    borderRadius: 10,
                    background: `linear-gradient(to ${up ? "right" : "left"}, ${pale(color, LIFT.fadeFrom)}, ${color})`,
                  }}
                />
              </div>
              <div style={{ width: VALUE_COL, textAlign: "right", paddingRight: 24, boxSizing: "border-box", fontSize: TYPE.body, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: r.significant ? (up ? COLOR.ink : LIFT.negative) : COLOR.faint, opacity: grow }}>
                {signed(r.lift * grow)}
              </div>
            </div>
          )
        })}
      </div>

      {caption && (
        <div style={{ height: captionH, display: "flex", alignItems: "flex-end", fontSize: TYPE.label, color: COLOR.secondary }}>
          {caption.slice(0, chars)}
          {chars > 0 && chars < caption.length && <span style={{ marginLeft: 2, color: COLOR.lightBlue }}>▍</span>}
        </div>
      )}
    </AbsoluteFill>
  )
}
