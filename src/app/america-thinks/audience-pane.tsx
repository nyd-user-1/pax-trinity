"use client"

import * as React from "react"
import { X } from "lucide-react"

import { Button } from "@govblock/ui/components/nova/button"
import { CardTools } from "@/components/dash/card-tools"
import { Block, Fact, Passage } from "@/components/settings/blocks"
import { ATTITUDE } from "../q/[source]/[id]/headline"
import { dimLabel, fieldDates, num, period, shortSource, value, type MetricInfo, type SourceGroup, type SourceRow } from "./audience-data"
import { B, ViewColumn } from "./view-shell"

// The Baseline panel — a clicked value set against its reference figure, and everything it carries
// (Brendan, 2026-11-02: it was the About panel, the wrong name for what it shows). Beside the compare grid it
// stands as the fourth column at 420; over an open question it is a layer in the pane (pass 2, 2026-10-27),
// its X returning the view it covered. It wears the model and question cards' dress (components/settings/
// blocks.tsx Block): the sentence and its facts in the head strip, the kebab at its top right with the
// standard menu (Add to Blocks, Ask PAX, Refresh, Download, Delete), then the figures and the provenance as
// the card's rows.

export type BaselinePick = { r: SourceRow; metric: string; segment: string }

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

export function BaselinePanel({
  layer = false,
  picked,
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
  picked: BaselinePick
  onClose: () => void
  source: string | null
  groups: SourceGroup[]
  files: Record<string, SourceRow[]>
  info: Map<string, MetricInfo>
  place: (code: string) => string
  /** The open question's rows, where the Baseline is read; files[source] where not given. */
  rows?: SourceRow[]
}) {
  const c = info.get(picked.metric)
  const base = baselineOf(picked.r, rows ?? (source ? (files[source] ?? []) : []), c?.baseGeo ?? picked.r[1])
  const band = picked.r[4]
  const seg = picked.r[5] ? picked.r[6] : null
  // A poll's field period by its dates; a survey wave by its year.
  const when = picked.r[10] && source === "POLL" ? fieldDates(picked.r[2], picked.r[3]) : period(picked.r[2], picked.r[3])
  const people = source != null && (ATTITUDE.has(source) || source === "POLL")
  const sourceLabel = groups.find((g) => g.source === source)?.label
  const facts = [seg ? `${dimLabel(picked.r[5] as string)}: ${seg}` : "All", place(picked.r[1]), source ? shortSource(source) : null].filter(Boolean).join(", ")
  const figures: [string, string][] = [["Estimate", value(picked.r[7], picked.r[8], null)]]
  if (picked.r[9] != null) figures.push(["Margin of error", `± ${num(picked.r[9])}`])
  if (picked.r[11] != null) figures.push(["Respondents", num(picked.r[11], 0)])
  if (base) figures.push(["Baseline", `${value(base[7], base[8], null)} · ${place(base[1])}`])
  const estimate = value(picked.r[7], picked.r[8], null)
  // The sentence, as the head strip shows it (its figures in bold) and as plain text for the menu's foot and Blocks.
  const sentence =
    people && band ? (
      <>
        <B>{estimate}</B> {seg ? <>of {seg} respondents </> : null}answered “{band}” in <B>{when}</B>.
      </>
    ) : (
      <>
        {band ? <>“{band}”: </> : null}
        <B>{estimate}</B> in <B>{when}</B>.
      </>
    )
  const plain = people && band ? `${estimate} ${seg ? `of ${seg} respondents ` : ""}answered “${band}” in ${when}.` : `${band ? `“${band}”: ` : ""}${estimate} in ${when}.`
  const anchor = `baseline-${picked.metric}`.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  const body = (
    <ViewColumn>
      <Block
        title={<span className="text-[17px] leading-snug font-normal">{sentence}</span>}
        sub={facts}
        action={
          <span className="flex shrink-0 items-center gap-0.5 self-start">
            <CardTools panel title={plain} anchor={anchor} name="baseline" rows={[Object.fromEntries([["Question", picked.metric], ["Segment", picked.segment], ...figures])]} />
            <Button variant="ghost" size="icon-sm" aria-label="Close" title="Close" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </span>
        }
      >
        {figures.map(([k, v]) => (
          <Fact key={k} label={k}>
            <span className="font-semibold text-slate-900 tabular-nums">{v}</span>
          </Fact>
        ))}
        <Passage label="Provenance">
          <span className="text-[13px] text-slate-600">
            {picked.r[10] && <>{picked.r[10]} · </>}
            {sourceLabel && <>{credited(sourceLabel)} · </>}
            {when}
            {picked.r[12] && (
              <>
                {" · "}
                <a href={picked.r[12]} target="_blank" rel="noreferrer" className="break-all text-pax2-light-blue underline">
                  {host(picked.r[12])}
                </a>
              </>
            )}
          </span>
        </Passage>
      </Block>
    </ViewColumn>
  )
  return layer ? <div className="min-h-0 w-full flex-1 overflow-y-auto">{body}</div> : <div className="w-[420px] shrink-0 overflow-y-auto border-l">{body}</div>
}
