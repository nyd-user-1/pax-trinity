"use client"

import * as React from "react"

import { clearDraft, readDraft, type SurveyDraft } from "@/lib/consensus/draft"
import { Button } from "@govblock/ui/components/nova/button"

// The drafted survey the audience instrument wrote, rendered as the
// questionnaire it is: each question with its answer options under it, held
// here until it is fielded or discarded. Lives in this browser only.

export function DraftCard() {
  const [draft, setDraft] = React.useState<SurveyDraft | null>(null)
  React.useEffect(() => setDraft(readDraft()), [])
  if (!draft) return null
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-pax2-blue/25 bg-pax2-lavender/30 p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight">{draft.title}</h2>
        <span className="text-xs text-muted-foreground">
          {draft.questions.length} {draft.questions.length === 1 ? "question" : "questions"} · held in this browser
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{draft.description}</p>
      <ol className="flex list-decimal flex-col gap-4 pl-5">
        {draft.questions.map((q) => (
          <li key={q.text} className="text-sm font-medium">
            {q.text}
            {q.options.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {q.options.map((option) => (
                  <span key={option} className="rounded-full border border-pax2-blue/20 bg-pax2-surface px-2.5 py-0.5 text-xs font-normal text-slate-600">
                    {option}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => {
          clearDraft()
          setDraft(null)
        }}
      >
        Discard draft
      </Button>
    </section>
  )
}
