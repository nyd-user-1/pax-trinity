"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { ArrowLeft, ChartColumnIncreasing, ClipboardList, Database, Globe, Grid3x3 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
import { PaneTitleRow, ViewToggle, type PaneSearch } from "@/components/bank/pane-bars"
import { Card, CardLabel } from "../_wire/wire-bits"

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

import { crosstabOf, dimLabel, latestRow, MAX_BANNER_ROWS, mnemonicOf, normalizeWording, num, shortSource, value, weightOf, year, type MetricInfo, type SourceRow } from "./audience-data"
import { ATTITUDE } from "../q/[source]/[id]/headline"
import { B, Copyable, listed, Provenance, ViewColumn, ViewHeading } from "./view-shell"
import { RowsView } from "./rows-view"
import { type BaselinePick } from "./audience-pane"

// The clicked question, read the way a pollster reads one: a vertical
// crosstab — the answer options across the top, the subgroups down the side
// (Total, then every breakdown's values under its name), the latest wave's
// shares in the cells with each row's unweighted base at its right. The wave-by-wave trend table rides the Trend view under the
// chart (Brendan, 2026-10-27). The toggle's first position
// mounts the shared Rows view (Brendan, 2026-10-26): wave, segment, band,
// estimate, margin, base, geo and weight, newest first with the total before
// its subgroups. A clicked crosstab cell hands its row to the Baseline panel.
// Topline, Crosstab, Trend and the globe stand in the Global view's centered
// column of cards under the same h2, a sentence of context (Brendan,
// 2026-10-29). The Topline is the pollster's: the verbatim wording, every
// answer at the latest wave with the earlier waves beside it, and the
// provenance under it.
// One 52px bar, flush with the list's one (Brendan's DevTools pass,
// 2026-10-28): the question, with the view toggle at its right; the box,
// importance arrow and star stay on the list's rows (Brendan, 2026-10-28).
// With the reading pane off, Back leads the bar; a picked value's Baseline panel
// takes the content area as a layer, the dossier's way.

const VIEWS = [
  // Every view an icon (Brendan, 2026-10-29), its label the tooltip.
  { value: "tidy", label: "Data", icon: Database },
  { value: "crosstab", label: "Crosstab", icon: Grid3x3 },
  { value: "chart", label: "Trend", icon: ChartColumnIncreasing },
  { value: "topline", label: "Topline", icon: ClipboardList },
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
  sourceLabel = null,
  wording,
  picked,
  onPick,
  onBack,
  search,
  baselineLayer,
  local = false,
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
  /** The source's full name, for the Topline's provenance. */
  sourceLabel?: string | null
  /** The verbatim wording where the bank carries one; the bar reads it over the label. */
  wording: string | null
  picked: BaselinePick | null
  onPick: (a: BaselinePick) => void
  /** The title row's Back: one layer up, from the full screen to the split, from the split to the rows. */
  onBack?: () => void
  /** The list's search, carried in the title row after the kebab. */
  search?: PaneSearch
  /** The picked value's Baseline panel, as the layer over the view. */
  baselineLayer?: React.ReactNode
  /** The rows are the mount's own, not an export file's (Survey's Consensus statements): the Global
   *  view reads them as handed in, and the provenance links no raw file. */
  local?: boolean
}) {
  const [view, setView] = React.useState<View>("tidy")

  const tab = React.useMemo(() => {
    // The crosstab itself, shared with the compare grid's Banner; the trend stays here.
    const x = crosstabOf(rows, info)
    const top = rows.filter((r) => !r[5] && r[1] === x.base)
    const years: string[] = []
    for (const r of top) {
      const y = year(r[3])
      if (!years.includes(y)) years.push(y)
    }
    years.sort((a, b) => b.localeCompare(a))
    const trendCell = (opt: string | null, y: string) => latestRow(top.filter((r) => (r[4] ?? null) === opt && year(r[3]) === y))
    return { ...x, years, trendCell }
  }, [rows, info])

  // What every view's h2 is built from.
  const baseName = place(info.baseGeo)
  const who = info.baseGeo === "US" ? "Americans" : `people in ${baseName}`
  const people = source != null && ATTITUDE.has(source)
  const latestN = tab.cell(tab.options[0], null, null)?.[11] ?? null
  const src = source ? shortSource(source) : null
  const asked = latestN != null ? (
    <>
      the <B>{num(latestN, 0)}</B> {who} asked in <B>{tab.latestYear}</B>
    </>
  ) : (
    <>
      {who} asked in <B>{tab.latestYear}</B>
    </>
  )
  const oldest = tab.years[tab.years.length - 1]
  const facts = (...xs: (string | null)[]) => xs.filter(Boolean).join(", ")

  // The title row reads the question itself (Brendan, 2026-10-26) and the
  // chevrons changing the open question change it with them.
  const heading = normalizeWording(wording ?? title)
  // Before the title: Back, one layer up.
  const leading = onBack ? (
    <Button variant="ghost" size="icon-sm" aria-label="Back" title="Back" className="-ml-1.5 shrink-0" onClick={onBack}>
      <ArrowLeft className="size-4" />
    </Button>
  ) : undefined
  // At the title row's right in every view. The globe needs the question's
  // source to find its dossier.
  // A view with nothing to show for this question greys out (Brendan, 2026-11-02): the
  // Crosstab without a breakdown, the Trend with one wave. A question opened on one of
  // them reads its rows instead, and the pick holds for the next question that has it.
  const disabled = new Set<View>()
  if (!tab.banner.length) disabled.add("crosstab")
  if (tab.years.length < 2) disabled.add("chart")
  const shown: View = disabled.has(view) ? "tidy" : view
  const viewToggle = <ViewToggle views={source ? VIEWS : VIEWS.filter((v) => v.value !== "global")} value={shown} onChange={setView} disabled={disabled} />

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      {baselineLayer ? (
        <>
          <PaneTitleRow title={heading} leading={leading} search={search}>
            {viewToggle}
          </PaneTitleRow>
          {baselineLayer}
        </>
      ) : shown === "global" && source ? (
        <>
          <PaneTitleRow title={heading} leading={leading} search={search}>
            {viewToggle}
          </PaneTitleRow>
          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <Dossier source={source.toLowerCase()} id={metric} embedded given={local ? { rows, label: title, wording, sourceLabel } : undefined} />
          </div>
        </>
      ) : shown === "tidy" ? (
        <RowsView rows={rows} id={metric} source={source} header={heading} leading={leading} trailing={viewToggle} search={search} picked={picked} onPick={onPick} />
      ) : (
        <>
      <PaneTitleRow title={heading} leading={leading} search={search}>
        {viewToggle}
      </PaneTitleRow>
      {/* Native scroll, not the ScrollArea primitive: radix's viewport sizes
          itself to the banner's intrinsic width, which blew the pane out
          sideways and swallowed the vertical scroll with it. */}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        {shown === "topline" ? (
          <ToplineView tab={tab} title={title} wording={wording} metric={metric} source={source} sourceLabel={sourceLabel} rows={rows} picked={picked} onPick={onPick} local={local}>
            <ViewHeading sub={facts(baseName, src, tab.years.length > 1 ? `${oldest}–${tab.latestYear}, ${tab.years.length} waves` : null)}>
              {people ? <>Every answer from {asked}.</> : <>Every figure on file for {baseName} in <B>{tab.latestYear}</B>.</>}
            </ViewHeading>
          </ToplineView>
        ) : shown === "chart" ? (
          <ViewColumn>
            <ViewHeading sub={facts(baseName, src)}>
              {tab.years.length > 1 ? (
                <>
                  {people ? "Every answer" : "Every figure"} across <B>{tab.years.length}</B> waves, <B>{oldest}</B> to <B>{tab.latestYear}</B>.
                </>
              ) : (
                <>
                  One wave on file, <B>{tab.latestYear}</B>: nothing to trend yet.
                </>
              )}
            </ViewHeading>
            {tab.years.length > 1 && info.type !== "lift_pp" && (
              <Card>
                <QuestionChart rows={rows} info={info} title={title} place={place} flush />
              </Card>
            )}
            {/* The wave-by-wave table under the chart (Brendan, 2026-10-27), off the crosstab. */}
            {tab.years.length > 1 && (
              <Copyable>
                <Card>
                  <CardLabel>By wave</CardLabel>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[13px]">
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
                              <XCell key={opt ?? "·"} r={tab.trendCell(opt, y)} metric={metric} segment={`${y}`} picked={picked} onPick={onPick} />
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </Copyable>
            )}
          </ViewColumn>
        ) : (
          <ViewColumn>
            <ViewHeading sub={facts(baseName, src)}>
              {people ? <>How {asked} answered</> : <>Each figure for {baseName} in <B>{tab.latestYear}</B></>}
              {tab.banner.length ? `, by ${listed(tab.banner.map((b) => dimLabel(b.dim).toLowerCase()))}.` : "; no breakdowns on file."}
            </ViewHeading>
            {/* Vertical (Brendan, 2026-10-29): the answers across the top, Total
                then each breakdown's values down the side under its name, and
                each row's unweighted n last. */}
            <Copyable>
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-[13px]">
                    <thead>
                      <tr>
                        <th className="min-w-[180px] border-b px-2.5 py-2" />
                        {tab.options.map((opt, k) => (
                          <th key={opt ?? "·"} className={cn("min-w-[96px] border-b px-2.5 py-2 text-left align-bottom text-xs font-semibold text-muted-foreground", k === 0 && "border-l")}>
                            <span className="block max-w-[9rem]">{opt ?? title}</span>
                          </th>
                        ))}
                        <th className="border-b border-l px-2.5 py-2 text-left align-bottom text-xs font-medium whitespace-nowrap text-muted-foreground">Unweighted n</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border-b px-2.5 py-2 font-medium whitespace-nowrap">Total</td>
                        {tab.options.map((opt, k) => (
                          <XCell key={opt ?? "·"} r={tab.cell(opt, null, null)} metric={metric} segment="Total" first={k === 0} picked={picked} onPick={onPick} />
                        ))}
                        <BaseCell r={tab.cell(tab.options[0], null, null)} latestYear={tab.latestYear} first className="border-b" />
                      </tr>
                      {tab.banner.map((b) => (
                        <React.Fragment key={b.dim}>
                          {/* The group's name, the column rules running through it. */}
                          <tr>
                            <td className="px-2.5 pt-4 pb-1 text-xs font-semibold text-muted-foreground">{dimLabel(b.dim)}</td>
                            <td colSpan={tab.options.length} className="border-l" />
                            <td className="border-l" />
                          </tr>
                          {b.values.map((v) => (
                            <tr key={v}>
                              <td className="border-b py-2 pr-2.5 pl-5 whitespace-nowrap">{v}</td>
                              {tab.options.map((opt, k) => (
                                <XCell key={opt ?? "·"} r={tab.cell(opt, b.dim, v)} metric={metric} segment={v} first={k === 0} picked={picked} onPick={onPick} />
                              ))}
                              <BaseCell r={tab.cell(tab.options[0], b.dim, v)} latestYear={tab.latestYear} first className="border-b" />
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                {tab.capped && <p className="mt-2 text-xs text-muted-foreground">The first {MAX_BANNER_ROWS} options by the latest value.</p>}
              </Card>
            </Copyable>
          </ViewColumn>
        )}
      </div>
        </>
      )}
    </div>
  )
}

/** A crosstab cell: the share with its margin small beside it (plain: the share alone, its margin on hover); a count prints whole. */
function XCell({ r, metric, segment, first, plain, picked, onPick }: { r: SourceRow | null; metric: string; segment: string; first?: boolean; plain?: boolean; picked: BaselinePick | null; onPick: (a: BaselinePick) => void }) {
  if (!r) return <td className={cn("border-b px-2.5 py-2 text-xs text-muted-foreground/40", first && "border-l")}>—</td>
  const sel = picked?.r === r
  return (
    <td className={cn("border-b px-2.5 py-2", first && "border-l")}>
      <button
        type="button"
        onClick={() => onPick({ r, metric, segment })}
        title={value(r[7], r[8], r[9])}
        className={cn("flex items-baseline gap-1 rounded-[3px] text-left tabular-nums", sel && "outline-2 outline-offset-2 outline-pax2-light-blue")}
      >
        <span className="font-medium">{r[8] === "count" ? num(r[7], 0) : num(r[7])}</span>
        {!plain && r[9] != null && <span className="text-[11px] text-muted-foreground">±{num(r[9])}</span>}
      </button>
    </td>
  )
}

/** The base row: each column's unweighted n, and its year when it is not the headline wave. The compare grid's Banner prints it too. */
export function BaseCell({ r, latestYear, first, className }: { r: SourceRow | null; latestYear: string; first?: boolean; className?: string }) {
  if (!r) return <td className={cn("px-2.5 py-2 text-xs text-muted-foreground/40", first && "border-l", className)}>—</td>
  const y = year(r[3])
  return (
    <td className={cn("px-2.5 py-2 text-xs text-muted-foreground tabular-nums", first && "border-l", className)}>
      {r[11] != null ? num(r[11], 0) : "—"}
      {y !== latestYear && <span className="text-muted-foreground/60"> · {y}</span>}
    </td>
  )
}


/** The question's read: its crosstab, its waves newest first, and any answer's row in a wave. */
type Tab = ReturnType<typeof crosstabOf> & { years: string[]; trendCell: (opt: string | null, y: string) => SourceRow | null }

/** A topline lays a few waves beside the latest; Trend carries every one. */
const TOPLINE_WAVES = 6

/** The Topline: the question as asked, every answer at the latest wave with
 *  the earlier waves beside it (shares alone, margins on hover, each wave's
 *  unweighted n under), then where the rows come from and the weight. */
function ToplineView({
  tab,
  title,
  wording,
  metric,
  source,
  sourceLabel,
  rows,
  picked,
  onPick,
  local = false,
  children,
}: {
  tab: Tab
  title: string
  wording: string | null
  metric: string
  source: string | null
  sourceLabel: string | null
  rows: SourceRow[]
  picked: BaselinePick | null
  onPick: (a: BaselinePick) => void
  local?: boolean
  /** The view's h2. */
  children: React.ReactNode
}) {
  const waves = tab.years.slice(0, TOPLINE_WAVES)
  const weights = [...new Set(waves.flatMap((y) => weightOf(source, y) ?? []))]
  return (
    <ViewColumn>
      {children}
      <Copyable>
        <Card>
          <CardLabel>{[source ? shortSource(source) : null, mnemonicOf(metric)].filter(Boolean).join(" · ")}</CardLabel>
          <p className="pr-8 text-[15px] leading-relaxed">{normalizeWording(wording ?? title)}</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className="min-w-[180px] border-b px-2.5 py-2" />
                  {waves.map((y, k) => (
                    <th key={y} className={cn("min-w-[72px] border-b px-2.5 py-2 text-left text-xs tabular-nums", k === 0 ? "border-l font-semibold text-foreground" : "font-medium text-muted-foreground")}>
                      {y}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tab.options.map((opt) => (
                  <tr key={opt ?? "·"}>
                    <td className="border-b px-2.5 py-2">{opt ?? title}</td>
                    {waves.map((y, k) => (
                      <XCell key={y} r={tab.trendCell(opt, y)} metric={metric} segment={y} first={k === 0} plain picked={picked} onPick={onPick} />
                    ))}
                  </tr>
                ))}
                <tr>
                  <td className="px-2.5 py-2 text-xs text-muted-foreground">Unweighted n</td>
                  {waves.map((y, k) => {
                    const n = tab.trendCell(tab.options[0], y)?.[11]
                    return (
                      <td key={y} className={cn("px-2.5 py-2 text-xs text-muted-foreground tabular-nums", k === 0 && "border-l")}>
                        {n != null ? num(n, 0) : "—"}
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          {(tab.years.length > waves.length || tab.capped) && (
            <p className="mt-2 text-xs text-muted-foreground">
              {[
                tab.years.length > waves.length ? `The latest ${waves.length} of ${tab.years.length} waves; Trend carries every one.` : null,
                tab.capped ? `The first ${MAX_BANNER_ROWS} options by the latest value.` : null,
              ]
                .filter(Boolean)
                .join(" ")}
            </p>
          )}
        </Card>
      </Copyable>
      {source && (
        <Card>
          <CardLabel>Provenance</CardLabel>
          <Provenance source={source} id={metric} label={sourceLabel} rows={rows} raw={!local} extra={weights.length ? <span key="w">weighted by {listed(weights)}</span> : undefined} />
        </Card>
      )}
    </ViewColumn>
  )
}
