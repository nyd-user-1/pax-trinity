import type { Metadata } from "next"
import Link from "next/link"

import { PAPER_BRIDGE } from "@/components/editorial/PaperBridge"
import { WaveChip } from "@/components/report/report-bits"
import { count, dateRange, wavesLine } from "@/components/report/report-math"
import { armsLine } from "@/components/report/sections"

import { studies } from "../reports/data"
import "../paper.css"
import "../reports/report.css"

export const metadata: Metadata = { title: "Report 2" }

// /reports-2 — the /reports cards, each opening its study section-first.
export default function ReportsPage() {
  const all = studies()
  return (
    <div className="nysgpt-app relative min-h-0 flex-1 overflow-y-auto" style={{ backgroundColor: "var(--paper)", ...PAPER_BRIDGE }}>
      <div className="report-doc mx-auto grid w-full max-w-[1120px] gap-6 px-6 py-10 text-[var(--paper-text)] sm:px-10 md:grid-cols-2" data-reports={all.length}>
        {all.map((s) => {
          const last = s.waves[s.waves.length - 1].wave
          return (
            <Link key={s.slug} href={`/reports-2/${s.slug}`} className="group flex flex-col rounded-2xl border border-[var(--paper-rule)] bg-[var(--paper)] p-6 transition-colors hover:bg-[var(--paper-quiet)]">
              <h2 className="text-[28px] leading-tight font-semibold tracking-tight group-hover:underline">{s.name}</h2>
              <p className="mt-1 text-[15px] text-[var(--paper-muted)]">{wavesLine(s.waves.map((w) => w.wave))}</p>
              <ul className="mt-6 flex flex-col gap-3 border-t border-[var(--paper-rule)]/30 pt-4">
                {s.waves.map((w) => (
                  <li key={w.id} className="flex items-start gap-3 text-[13px] leading-relaxed">
                    <WaveChip wave={w.wave} latest={w.wave === last} />
                    <span>
                      {dateRange(w.fielded.start, w.fielded.end)} · {count(w.sample.raw)} respondents ({count(w.sample.weighted)} weighted) · {armsLine(w)}
                    </span>
                  </li>
                ))}
              </ul>
            </Link>
          )
        })}
        {all.length === 0 && <p className="text-[14px] text-[var(--paper-muted)]">No result sets yet.</p>}
      </div>
    </div>
  )
}
