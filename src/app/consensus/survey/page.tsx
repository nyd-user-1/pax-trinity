import { redirect } from "next/navigation"

// /consensus/survey became the Questions tab on /consensus (2026-10-27); the proxy answers first.
export default async function ConsensusSurveyPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams
  redirect(`/consensus?tab=questions${c ? `&c=${encodeURIComponent(c)}` : ""}`)
}
