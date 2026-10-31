"use client"

import * as React from "react"

import type { Survey } from "@/lib/surveys/catalog"
import { cn } from "@/lib/utils"

// The respondent's form: every question, one answer each, sent once.
export function SurveyForm({ survey, pid = null }: { survey: Survey; pid?: string | null }) {
  const [startedAt] = React.useState(() => new Date().toISOString())
  const [answers, setAnswers] = React.useState<Record<string, string>>({})
  const [state, setState] = React.useState<"open" | "sending" | "done" | "failed">("open")
  const complete = survey.questions.every((q) => answers[q.id])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!complete || state === "sending") return
    setState("sending")
    try {
      const r = await fetch(`/api/surveys/${encodeURIComponent(survey.slug)}/responses`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(pid ? { answers, startedAt, pid } : { answers, startedAt }) })
      setState(r.ok ? "done" : "failed")
    } catch {
      setState("failed")
    }
  }

  if (state === "done")
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Thank you</h1>
        <p className="mt-2 text-slate-600">I have your answers.</p>
      </div>
    )

  return (
    <form onSubmit={submit}>
      <h1 className="text-3xl font-semibold tracking-tight">{survey.title}</h1>
      <div className="mt-8 flex flex-col gap-8">
        {survey.questions.map((q, i) => (
          <fieldset key={q.id} data-question={q.id}>
            <legend className="text-[16px] leading-snug font-semibold">
              <span className="mr-1.5 tabular-nums">{i + 1}.</span>
              {q.text}
            </legend>
            <div className="mt-3 flex flex-col gap-2">
              {q.options.map((o) => {
                const on = answers[q.id] === o
                return (
                  <label key={o} className={cn("flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-[15px] transition-colors", on ? "border-slate-900 bg-slate-50 font-medium" : "border-slate-200 hover:bg-slate-50")}>
                    <input type="radio" name={q.id} value={o} checked={on} onChange={() => setAnswers((a) => ({ ...a, [q.id]: o }))} className="size-4 accent-slate-900" />
                    {o}
                  </label>
                )
              })}
            </div>
          </fieldset>
        ))}
      </div>
      {state === "failed" && <p className="mt-6 text-sm text-red-600">I couldn&apos;t record your answers. Please try again.</p>}
      <button type="submit" disabled={!complete || state === "sending"} className="mt-8 h-11 w-full rounded-full bg-night-900 text-[15px] font-semibold text-white transition-opacity disabled:opacity-40">
        {state === "sending" ? "Sending" : "Submit"}
      </button>
    </form>
  )
}
