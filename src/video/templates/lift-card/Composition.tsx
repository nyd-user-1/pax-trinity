import * as React from "react"
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from "remotion"

import { draw, enter, fade, pale, signed } from "../../motion"
import { COLOR, FONT, LAYOUT, LIFT, MOTION, TYPE, sec } from "../../theme"
import type { LiftCardProps } from "./schema"

// One treatment's result, as the Lift table reads it. The title (and its
// thumbnail) lands first; then each outcome in turn: the placebo's level draws
// left to right on a 0–100 track, and the lift springs out from its end, right
// in blue when it rose, left in red over the placebo's bar when it fell. A lift
// that did not clear its test is hollow and at half strength. The trial's
// badge fades in last; the partner's handle holds the foot.

type Metric = LiftCardProps["metrics"][number]

const ROWS_AT = 1 // seconds

export function LiftCardComposition({ treatment, segment, metrics, rct, n }: LiftCardProps) {
  const frame = useCurrentFrame()
  const { fps, width } = useVideoConfig()
  const head = enter(frame, fps)
  const track = width - LAYOUT.safe * 2
  const rowAt = (i: number) => sec(ROWS_AT + MOTION.stagger * i, fps)
  const badgeAt = rowAt(metrics.length - 1) + sec(MOTION.draw * 2, fps)
  const badge = fade(frame, fps, badgeAt)

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.mist, fontFamily: FONT.family, color: COLOR.ink, padding: LAYOUT.safe, display: "flex", flexDirection: "column" }}>
      <div style={{ opacity: head, transform: `translateY(${(1 - head) * 32}px)` }}>
        {treatment.thumbnailUrl && (
          <Img src={treatment.thumbnailUrl} style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", borderRadius: LAYOUT.radius, marginBottom: 56 }} />
        )}
        <div style={{ display: "inline-block", padding: "10px 22px", borderRadius: 999, backgroundColor: COLOR.lavender, color: COLOR.blue, fontSize: TYPE.label, fontWeight: 600 }}>{segment}</div>
        <div style={{ marginTop: 28, fontSize: TYPE.hero, fontWeight: 700, lineHeight: 1.05, letterSpacing: -1 }}>{treatment.title}</div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 88 }}>
        {metrics.map((m, i) => (
          <MetricRow key={m.name} m={m} at={rowAt(i)} track={track} />
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: LAYOUT.gap }}>
        <span style={{ fontSize: TYPE.label, fontWeight: 600, color: COLOR.secondary, opacity: head }}>{treatment.partner ?? ""}</span>
        {rct && (
          <span style={{ opacity: badge, padding: "12px 24px", borderRadius: 999, backgroundColor: COLOR.white, boxShadow: "0 1px 2px rgb(15 23 42 / 0.06)", fontSize: TYPE.caption, fontWeight: 600, color: COLOR.blue }}>
            Randomized controlled trial{n ? ` · n ${n.toLocaleString("en-US")}` : ""}
          </span>
        )}
      </div>
    </AbsoluteFill>
  )
}

function MetricRow({ m, at, track }: { m: Metric; at: number; track: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const shown = enter(frame, fps, at)
  const placebo = draw(frame, fps, at)
  const grow = enter(frame, fps, at + sec(MOTION.draw, fps))

  const px = track / 100
  const controlW = m.control * px * placebo
  const liftPx = m.lift * px * grow
  const up = m.lift >= 0
  const color = up ? LIFT.positive : LIFT.negative
  const left = up ? controlW : controlW + liftPx
  const bar: React.CSSProperties = m.significant
    ? { background: `linear-gradient(to ${up ? "right" : "left"}, ${pale(color, LIFT.fadeFrom)}, ${color})` }
    : { border: `4px solid ${color}`, opacity: 0.5 }

  return (
    <div style={{ opacity: shown, transform: `translateY(${(1 - shown) * 24}px)` }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <span style={{ fontSize: TYPE.heading, fontWeight: 600 }}>{m.name}</span>
        <span style={{ fontSize: TYPE.title, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: m.significant ? color : COLOR.faint, opacity: grow }}>
          {signed(m.lift * grow)}
          <span style={{ fontSize: TYPE.label, fontWeight: 500 }}> pts</span>
        </span>
      </div>
      <div style={{ position: "relative", height: 56, marginTop: 24 }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 14, backgroundColor: COLOR.rule }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: controlW, borderRadius: 14, backgroundColor: "#cbd5e1" }} />
        <div style={{ position: "absolute", top: -10, bottom: -10, left, width: Math.abs(liftPx), borderRadius: 12, boxSizing: "border-box", ...bar }} />
      </div>
      <div style={{ marginTop: 18, fontSize: TYPE.caption, color: COLOR.muted, fontVariantNumeric: "tabular-nums", opacity: grow }}>
        Placebo {m.control.toFixed(1)}% → {(m.control + m.lift).toFixed(1)}%{m.significant ? "" : " · inside its margin"}
      </div>
    </div>
  )
}
