import * as React from "react"
import { AbsoluteFill } from "remotion"

import { Backdrop, PLAIN_FIELD } from "../../backdrop"
import { FONT, YES_ON_3 } from "../../theme"
import { CARD, QuestionCard } from "./Card"
import { CAPTION_STACK, Words } from "./kit"
import type { YesOn3CardProps } from "./schema"

// The Yes on 3 card over its footage (or a plain field), in the campaign's own kit. The caption line
// is set in Bebas Neue, the nearest open face to the Wave 2 videos' condensed capitals (./kit.tsx).

function Caption({ text, highlight }: { text: string; highlight?: string }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 40,
        right: 40,
        bottom: 1920 - CARD.panelTop + 22,
        textAlign: "center",
        fontFamily: CAPTION_STACK,
        fontSize: 110,
        lineHeight: 1,
        textTransform: "uppercase",
        textShadow: "0 4px 16px rgba(0,0,0,0.45)",
        whiteSpace: "nowrap",
      }}
    >
      <Words text={text} highlight={highlight} />
    </div>
  )
}

export function YesOn3CardComposition({ title, items, footer, layout, inset, caption, highlight, entrance, backdrop }: YesOn3CardProps) {
  return (
    <AbsoluteFill style={{ background: backdrop ? "#000" : PLAIN_FIELD }}>
      {backdrop ? <Backdrop src={backdrop} /> : null}
      {caption ? <Caption text={caption} highlight={highlight} /> : null}
      <QuestionCard
        title={title}
        items={items}
        footer={footer}
        layout={layout}
        inset={inset}
        entrance={entrance}
        look={{ panel: YES_ON_3.blue, accent: YES_ON_3.orange, font: FONT.family }}
      />
    </AbsoluteFill>
  )
}
