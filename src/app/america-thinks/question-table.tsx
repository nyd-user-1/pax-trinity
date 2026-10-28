"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { ArrowLeft, Globe } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
import { PaneTitleRow, ViewToggle } from "@/components/bank/pane-bars"
import { Marks } from "@/components/bank/marks"

// The Trend view loads only when clicked: the chart file carries the ECharts
// modules, and this dynamic mount keeps that chunk off every route until then.
const QuestionChart = dynamic(() => import("./question-chart").then((m) => m.QuestionChart), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-muted-foreground">Drawing…</p>,
})
// The dossier is the toggle's fourth view, the globe (Brendan, 2026-10-27),
// mounted embedded: the pane's title row carries the question. Dynamic for
// the same reason as the chart.
const Dossier = dynamic(() => import("../q/[source]/[id]/dossier").then((m) => m.Dossier), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-muted-foreground">Reading the question…</p>,
})

import { dimLabel, latestRow, normalizeWording, num, value, year, type MetricInfo, type SourceRow } from "./audience-data"
import { RowsView } from "./rows-view"
import { type About } from "./audience-pane"

// The clicked question, read the way a pollster reads one: a crosstab — the
// answer options down the side, the banner across the top (Total, then every
// breakdown), the latest wave's shares in the cells with unweighted bases
// underneath. The wave-by-wave trend table rides the Trend view under the
// chart (Brendan, 2026-10-27). The toggle's first position
// mounts the shared Rows view (Brendan, 2026-10-26): wave, segment, band,
// estimate, margin, base, geo and weight, newest first with the total before
// its subgroups. A clicked crosstab cell hands its row to the About panel.
// One 52px bar, flush with the list's one (Brendan's DevTools pass,
// 2026-10-28): the question — its column box, importance arrow and star
// before it (pass 2) — with the view toggle at its right. With the reading
// pane off, Back leads the bar; a picked value's About panel takes the
// content area as a layer, the dossier's way.

const MAX_BANNER_ROWS = 24
const VIEWS = [
  { value: "tidy", label: "Data" },
  { value: "crosstab", label: "Crosstab" },
  { value: "chart", label: "Trend" },
  { value: "global", label: "Global view", icon: Globe },
] as const
type View = (typeof VIEWS)[number]["value"]

export function QuestionTable({
  rows,
  title,
  def,
  metric,
  place,
  info,
  source,
  wording,
  about,
  onPick,
  isColumn,
  atCap,
  onColumn,
  pinned,
  onPin,
  important,
  onImportant,
  onBack,
  aboutLayer,
}: {
  /** The question's rows alone. */
  rows: SourceRow[]
  title: string
  def?: string
  metric: string
  place: (code: string) => string
  info: MetricInfo
  /** The source's key, for the Rows view's weight mapping. */
  source: string | null
  /** The verbatim wording where the bank carries one; the bar reads it over the label. */
  wording: string | null
  about: About | null
  onPick: (a: About) => void
  /** The open question as a compare-grid column, the box before its title. */
  isColumn: boolean
  atCap: boolean
  onColumn: () => void
  pinned: boolean
  onPin: () => void
  important: boolean
  onImportant: () => void
  /** Present when the list is hidden: the title row's Back. */
  onBack?: () => void
  /** The picked value's About panel, as the layer over the view. */
  aboutLayer?: React.ReactNode
}) {
  const [view, setView] = React.useState<View>("tidy")

  const tab = React.useMemo(() => {
    const base = info.baseGeo
    const top = rows.filter((r) => !r[5] && r[1] === base)
    const latest = top.reduce<string | null>((b, r) => (!b || r[3] > b ? r[3] : b), null)
    const latestYear = latest ? year(latest) : ""
    let options: (string | null)[] = info.options.length ? info.options : [info.option]
    const totalOf = (opt: string | null) => latestRow(top.filter((r) => (r[4] ?? null) === opt))
    const capped = options.length > MAX_BANNER_ROWS
    if (capped) options = [...options].sort((a, b) => (totalOf(b)?.[7] ?? -Infinity) - (totalOf(a)?.[7] ?? -Infinity)).slice(0, MAX_BANNER_ROWS)
    const dims: string[] = []
    for (const r of rows) if (r[5] && !dims.includes(r[5])) dims.push(r[5])
    const banner = dims.map((d) => {
      const values: string[] = []
      for (const r of rows) if (r[5] === d && r[6] && !values.includes(r[6])) values.push(r[6])
      return { dim: d, values }
    })
    const cell = (opt: string | null, dim: string | null, val: string | null) =>
      latestRow(rows.filter((r) => (r[4] ?? null) === opt && r[1] === base && (dim ? r[5] === dim && r[6] === val : !r[5])))
    const years: string[] = []
    for (const r of top) {
      const y = year(r[3])
      if (!years.includes(y)) years.push(y)
    }
    years.sort((a, b) => b.localeCompare(a))
    const trendCell = (opt: string | null, y: string) => latestRow(top.filter((r) => (r[4] ?? null) === opt && year(r[3]) === y))
    return { base, latestYear, options, capped, banner, cell, years, trendCell }
  }, [rows, info])

  // The title row reads the question itself (Brendan, 2026-10-26) and the
  // chevrons changing the open question change it with them.
  const heading = normalizeWording(wording ?? title)
  // Before the title: Back where the list is hidden, then the question's box
  // (a compare-grid column), Gmail's importance arrow and the star (pass 2,
  // 2026-10-27).
  const leading = (
    <>
      {onBack && (
        <Button variant="ghost" size="icon-sm" aria-label="Back to the list" title="Back to the list" className="-ml-1.5 shrink-0" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
      )}
      <Marks column={isColumn} atCap={atCap} onColumn={onColumn} important={important} onImportant={onImportant} pinned={pinned} onPin={onPin} />
    </>
  )
  // At the title row's right in every view. The globe needs the question's
  // source to find its dossier.
  const viewToggle = <ViewToggle views={source ? VIEWS : VIEWS.filter((v) => v.value !== "global")} value={view} onChange={setView} />

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      {aboutLayer ? (
        <>
          <PaneTitleRow title={heading} leading={leading}>
            {viewToggle}
          </PaneTitleRow>
          {aboutLayer}
        </>
      ) : view === "global" && source ? (
        <>
          <PaneTitleRow title={heading} leading={leading}>
            {viewToggle}
          </PaneTitleRow>
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <Dossier source={source.toLowerCase()} id={metric} embedded />
          </div>
        </>
      ) : view === "tidy" ? (
        <RowsView rows={rows} id={metric} source={source} header={heading} leading={leading} trailing={viewToggle} about={about} onPick={onPick} />
      ) : (
        <>
      <PaneTitleRow title={heading} leading={leading}>
        {viewToggle}
      </PaneTitleRow>
      {/* Native scroll, not the ScrollArea primitive: radix's viewport sizes
          itself to the banner's intrinsic width, which blew the pane out
          sideways and swallowed the vertical scroll with it. */}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        {view === "chart" ? (
          <>
            <QuestionChart rows={rows} info={info} title={title} place={place} />
            {/* The wave-by-wave table under the chart (Brendan, 2026-10-27), off the crosstab. */}
            {tab.years.length > 1 && (
              <div className="px-5 pb-5">
                <h3 className="mb-3 text-sm font-semibold text-pax2-blue">Trend</h3>
                <div className="overflow-x-auto">
                  <table className="w-max min-w-[420px] border-collapse text-[13px]">
                    <thead>
                      <tr>
                        <th className="border-b px-2.5 py-2 text-left text-xs font-medium text-muted-foreground">Wave</th>
                        {tab.options.map((opt) => (
                          <th key={opt ?? "·"} className="border-b px-2.5 py-2 text-left text-xs font-medium whitespace-nowrap text-muted-foreground">
                            {opt ?? title}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tab.years.map((y) => (
                        <tr key={y}>
                          <td className="border-b px-2.5 py-2 text-muted-foreground tabular-nums">{y}</td>
                          {tab.options.map((opt) => (
                            <XCell key={opt ?? "·"} r={tab.trendCell(opt, y)} metric={metric} segment={`${y}`} about={about} onPick={onPick} />
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="p-5">
            <h2 className="text-[17px] font-semibold text-pax2-blue">{title}</h2>
            <p className="mb-5 text-xs text-muted-foreground">
              {def && `${def} · `}
              {place(tab.base)} · latest wave {tab.latestYear}
            </p>
            <div className="overflow-x-auto">
              <table className="w-max min-w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className="min-w-[180px] border-b px-2.5 py-2" />
                    <th className="border-b border-l px-2.5 py-2 text-left text-xs font-semibold text-muted-foreground">Total</th>
                    {tab.banner.map((b) => (
                      <th key={b.dim} colSpan={b.values.length} className="border-b border-l px-2.5 py-2 text-left text-xs font-semibold text-muted-foreground">
                        {dimLabel(b.dim)}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th className="border-b px-2.5 py-1.5" />
                    <th className="border-b border-l px-2.5 py-1.5" />
                    {tab.banner.map((b) =>
                      b.values.map((v, k) => (
                        <th key={`${b.dim}:${v}`} className={cn("border-b px-2.5 py-1.5 text-left text-xs font-medium whitespace-nowrap text-muted-foreground", k === 0 && "border-l")}>
                          {v}
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody>
                  {tab.options.map((opt) => (
                    <tr key={opt ?? "·"}>
                      <td className="border-b px-2.5 py-2 font-medium whitespace-nowrap">{opt ?? title}</td>
                      <XCell r={tab.cell(opt, null, null)} metric={metric} segment="Total" first about={about} onPick={onPick} />
                      {tab.banner.map((b) => b.values.map((v, k) => <XCell key={`${b.dim}:${v}`} r={tab.cell(opt, b.dim, v)} metric={metric} segment={v} first={k === 0} about={about} onPick={onPick} />))}
                    </tr>
                  ))}
                  <tr>
                    <td className="px-2.5 py-2 text-xs text-muted-foreground">Unweighted n</td>
                    <BaseCell r={tab.cell(tab.options[0], null, null)} latestYear={tab.latestYear} first />
                    {tab.banner.map((b) => b.values.map((v, k) => <BaseCell key={`${b.dim}:${v}`} r={tab.cell(tab.options[0], b.dim, v)} latestYear={tab.latestYear} first={k === 0} />))}
                  </tr>
                </tbody>
              </table>
            </div>
            {tab.capped && <p className="mt-2 text-xs text-muted-foreground">The first {MAX_BANNER_ROWS} options by the latest value.</p>}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  )
}

/** A crosstab cell: the share with its margin small beside it; a count prints whole. */
function XCell({ r, metric, segment, first, about, onPick }: { r: SourceRow | null; metric: string; segment: string; first?: boolean; about: About | null; onPick: (a: About) => void }) {
  if (!r) return <td className={cn("border-b px-2.5 py-2 text-xs text-muted-foreground/40", first && "border-l")}>—</td>
  const sel = about?.r === r
  return (
    <td className={cn("border-b px-2.5 py-2", first && "border-l")}>
      <button
        type="button"
        onClick={() => onPick({ r, metric, segment })}
        title={value(r[7], r[8], r[9])}
        className={cn("flex items-baseline gap-1 rounded-[3px] text-left tabular-nums", sel && "outline-2 outline-offset-2 outline-pax2-light-blue")}
      >
        <span className="font-medium">{r[8] === "count" ? num(r[7], 0) : num(r[7])}</span>
        {r[9] != null && <span className="text-[11px] text-muted-foreground">±{num(r[9])}</span>}
      </button>
    </td>
  )
}

/** The base row: each column's unweighted n, and its year when it is not the headline wave. */
function BaseCell({ r, latestYear, first }: { r: SourceRow | null; latestYear: string; first?: boolean }) {
  if (!r) return <td className={cn("px-2.5 py-2 text-xs text-muted-foreground/40", first && "border-l")}>—</td>
  const y = year(r[3])
  return (
    <td className={cn("px-2.5 py-2 text-xs text-muted-foreground tabular-nums", first && "border-l")}>
      {r[11] != null ? num(r[11], 0) : "—"}
      {y !== latestYear && <span className="text-muted-foreground/60"> · {y}</span>}
    </td>
  )
}

