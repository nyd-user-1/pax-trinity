import * as React from "react"
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"

import { Backdrop, PLAIN_FIELD } from "../../backdrop"
import { CLAMP } from "../../motion"
import { FONT, YES_ON_3 } from "../../theme"
import { BEBAS_EM, CAPTION_STACK, fit, Words } from "../yes-on-3-card/kit"
import type { YesOn3ExplainerProps } from "./schema"

// Text on screen in three beats. The hook lands over the take's open, two lines at most, under a dark
// wash from the top so it reads over any footage, and lifts away at hookSeconds. The take plays clean.
// At the close the end card rises over everything, the campaign's blue: the head in condensed capitals
// with its last word in orange, the answer's rows in white, an orange bar at the foot.

const HOOK = { top: 300, size: 150, width: 940 } as const

function Hook({ text, highlight, until }: { text: string; highlight?: string; until: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const inn = spring({ frame, fps, config: { damping: 16, stiffness: 150 } })
  const out = interpolate(frame, [until - 8, until], [1, 0], CLAMP)
  const longest = Math.max(...text.split(/\s+/).map((w) => w.length), Math.ceil(text.length / 2))
  const size = fit(HOOK.size, HOOK.width, longest, BEBAS_EM)
  return (
    <>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0) 55%)", opacity: out }} />
      <div
        style={{
          position: "absolute",
          top: HOOK.top,
          left: 70,
          right: 70,
          textAlign: "center",
          fontFamily: CAPTION_STACK,
          fontSize: size,
          lineHeight: 0.95,
          textTransform: "uppercase",
          textShadow: "0 6px 20px rgba(0,0,0,0.45)",
          opacity: out,
          transform: `scale(${0.9 + 0.1 * inn})`,
        }}
      >
        <Words text={text} highlight={highlight} />
      </div>
    </>
  )
}

function EndCard({ title, lines, footer, from }: { title: string; lines: readonly string[]; footer?: string; from: number }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const rise = spring({ frame: frame - from, fps, config: { damping: 18, stiffness: 140 } })
  const words = title.split(/\s+/).filter(Boolean)
  const titleSize = fit(240, 940, title.length, BEBAS_EM)
  const rowSize = fit(72, 900, Math.max(1, ...lines.map((l) => l.length)), 0.55)
  return (
    <AbsoluteFill style={{ background: YES_ON_3.blue, transform: `translateY(${(1 - rise) * 100}%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 48, fontFamily: FONT.family }}>
      <div style={{ fontFamily: CAPTION_STACK, fontSize: titleSize, lineHeight: 0.9, color: "#fff", whiteSpace: "nowrap" }}>
        <Words text={title} highlight={words.at(-1)} />
      </div>
      {lines.length ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
          {lines.map((l, i) => {
            const t = interpolate(frame, [from + 10 + i * 5, from + 20 + i * 5], [0, 1], CLAMP)
            return (
              <div key={i} style={{ color: "#fff", fontSize: rowSize, fontWeight: 800, lineHeight: 1.1, whiteSpace: "nowrap", opacity: t, transform: `translateY(${(1 - t) * 20}px)` }}>
                {l}
              </div>
            )
          })}
        </div>
      ) : null}
      {footer ? (
        <div style={{ marginTop: 24, background: YES_ON_3.orange, color: "#fff", fontSize: fit(60, 860, footer.length, 0.55), fontWeight: 800, padding: "22px 48px", whiteSpace: "nowrap", opacity: interpolate(frame, [from + 28, from + 38], [0, 1], CLAMP) }}>
          {footer}
        </div>
      ) : null}
    </AbsoluteFill>
  )
}

export function YesOn3ExplainerComposition({ hook, highlight, hookSeconds, end, endSeconds, backdrop }: YesOn3ExplainerProps) {
  const { fps, durationInFrames } = useVideoConfig()
  return (
    <AbsoluteFill style={{ background: backdrop ? "#000" : PLAIN_FIELD }}>
      {backdrop ? <Backdrop src={backdrop} /> : null}
      <Hook text={hook} highlight={highlight} until={Math.round(hookSeconds * fps)} />
      <EndCard title={end.title} lines={end.lines} footer={end.footer} from={durationInFrames - Math.round(endSeconds * fps)} />
    </AbsoluteFill>
  )
}
