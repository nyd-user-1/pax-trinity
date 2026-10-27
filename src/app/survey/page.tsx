import type { Metadata } from "next"

import { conversations } from "@/lib/consensus/store"

import { SurveyInbox } from "./survey-inbox"

export const metadata: Metadata = { title: "Survey", description: "The consensus surveys on the audience anatomy: a survey's questions as cards, each one's results beside them." }

// /survey — consensus on the inbox pattern (Brendan, 2026-10-27: the gmail
// pattern mapped onto surveys). The server reads the conversations and hands
// the client the list and the open one alone (?c=, the first by default), so
// a large room's statements travel only when it is opened.
export default async function SurveyPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c: slug } = await searchParams
  const all = await conversations()
  const open = all.find((c) => c.slug === slug) ?? all[0] ?? null
  return <SurveyInbox surveys={all.map((c) => ({ slug: c.slug, title: c.title, statements: c.statements.length }))} open={open} />
}
