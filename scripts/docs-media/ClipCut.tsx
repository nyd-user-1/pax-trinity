import * as React from "react"
import { AbsoluteFill, Easing, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion"
import { loadFont } from "@remotion/google-fonts/Inter"

// An edited cut of a live clip (Brendan, 2026-10-31: "edit one of the live videos on Clips"): the clip, with its
// sound, under a lower third naming the messenger and the test, then an end card with what the test measured,
// from the clip's own report in src/components/clips/catalog.ts. Vertical, as the clips are.

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] })

export type Outcome = { name: string; lift: number; label: string }
export type ClipCutProps = { src: string; seconds: number; messenger: string; study: string; fielded: string; armN: number; placeboN: number; outcomes: Outcome[] }

export const CUT_FPS = 30
export const CARD = 165

const NAVY = "#1e3a8a"
const BLUE = "#3b82f6"

function LowerThird({ messenger, study }: { messenger: string; study: string }) {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame: f, fps, config: { damping: 18, stiffness: 120 } })
  const leave = interpolate(f, [110, 126], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) })
  const x = interpolate(enter, [0, 1], [-520, 0]) - leave * 560
  return (
    <div style={{ position: "absolute", left: 36 + x, bottom: 170, display: "flex", alignItems: "stretch", borderRadius: 14, overflow: "hidden", boxShadow: "0 14px 30px -12px rgba(0,0,0,.5)" }}>
      <div style={{ width: 8, background: BLUE }} />
      <div style={{ background: "rgba(255,255,255,.96)", padding: "16px 22px 16px 18px" }}>
        <div style={{ fontSize: 34, fontWeight: 700, color: "#0f172a", letterSpacing: "-0.01em" }}>{messenger}</div>
        <div style={{ marginTop: 4, fontSize: 19, fontWeight: 500, color: "#475569" }}>{study}</div>
      </div>
    </div>
  )
}

function EndCard({ messenger, study, fielded, armN, placeboN, outcomes }: Omit<ClipCutProps, "src" | "seconds">) {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const fade = interpolate(f, [0, 12], [0, 1], { extrapolateRight: "clamp" })
  const max = Math.max(20, ...outcomes.map((o) => Math.abs(o.lift)))
  return (
    <AbsoluteFill style={{ background: `linear-gradient(170deg, #172554 0%, ${NAVY} 60%, #1e40af 100%)`, opacity: fade, color: "#fff", padding: "150px 56px 0" }}>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.22em", color: "#93c5fd" }}>PAX</div>
      <div style={{ marginTop: 26, fontSize: 30, fontWeight: 500, color: "#bfdbfe" }}>What the test found</div>
      <div style={{ marginTop: 8, fontSize: 52, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.08 }}>{messenger}</div>
      <div style={{ marginTop: 56, display: "flex", flexDirection: "column", gap: 44 }}>
        {outcomes.map((o, i) => {
          const grow = spring({ frame: f - 14 - i * 10, fps, config: { damping: 200 }, durationInFrames: 30 })
          const w = (Math.abs(o.lift) / max) * 100 * grow
          const quiet = o.lift === 0 || /no measurable/i.test(o.label)
          return (
            <div key={o.name}>
              <div style={{ fontSize: 24, fontWeight: 500, color: "#dbeafe" }}>{o.name}</div>
              <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ flex: 1, height: 26, borderRadius: 13, background: "rgba(255,255,255,.14)", overflow: "hidden" }}>
                  <div style={{ width: `${Math.max(w, quiet ? 0 : 3)}%`, height: "100%", borderRadius: 13, background: quiet ? "rgba(255,255,255,.4)" : BLUE }} />
                </div>
                <div style={{ width: 150, textAlign: "right", fontSize: 46, fontWeight: 700, fontVariantNumeric: "tabular-nums", opacity: interpolate(f, [20 + i * 10, 32 + i * 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
                  {o.lift > 0 ? "+" : o.lift < 0 ? "−" : ""}
                  {Math.abs(o.lift)} pts
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 22, fontWeight: 600, color: quiet ? "#cbd5e1" : "#86efac" }}>{o.label}</div>
            </div>
          )
        })}
      </div>
      <div style={{ position: "absolute", left: 56, right: 56, bottom: 130, fontSize: 21, lineHeight: 1.5, color: "#bfdbfe", opacity: interpolate(f, [40, 56], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>
        A randomized test: {armN.toLocaleString("en-US")} saw this video, {placeboN.toLocaleString("en-US")} a placebo.
        <br />
        {study} · {fielded}
      </div>
    </AbsoluteFill>
  )
}

export function ClipCut({ src, seconds, ...card }: ClipCutProps) {
  const clip = Math.round(seconds * CUT_FPS)
  return (
    <AbsoluteFill style={{ fontFamily, background: "#000" }}>
      <Sequence durationInFrames={clip}>
        <OffthreadVideo src={staticFile(src)} style={{ width: "100%", height: "100%" }} />
        <Sequence from={18} durationInFrames={130}>
          <LowerThird messenger={card.messenger} study={card.study} />
        </Sequence>
      </Sequence>
      <Sequence from={clip}>
        <EndCard {...card} />
      </Sequence>
    </AbsoluteFill>
  )
}
