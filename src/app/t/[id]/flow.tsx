"use client"

import * as React from "react"

import { PUBLISHED } from "@/components/clips/store"
import { PLACEBO_SRC, TEST, type Arm, type Choice } from "@/lib/tests/open-primaries"
import { Button } from "@govblock/ui/components/nova/button"
import { cn } from "@govblock/ui/lib/utils"
import { ArrowLeft } from "lucide-react"

// The consensus survey's card pattern (src/components/consensus/survey.tsx):
// the framing read once on the way in, one card at a time advancing on the
// answer, back but never forward, a thin rule for progress.

// Five entry questions, then the video, the explanation, the ballot and the
// comprehension question.
const STEPS = TEST.entry.length + 4
const VIDEO = TEST.entry.length
const EXPLANATION = VIDEO + 1
const BALLOT = EXPLANATION + 1
const COMPREHENSION = BALLOT + 1

export function Flow({ arm }: { arm: Arm }) {
  const src = arm === "placebo" ? PLACEBO_SRC : (PUBLISHED.find((c) => c.id === arm)?.src ?? PLACEBO_SRC)
  const [entered, setEntered] = React.useState(false)
  const [at, setAt] = React.useState(0)
  const [answers, setAnswers] = React.useState<Record<string, string>>({})
  const [watched, setWatched] = React.useState(0)
  const [code, setCode] = React.useState<string | null>(null)
  const startedAt = React.useRef(new Date().toISOString())
  const videoRef = React.useRef<HTMLVideoElement>(null)

  // Scrubbing earns no credit: the played ranges are summed, so only time the
  // video actually ran counts toward the unlock.
  const onTime = () => {
    const v = videoRef.current
    if (!v || !v.duration) return
    let played = 0
    for (let i = 0; i < v.played.length; i++) played += v.played.end(i) - v.played.start(i)
    // Once earned, the unlock stays earned: a revisit to this card remounts the
    // element and resets its played ranges, which must not re-lock Continue.
    setWatched((w) => Math.max(w, played / v.duration))
  }

  const answer = (key: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [key]: value }))
    setAt((n) => n + 1)
  }

  const finish = (comprehension: string) => {
    const record = {
      test: TEST.id,
      arm,
      src,
      startedAt: startedAt.current,
      completedAt: new Date().toISOString(),
      answers: { ...answers, comprehension },
      comprehensionCorrect: comprehension === TEST.comprehension.correct,
      watched: Math.round(watched * 100) / 100,
      code: crypto.randomUUID().slice(0, 8).toUpperCase(),
    }
    // The response stays in the browser for now: one object, kept in
    // sessionStorage and logged. TODO: POST this same object to a collector
    // route (/api/tests/[id]/responses) when one exists — this is the seam.
    sessionStorage.setItem(`pax:test:${TEST.id}`, JSON.stringify(record))
    console.log("message-test response", record)
    setCode(record.code)
    setAt((n) => n + 1)
  }

  if (!entered)
    return (
      <main className="min-h-dvh bg-white">
        <div className="mx-auto flex min-h-dvh w-full max-w-[773px] flex-col justify-center px-6 py-10">
          <div className="flex flex-col gap-5 rounded-xl border border-slate-200 p-8">
            <h1 className="text-2xl font-semibold tracking-tight text-pax2-blue">{TEST.title}</h1>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-slate-500">
              <li>I ask five quick questions about you.</li>
              <li>I play one short video. Watch it through.</li>
              <li>I ask how you would vote on a ballot measure, then one question about it.</li>
              <li>Your completion code is on the last screen.</li>
            </ul>
            <Button onClick={() => setEntered(true)} className="self-start">
              Start
            </Button>
          </div>
        </div>
      </main>
    )

  const question =
    at < VIDEO ? TEST.entry[at] : at === BALLOT ? { key: "ballot", ...TEST.ballot } : at === COMPREHENSION ? { key: "comprehension", ...TEST.comprehension } : null

  return (
    <main className="min-h-dvh bg-white">
      <div className="mx-auto flex w-full max-w-[773px] flex-col gap-6 px-6 py-10">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{TEST.title}</span>
          {at < STEPS && (
            <span className="flex items-center gap-2 tabular-nums">
              {/* Back, never forward: a card can be revisited, not skipped ahead of. */}
              <button
                type="button"
                onClick={() => setAt((n) => Math.max(0, n - 1))}
                disabled={at === 0}
                aria-label="Back one card"
                className="inline-flex size-6 items-center justify-center rounded-md transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <ArrowLeft className="size-3.5" />
              </button>
              {Math.min(at + 1, STEPS)} of {STEPS}
            </span>
          )}
        </div>

        <div className="h-0.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-pax2-blue transition-[width] duration-300"
            style={{ width: `${(Math.min(at, STEPS) / STEPS) * 100}%` }}
          />
        </div>

        {question ? (
          <section className="flex flex-col gap-6 rounded-xl border border-slate-200 p-6">
            <p className="text-lg leading-7 font-medium text-balance text-slate-900">{question.prompt}</p>
            <div className="flex flex-col gap-2">
              {question.choices.map((choice: Choice) => (
                <Button
                  key={choice.value}
                  variant="secondary"
                  onClick={() => (at === COMPREHENSION ? finish(choice.value) : answer(question.key, choice.value))}
                  className={cn(
                    "h-auto min-h-11 justify-start whitespace-normal px-4 py-3 text-left",
                    answers[question.key] === choice.value && "ring-2 ring-pax2-blue"
                  )}
                >
                  {choice.label}
                </Button>
              ))}
            </div>
          </section>
        ) : at === VIDEO ? (
          <section className="flex flex-col gap-6 rounded-xl border border-slate-200 p-6">
            <p className="text-lg leading-7 font-medium text-slate-900">Watch this video, then continue.</p>
            <video
              ref={videoRef}
              src={src}
              controls
              playsInline
              preload="auto"
              onTimeUpdate={onTime}
              className="mx-auto max-h-[60dvh] w-full rounded-xl bg-black object-contain"
            />
            <Button onClick={() => setAt((n) => n + 1)} disabled={watched < 0.9} className="self-start">
              {watched < 0.9 ? "Keep watching" : "Continue"}
            </Button>
          </section>
        ) : at === EXPLANATION ? (
          <section className="flex flex-col gap-4 rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">{TEST.explanationTitle}</h2>
            <p className="text-sm leading-6 text-slate-600">{TEST.explanation}</p>
            <Button onClick={() => setAt((n) => n + 1)} className="self-start">
              Continue
            </Button>
          </section>
        ) : (
          <section className="flex flex-col gap-4 rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">That is everything</h2>
            <p className="text-sm text-slate-600">Your completion code — copy it now; I show it only once.</p>
            <p className="font-mono text-3xl tracking-[0.2em] text-pax2-blue">{code}</p>
          </section>
        )}
      </div>
    </main>
  )
}
