import * as React from "react"
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"

import { COLOR, FONT, LAYOUT, LIFT, MOTION, SPRING, TYPE, sec } from "../../theme"
import type { ExampleProps } from "./schema"

// The pattern, small: every pixel is a function of the frame and the props.
// No Math.random, no Date.now, no fetch: the same props give the same video.
// The title springs in, the bar draws to the value as its figure counts up,
// and the caption fades in last.

export function ExampleComposition({ title, value, unit, caption }: ExampleProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const enter = spring({ frame, fps, config: SPRING })
  const drawStart = sec(MOTION.stagger, fps)
  const drawn = spring({ frame: frame - drawStart, fps, config: SPRING, durationInFrames: sec(MOTION.draw, fps) })
  const shown = value * drawn
  const captionIn = interpolate(frame, [drawStart + sec(MOTION.draw, fps), drawStart + sec(MOTION.draw + MOTION.fade, fps)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  })

  return (
    <AbsoluteFill style={{ backgroundColor: COLOR.mist, fontFamily: FONT.family, color: COLOR.ink, padding: LAYOUT.safe, justifyContent: "center" }}>
      <div style={{ fontSize: TYPE.title, fontWeight: 600, opacity: enter, transform: `translateY(${(1 - enter) * 24}px)` }}>{title}</div>
      <div style={{ marginTop: LAYOUT.gap * 2, display: "flex", alignItems: "center", gap: LAYOUT.gap }}>
        <div style={{ position: "relative", flex: 1, height: 40, borderRadius: 20, backgroundColor: COLOR.rule, overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              width: `${shown}%`,
              borderRadius: 20,
              background: `linear-gradient(to right, color-mix(in srgb, ${LIFT.positive} ${LIFT.fadeFrom * 100}%, white), ${LIFT.positive})`,
            }}
          />
        </div>
        <div style={{ width: 220, textAlign: "right", fontSize: TYPE.heading, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {shown.toFixed(1)}
          {unit}
        </div>
      </div>
      {caption && <div style={{ marginTop: LAYOUT.gap * 1.5, fontSize: TYPE.body, color: COLOR.muted, opacity: captionIn }}>{caption}</div>}
    </AbsoluteFill>
  )
}
