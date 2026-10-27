import { redirect } from "next/navigation"

// /consensus/admin became the Admin tab on /consensus (2026-10-27); the proxy answers first.
export default async function ConsensusAdminPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams
  redirect(`/consensus?tab=admin${c ? `&c=${encodeURIComponent(c)}` : ""}`)
}
