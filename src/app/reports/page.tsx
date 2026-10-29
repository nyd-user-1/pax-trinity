import type { Metadata } from "next"

import { ReportCardLink, reportCards, ReportsCover } from "@/components/report/report-pages"

import "../paper.css"
import "./report.css"

export const metadata: Metadata = { title: "Reports" }

// /reports — the study's cover, then every report as a card (Brendan, 2026-10-29): a study of several
// waves, its executive summary and each wave; a study of one wave, that wave.
export default function ReportsPage() {
  const cards = reportCards()
  return (
    <div className="nysgpt-app report-pax relative min-h-0 flex-1 overflow-y-auto" style={{ backgroundColor: "var(--paper)" }}>
      <div className="report-doc mx-auto w-full max-w-[1120px] px-6 py-10 text-[var(--paper-text)] sm:px-10">
        <ReportsCover />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-reports={cards.length}>
          {cards.map((c) => (
            <ReportCardLink key={c.href} card={c} />
          ))}
          {cards.length === 0 && <p className="text-[14px] text-[var(--paper-muted)]">No result sets yet.</p>}
        </div>
      </div>
    </div>
  )
}
