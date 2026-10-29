import * as React from "react"
import Link from "next/link"

import { fielding, signed } from "@/app/lift/lift-data"
import { approx, placeboOf, slugOf, toplineOf, verdictWord } from "@/components/report/report-math"
import { RESULT_SETS } from "@/lib/results"
import type { Arm, ResultSet } from "@/lib/results/types"
import { cn } from "@/lib/utils"

// The Report Panel for a tested clip: the arm the results register joins to it
// by clipId, read as /lift reads a cell. Each outcome's lift against the wave's
// own placebo, gray when inconclusive; the arm's printed line; the wave's
// pairings that name it; and the cell in /lift and the study in /reports-2.

export type ClipTestRef = { rs: ResultSet; arm: Arm }

/** Every wave that tested this clip, latest first. */
export const testsOf = (clipId: string): ClipTestRef[] =>
  RESULT_SETS.flatMap((rs) => rs.arms.filter((arm) => arm.role === "treatment" && arm.clipId === clipId).map((arm) => ({ rs, arm }))).sort((a, b) => b.rs.wave - a.rs.wave)

/** The register's outcomes under /lift's Tests metric names. */
const METRIC: Record<string, string> = { ballot: "lift_support", comprehension: "lift_comprehension" }

/** The cell in /lift's Tests folder: treatment, metric, everyone, fielding. */
const liftHref = (rs: ResultSet, arm: Arm, outcomeId: string) =>
  `/lift?source=PAX_TEST&at=${[arm.name, METRIC[outcomeId] ?? outcomeId, "all", `${rs.fielded.start}|${rs.fielded.end}`].map(encodeURIComponent).join(",")}`

const lower = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s)

export function ClipTest({ tests }: { tests: ClipTestRef[] }) {
  return (
    <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <div className="flex flex-col gap-8">
        {tests.map((t) => (
          <ArmTest key={t.rs.id} {...t} />
        ))}
      </div>
    </div>
  )
}

function ArmTest({ rs, arm }: ClipTestRef) {
  const placebo = placeboOf(rs)
  const line = [arm.producer, arm.durationSeconds ? `${arm.durationSeconds}s` : null, arm.note].filter(Boolean).join(" · ")
  const pairings = rs.pairings.filter((p) => p.armIds.includes(arm.id)).sort((a, b) => a.rank - b.rank)
  const lead = rs.outcomes[0]?.id
  return (
    <section>
      <p className="text-sm font-semibold">{rs.study}</p>
      <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="shrink-0 rounded-md border px-1.5 py-px text-[10.5px] whitespace-nowrap">Wave {rs.wave}</span>
        {fielding(rs.fielded.start, rs.fielded.end)}
      </p>
      {line && <p className="mt-3 text-xs leading-relaxed">{line}</p>}

      <div className="mt-3 flex flex-col gap-3">
        {rs.outcomes.map((o) => {
          const t = toplineOf(rs, arm.id, o.id)
          if (t?.liftPp == null) return null
          const pl = placebo ? toplineOf(rs, placebo.id, o.id) : undefined
          const quiet = t.verdict !== "detectable"
          const up = t.liftPp >= 0
          return (
            <div key={o.id} className="rounded-lg border px-3 py-2.5">
              <p className="text-xs text-muted-foreground">{o.name}</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className={cn("text-xl font-semibold tabular-nums", quiet ? "font-medium text-muted-foreground" : !up && "text-pax2-red")}>
                  {approx(t.derivation)}
                  {signed(t.liftPp)} pp
                </span>
                {t.verdict && (
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", quiet ? "bg-muted text-muted-foreground" : up ? "bg-pax2-light-blue/15 text-pax2-blue" : "bg-pax2-red/10 text-pax2-red")}>{verdictWord(t.verdict)}</span>
                )}
              </div>
              {t.levelPct != null && pl?.levelPct != null && (
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {t.levelPct}% vs {pl.levelPct}% placebo
                </p>
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground tabular-nums">
        {arm.nWeighted.toLocaleString("en-US")} weighted saw this cut{placebo ? ` · ${placebo.nWeighted.toLocaleString("en-US")} weighted saw the placebo` : ""}.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">Lifts are against the wave&apos;s own placebo at the {lower(rs.threshold.label)}.</p>

      {pairings.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold">Pairings</p>
          <ol className="mt-2 flex flex-col gap-3">
            {pairings.map((p) => (
              <li key={p.rank} className="flex gap-2.5 text-xs leading-relaxed">
                <span className="w-4 shrink-0 text-muted-foreground tabular-nums">{p.rank}</span>
                <span className="min-w-0">
                  <span className="block font-medium">{p.audience}</span>
                  <span className="block">{p.finding}</span>
                  {p.caveat && <span className="block text-muted-foreground">{p.caveat}</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      <p className="mt-5 flex gap-4 border-t pt-3 text-xs">
        {lead && (
          <Link href={liftHref(rs, arm, lead)} className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            Open in Lift
          </Link>
        )}
        <Link href={`/reports-2/${slugOf(rs.study)}`} className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
          Open the report
        </Link>
      </p>
    </section>
  )
}
