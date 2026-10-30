import * as React from "react"
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"

// The checklist card as the Yes on 3 team ran it in the Wave 2 videos, for a 1080x1920 frame: a panel
// from 54% of the height to the bottom, the title, up to three white rows each with an orange check, an
// orange footer bar, and empty panel under it. Every size below was measured from the Wave 2 frames in
// Report 2 and the tested videos on the clips CDN. Drawn by this template and by the Enhance flow's
// checklist graphic, which passes its brand's colours and typeface.

export const CARD = {
  /** The panel's top edge. */
  panelTop: 1040,
  /** The inset cut's margin on the sides and bottom. */
  inset: 24,
  /** The compact cut: the same card at this scale, anchored to the panel's top edge. */
  compact: 0.76,
  /** Rows and footer. */
  width: 956,
  padTop: 44,
  title: 92,
  titleGap: 24,
  row: 120,
  rowGap: 20,
  check: 101,
  checkLeft: 35,
  /** From the check to the row's words. */
  textLeft: 32,
  text: 80,
  footerGap: 20,
  footer: 95,
  footerText: 56,
} as const

export type CardLook = { panel: string; accent: string; font: string }

export type CardProps = {
  title: string
  items: readonly string[]
  footer?: string
  layout?: "wide" | "compact"
  inset?: boolean
  entrance?: "cut" | "rise"
  look: CardLook
}

const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const

/** The largest size, up to `max`, at which `chars` characters fit `width`, for a face whose average
 *  character is `em` of its size. Rows share one size, as in the Wave 2 cards. */
const fit = (max: number, width: number, chars: number, em: number) => Math.min(max, Math.floor(width / Math.max(1, chars * em)))

/** The campaign's face is heavier than Plus Jakarta Sans at its heaviest (800): Wave 2's stems are about a
 *  quarter thicker. A stroke in the text's own colour makes up most of it without moving a letter. */
const heavy = (size: number, color: string) => ({ WebkitTextStroke: `${(size * 0.035).toFixed(1)}px ${color}` })

function Check({ color }: { color: string }) {
  return (
    <svg width={CARD.check} height={CARD.check} viewBox="0 0 24 24" style={{ flexShrink: 0, marginLeft: CARD.checkLeft }}>
      <circle cx={12} cy={12} r={12} fill={color} />
      <path d="M6.4 12.6l3.6 3.6 7.6-8.2" fill="none" stroke="#fff" strokeWidth={3.3} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function QuestionCard({ title, items, footer, layout = "wide", inset = false, entrance = "cut", look }: CardProps) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const rise = entrance === "rise"
  const panelIn = rise ? spring({ frame, fps, config: { damping: 18, stiffness: 140 } }) : 1
  const rowIn = (i: number) => (rise ? interpolate(frame, [10 + i * 6, 22 + i * 6], [0, 1], CLAMP) : 1)
  const footerIn = rise ? interpolate(frame, [32, 42], [0, 1], CLAMP) : 1

  const rows = items.slice(0, 3)
  // Measured: Plus Jakarta Sans at 800 sets about 0.515 of its size per character; the longest row keeps
  // the 25 px the Wave 2 rows leave at their right end.
  const textRoom = CARD.width - CARD.checkLeft - CARD.check - CARD.textLeft - 25
  const textSize = fit(CARD.text, textRoom, Math.max(0, ...rows.map((r) => r.length)), 0.515)
  const titleSize = fit(CARD.title, CARD.width, title.length, 0.62)
  const footerSize = footer ? fit(CARD.footerText, CARD.width - 48, footer.length, 0.55) : CARD.footerText
  const m = inset ? CARD.inset : 0

  return (
    <div
      style={{
        position: "absolute",
        top: CARD.panelTop,
        left: m,
        right: m,
        bottom: m,
        background: look.panel,
        transform: `translateY(${(1 - panelIn) * 100}%)`,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: CARD.padTop,
          transform: layout === "compact" ? `scale(${CARD.compact})` : undefined,
          transformOrigin: "top center",
          fontFamily: look.font,
        }}
      >
        <div style={{ color: "#fff", fontWeight: 800, fontSize: titleSize, lineHeight: 1, whiteSpace: "nowrap", marginBottom: CARD.titleGap, ...heavy(titleSize, "#fff") }}>{title}</div>
        {rows.map((item, i) => {
          const t = rowIn(i)
          return (
            <div
              key={i}
              style={{
                width: CARD.width,
                height: CARD.row,
                marginTop: i ? CARD.rowGap : 0,
                background: "#fff",
                display: "flex",
                alignItems: "center",
                opacity: t,
                transform: `translateX(${(1 - t) * -60}px)`,
              }}
            >
              <Check color={look.accent} />
              <span style={{ marginLeft: CARD.textLeft, color: look.panel, fontWeight: 800, fontSize: textSize, lineHeight: 1, letterSpacing: "-0.015em", whiteSpace: "nowrap", ...heavy(textSize, look.panel) }}>{item}</span>
            </div>
          )
        })}
        {footer ? (
          <div
            style={{
              width: CARD.width,
              height: CARD.footer,
              marginTop: CARD.footerGap,
              background: look.accent,
              color: "#fff",
              fontWeight: 800,
              fontSize: footerSize,
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              whiteSpace: "nowrap",
              opacity: footerIn,
              ...heavy(footerSize, "#fff"),
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
