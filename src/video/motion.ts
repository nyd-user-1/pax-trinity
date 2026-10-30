import { Easing, interpolate, spring } from "remotion"

import { MOTION, SPRING, sec } from "./theme"

// The few motions every template shares, as pure functions of the frame.

export const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

/** 0 → 1 on the house spring, starting at `from` (frames). */
export const enter = (frame: number, fps: number, from = 0) => spring({ frame: frame - from, fps, config: SPRING })

/** 0 → 1 over `seconds` from `from` (frames), eased out: a bar drawing. */
export const draw = (frame: number, fps: number, from: number, seconds: number = MOTION.draw) =>
  interpolate(frame, [from, from + sec(seconds, fps)], [0, 1], { ...CLAMP, easing: Easing.out(Easing.cubic) })

/** 0 → 1 over the house fade from `from` (frames). */
export const fade = (frame: number, fps: number, from: number) => interpolate(frame, [from, from + sec(MOTION.fade, fps)], [0, 1], CLAMP)

/** A point change with its sign: "+15.7", "−9.1", "±0.0". */
export const signed = (v: number, digits = 1) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(digits)}`

/** A color at a fraction of its strength over white, for a bar's pale end. */
export const pale = (color: string, strength: number) => `color-mix(in srgb, ${color} ${Math.round(strength * 100)}%, white)`
