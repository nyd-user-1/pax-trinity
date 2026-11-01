import * as React from "react"
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"

import { Backdrop, PLAIN_FIELD } from "../../backdrop"
import { CLAMP } from "../../motion"
import { FONT, YES_ON_3 } from "../../theme"
import { Words } from "../yes-on-3-card/kit"
import type { YesOn3QuoteProps } from "./schema"

// A quote card in the Yes on 3 kit. The blue card stands in from the frame's sides, at the top or the
// bottom, and rises into place; an orange quotation mark hangs over its corner; the words are set in the
// app's face at its heaviest, sized to their length; an orange rule, then who said it and what they are.

const CARD = { side: 60, edge: 200, pad: 64, mark: 260 } as const

/** The quote's size by its length: a short line large, a long one smaller, always within the card. */
const quoteSize = (chars: number) => (chars <= 50 ? 76 : chars <= 90 ? 64 : 54)

export function YesOn3QuoteComposition({ quote, highlight, by, role, position, backdrop }: YesOn3QuoteProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const rise = spring({ frame, fps, config: { damping: 18, stiffness: 140 } })
  const credit = interpolate(frame, [14, 24], [0, 1], CLAMP)
  const top = position === "top"
  return (
    <AbsoluteFill style={{ background: backdrop ? "#000" : PLAIN_FIELD }}>
      {backdrop ? <Backdrop src={backdrop} /> : null}
      <div
        style={{
          position: "absolute",
          left: CARD.side,
          right: CARD.side,
          ...(top ? { top: CARD.edge } : { bottom: CARD.edge }),
          background: YES_ON_3.blue,
          padding: `${CARD.pad + 40}px ${CARD.pad}px ${CARD.pad}px`,
          fontFamily: FONT.family,
          color: "#fff",
          opacity: rise,
          transform: `translateY(${(1 - rise) * (top ? -60 : 60)}px)`,
        }}
      >
        <div style={{ position: "absolute", top: -CARD.mark * 0.3, left: CARD.pad - 16, fontSize: CARD.mark, fontWeight: 800, lineHeight: 1, color: YES_ON_3.orange }}>“</div>
        <div style={{ fontSize: quoteSize(quote.length), fontWeight: 800, lineHeight: 1.12, letterSpacing: "-0.01em" }}>
          <Words text={quote} highlight={highlight} />
        </div>
        <div style={{ marginTop: 44, opacity: credit }}>
          <div style={{ width: 96, height: 8, background: YES_ON_3.orange, marginBottom: 24 }} />
          <div style={{ fontSize: 44, fontWeight: 700, lineHeight: 1.15 }}>{by}</div>
          {role ? <div style={{ fontSize: 32, fontWeight: 500, lineHeight: 1.3, marginTop: 6, opacity: 0.8 }}>{role}</div> : null}
        </div>
      </div>
    </AbsoluteFill>
  )
}
