import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { Survey } from "@/components/consensus/survey"
import { currentUser } from "@/lib/auth"
import { armForPid } from "@/lib/fielding/engine"
import { conversations } from "@/lib/consensus/store"
import { takenBy } from "@/lib/consensus/taken"
import { surveyBySlug } from "@/lib/surveys/catalog"

import { SurveyForm } from "./survey-form"

// /s/<slug>: the survey's respondent page, the link a survey is shared by, in the shell like every page
// (Brendan, 2026-11-02: no page renders outside it unless he asked).
// Since 2026-11-02 (Brendan) it is the consensus survey itself, its questions as
// the two columns of cards; a signed-in reader who has taken it goes to their
// results at /r/<slug>, since no one takes a survey twice. A Pollster's link,
// which carries a fielding's pid, still answers the topline's own questions
// (lib/surveys/catalog.ts), as the fielding mailed it.

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ pid?: string | string[] }> }

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const slug = (await params).slug
  return { title: (await conversations()).find((c) => c.slug === slug)?.title ?? surveyBySlug(slug)?.title ?? "Survey" }
}

export default async function RespondPage({ params, searchParams }: Props) {
  const slug = (await params).slug
  const raw = (await searchParams).pid
  const pid = typeof raw === "string" && /^[0-9a-z-]{8,64}$/.test(raw) ? raw : null
  const topline = surveyBySlug(slug)
  const all = pid && topline ? [] : await conversations()
  const at = all.findIndex((c) => c.slug === slug)
  const open = all[at]

  if (!open) {
    if (!topline) notFound()
    // A Pollster's link carries a fielding's pid: the open is recorded, and the pid rides with the answers.
    const fielding = pid ? await armForPid(pid).catch(() => null) : null
    return (
      <div className="mx-auto w-full max-w-xl text-slate-900">
        {fielding?.closed ? (
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-8">
            <h1 className="text-2xl font-semibold tracking-tight text-pax2-blue">{topline.title}</h1>
            <p className="text-sm text-slate-600">This survey is closed.</p>
          </div>
        ) : (
          <SurveyForm survey={topline} pid={pid} />
        )}
      </div>
    )
  }

  const user = await currentUser()
  if (user && (await takenBy(slug, user.email))) redirect(`/r/${encodeURIComponent(slug)}`)
  return (
    <div className="mx-auto w-full max-w-[920px] text-slate-900" data-not-typeset="true">
      <Survey conversation={open} survey={at + 1} keep={!!user} />
    </div>
  )
}
