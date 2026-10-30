import { Survey } from "@/components/consensus/survey"
import { type Conversation } from "@/lib/consensus/data"

// The Questions tab — where a conversation is voted on: one statement at a
// time, agree, disagree or pass. Passing is a real answer.
export function QuestionsPanel({ conversation, survey }: { conversation: Conversation; survey: number }) {
  return (
    <div data-not-typeset="true">
      <Survey conversation={conversation} survey={survey} />
    </div>
  )
}
