import * as React from "react"
import { loadFont } from "@remotion/google-fonts/BebasNeue"

import { YES_ON_3 } from "../../theme"

// The Yes on 3 family's shared type: the condensed capitals the Wave 2 videos set their captions in
// (Bebas Neue, the nearest open face), with one word picked out in the campaign's orange. Drawn by the
// card, the captions, the explainer and the quote templates.

export const { fontFamily: CAPTION_FONT } = loadFont("normal", { weights: ["400"], subsets: ["latin"] })
export const CAPTION_STACK = `${CAPTION_FONT}, 'Arial Narrow', sans-serif`

/** A word with its punctuation gone, in capitals: how a highlight is matched. */
export const bare = (w: string) => w.toUpperCase().replace(/[^\p{L}\p{N}]/gu, "")

/** The largest size, up to `max`, at which `chars` characters fit `width`, for a face whose average
 *  character is `em` of its size. */
export const fit = (max: number, width: number, chars: number, em: number) => Math.min(max, Math.floor(width / Math.max(1, chars * em)))

/** Bebas Neue sets about 0.35 of its size per character, capitals and spaces together (measured from a
 *  rendered frame); 0.38 leaves room for a line heavy in W and M. */
export const BEBAS_EM = 0.38

/** A line's words, white, the highlighted one orange. */
export function Words({ text, highlight, color = "#fff" }: { text: string; highlight?: string; color?: string }) {
  const hot = bare(highlight ?? "")
  const words = text.split(/\s+/).filter(Boolean)
  return (
    <>
      {words.map((w, i) => (
        <span key={i} style={{ color: hot && bare(w) === hot ? YES_ON_3.orange : color }}>
          {w}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  )
}
