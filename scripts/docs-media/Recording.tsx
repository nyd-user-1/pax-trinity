import * as React from "react"
import { AbsoluteFill, interpolate, OffthreadVideo, Series, staticFile, useCurrentFrame, useVideoConfig } from "remotion"
import { loadFont } from "@remotion/google-fonts/Inter"

import { FPS, H, OUTRO, TITLE, W } from "./Guide"

// /docs' screen recordings (Brendan, 2026-10-31): a real session recorded by Playwright, cut into segments, each
// played at its own speed (the waits run faster) under its caption, in the guides' window and title card.

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] })

export type Segment = { from: number; to: number; rate: number; caption: string }
export type RecordingProps = { title: string; subtitle?: string; src: string; segments: Segment[] }

export const frames = (s: Segment) => Math.round(((s.to - s.from) * FPS) / s.rate)

const WIN_W = 1376
const WIN_H = (WIN_W * 900) / 1440
const WIN_X = (W - WIN_W) / 2
const WIN_Y = 34

function Caption({ n, of, text }: { n: number; of: number; text: string }) {
  const f = useCurrentFrame()
  const on = interpolate(f, [4, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: WIN_Y + WIN_H + 22, display: "flex", justifyContent: "center", opacity: on, transform: `translateY(${(1 - on) * 10}px)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, maxWidth: 1240, padding: "14px 26px 14px 16px", borderRadius: 999, background: "#fff", boxShadow: "0 10px 30px -12px rgba(15,23,42,.3)", border: "1px solid #e2e8f0" }}>
        <span style={{ flexShrink: 0, minWidth: 54, height: 34, padding: "0 10px", borderRadius: 999, background: "#1e3a8a", color: "#fff", fontSize: 18, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {n}/{of}
        </span>
        <span style={{ fontSize: 27, fontWeight: 500, color: "#0f172a", letterSpacing: "-0.01em" }}>{text}</span>
      </div>
    </div>
  )
}

export function Recording({ title, subtitle, src, segments }: RecordingProps) {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const titleOut = interpolate(frame, [TITLE - 12, TITLE], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  const end = interpolate(frame, [durationInFrames - OUTRO, durationInFrames - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  return (
    <AbsoluteFill style={{ fontFamily, background: "linear-gradient(160deg, #f5f7fb 0%, #e3e9f1 100%)" }}>
      <AbsoluteFill style={{ opacity: end }}>
        <Series>
          <Series.Sequence durationInFrames={TITLE}>
            <span />
          </Series.Sequence>
          {segments.map((s, i) => (
            <Series.Sequence key={i} durationInFrames={frames(s)}>
              <div style={{ position: "absolute", left: WIN_X, top: WIN_Y, width: WIN_W, height: WIN_H, borderRadius: 18, overflow: "hidden", background: "#fff", border: "1px solid #dce3ec", boxShadow: "0 30px 70px -24px rgba(15,23,42,.35), 0 8px 18px -10px rgba(15,23,42,.2)" }}>
                <OffthreadVideo src={staticFile(src)} startFrom={Math.round(s.from * FPS)} endAt={Math.round(s.to * FPS)} playbackRate={s.rate} muted style={{ width: WIN_W, height: WIN_H }} />
              </div>
              <Caption n={i + 1} of={segments.length} text={s.caption} />
            </Series.Sequence>
          ))}
          <Series.Sequence durationInFrames={OUTRO}>
            <span />
          </Series.Sequence>
        </Series>
      </AbsoluteFill>
      {titleOut > 0 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: titleOut }}>
          <div style={{ textAlign: "center", transform: `translateY(${interpolate(frame, [0, 18], [16, 0], { extrapolateRight: "clamp" })}px)`, opacity: interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" }) }}>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "0.18em", color: "#1e3a8a" }}>PAX</div>
            <div style={{ marginTop: 18, fontSize: 68, fontWeight: 700, letterSpacing: "-0.02em", color: "#0f172a" }}>{title}</div>
            {subtitle && <div style={{ marginTop: 14, fontSize: 30, color: "#475569" }}>{subtitle}</div>}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}
