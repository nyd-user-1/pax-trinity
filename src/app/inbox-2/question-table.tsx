"use client"

import * as React from "react"
import dynamic from "next/dynamic"

import { cn } from "@/lib/utils"

// The Trend view loads only when clicked: the chart file carries the ECharts
// modules, and this dynamic mount keeps that chunk off every route until then.
const QuestionChart = dynamic(() => import("./question-chart").then((m) => m.QuestionChart), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-muted-foreground">Drawing…</p>,
})

import { dimLabel, latestRow, normalizeWording, num, value, year, type MetricInfo, type SourceRow } from "../audience/audience-data"
import { RowsView } from "../audience/rows-view"
import { type About } from "../audience/audience-pane"

// The clicked question, read the way a pollster reads one: a crosstab — the
// answer options down the side, the banner across the top (Total, then every
// breakdown), the latest wave's shares in the cells with unweighted bases
// underneath, and the trend as its own block. The toggle's third position
// mounts the shared Rows view (Brendan, 2026-10-26): wave, segment, band,
// estimate, margin, base, geo and weight, newest first with the total before
// its subgroups and the three filter pills. A clicked crosstab cell hands its
// row to the About panel.

const MAX_BANNER_ROWS = 24

export function QuestionTable({
  rows,
  title,
  def,
  metric,
  place,
  info,
  short,
  source,
  wording,
  about,
  onPick,
}: {
  /** The question's rows alone. */
  rows: SourceRow[]
  title: string
  def?: string
  metric: string
  place: (code: string) => string
  info: MetricInfo
  /** The source's short name. */
  short: string
  /** The source's key, for the Rows view's weight mapping. */
  source: string | null
  /** The verbatim wording where the bank carries one; the bar reads it over the label. */
  wording: string | null
  about: About | null
  onPick: (a: About) => void
}) {
  const [view, setView] = React.useState<"crosstab" | "chart" | "tidy">("tidy")

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

  // The bar reads the question itself (Brendan, 2026-10-26) and the chevrons
  // changing the open question change it with them; the toggle rides the
  // filter row's right in the Data view and the bar's right elsewhere.
  const heading = <span className="min-w-0 truncate text-sm font-semibold">{normalizeWording(wording ?? title)}</span>
  const toggle = (
    <div className="flex shrink-0 rounded-lg border p-0.5 text-xs">
      {(["tidy", "crosstab", "chart"] as const).map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={view === v}
          onClick={() => setView(v)}
          className={cn("rounded-md px-2.5 py-1 transition-colors", view === v ? "bg-pax2-mist font-semibold text-pax2-blue" : "text-muted-foreground hover:text-foreground")}
        >
          {v === "crosstab" ? "Crosstab" : v === "chart" ? "Trend" : "Data"}
        </button>
      ))}
    </div>
  )

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      {view === "tidy" ? (
        <RowsView rows={rows} title={title} id={metric} short={short} source={source} header={heading} trailing={toggle} about={about} onPick={onPick} />
      ) : (
        <>
      <div className="flex h-[52px] shrink-0 items-center gap-2 border-b px-4">
        {heading}
        <div className="ml-auto flex shrink-0 items-center">{toggle}</div>
      </div>
      {/* Native scroll, not the ScrollArea primitive: radix's viewport sizes
          itself to the banner's intrinsic width, which blew the pane out
          sideways and swallowed the vertical scroll with it. */}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        {view === "chart" ? (
          <QuestionChart rows={rows} info={info} title={title} place={place} />
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

            {tab.years.length > 1 && (
              <>
                <h3 className="mt-8 mb-3 text-sm font-semibold text-pax2-blue">Trend</h3>
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
              </>
            )}
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

