import * as React from "react"
import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion"
import { loadFont } from "@remotion/google-fonts/Inter"

// /docs' guide videos (Brendan, 2026-10-31): a title card, then each step's screenshot in a window, the camera
// easing toward what the step points at, a ring round it, a cursor that travels there (and clicks), and the
// step's caption beneath. The steps come from scratchpad captures (scripts/docs-media/README.md): each a 1440x900
// screenshot at 2x and the box, in CSS px, of the element it points at.

const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] })

export type GuideStep = { img: string; caption: string; focus: [number, number, number, number] | null; click: boolean }
/** `narration` (Brendan, 2026-10-31): the narrator's lines as audio files, the title's and each step's; `frames`
 *  each step's length and `titleFrames` the title card's, stretched to fit what is said. */
export type GuideProps = { title: string; subtitle?: string; steps: GuideStep[]; narration?: { intro?: string; steps: (string | null)[] }; frames?: number[]; titleFrames?: number }
/** A narrated line starts this many frames into its step, as its caption arrives. */
export const SPEAK_AT = 8

export const FPS = 30
export const TITLE = 60
export const STEP = 120
export const OUTRO = 30
export const W = 1600
export const H = 1000

const SHOT_W = 1440
const SHOT_H = 900
// The window: the screenshot fitted above the caption.
const WIN_W = 1376
const WIN_H = (WIN_W * SHOT_H) / SHOT_W
const WIN_X = (W - WIN_W) / 2
const WIN_Y = 34
const S = WIN_W / SHOT_W

const NAVY = "#1e3a8a"
const BLUE = "#2563eb"
const INK = "#0f172a"
const SLATE = "#475569"

type Cam = { z: number; left: number; top: number }

/** The camera for a step: zoomed toward its target, never past the screenshot's edges. */
function camera(focus: GuideStep["focus"]): Cam {
  if (!focus) return { z: 1, left: 0, top: 0 }
  const [x, y, w, h] = focus
  const z = Math.min(1.45, Math.max(1, Math.min((SHOT_W * 0.5) / Math.max(w, 1), (SHOT_H * 0.5) / Math.max(h, 1))))
  const vw = SHOT_W / z
  const vh = SHOT_H / z
  const left = Math.min(Math.max(x + w / 2 - vw / 2, 0), SHOT_W - vw)
  const top = Math.min(Math.max(y + h / 2 - vh / 2, 0), SHOT_H - vh)
  return { z, left, top }
}
const mix = (a: Cam, b: Cam, t: number): Cam => ({ z: a.z + (b.z - a.z) * t, left: a.left + (b.left - a.left) * t, top: a.top + (b.top - a.top) * t })
/** A point in the screenshot (CSS px) to the window under a camera. */
const place = (c: Cam, x: number, y: number) => ({ x: (x - c.left) * S * c.z, y: (y - c.top) * S * c.z })
const centre = (f: GuideStep["focus"]) => (f ? { x: f[0] + f[2] / 2, y: f[1] + f[3] / 2 } : { x: SHOT_W * 0.62, y: SHOT_H * 0.58 })

function Shot({ src, cam, opacity }: { src: string; cam: Cam; opacity: number }) {
  return (
    <Img
      src={staticFile(src)}
      style={{ position: "absolute", left: 0, top: 0, width: SHOT_W, height: SHOT_H, transformOrigin: "0 0", transform: `scale(${S * cam.z}) translate(${-cam.left}px, ${-cam.top}px)`, opacity }}
    />
  )
}

function Cursor({ x, y, press }: { x: number; y: number; press: number }) {
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0 }}>
      {press > 0 && press < 1 && (
        <div style={{ position: "absolute", left: -28 * press - 6, top: -28 * press - 6, width: 56 * press + 12, height: 56 * press + 12, borderRadius: "50%", border: `3px solid ${BLUE}`, opacity: 1 - press }} />
      )}
      <svg width="30" height="34" viewBox="0 0 24 28" style={{ position: "absolute", left: -3, top: -2, filter: "drop-shadow(0 2px 3px rgba(15,23,42,.35))", transform: `scale(${1 - 0.12 * Math.sin(Math.PI * Math.min(press * 2, 1))})` }}>
        <path d="M2 2 L2 22 L7.5 17 L11 25 L14.5 23.5 L11 15.8 L18.5 15.8 Z" fill="#fff" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

export function Guide({ title, subtitle, steps, narration, frames, titleFrames = TITLE }: GuideProps) {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const cams = steps.map((s) => camera(s.focus))
  const lengths = steps.map((_, k) => frames?.[k] ?? STEP)
  const starts = lengths.map((_, k) => lengths.slice(0, k).reduce((a, b) => a + b, 0))

  // The title card, then the steps.
  const titleOut = interpolate(frame, [titleFrames - 12, titleFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  const f = frame - titleFrames
  let i = 0
  for (let k = 0; k < steps.length; k++) if (f >= starts[k]!) i = k
  const at = f - starts[i]!
  const step = steps[i]!
  const move = f < 0 ? 0 : spring({ frame: at, fps: FPS, config: { damping: 200 }, durationInFrames: 28 })
  const cam = i === 0 ? mix({ z: 1, left: 0, top: 0 }, cams[0]!, move) : mix(cams[i - 1]!, cams[i]!, move)
  const fadeIn = interpolate(at, [0, 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })

  // The cursor travels from the last target to this one, and clicks.
  const from = centre(i === 0 ? null : steps[i - 1]!.focus)
  const to = centre(step.focus)
  const travel = interpolate(at, [4, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) })
  const pointer = place(cam, from.x + (to.x - from.x) * travel, from.y + (to.y - from.y) * travel)
  const press = step.click ? interpolate(at, [44, 66], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0

  const ring = step.focus ? { a: place(cam, step.focus[0] - 6, step.focus[1] - 6), b: place(cam, step.focus[0] + step.focus[2] + 6, step.focus[1] + step.focus[3] + 6) } : null
  const ringIn = interpolate(at, [22, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  const pulse = 0.5 + 0.5 * Math.sin((at / FPS) * Math.PI * 2 * 0.8)
  const captionIn = interpolate(at, [6, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  const end = interpolate(frame, [durationInFrames - OUTRO, durationInFrames - 1], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })

  return (
    <AbsoluteFill style={{ fontFamily, background: "linear-gradient(160deg, #f5f7fb 0%, #e3e9f1 100%)" }}>
      {narration?.intro && (
        <Sequence from={6}>
          <Audio src={staticFile(narration.intro)} />
        </Sequence>
      )}
      {narration?.steps.map((a, k) =>
        a ? (
          <Sequence key={k} from={titleFrames + starts[k]! + SPEAK_AT}>
            <Audio src={staticFile(a)} />
          </Sequence>
        ) : null
      )}
      {f >= 0 && (
        <AbsoluteFill style={{ opacity: end }}>
          <div style={{ position: "absolute", left: WIN_X, top: WIN_Y, width: WIN_W, height: WIN_H, borderRadius: 18, overflow: "hidden", background: "#fff", border: "1px solid #dce3ec", boxShadow: "0 30px 70px -24px rgba(15,23,42,.35), 0 8px 18px -10px rgba(15,23,42,.2)" }}>
            {i > 0 && fadeIn < 1 && <Shot src={steps[i - 1]!.img} cam={cam} opacity={1} />}
            <Shot src={step.img} cam={cam} opacity={i === 0 ? 1 : fadeIn} />
            {ring && (
              <div
                style={{
                  position: "absolute",
                  left: ring.a.x,
                  top: ring.a.y,
                  width: ring.b.x - ring.a.x,
                  height: ring.b.y - ring.a.y,
                  borderRadius: 12,
                  border: `3px solid ${BLUE}`,
                  boxShadow: `0 0 0 ${4 + 6 * pulse}px rgba(37,99,235,${0.18 * ringIn})`,
                  opacity: ringIn,
                }}
              />
            )}
            <Cursor x={pointer.x} y={pointer.y} press={press} />
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: WIN_Y + WIN_H + 22, display: "flex", justifyContent: "center", opacity: captionIn, transform: `translateY(${(1 - captionIn) * 10}px)` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, maxWidth: 1240, padding: "14px 26px 14px 16px", borderRadius: 999, background: "#fff", boxShadow: "0 10px 30px -12px rgba(15,23,42,.3)", border: "1px solid #e2e8f0" }}>
              <span style={{ flexShrink: 0, minWidth: 54, height: 34, padding: "0 10px", borderRadius: 999, background: NAVY, color: "#fff", fontSize: 18, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {i + 1}/{steps.length}
              </span>
              <span style={{ fontSize: 27, fontWeight: 500, color: INK, letterSpacing: "-0.01em" }}>{step.caption}</span>
            </div>
          </div>
        </AbsoluteFill>
      )}
      {titleOut > 0 && (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: titleOut }}>
          <div style={{ textAlign: "center", transform: `translateY(${interpolate(frame, [0, 18], [16, 0], { extrapolateRight: "clamp" })}px)`, opacity: interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" }) }}>
            <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: "0.18em", color: NAVY }}>PAX</div>
            <div style={{ marginTop: 18, fontSize: 68, fontWeight: 700, letterSpacing: "-0.02em", color: INK }}>{title}</div>
            {subtitle && <div style={{ marginTop: 14, fontSize: 30, color: SLATE }}>{subtitle}</div>}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  )
}
