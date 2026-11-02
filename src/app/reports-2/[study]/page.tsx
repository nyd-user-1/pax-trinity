import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PAPER_BRIDGE } from "@/components/editorial/PaperBridge"
import { ReportDoc2 } from "@/components/report-2/report-doc-2"

import { readerLens, studies, studyBySlug } from "../../reports/data"
import "../../paper.css"
import "../../reports/report.css"
import "../report-2.css"

type Params = { params: Promise<{ study: string }> }

// Read per request: a partner's lens finds its own sponsor's studies alone, and another's answers not found.
export const dynamic = "force-dynamic"

export function generateStaticParams() {
  return studies().map((s) => ({ study: s.slug }))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { study } = await params
  return { title: studyBySlug(study, await readerLens())?.name ?? "Report" }
}

export default async function StudyReport2Page({ params }: Params) {
  const { study } = await params
  const s = studyBySlug(study, await readerLens())
  if (!s) notFound()
  return (
    // No overflow of its own: the shell's main scrolls, so the contents rail can stick to it.
    <div className="nysgpt-app report-pax relative min-h-0 flex-1" style={{ backgroundColor: "var(--paper)", ...PAPER_BRIDGE }}>
      <ReportDoc2 name={s.name} waves={s.waves} />
    </div>
  )
}
