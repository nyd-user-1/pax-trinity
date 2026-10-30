import Link from "next/link"
import { MessagesSquare } from "lucide-react"

import { surveyCode } from "@/components/consensus/question-code"
import { Block, Fact, SMALL, Tile } from "@/components/settings/blocks"
import { type Conversation } from "@/lib/consensus/data"
import { fmtNumber } from "@/lib/format"

// The Surveys tab — the conversations, as a directory.
//
// Polis lists these by printing every conversation's entire description into
// a wall of monospace. A conversation is a thing with a shape — how many
// people, how many statements, how many groups it found — so it gets a card
// with that shape on it: /models' block (Brendan, 2026-10-30), its numbers
// as the rows, Vote and Results at its head, its code at its foot.
export function SurveysPanel({ all, admin }: { all: Conversation[]; admin: boolean }) {
  return (
    <div data-not-typeset="true" className="space-y-6">
      <div className="grid items-stretch gap-5 md:grid-cols-2">
        {all.map((c, i) => (
          <Block
            key={c.slug}
            stretch
            lead={<Tile icon={MessagesSquare} tint="#475569" />}
            title={c.title}
            sub={c.topic || undefined}
            action={
              <span className="flex shrink-0 gap-1.5">
                <Link href={`/consensus?c=${c.slug}`} className={SMALL}>
                  Vote
                </Link>
                <Link href={`/consensus?tab=results&c=${c.slug}`} className={SMALL}>
                  Results
                </Link>
              </span>
            }
          >
            <Fact label="Participants">{fmtNumber(c.stats.voters)}</Fact>
            <Fact label="Statements">{fmtNumber(c.stats.statements)}</Fact>
            <Fact label="Votes cast">{fmtNumber(c.stats.votes)}</Fact>
            <Fact label="Opinion groups">{String(c.stats.groups)}</Fact>
            <p className="px-4 py-3 text-[13px] text-slate-500 tabular-nums sm:px-5">{surveyCode(i + 1)}</p>
          </Block>
        ))}
      </div>

      <p className="text-[13px] text-slate-500">
        The conversations are the Computational Democracy Project&apos;s own published data, so every one of them has already clustered.{" "}
        <Link href="/consensus" className="font-medium text-pax2-light-blue hover:underline">
          Questions
        </Link>{" "}
        is where a conversation is voted on
        {admin ? (
          <>
            {" "}
            and{" "}
            <Link href="/consensus?tab=admin" className="font-medium text-pax2-light-blue hover:underline">
              Admin
            </Link>{" "}
            is where one is built.
          </>
        ) : (
          "."
        )}
      </p>
    </div>
  )
}
