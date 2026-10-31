import Link from "next/link"

import { DraftCard } from "@/components/consensus/draft-card"
import { SplitBar } from "@/components/consensus/split-bar"
import { surveyCode } from "@/components/consensus/question-code"
import { Block } from "@/components/settings/blocks"
import { share, type Conversation } from "@/lib/consensus/data"
import { fmtNumber } from "@/lib/format"
import { consensusHref } from "@/lib/survey-links"

// The Admin tab — building and watching a conversation, for admins only.
//
// Polis splits this across seven pages in a monospace sidebar: Configure,
// Distribute, Moderate, Monitor, Reports, Invite Tree, Invite Codes. Four of
// those are one number each. They are one panel here, because a person
// running a conversation is doing one job: watching it and keeping it clean.

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}

export function AdminPanel({ conversation: c, survey }: { conversation: Conversation; survey: number }) {
  // 1 is accepted, -1 is pulled, 0 is not yet looked at — the flag reads
  // backwards, so it is named rather than tested for truthiness.
  const moderated = c.statements.filter((s) => s.moderated === -1)
  const busiest = [...c.statements].sort((a, b) => b.votes.seen - a.votes.seen).slice(0, 8)

  return (
    <div data-not-typeset="true" className="flex flex-col gap-10">
      <DraftCard />
      <section className="flex flex-col gap-4">
        <Block title={c.title} sub={c.topic || undefined}>
          <div className="grid grid-cols-2 gap-6 px-4 py-4 sm:grid-cols-4 sm:px-5">
            <Stat value={fmtNumber(c.stats.voters)} label="participants" />
            <Stat value={fmtNumber(c.stats.votes)} label="votes cast" />
            <Stat value={fmtNumber(c.stats.commenters)} label="wrote a statement" />
            <Stat
              value={
                c.stats.voters
                  ? String(Math.round(c.stats.votes / c.stats.voters))
                  : "—"
              }
              label="votes per voter"
            />
          </div>
          <p className="px-4 py-3 text-[13px] text-slate-500 tabular-nums sm:px-5">{surveyCode(survey)}</p>
        </Block>
        <p className="text-sm text-muted-foreground">
          Voting happens on the{" "}
          <Link href={consensusHref("questions", c.slug)}>questions</Link>; the
          findings are in the{" "}
          <Link href={consensusHref("results", c.slug)}>results</Link>.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold tracking-tight">
          The statements getting the most traffic
        </h3>
        <p className="text-sm text-muted-foreground">
          What the engine is routing to people right now. A statement nobody
          is being shown is a statement to retire.
        </p>
        <div className="flex flex-col gap-4 pt-1">
          {busiest.map((s) => (
            <div key={s.tid} className="flex flex-col gap-1.5">
              <p className="text-sm">{s.text}</p>
              <SplitBar votes={s.votes} compact />
            </div>
          ))}
        </div>
      </section>

      {moderated.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold tracking-tight">Held back</h3>
          <p className="text-sm text-muted-foreground">
            {moderated.length} statements a moderator pulled. They keep
            their votes but are left out of the findings.
          </p>
          <ul className="flex flex-col gap-2 pt-1">
            {moderated.slice(0, 10).map((s) => (
              <li
                key={s.tid}
                className="flex items-baseline justify-between gap-4 border-b pb-2 text-sm last:border-0"
              >
                <span>{s.text}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {Math.round(share(s.votes).agree)}% agreed
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
