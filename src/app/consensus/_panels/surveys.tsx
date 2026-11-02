import Link from "next/link"
import { MessagesSquare } from "lucide-react"

import { surveyCode } from "@/components/consensus/question-code"
import { CardTools, UnlessDeleted } from "@/components/dash/card-tools"
import { LifeChip } from "@/components/life-chip"
import { Block, Fact, Tile } from "@/components/settings/blocks"
import { asked, type Conversation } from "@/lib/consensus/data"
import { fmtNumber } from "@/lib/format"
import type { LifeState } from "@/lib/lifecycle/rules"

// The Surveys tab — the conversations, as a directory.
//
// Polis lists these by printing every conversation's entire description into
// a wall of monospace. A conversation is a thing with a shape — how many
// people, how many statements, how many groups it found — so it gets a card
// with that shape on it: /models' block (Brendan, 2026-10-30), its numbers
// as the rows, its code at its foot.
//
// Each card opens the survey itself at /s/<slug> (Brendan, 2026-11-02), or,
// for a reader who has taken it, their results at /r/<slug>: no one takes a
// survey twice.
export function SurveysPanel({ all, taken, states = {} }: { all: Conversation[]; taken: string[]; /** Each survey's lifecycle state (lib/lifecycle), by slug. */ states?: Record<string, LifeState> }) {
  return (
    <div data-not-typeset="true" className="space-y-6">
      <div className="grid items-stretch gap-5 md:grid-cols-2">
        {all.map((c, i) => (
          <SurveyCard key={c.slug} c={c} n={i + 1} taken={taken.includes(c.slug)} state={states[c.slug]} />
        ))}
      </div>
    </div>
  )
}

/** A survey's card: the whole card opens it, or the reader's results once they have taken it, with no button saying so
 *  (Brendan, 2026-11-02: the card is the way in). The link lies under the
 *  card, so its three-dot menu (Copy, Add to Blocks and the rest, Brendan 2026-11-02) can sit above it: a menu can't
 *  live inside a link. The card lifts on hover as /models' cards do. */
export function SurveyCard({ c, n, taken, state }: { c: Conversation; n: number; taken: boolean; state?: LifeState }) {
  const href = `/${taken ? "r" : "s"}/${encodeURIComponent(c.slug)}`
  const anchor = `survey-${c.slug}`
  const rows: [string, string][] = [
    ["Questions", fmtNumber(asked(c).length)],
    ["Participants", fmtNumber(c.stats.voters)],
    ["Votes cast", fmtNumber(c.stats.votes)],
    ["Opinion groups", String(c.stats.groups)],
  ]
  const copy = [c.title, c.topic, ...rows.map(([k, v]) => `${k}: ${v}`), surveyCode(n)].filter(Boolean).join("\n")
  return (
    <UnlessDeleted anchor={anchor}>
      <div className="group/survey relative h-full">
        <Link href={href} aria-label={taken ? `${c.title}: your results` : c.title} className="absolute inset-0 rounded-[18px] outline-none focus-visible:ring-3 focus-visible:ring-pax2-light-blue/30" />
        <Block
          stretch
          id={anchor}
          className="pointer-events-none relative transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] group-hover/survey:-translate-y-[3px] group-hover/survey:shadow-[var(--pax2-shadow-3)]"
          lead={<Tile icon={MessagesSquare} tint="#475569" />}
          title={c.title}
          sub={c.topic || undefined}
          badge={state && <LifeChip state={state} />}
          action={
            <CardTools title={c.title} anchor={anchor} copy={copy} className="pointer-events-auto self-start" />
          }
        >
          {rows.map(([k, v]) => (
            <Fact key={k} label={k}>
              {v}
            </Fact>
          ))}
          <p className="px-4 py-3 text-[13px] text-slate-500 tabular-nums sm:px-5">{surveyCode(n)}</p>
        </Block>
      </div>
    </UnlessDeleted>
  )
}
