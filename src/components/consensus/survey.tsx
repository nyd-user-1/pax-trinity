"use client"

import * as React from "react"

import { Check, Info, Minus, X } from "lucide-react"

import { QuestionMenu } from "@/components/consensus/question-menu"
import { SeriesCard } from "@/components/models/model-card"
import { LifeChip } from "@/components/life-chip"
import type { LifeState } from "@/lib/lifecycle/rules"
import { Badge, Block, Fact, FIELD, Passage, PRIMARY, SMALL, SMALL_PRIMARY } from "@/components/settings/blocks"
import { Toggle } from "@/components/settings/controls"
import { StatementCard } from "@/components/consensus/status-bars"
import { asked, consensusOn, emergedStatements, everyGroupAgrees, roomSide, share, WALKTHROUGH_BAR, type ConsensusRule, type Conversation, type Statement } from "@/lib/consensus/data"
import { ViewToggle } from "@/components/bank/pane-bars"
import { questionAnchor, questionCode } from "@/components/consensus/question-code"
import { SLIDE } from "@/lib/motion"
import { cn } from "@/lib/utils"
import type { SurveyAbout } from "@/lib/consensus/about"
import type { Taken } from "@/lib/consensus/taken"
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
// moves it on to the next question still unanswered. An answered card leaves
// on its own (Brendan, 2026-10-31; before, a row waited for both its cards): a
// beat to see the pick, a fade, and the cards after it each move up one place
// in reading order, the second column's into the first and the next row's
// first up into the second column, with the slide's timing (lib/motion.ts).
// Once every card has gone, the survey's results open in its place, under a
// switch between two rules for consensus (lib/consensus/data.ts): Trinity's
// (only the questions consensus emerged on, each beside the reader's own
// answer) and the nysgpt walkthrough's (every question, those every group
// agrees on first, each group's agreement in ten). Voting is local here,
// against the published conversations.
//
// No one takes a survey twice (Brendan, 2026-11-02): a signed-in reader's
// answers are kept once the last question has one (lib/consensus/taken.ts),
// and from then on the survey opens on their results (SurveyResults) in place
// of the cards, with no Review my answers.

type Answer = "agree" | "disagree" | "pass"

// An answered card: a beat to see the pick, then its fade.
const BEAT_MS = 350
const FADE_MS = 200

const CHOICES: { value: Answer; label: string; icon: React.ReactNode }[] = [
  { value: "agree", label: "Agree", icon: <Check className="size-4" /> },
  { value: "disagree", label: "Disagree", icon: <X className="size-4" /> },
  { value: "pass", label: "Pass", icon: <Minus className="size-4" /> },
]

/** `survey` is the conversation's place in the directory, 1 up: the first part of every card's code. `taken` is
 *  the reader's kept answers, when they have taken it; `keep`, that the reader is signed in and their answers are
 *  kept once the last question has one. */
export function Survey({ conversation, survey, taken = null, keep = false, about, state }: { conversation: Conversation; survey: number; taken?: Taken | null; keep?: boolean; about?: SurveyAbout; /** Its lifecycle state (lib/lifecycle), on its head. */ state?: LifeState }) {
  // 1 accepted, 0 unreviewed, -1 pulled.
  const queue = React.useMemo(() => asked(conversation), [conversation])
  const [answers, setAnswers] = React.useState<Record<number, Answer>>({})
  const [salient, setSalient] = React.useState<Set<number>>(new Set())
  const [written, setWritten] = React.useState("")
  const [submitted, setSubmitted] = React.useState<string[]>([])
  const voted = queue.filter((s) => answers[s.tid]).length
  // The card in focus, by statement: the one tabbed into or pressed, until an answer moves it on.
  const [active, setActive] = React.useState<number | null>(null)
  // An answer, then the blue rule on the earliest question still unanswered: the next one when they are
  // taken in order, and one skipped in the row when they are not.
  // Cards fading out, and cards gone; reviewing, every card stays to change an answer.
  const [leaving, setLeaving] = React.useState<Set<number>>(new Set())
  const [gone, setGone] = React.useState<Set<number>>(new Set())
  const [review, setReview] = React.useState(false)
  const timers = React.useRef(new Map<number, number>())
  const cards = React.useRef(new Map<number, HTMLElement>())
  // Where each card stood before one left, for the move into its new place.
  const before = React.useRef<Map<number, DOMRect> | null>(null)
  const answer = (tid: number, a: Answer) => {
    const next = { ...answers, [tid]: a }
    setAnswers(next)
    setActive(queue.find((st) => !next[st.tid])?.tid ?? null)
    if (review || timers.current.has(tid)) return
    // A beat to see the pick, then the fade, then the card goes and the rest move up.
    timers.current.set(
      tid,
      window.setTimeout(() => {
        setLeaving((prev) => new Set(prev).add(tid))
        timers.current.set(
          tid,
          window.setTimeout(() => {
            timers.current.delete(tid)
            before.current = new Map([...cards.current].map(([id, el]) => [id, el.getBoundingClientRect()]))
            setLeaving((prev) => {
              const left = new Set(prev)
              left.delete(tid)
              return left
            })
            setGone((prev) => new Set(prev).add(tid))
          }, FADE_MS)
        )
      }, BEAT_MS)
    )
  }
  // FLIP: each card that moved starts where it stood and slides to its new place.
  React.useLayoutEffect(() => {
    const was = before.current
    before.current = null
    if (!was || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    for (const [id, el] of cards.current) {
      const from = was.get(id)
      if (!from) continue
      const to = el.getBoundingClientRect()
      const dx = from.left - to.left
      const dy = from.top - to.top
      if (dx || dy) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }], { duration: 300, easing: "ease-in-out" })
    }
  }, [gone])
  React.useEffect(() => {
    const t = timers.current
    return () => t.forEach((id) => window.clearTimeout(id))
  }, [])
  // The results open once the last card has gone, and stay, under the cards, while answers are reviewed.
  const answered = queue.length > 0 && queue.every((st) => answers[st.tid])
  const done = answered && (review || gone.size === queue.length)
  const [rule, setRule] = useRule()

  // The answers kept once the last question has one; a reader who had already taken it gets their first
  // answers back from the server. Should keeping fail, the survey ends as it does for a signed-out reader.
  const [failed, setFailed] = React.useState(false)
  const sent = React.useRef(false)
  React.useEffect(() => {
    if (!keep || !answered || review || sent.current) return
    sent.current = true
    fetch(`/api/consensus/${encodeURIComponent(conversation.slug)}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers, salient: [...salient] }),
    })
      .then((r) => {
        if (r.status === 409) window.location.reload()
        else if (r.status !== 201) setFailed(true)
      })
      .catch(() => setFailed(true))
  }, [keep, answered, review, answers, salient, conversation.slug])

  if (taken) return <SurveyResults conversation={conversation} survey={survey} answers={taken.answers} completedAt={taken.completedAt} />

  // Begin: Question 1's card into view, its first answer in focus (the focus also gives it the blue rule).
  const begin = () => {
    const first = queue.find((st) => !gone.has(st.tid))
    const el = first && cards.current.get(first.tid)
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "start" })
    el.querySelector<HTMLButtonElement>("button[aria-pressed]")?.focus({ preventScroll: true })
  }

  return (
    <div className="space-y-6">
      {/* The survey's head on its own page (Brendan, 2026-11-02): the PAX Series card, holding its title, its author and
          what it is for, Begin at its foot. */}
      {about && (
        <SeriesCard m={{ name: conversation.title, tagline: about.author }} anchor={`about-${conversation.slug}`} copy={[conversation.title, about.author, about.about].join("\n")} badge={state && <LifeChip state={state} />}>
          <Passage>
            <p>{about.about}</p>
            <button type="button" onClick={begin} className={cn(PRIMARY, "mt-4")}>
              Begin
            </button>
          </Passage>
        </SeriesCard>
      )}
      <div className="space-y-2">
        <div className={cn("flex items-baseline gap-4", about ? "justify-end" : "justify-between")}>
          {!about && (
            <p className="text-sm font-semibold text-slate-900">
              {conversation.title}
              {conversation.topic && <span className="font-normal text-slate-500"> · {conversation.topic}</span>}
            </p>
          )}
          <span className="text-[13px] text-slate-500 tabular-nums">
            {voted} of {queue.length} answered
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-pax2-blue transition-[width] duration-300" style={{ width: `${(voted / Math.max(1, queue.length)) * 100}%` }} />
        </div>
      </div>

      <div className="grid items-stretch gap-5 md:grid-cols-2">
        {queue
          .filter((statement) => !gone.has(statement.tid))
          .map((statement) => {
            const n = queue.indexOf(statement) + 1
            return (
              <div
                key={statement.tid}
                ref={(el) => {
                  if (el) cards.current.set(statement.tid, el)
                  else cards.current.delete(statement.tid)
                }}
                className={cn("h-full transition-opacity duration-200 ease-out", leaving.has(statement.tid) && "pointer-events-none opacity-0")}
                onPointerDownCapture={() => setActive(statement.tid)}
                onFocusCapture={() => setActive(statement.tid)}
              >
                <Card
                  n={n}
                  title={conversation.title}
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

      {done && keep && !failed && (
        <Unfold>
          <SurveyResults conversation={conversation} survey={survey} answers={answers} />
        </Unfold>
      )}

      {done && (!keep || failed) && (
        <Unfold>
          <Emerged
            conversation={conversation}
            survey={survey}
            queue={queue}
            answers={answers}
            rule={rule}
            onRule={setRule}
            onReview={
              review
                ? undefined
                : () => {
                    setReview(true)
                    setGone(new Set())
                  }
            }
          />
        </Unfold>
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

const ANSWER_LABEL: Record<Answer, string> = { agree: "Agree", disagree: "Disagree", pass: "Pass" }

/** The survey's results at its end: only the questions consensus emerged on, strongest first, each with
 *  the reader's own answer beside the room's; or, where none did, a line that says so. */
function Emerged({
  conversation,
  survey,
  queue,
  answers,
  rule,
  onRule,
  onReview,
}: {
  conversation: Conversation
  survey: number
  queue: Statement[]
  answers: Record<number, Answer>
  rule: ConsensusRule
  onRule: (r: ConsensusRule) => void
  onReview?: () => void
}) {
  const emerged = emergedStatements(conversation).filter((s) => queue.includes(s))
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-base font-semibold text-slate-900">Where consensus emerged</h3>
        <div className="flex items-center gap-3">
          {/* The two rules, to road-test one after the other (Brendan, 2026-10-31); the pick is kept in this browser. */}
          <span title={rule === "trinity" ? "Most of the room on one side, and no opinion group's majority on the other" : `Every opinion group agreeing at ${WALKTHROUGH_BAR}% or more: the least agreeable group decides`}>
            <ViewToggle
              views={[
                { value: "trinity" as const, label: "Trinity" },
                { value: "walkthrough" as const, label: "Walkthrough" },
              ]}
              value={rule}
              onChange={onRule}
            />
          </span>
          {onReview && (
            <button type="button" onClick={onReview} className={SMALL}>
              Review my answers
            </button>
          )}
        </div>
      </div>
      {rule === "walkthrough" ? (
        <Walkthrough conversation={conversation} survey={survey} queue={queue} answers={answers} />
      ) : emerged.length ? (
        emerged.map((s) => {
          const n = queue.indexOf(s) + 1
          const mine = answers[s.tid]
          return <StatementCard key={s.tid} statement={s} conversation={conversation} number={n} code={questionCode(survey, n)} side={consensusOn(s) ?? undefined} yours={mine ? ANSWER_LABEL[mine] : undefined} />
        })
      ) : (
        <Block title="No consensus emerged">
          <p className="px-4 py-3.5 text-sm text-slate-700 sm:px-5">On every question, most of the room was not on one side, or an opinion group&apos;s majority stood on the other.</p>
        </Block>
      )}
    </section>
  )
}

/** The nysgpt walkthrough's results (its app/illustrations/Consensus.tsx), on this survey's votes: every question,
 *  those every group agrees on first (in the order they were asked), each marked as the walkthrough marks them
 *  and showing each group's agreement as ten people, filled for each who agrees. Within each, the questions
 *  where the reader stood with the consensus come first (Brendan, 2026-11-02): with every group, agreeing; with
 *  the rest, on most of the room's side. */
function Walkthrough({ conversation, survey, queue, answers }: { conversation: Conversation; survey: number; queue: Statement[]; answers: Record<number, Answer> }) {
  const rank = (s: Statement) => {
    const mine = answers[s.tid]
    return everyGroupAgrees(s) ? (mine === "agree" ? 0 : 1) : mine && mine === roomSide(s) ? 2 : 3
  }
  const record = [...queue].sort((a, b) => rank(a) - rank(b) || queue.indexOf(a) - queue.indexOf(b))
  const agreed = queue.filter(everyGroupAgrees).length
  const groups = conversation.groups
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Every group agrees on {agreed} of {queue.length}.
      </p>
      {record.map((s) => {
        const n = queue.indexOf(s) + 1
        const all = everyGroupAgrees(s)
        const mine = answers[s.tid]
        return (
          <Block key={s.tid} id={questionAnchor("result", questionCode(survey, n), s.tid)} title={<span className="font-medium">{`Question ${n}`}</span>} badge={<Badge tone={all ? "blue" : "slate"}>{all ? (groups.length === 2 ? "Both agree" : "Every group agrees") : "Split"}</Badge>} action={<QuestionMenu n={n} title={conversation.title} code={questionCode(survey, n)} text={s.text} anchor={questionAnchor("result", questionCode(survey, n), s.tid)} />}>
            <div className="flex flex-col gap-4 px-4 py-5 sm:px-5">
              <p className={cn("text-[17px] leading-snug", all ? "text-slate-900" : "text-slate-500")}>{s.text}</p>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {groups.map((g, i) => {
                  const t = s.byGroup[String(g.id)]
                  const inTen = t && t.seen ? Math.round(share(t).agree / 10) : null
                  return <Ten key={g.id} name={`Group ${String.fromCharCode(65 + g.id)}`} tone={i} agree={inTen} />
                })}
              </div>
            </div>
            {mine && (
              <Fact label="Your answer">
                {ANSWER_LABEL[mine]}
                {mine !== "pass" && roomSide(s) && <span className="text-slate-400">{mine === roomSide(s) ? " · with most of the room" : " · against most of the room"}</span>}
              </Fact>
            )}
            <p className="px-4 py-3 text-[13px] text-slate-500 tabular-nums sm:px-5">{questionCode(survey, n)}</p>
          </Block>
        )
      })}
    </div>
  )
}

const numbered = (ns: number[]) => (ns.length === 1 ? `Question ${ns[0]}` : `Questions ${ns.slice(0, -1).join(", ")} and ${ns[ns.length - 1]}`)

/** A reader's results once they have taken the survey (Brendan, 2026-11-02): the walkthrough's view of every
 *  question, under a PAX Series card that sums up where they stood with the consensus. */
export function SurveyResults({ conversation, survey, answers, completedAt }: { conversation: Conversation; survey: number; answers: Record<number, Answer>; completedAt?: string }) {
  const queue = asked(conversation)
  const n = (s: Statement) => queue.indexOf(s) + 1
  const mine = (s: Statement) => answers[s.tid]
  const voted = queue.filter((s) => mine(s) && mine(s) !== "pass" && roomSide(s))
  const withRoom = voted.filter((s) => mine(s) === roomSide(s))
  const against = voted.filter((s) => mine(s) !== roomSide(s))
  const passed = queue.filter((s) => mine(s) === "pass").length
  const everyGroup = queue.filter(everyGroupAgrees)
  const joined = everyGroup.filter((s) => mine(s) === "agree")
  const when = completedAt ? new Date(completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null
  const counts = [`sided with most of the room on ${withRoom.length} of the ${queue.length} questions`, against.length ? `went against it on ${against.length}` : null, passed ? `passed on ${passed}` : null].filter(Boolean) as string[]
  const tagline = when ? `Answered ${when}` : "Answered just now"
  // The summary's passages, as the card shows them and as its Copy puts them (a label, then its text).
  const summary: [string, string][] = [
    ["", `You ${counts.length > 1 ? `${counts.slice(0, -1).join(", ")} and ${counts[counts.length - 1]}` : counts[0]}.`],
    ...(withRoom.length ? ([["With the room", numbered(withRoom.map(n))]] as [string, string][]) : []),
    ...(against.length ? ([["Against it", numbered(against.map(n))]] as [string, string][]) : []),
    ["Every group agrees", everyGroup.length ? `${numbered(everyGroup.map(n))}; you agreed on ${joined.length} of ${everyGroup.length}.` : `On none of the ${queue.length}: no question reached ${WALKTHROUGH_BAR}% in every opinion group.`],
  ]
  return (
    <div className="space-y-6">
      <SeriesCard m={{ name: conversation.title, tagline: tagline }} anchor={`results-${conversation.slug}`} copy={[conversation.title, tagline, ...summary.map(([label, text]) => (label ? `${label}: ${text}` : text))].join("\n")}>
        {summary.map(([label, text]) => (
          <Passage key={label || "summary"} label={label || undefined}>
            {text}
          </Passage>
        ))}
      </SeriesCard>
      <Walkthrough conversation={conversation} survey={survey} queue={queue} answers={answers} />
    </div>
  )
}

// The walkthrough's group colours: its blue and red, then the theme's further accents.
const GROUP_TONE = ["bg-pax2-blue", "bg-pax2-red", "bg-amber-500", "bg-emerald-600", "bg-violet-600"]

/** One group as ten people, filled for each who agrees (the walkthrough's Ten). */
function Ten({ name, tone, agree }: { name: string; tone: number; agree: number | null }) {
  return (
    <span className="flex items-center gap-2 text-xs text-slate-500">
      <span className="w-14 shrink-0 font-medium text-slate-700">{name}</span>
      <span className="flex gap-0.5" role="img" aria-label={agree == null ? `${name}: too few votes` : `${agree} in 10 of ${name} agree`}>
        {Array.from({ length: 10 }, (_, k) => (
          <span key={k} className={cn("size-2 rounded-full border border-slate-300", agree != null && k < agree && cn(GROUP_TONE[tone % GROUP_TONE.length], "border-transparent"))} />
        ))}
      </span>
      <span className="tabular-nums">{agree == null ? "—" : `${agree} in 10`}</span>
    </span>
  )
}

const RULE_KEY = "consensus:rule"
/** The results' rule, kept in this browser so a reload keeps the one being tested. */
function useRule() {
  const [rule, setRule] = React.useState<ConsensusRule>("trinity")
  React.useEffect(() => {
    if (localStorage.getItem(RULE_KEY) === "walkthrough") setRule("walkthrough")
  }, [])
  const set = (r: ConsensusRule) => {
    setRule(r)
    try {
      localStorage.setItem(RULE_KEY, r)
    } catch {}
  }
  return [rule, set] as const
}

/** Opens its content with the slide, forwards: from no height to its own, fading in. */
function Unfold({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => {
    let second = 0
    // Two frames, so the closed state is painted before the open one is set.
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setOpen(true))
    })
    return () => {
      cancelAnimationFrame(first)
      cancelAnimationFrame(second)
    }
  }, [])
  return (
    <div className={cn("grid transition-[grid-template-rows,opacity]", SLIDE, open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
      <div className="-mx-2 min-h-0 overflow-hidden px-2 pb-1">{children}</div>
    </div>
  )
}

/** One question as a block: Question and its number on the frame; inside, the statement, the three
 *  answers (the picked one filled) and the mark that it matters, then the question's code. */
function Card({ n, title, code, statement, selected, answer, onAnswer, salient, onSalient }: { n: number; title: string; code: string; statement: Statement; selected: boolean; answer?: Answer; onAnswer: (a: Answer) => void; salient: boolean; onSalient: () => void }) {
  return (
    <Block stretch id={questionAnchor("question", code, statement.tid)} selected={selected} title={<span className="font-medium">Question {n}</span>} action={<QuestionMenu n={n} title={title} code={code} text={statement.text} anchor={questionAnchor("question", code, statement.tid)} />}>
      <div className="flex flex-1 flex-col gap-6 px-4 py-5 sm:px-5">
        <p className="text-[17px] leading-snug text-slate-900">{statement.text}</p>
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
                  on ? "border-pax2-blue bg-pax2-blue text-white" : "border-slate-300 bg-pax2-surface text-slate-700 hover:border-pax2-blue hover:text-pax2-blue"
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
