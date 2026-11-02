"use client"

import * as React from "react"
import { X } from "lucide-react"

import { Button } from "@govblock/ui/components/nova/button"
import { Card, CardLabel } from "../_wire/wire-bits"
import { ATTITUDE } from "../q/[source]/[id]/headline"
import { dimLabel, fieldDates, num, period, shortSource, value, type MetricInfo, type SourceGroup, type SourceRow } from "./audience-data"
import { B, ViewColumn, ViewHeading } from "./view-shell"

// The About panel — everything a clicked value carries. Beside the compare grid it stands as the fourth
// column at 420; over an open question it is a layer in the pane (pass 2,
// 2026-10-27), its X returning the view it covered.

export type About = { r: SourceRow; metric: string; segment: string }

/** Compilers a source label names whose terms ask for a credit: VoteHub's polls are CC BY 4.0
 *  (the lead's ruling, 2026-11-02: the link sits where the data shows), and Pew's figures
 *  are used with credit to Pew Research Center. */
const CREDITS: Record<string, string> = { VoteHub: "https://votehub.com/polls/", "Pew Research Center": "https://www.pewresearch.org/" }
const CREDIT_NAMES = new RegExp(`(${Object.keys(CREDITS).join("|")})`)

/** A link's host, as the views print it: "pewresearch.org". */
const host = (u: string) => {
  try {
    return new URL(u).host.replace(/^www\./, "")
  } catch {
    return u
  }
}

function credited(label: string): React.ReactNode {
  return label.split(CREDIT_NAMES).map((part, i) =>
    CREDITS[part] ? (
      <a key={i} href={CREDITS[part]} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
        {part}
      </a>
    ) : (
      part
    )
  )
}

/** A picked share's Baseline: the same answer, in the same wave and from the same poll, among
 *  everyone the pick belongs to. A subgroup's is its own place's total; a smaller place's total
 *  is the question's base place's. A pick that is itself the total has none, and nor does a
 *  pick whose total isn't on file, so no row prints rather than a wrong one (Brendan,
 *  2026-11-02: the old Baseline was the question's first answer, often "No answer"). */
export function baselineOf(r: SourceRow, rows: SourceRow[], baseGeo: string): SourceRow | null {
  if (r[8] !== "pct") return null
  const geo = r[5] ? r[1] : baseGeo
  if (!r[5] && r[1] === baseGeo) return null
  return (
    rows.find(
      (x) => x !== r && x[0] === r[0] && !x[5] && x[1] === geo && x[4] === r[4] && x[2] === r[2] && x[3] === r[3] && x[8] === r[8] && (x[10] ?? null) === (r[10] ?? null)
    ) ?? null
  )
}

export function AboutPanel({
  layer = false,
  about,
  onClose,
  source,
  groups,
  files,
  info,
  place,
  rows,
}: {
  /** In the pane, full width with the reading capped, rather than the 420 column. */
  layer?: boolean
  about: About
  onClose: () => void
  source: string | null
  groups: SourceGroup[]
  files: Record<string, SourceRow[]>
  info: Map<string, MetricInfo>
  place: (code: string) => string
  /** The open question's rows, where the Baseline is read; files[source] where not given. */
  rows?: SourceRow[]
}) {
  const c = info.get(about.metric)
  const base = baselineOf(about.r, rows ?? (source ? (files[source] ?? []) : []), c?.baseGeo ?? about.r[1])
  const band = about.r[4]
  const seg = about.r[5] ? about.r[6] : null
  // A poll's field period by its dates; a survey wave by its year.
  const when = about.r[10] && source === "POLL" ? fieldDates(about.r[2], about.r[3]) : period(about.r[2], about.r[3])
  const people = source != null && (ATTITUDE.has(source) || source === "POLL")
  const sourceLabel = groups.find((g) => g.source === source)?.label
  const facts = [seg ? `${dimLabel(about.r[5] as string)}: ${seg}` : "All", place(about.r[1]), source ? shortSource(source) : null].filter(Boolean).join(", ")
  const figures: [string, string][] = [["Estimate", value(about.r[7], about.r[8], null)]]
  if (about.r[9] != null) figures.push(["Margin of error", `± ${num(about.r[9])}`])
  if (about.r[11] != null) figures.push(["Respondents", num(about.r[11], 0)])
  if (base) figures.push(["Baseline", `${value(base[7], base[8], null)} · ${place(base[1])}`])
  // The views' own furniture (Brendan, 2026-11-02): the centered column, a sentence for the
  // h2 with its figures in bold and the facts under it, then cards.
  const body = (
    <ViewColumn>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <ViewHeading sub={facts}>
            {people && band ? (
              <>
                <B>{value(about.r[7], about.r[8], null)}</B> {seg ? <>of {seg} respondents </> : null}answered “{band}” in <B>{when}</B>.
              </>
            ) : (
              <>
                {band ? <>“{band}”: </> : null}
                <B>{value(about.r[7], about.r[8], null)}</B> in <B>{when}</B>.
              </>
            )}
          </ViewHeading>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="Close" title="Close" className="shrink-0" onClick={onClose}>
          <X className="size-4" />
        </Button>
      </div>
      <Card>
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            {figures.map(([k, v]) => (
              <tr key={k}>
                <td className="border-b px-2.5 py-2 text-muted-foreground">{k}</td>
                <td className="border-b px-2.5 py-2 text-right font-semibold tabular-nums">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card>
        <CardLabel>Provenance</CardLabel>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {about.r[10] && <>{about.r[10]} · </>}
          {sourceLabel && <>{credited(sourceLabel)} · </>}
          {when}
          {about.r[12] && (
            <>
              {" · "}
              <a href={about.r[12]} target="_blank" rel="noreferrer" className="break-all text-pax2-light-blue underline">
                {host(about.r[12])}
              </a>
            </>
          )}
        </p>
      </Card>
    </ViewColumn>
  )
  return layer ? <div className="min-h-0 w-full flex-1 overflow-y-auto">{body}</div> : <div className="w-[420px] shrink-0 overflow-y-auto border-l">{body}</div>
}
