import Link from "next/link"
import { MessagesSquare } from "lucide-react"

import { surveyCode } from "@/components/consensus/question-code"
import { Block, Fact, SMALL, Tile } from "@/components/settings/blocks"
import { asked, type Conversation } from "@/lib/consensus/data"
import { fmtNumber } from "@/lib/format"

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
export function SurveysPanel({ all, taken }: { all: Conversation[]; taken: string[] }) {
  return (
    <div data-not-typeset="true" className="space-y-6">
      <div className="grid items-stretch gap-5 md:grid-cols-2">
        {all.map((c, i) => (
          <SurveyCard key={c.slug} c={c} n={i + 1} taken={taken.includes(c.slug)} />
        ))}
      </div>
    </div>
  )
}

/** A survey's card: the whole card opens it, or the reader's results once they have taken it. */
export function SurveyCard({ c, n, taken }: { c: Conversation; n: number; taken: boolean }) {
  return (
    <Link href={`/${taken ? "r" : "s"}/${encodeURIComponent(c.slug)}`} className="block h-full rounded-[18px] outline-none focus-visible:ring-3 focus-visible:ring-pax2-light-blue/30">
      <Block stretch className="lift" lead={<Tile icon={MessagesSquare} tint="#475569" />} title={c.title} sub={c.topic || undefined} action={<span className={SMALL}>{taken ? "Your results" : "Take the survey"}</span>}>
        <Fact label="Questions">{fmtNumber(asked(c).length)}</Fact>
        <Fact label="Participants">{fmtNumber(c.stats.voters)}</Fact>
        <Fact label="Votes cast">{fmtNumber(c.stats.votes)}</Fact>
        <Fact label="Opinion groups">{String(c.stats.groups)}</Fact>
        <p className="px-4 py-3 text-[13px] text-slate-500 tabular-nums sm:px-5">{surveyCode(n)}</p>
      </Block>
    </Link>
  )
}
