import type * as React from "react"

import { Reveal } from "@/components/reveal"
import { Block } from "@/components/settings/blocks"
import { share, type Conversation, type Statement, type Tally } from "@/lib/consensus/data"
import { fmtNumber } from "@/lib/format"

// A statement's votes in the shape of an uptime status card (Brendan,
// 2026-09-11, on Aceternity's uptime-status-illustration): the statement where
// the service name goes, the agree share as the big figure on the right, and
// the votes as a row of rounded pills — agree, then pass, then disagree, left
// to right, so the row still reads as one measure. A pill grows under the
// pointer and names its share. The colours are the report's own validated pair
// (components/consensus/split-bar.tsx says why teal and amber, not green and
// red), with pass in the neutral middle. The pills rise in left to right the
// first time the row comes into view (components/reveal.tsx).

const AGREE = "var(--consensus-agree)"
const DISAGREE = "var(--consensus-disagree)"
const PILLS = 48

type Kind = "agree" | "pass" | "disagree"

/** Split N pills across three shares by largest remainder, so they always sum to N. */
function pillsOf(votes: Tally, n = PILLS): Kind[] {
  const s = share(votes)
  const raw = [
    ["agree", (s.agree / 100) * n],
    ["pass", (s.pass / 100) * n],
    ["disagree", (s.disagree / 100) * n],
  ] as const
  const counts = raw.map(([, v]) => Math.floor(v))
  let left = n - counts.reduce((a, b) => a + b, 0)
  const order = raw.map(([, v], i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0])
  for (const [, i] of order) {
    if (left <= 0) break
    counts[i]!++
    left--
  }
  const out: Kind[] = []
  raw.forEach(([k], i) => {
    for (let j = 0; j < counts[i]!; j++) out.push(k)
  })
  return out
}

const fill: Record<Kind, string> = {
  agree: AGREE,
  pass: "color-mix(in oklab, var(--muted-foreground) 30%, transparent)",
  disagree: DISAGREE,
}

export function StatusBars({
  votes,
  size = "md",
  figures = false,
}: {
  votes: Tally
  size?: "md" | "sm"
  /** The agree share before the pills and the disagree share after, in their colours. */
  figures?: boolean
}) {
  const s = share(votes)
  const pct = (v: number) => `${Math.round(v)}%`
  const title: Record<Kind, string> = {
    agree: `Agree · ${pct(s.agree)}`,
    pass: `Pass · ${pct(s.pass)}`,
    disagree: `Disagree · ${pct(s.disagree)}`,
  }
  const figure = "shrink-0 text-2xl font-semibold tracking-tight tabular-nums"
  return (
    <Reveal
      className={`flex w-full items-end ${size === "md" ? "h-9 gap-[3px]" : "h-4 gap-[2px]"}`}
      role="img"
      aria-label={`${pct(s.agree)} agree, ${pct(s.pass)} pass, ${pct(s.disagree)} disagree, of ${fmtNumber(votes.seen)} who saw it`}
    >
      {figures && (
        <span className={`${figure} mr-3`} style={{ color: AGREE }}>
          {pct(s.agree)}
        </span>
      )}
      {pillsOf(votes).map((kind, i) => (
        <span
          key={i}
          title={title[kind]}
          className={`grow-y min-w-0 flex-1 origin-bottom rounded-full transition-[scale] duration-150 hover:scale-y-125 ${size === "md" ? "h-8" : "h-3"}`}
          style={{ background: fill[kind], "--i": i / 4 } as React.CSSProperties}
        />
      ))}
      {figures && (
        <span className={`${figure} ml-3`} style={{ color: DISAGREE }}>
          {pct(s.disagree)}
        </span>
      )}
    </Reveal>
  )
}

// The card as Brendan arranged it in devtools (2026-09-11): the statement,
// then one row — the agree share, the pills, the disagree share. The note,
// the group rows and the foot came off. Since 2026-10-30 it is the Questions
// card's block, as Brendan drew it: Question and its number on the frame;
// inside, the statement and the row, then the question's code.
export function StatementCard({ statement, number, code }: { statement: Statement; number?: number; code?: string; conversation?: Conversation; note?: string }) {
  return (
    <Block title={<span className="font-medium">{number != null ? `Question ${number}` : "Statement"}</span>}>
      <div className="flex flex-col gap-5 px-4 py-5 sm:px-5">
        <p className="text-[17px] leading-snug text-balance text-slate-900">{statement.text}</p>
        <StatusBars votes={statement.votes} figures />
      </div>
      {code && <p className="px-4 py-3 text-[13px] text-slate-500 tabular-nums sm:px-5">{code}</p>}
    </Block>
  )
}
