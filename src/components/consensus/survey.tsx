"use client"

import * as React from "react"

import type { Conversation, Statement } from "@/lib/consensus/data"
import { Button } from "@govblock/ui/components/nova/button"
import { Textarea } from "@govblock/ui/components/nova/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/nova/tooltip"
import { Check, Flag, Info, Minus, X } from "lucide-react"

// The vote cards, and a catalogue of what Polis's own gets wrong.
//
// Their participation client, watched on 2026-09-10:
//
//   · the next statement does not appear until the page is refreshed.
//   · a statement sometimes changes before it has been read. Nothing here
//     re-renders a statement except a vote on that statement.
//   · the "Important/Significant" checkbox sits between the statement and the
//     buttons, in the reading path, which is why it gets clicked by accident.
//     Salience is a real signal but a secondary one, so it sits after the
//     answer, not before it.
//
// Every statement is on screen at once, two columns of cards, with no framing
// card to get past first (Brendan, 2026-10-29); an answer can be changed by
// pressing another. Voting is local here, against the published conversations.

type Answer = "agree" | "disagree" | "pass"

const CHOICES: { value: Answer; label: string; icon: React.ReactNode }[] = [
  { value: "agree", label: "Agree", icon: <Check className="size-4" /> },
  { value: "disagree", label: "Disagree", icon: <X className="size-4" /> },
  { value: "pass", label: "Pass", icon: <Minus className="size-4" /> },
]

export function Survey({ conversation }: { conversation: Conversation }) {
  const queue = React.useMemo(
    () =>
      // 1 accepted, 0 unreviewed, -1 pulled.
      conversation.statements.filter((s) => s.moderated >= 0).slice(0, 25),
    [conversation]
  )
  const [answers, setAnswers] = React.useState<Record<number, Answer>>({})
  const [salient, setSalient] = React.useState<Set<number>>(new Set())
  const [written, setWritten] = React.useState("")
  const [submitted, setSubmitted] = React.useState<string[]>([])
  const voted = queue.filter((s) => answers[s.tid]).length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{conversation.topic}</span>
        <span className="tabular-nums">
          {voted} of {queue.length}
        </span>
      </div>

      {/* A thin progress rule beside the count. */}
      <div className="h-0.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-foreground/70 transition-[width] duration-300" style={{ width: `${(voted / Math.max(1, queue.length)) * 100}%` }} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {queue.map((statement) => (
          <Card
            key={statement.tid}
            statement={statement}
            answer={answers[statement.tid]}
            onAnswer={(a) => setAnswers((prev) => ({ ...prev, [statement.tid]: a }))}
            salient={salient.has(statement.tid)}
            onSalient={() =>
              setSalient((prev) => {
                const next = new Set(prev)
                if (next.has(statement.tid)) next.delete(statement.tid)
                else next.add(statement.tid)
                return next
              })
            }
          />
        ))}
      </div>

      {/* Writing a statement is available throughout, not only at the end. */}
      <section className="flex flex-col gap-3">
        <label htmlFor="own" className="text-sm font-medium">
          Add a statement of your own
        </label>
        <Textarea
          id="own"
          value={written}
          onChange={(e) => setWritten(e.target.value.slice(0, 140))}
          rows={3}
          placeholder="One stand-alone idea, in your own words."
        />
        <div className="flex items-center justify-between">
          <span className="text-xs tabular-nums text-muted-foreground">
            {140 - written.length} left
          </span>
          <Button
            size="sm"
            disabled={written.trim().length < 8}
            onClick={() => {
              setSubmitted((prev) => [written.trim(), ...prev])
              setWritten("")
            }}
          >
            Add it
          </Button>
        </div>
        {submitted.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {submitted.length} waiting for moderation. Others will vote on them
            once they are through.
          </p>
        )}
      </section>

    </div>
  )
}

/** One statement: its text, the three answers (the picked one filled), and the mark that it matters. */
function Card({ statement, answer, onAnswer, salient, onSalient }: { statement: Statement; answer?: Answer; onAnswer: (a: Answer) => void; salient: boolean; onSalient: () => void }) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <p className="text-base leading-6 font-medium text-balance">{statement.text}</p>
      <div className="mt-auto grid grid-cols-3 gap-2">
        {CHOICES.map((choice) => (
          <Button
            key={choice.value}
            variant={answer === choice.value ? "default" : "secondary"}
            aria-pressed={answer === choice.value}
            onClick={() => onAnswer(choice.value)}
            className="h-10 justify-center gap-2"
          >
            {choice.icon}
            {choice.label}
          </Button>
        ))}
      </div>
      {/* Salience, after the answer rather than in front of it. */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onSalient}
          className={`flex items-center gap-2 text-xs transition-colors ${salient ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Flag className={`size-3.5 ${salient ? "fill-current" : ""}`} aria-hidden />
          {salient ? "Marked as one that matters" : "This one matters more than most"}
        </button>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label="What marking a statement does"
                className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
              />
            }
          >
            <Info className="size-3.5" />
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} className="max-w-xs text-xs leading-5">
            Check this box if you believe this statement is especially
            important to you or is highly relevant to the conversation,
            irrespective of your vote. It will give this statement higher
            priority compared to your other votes in the conversation
            analysis.
          </TooltipContent>
        </Tooltip>
      </div>
    </section>
  )
}
