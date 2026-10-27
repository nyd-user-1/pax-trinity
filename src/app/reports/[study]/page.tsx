import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PAPER_BRIDGE } from "@/components/editorial/PaperBridge"
import { ReportDoc } from "@/components/report/report-doc"

import { studies, studyBySlug } from "../data"
import "../../paper.css"
import "../report.css"

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
    <div className="nysgpt-app relative min-h-0 flex-1 overflow-y-auto" style={{ backgroundColor: "var(--paper)", ...PAPER_BRIDGE }}>
      <ReportDoc name={s.name} waves={s.waves} />
    </div>
  )
}
