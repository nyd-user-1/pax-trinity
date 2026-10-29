"use client"

import { useRouter } from "next/navigation"
import { ListChecks } from "lucide-react"

import { leaveDraft } from "@/lib/agents/pending-draft"
import { SURVEYS } from "@/lib/surveys/catalog"
import { Button } from "@/ui/components/nova/button"

// Make question card (Brendan, 2026-10-29): Consensus is the question writer.
// The card puts the bank's normed items (the Open primaries survey's America
// Thinks questions) beside the statements every group shared and the ones that
// split them, as agree/disagree items, and hands it to the Inbox as a New test
// addressed to the Pollster.
export function MakeQuestionCard({ title, voters, groups, shared, split }: { title: string; voters: string; groups: number; shared: string[]; split: string[] }) {
  const router = useRouter()
  const make = () => {
    const bank = SURVEYS[0]?.questions ?? []
    const items = [
      ...bank.map((q) => `${q.text} (${q.options.join(" / ")})`),
      ...[...shared.slice(0, 2), ...split.slice(0, 2)].map((text) => `${text} (Agree / Disagree)`),
    ]
    const body = [
      `**Question card: ${title}**`,
      `From Consensus (${voters} participants, ${groups} opinion groups) and the America Thinks bank. The first ${bank.length} carry their norms; the rest are the shared ground and the divides.`,
      items.map((item, i) => `${i + 1}. ${item}`).join("\n"),
      "**Clips:** ",
      "**Group:** Open primaries conversation",
      "**Quota:** 1,200 completes, at least 150 per arm, randomized to a cut or the placebo on arrival",
      "**Close by:** ",
    ].join("\n\n")
    leaveDraft({ to: ["tracker"], subject: `New test: ${title}`, body })
    router.push("/inbox")
  }
  return (
    <Button size="sm" onClick={make} className="shrink-0 gap-1.5">
      <ListChecks className="size-4" />
      Make question card
    </Button>
  )
}
