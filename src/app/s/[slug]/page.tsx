import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { surveyBySlug, SURVEYS } from "@/lib/surveys/catalog"

import { SurveyForm } from "./survey-form"

// /s/<slug>: the survey's respondent page, the link a survey is shared by: bare,
// outside the shell like a message test's /test/<id>, nothing of the product around it.

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return SURVEYS.map((s) => ({ slug: s.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: surveyBySlug((await params).slug)?.title ?? "Survey" }
}

export default async function RespondPage({ params }: Props) {
  const survey = surveyBySlug((await params).slug)
  if (!survey) notFound()
  return (
    <main className="min-h-dvh bg-white text-slate-900">
      <div className="mx-auto w-full max-w-xl px-5 py-12">
        <SurveyForm survey={survey} />
      </div>
    </main>
  )
}
