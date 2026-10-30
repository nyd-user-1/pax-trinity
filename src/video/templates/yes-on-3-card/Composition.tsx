import * as React from "react"
import { AbsoluteFill } from "remotion"
import { loadFont } from "@remotion/google-fonts/BebasNeue"

import { Backdrop, PLAIN_FIELD } from "../../backdrop"
import { FONT, YES_ON_3 } from "../../theme"
import { CARD, QuestionCard } from "./Card"
import type { YesOn3CardProps } from "./schema"

// The Yes on 3 card over its footage (or a plain field), in the campaign's own kit. The caption line
// is set in Bebas Neue, the nearest open face to the Wave 2 videos' condensed capitals.

const { fontFamily: CAPTION_FONT } = loadFont("normal", { weights: ["400"], subsets: ["latin"] })

const bare = (w: string) => w.toUpperCase().replace(/[^\p{L}\p{N}]/gu, "")

function Caption({ text, highlight }: { text: string; highlight?: string }) {
  const hot = bare(highlight ?? "")
  const words = text.split(/\s+/).filter(Boolean)
  return (
    <div
      style={{
        position: "absolute",
        left: 40,
        right: 40,
        bottom: 1920 - CARD.panelTop + 22,
        textAlign: "center",
        fontFamily: `${CAPTION_FONT}, 'Arial Narrow', sans-serif`,
        fontSize: 110,
        lineHeight: 1,
        textTransform: "uppercase",
        textShadow: "0 4px 16px rgba(0,0,0,0.45)",
        whiteSpace: "nowrap",
      }}
    >
      {words.map((w, i) => (
        <span key={i} style={{ color: hot && bare(w) === hot ? YES_ON_3.orange : "#fff" }}>
          {w}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
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
