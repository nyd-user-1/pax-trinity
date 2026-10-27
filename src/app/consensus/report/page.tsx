import { redirect } from "next/navigation"

// /consensus/report became the Results tab on /consensus (2026-10-27); the proxy answers first.
export default async function ConsensusReportPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams
  redirect(`/consensus?tab=results${c ? `&c=${encodeURIComponent(c)}` : ""}`)
}
