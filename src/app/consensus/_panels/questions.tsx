import { Survey } from "@/components/consensus/survey"
import { type Conversation } from "@/lib/consensus/data"
import type { Taken } from "@/lib/consensus/taken"
import type { LifeState } from "@/lib/lifecycle/rules"

// The Questions tab — where a conversation is voted on: one statement at a
// time, agree, disagree or pass. Passing is a real answer. It is the survey
// itself (Brendan, 2026-11-02), as /s/<slug> is: a reader who has taken it
// sees their results here instead.
export function QuestionsPanel({ conversation, survey, taken, keep, state }: { conversation: Conversation; survey: number; taken: Taken | null; keep: boolean; state?: LifeState }) {
  return (
    <div data-not-typeset="true">
      <Survey conversation={conversation} survey={survey} taken={taken} keep={keep} state={state} />
    </div>
  )
}
