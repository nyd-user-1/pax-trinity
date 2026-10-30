"use client"

import * as React from "react"

import { Check, Info, Minus, X } from "lucide-react"

import { Block, FIELD, SMALL, SMALL_PRIMARY } from "@/components/settings/blocks"
import { Toggle } from "@/components/settings/controls"
import type { Conversation, Statement } from "@/lib/consensus/data"
import { questionCode } from "@/components/consensus/question-code"
import { SLIDE } from "@/lib/motion"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/nova/tooltip"

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
// pressing another. Each card is /models' block, as Brendan drew it
// (2026-10-30): Question and its number on the frame; inside, the statement,
// the three answers and the mark that it matters, then the question's code
// (question-code.ts). The card in focus wears a blue rule, and an answer
// moves it on to the next question still unanswered. A row whose cards
// are both answered closes with the slide run backwards (lib/motion.ts): it
// dissolves as its height eases shut, and the next row rises into its place,
// so the survey visibly moves on (Brendan, 2026-10-30). Voting is local here,
// against the published conversations.

type Answer = "agree" | "disagree" | "pass"

const CHOICES: { value: Answer; label: string; icon: React.ReactNode }[] = [
  { value: "agree", label: "Agree", icon: <Check className="size-4" /> },
  { value: "disagree", label: "Disagree", icon: <X className="size-4" /> },
  { value: "pass", label: "Pass", icon: <Minus className="size-4" /> },
]

/** `survey` is the conversation's place in the directory, 1 up: the first part of every card's code. */
export function Survey({ conversation, survey }: { conversation: Conversation; survey: number }) {
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
  // The card in focus, by statement: the one tabbed into or pressed, until an answer moves it on.
  const [active, setActive] = React.useState<number | null>(null)
  // An answer, then the blue rule on the earliest question still unanswered: the next one when they are
  // taken in order, and one skipped in the row when they are not.
  const answer = (tid: number, a: Answer) => {
    const next = { ...answers, [tid]: a }
    setAnswers(next)
    setActive(queue.find((st) => !next[st.tid])?.tid ?? null)
  }
  // Two cards a row; a finished row closes a beat after its last answer, so the pick is seen first.
  const rows = React.useMemo(() => Array.from({ length: Math.ceil(queue.length / 2) }, (_, r) => queue.slice(r * 2, r * 2 + 2)), [queue])
  const [closed, setClosed] = React.useState<Set<number>>(new Set())
  // Reviewing, every row stays open to change an answer.
  const [review, setReview] = React.useState(false)
  const timers = React.useRef(new Map<number, number>())
  React.useEffect(() => {
    if (review) return
    rows.forEach((row, r) => {
      if (closed.has(r) || timers.current.has(r) || !row.every((st) => answers[st.tid])) return
      timers.current.set(
        r,
        window.setTimeout(() => {
          timers.current.delete(r)
          setClosed((prev) => new Set(prev).add(r))
        }, 450)
      )
    })
  }, [answers, rows, closed, review])
  React.useEffect(() => {
    const t = timers.current
    return () => t.forEach((id) => window.clearTimeout(id))
  }, [])
  const done = !review && rows.length > 0 && closed.size === rows.length

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm font-semibold text-slate-900">
            {conversation.title}
            {conversation.topic && <span className="font-normal text-slate-500"> · {conversation.topic}</span>}
          </p>
          <span className="text-[13px] text-slate-500 tabular-nums">
            {voted} of {queue.length} answered
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-pax2-blue transition-[width] duration-300" style={{ width: `${(voted / Math.max(1, queue.length)) * 100}%` }} />
        </div>
      </div>

      {/* Each row in a clip that eases from its height to none while the row fades: the slide, backwards. */}
      <div>
        {rows.map((row, r) => {
          const shut = closed.has(r)
          return (
            <div key={row[0]!.tid} inert={shut} aria-hidden={shut || undefined} className={cn("grid transition-[grid-template-rows,opacity]", SLIDE, shut ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100")}>
              <div className="-mx-2 min-h-0 overflow-hidden px-2">
                <div className="grid items-stretch gap-5 pb-5 md:grid-cols-2">
                  {row.map((statement) => {
                    const n = queue.indexOf(statement) + 1
                    return (
                      <div key={statement.tid} className="h-full" onPointerDownCapture={() => setActive(statement.tid)} onFocusCapture={() => setActive(statement.tid)}>
                        <Card
                          n={n}
                          code={questionCode(survey, n)}
                          statement={statement}
                          selected={active === statement.tid}
                          answer={answers[statement.tid]}
                          onAnswer={(a) => answer(statement.tid, a)}
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
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {done && (
        <Block title={`All ${queue.length} answered`}>
          <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
            <span className="text-sm text-slate-700">Every question in this survey has your answer.</span>
            <button
              type="button"
              onClick={() => {
                setReview(true)
                setClosed(new Set())
              }}
              className={SMALL}
            >
              Review my answers
            </button>
          </div>
        </Block>
      )}

      {/* Writing a statement is available throughout, not only at the end. */}
      <Block title="Add a statement of your own">
        <div className="px-4 py-3.5 sm:px-5">
          <textarea
            aria-label="Your statement"
            value={written}
            onChange={(e) => setWritten(e.target.value.slice(0, 140))}
            rows={3}
            placeholder="One stand-alone idea, in your own words."
            className={cn(FIELD, "block w-full resize-none px-3 py-2 outline-none placeholder:text-slate-400")}
          />
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
          <span className="text-[13px] text-slate-500 tabular-nums">
            {submitted.length > 0 ? `${submitted.length} waiting for moderation · ` : ""}
            {140 - written.length} left
          </span>
          <button
            type="button"
            disabled={written.trim().length < 8}
            onClick={() => {
              setSubmitted((prev) => [written.trim(), ...prev])
              setWritten("")
            }}
            className={cn(SMALL_PRIMARY, "disabled:opacity-40")}
          >
            Add it
          </button>
        </div>
      </Block>
    </div>
  )
}

/** One question as a block: Question and its number on the frame; inside, the statement, the three
 *  answers (the picked one filled) and the mark that it matters, then the question's code. */
function Card({ n, code, statement, selected, answer, onAnswer, salient, onSalient }: { n: number; code: string; statement: Statement; selected: boolean; answer?: Answer; onAnswer: (a: Answer) => void; salient: boolean; onSalient: () => void }) {
  return (
    <Block stretch selected={selected} title={<span className="font-medium">Question {n}</span>}>
      <div className="flex flex-1 flex-col gap-6 px-4 py-5 sm:px-5">
        <p className="text-[17px] leading-snug text-balance text-slate-900">{statement.text}</p>
        <div className="mt-auto grid grid-cols-3 gap-2">
          {CHOICES.map((choice) => {
            const on = answer === choice.value
            return (
              <button
                key={choice.value}
                type="button"
                aria-pressed={on}
                onClick={() => onAnswer(choice.value)}
                className={cn(
                  "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-pax2-light-blue/30",
                  on ? "border-pax2-blue bg-pax2-blue text-white" : "border-slate-300 bg-white text-slate-700 hover:border-pax2-blue hover:text-pax2-blue"
                )}
              >
                {choice.icon}
                {choice.label}
              </button>
            )
          })}
        </div>
        {/* Salience, after the answer rather than in front of it. */}
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1 text-sm font-medium text-slate-900">
            Matters more than most
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label="What marking a statement does"
                    className="inline-flex size-5 items-center justify-center rounded-full text-slate-400 hover:text-slate-700"
                  />
                }
              >
                <Info className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className="max-w-xs text-xs leading-5">
                Turn this on if you believe this statement is especially
                important to you or is highly relevant to the conversation,
                irrespective of your vote. It will give this statement higher
                priority compared to your other votes in the conversation
                analysis.
              </TooltipContent>
            </Tooltip>
          </span>
          <Toggle label="Matters more than most" on={salient} onChange={onSalient} />
        </div>
      </div>
      <p className="px-4 py-3 text-[13px] text-slate-500 tabular-nums sm:px-5">{code}</p>
    </Block>
  )
}
