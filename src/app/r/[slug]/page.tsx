import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { SurveyResults } from "@/components/consensus/survey"
import { currentUser } from "@/lib/auth"
import { lensOf, seesConversation } from "@/lib/partners/sponsors"
import { conversations } from "@/lib/consensus/store"
import { takenBy } from "@/lib/consensus/taken"

// /r/<slug>: a reader's results on a consensus survey they have taken (Brendan, 2026-11-02), in the shell:
// the PAX Series card summing up where they stood with the consensus, then every question in the nysgpt
// walkthrough's view. A reader who hasn't taken it goes to the survey; a signed-out one, to sign in.

type Props = { params: Promise<{ slug: string }> }

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug
  const title = (await conversations()).find((c) => c.slug === slug)?.title
  return { title: title ? `${title}: your results` : "Results" }
}

export default async function ResultsPage({ params }: Props) {
  const slug = (await params).slug
  const all = await conversations()
  const at = all.findIndex((c) => c.slug === slug)
  if (at < 0) notFound()
  const user = await currentUser()
  if (!user) redirect(`/signin?next=${encodeURIComponent(`/r/${slug}`)}`)
  // A partner's lens: its own sponsor's surveys alone.
  if (!seesConversation(lensOf(user), slug)) notFound()
  const taken = await takenBy(slug, user.email)
  if (!taken) redirect(`/s/${encodeURIComponent(slug)}`)
  return (
    <div className="mx-auto w-full max-w-[920px] text-slate-900" data-not-typeset="true">
      <SurveyResults conversation={all[at]} survey={at + 1} answers={taken.answers} completedAt={taken.completedAt} />
    </div>
  )
}
