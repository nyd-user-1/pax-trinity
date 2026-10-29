import { redirect } from "next/navigation"

// /reports/[study] — gone (Brendan, 2026-10-29): /reports carries the study's cover and every report as
// a card, so a study's own address returns there.
export default function StudyReportPage() {
  redirect("/reports")
}
