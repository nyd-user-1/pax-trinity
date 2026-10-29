import type { Metadata } from "next"

import { MethodologyPage } from "@/components/report/report-pages"

import "../../paper.css"
import "../report.css"

export const metadata: Metadata = { title: "Methodology · Reports" }

// /reports/methodology — how every report is made: the design, the lift, the criterion, the weighting,
// the subgroups and each report's source (src/components/report/report-pages.tsx).
export default function ReportsMethodologyRoute() {
  return (
    // No overflow of its own, so the contents column sticks to the shell's scrolling main.
    <div className="nysgpt-app report-pax relative min-h-0 flex-1" style={{ backgroundColor: "var(--paper)" }}>
      <MethodologyPage />
    </div>
  )
}
