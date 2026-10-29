import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PAPER_BRIDGE } from "@/components/editorial/PaperBridge"
import { StudyLanding } from "@/components/report/report-pages"

import { studies, studyBySlug } from "../data"
import "../../paper.css"
import "../report.css"

// /reports/[study] — the study's cover and a card per page of its readout: the executive summary
// and each wave (src/components/report/report-pages.tsx).

type Params = { params: Promise<{ study: string }> }

export function generateStaticParams() {
  return studies().map((s) => ({ study: s.slug }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { study } = await params
  return { title: studyBySlug(study)?.name ?? "Report" }
}

export default async function StudyReportPage({ params }: Params) {
  const { study } = await params
  const s = studyBySlug(study)
  if (!s) notFound()
  return (
    <div className="nysgpt-app report-pax relative min-h-0 flex-1 overflow-y-auto" style={{ backgroundColor: "var(--paper)", ...PAPER_BRIDGE }}>
      <StudyLanding study={s} />
    </div>
  )
}
