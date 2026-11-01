import * as React from "react"
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"

import { Backdrop, PLAIN_FIELD } from "../../backdrop"
import { CLAMP } from "../../motion"
import { FONT, YES_ON_3 } from "../../theme"
import { BEBAS_EM, CAPTION_STACK, fit, Words } from "../yes-on-3-card/kit"
import type { YesOn3CaptionsProps } from "./schema"

// A person speaking to camera, captioned in the Yes on 3 kit. The lower third slides in from the left
// at half a second, holds four seconds (or most of a short take) and slides back out. The captions take
// the take in equal shares, a line each, low in the frame where a phone's own captions sit; each line
// lands with a small lift.

const PLATE = { left: 60, top: 1160, accent: 16, padX: 36, padY: 26, name: 64, role: 36, tag: 28 } as const
const CAPTION = { bottom: 300, size: 120, width: 960 } as const

function LowerThird({ name, role, tag }: { name: string; role?: string; tag: string }) {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const inAt = Math.round(0.5 * fps)
  const outAt = Math.min(inAt + 4 * fps, Math.round(durationInFrames * 0.7))
  const shown = spring({ frame: frame - inAt, fps, config: { damping: 20, stiffness: 160 } }) - spring({ frame: frame - outAt, fps, config: { damping: 20, stiffness: 160 } })
  const nameSize = fit(PLATE.name, 820, name.length, 0.6)
  return (
    <div style={{ position: "absolute", left: PLATE.left, top: PLATE.top, display: "flex", transform: `translateX(${(shown - 1) * 1100}px)` }}>
      <div style={{ width: PLATE.accent, background: YES_ON_3.orange }} />
      <div style={{ background: YES_ON_3.blue, padding: `${PLATE.padY}px ${PLATE.padX}px`, fontFamily: FONT.family, color: "#fff" }}>
        {tag ? <div style={{ fontFamily: CAPTION_STACK, fontSize: PLATE.tag, letterSpacing: "0.08em", color: YES_ON_3.orange, lineHeight: 1, marginBottom: 12 }}>{tag}</div> : null}
        <div style={{ fontSize: nameSize, fontWeight: 800, lineHeight: 1.05, whiteSpace: "nowrap" }}>{name}</div>
        {role ? <div style={{ fontSize: PLATE.role, fontWeight: 600, lineHeight: 1.2, marginTop: 8, opacity: 0.85, whiteSpace: "nowrap" }}>{role}</div> : null}
      </div>
    </div>
  )
}

function Captions({ lines, highlight }: { lines: readonly string[]; highlight?: string }) {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const share = durationInFrames / lines.length
  const i = Math.min(lines.length - 1, Math.floor(frame / share))
  const at = Math.round(i * share)
  // From a third, not from nothing: a line change never leaves a frame without words.
  const lift = interpolate(frame, [at, at + 4], [0.35, 1], CLAMP)
  const line = lines[i]
  const size = fit(CAPTION.size, CAPTION.width, line.length, BEBAS_EM)
  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        right: 60,
        bottom: CAPTION.bottom,
        textAlign: "center",
        fontFamily: CAPTION_STACK,
        fontSize: size,
        lineHeight: 1,
        textTransform: "uppercase",
        textShadow: "0 4px 16px rgba(0,0,0,0.5)",
        whiteSpace: "nowrap",
        opacity: lift,
        transform: `translateY(${(1 - lift) * 18}px)`,
      }}
    >
      <Words text={line} highlight={highlight} />
    </div>
  )
}

export function YesOn3CaptionsComposition({ name, role, tag, lines, highlight, backdrop }: YesOn3CaptionsProps) {
  return (
    <AbsoluteFill style={{ background: backdrop ? "#000" : PLAIN_FIELD }}>
      {backdrop ? <Backdrop src={backdrop} /> : null}
      <LowerThird name={name} role={role} tag={tag} />
      <Captions lines={lines} highlight={highlight} />
    </AbsoluteFill>
  )
}
