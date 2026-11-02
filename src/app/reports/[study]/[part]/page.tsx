import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { studyParts } from "@/components/report/report-doc"
import { partSlugs, ReportPartPage } from "@/components/report/report-pages"

import { readerLens, studies, studyBySlug } from "../../data"
import "../../../paper.css"
import "../../report.css"

// /reports/[study]/[part] — one page of a study's readout: summary, wave-1, wave-2…

type Params = { params: Promise<{ study: string; part: string }> }

// Read per request: a partner's lens finds its own sponsor's studies alone, and another's answers not found.
export const dynamic = "force-dynamic"

export function generateStaticParams() {
  return studies().flatMap((s) => partSlugs(s).map((part) => ({ study: s.slug, part })))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { study, part } = await params
  const s = studyBySlug(study, await readerLens())
  const p = s && studyParts(s.waves).find((x) => x.slug === part)
  return { title: s && p ? `${p.kicker} · ${s.name}` : "Report" }
}

export default async function ReportPartRoute({ params }: Params) {
  const { study, part } = await params
  const s = studyBySlug(study, await readerLens())
  if (!s || !partSlugs(s).includes(part)) notFound()
  return (
    // No overflow of its own, so the contents column sticks to the shell's scrolling main (as Report 2's does).
    <div className="nysgpt-app report-pax relative min-h-0 flex-1" style={{ backgroundColor: "var(--paper)" }}>
      <ReportPartPage study={s} slug={part} />
    </div>
  )
}
