"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"
import { ViewToggle } from "@/components/bank/pane-bars"

import { crosstabOf, dimLabel, latestRow, levelRank, MAX_BANNER_ROWS, num, value, type MetricInfo, type SourceRow } from "./audience-data"
import { type About } from "./audience-pane"
import { BaseCell } from "./question-table"

// The compare grid: the questions added from a row's kebab, read two ways.
// Compare (the Swayable shape in /public/Reference Images) sets one column per
// question. The Bands section leads — every band of the first column as a
// row, a level bar against the largest so the distribution is the picture —
// then Geography reads each place against the question's baseline, and each
// breakdown reads its bands against the topline as delta pennants. A cell
// inside its own margin fades rather than vanishes. Banner (Brendan,
// 2026-10-28) is a pollster's banner table: the groups across (Total, the
// places, each breakdown's values), every question's answers down the side,
// levels with their margins, each question read by the Crosstab view's own
// crosstabOf: the Crosstab's figures, laid horizontally where the Crosstab
// view now runs vertical (2026-10-29).
// Segments, Breakdowns and Filter govern both. Clicking a cell hands the row
// to the About panel, which arrives as the fourth column.

const MAX_BAND_ROWS = 16
const ACROSS = [
  { value: "questions", label: "Compare" },
  { value: "groups", label: "Banner" },
] as const

export function SegmentGrid({
  rows,
  info,
  columns,
  label,
  place,
  geoLevel,
  about,
  onPick,
}: {
  rows: SourceRow[]
  info: Map<string, MetricInfo>
  columns: string[]
  label: (id: string) => string
  place: (code: string) => string
  geoLevel: Map<string, string>
  about: About | null
  onPick: (a: About) => void
}) {
  const [geoSel, setGeoSel] = React.useState<string[] | null>(null)
  const [dimsOff, setDimsOff] = React.useState<string[]>([])
  const [across, setAcross] = React.useState<"questions" | "groups">("questions")

  const grid = React.useMemo(() => {
    const cols = columns.map((id) => info.get(id)).filter((c): c is MetricInfo => !!c)
    if (!cols.length) return null
    const geoRows = new Map<string, number>()
    for (const c of cols) for (const r of c.rs) if (!r[5]) geoRows.set(r[1], (geoRows.get(r[1]) ?? 0) + 1)
    const geosAll = [...geoRows.keys()].sort((a, b) => levelRank(geoLevel.get(a)) - levelRank(geoLevel.get(b)) || geoRows.get(b)! - geoRows.get(a)!)
    const geos = geoSel ? geosAll.filter((g) => geoSel.includes(g)) : geosAll.slice(0, 9)
    const dimsAll: string[] = []
    for (const c of cols) for (const r of c.rs) if (r[5] && !dimsAll.includes(r[5])) dimsAll.push(r[5])
    const breakdowns = dimsAll
      .filter((d) => !dimsOff.includes(d))
      .map((d) => {
        const values: string[] = []
        for (const c of cols) for (const r of c.rs) if (r[5] === d && r[6] && !values.includes(r[6])) values.push(r[6])
        return { dim: d, values }
      })

    // The Bands section: the lead segment's bands, each column's latest row
    // for that band at its own baseline geography. An archive of hundreds of
    // tested messages is not a distribution; it stays with its median.
    const lead = cols[0]
    const bandRow = (c: MetricInfo, opt: string) => latestRow(rows.filter((r) => r[0] === c.id && (r[4] ?? null) === opt && !r[5] && r[1] === c.baseGeo))
    const bands =
      lead.options.length >= 2 && lead.options.length <= MAX_BAND_ROWS
        ? lead.options.map((opt) => ({ opt, cells: cols.map((c) => bandRow(c, opt)) }))
        : null
    // Each column's largest band value sets its bars' scale.
    const bandMax = bands ? cols.map((_, i) => Math.max(...bands.map((b) => Math.abs(b.cells[i]?.[7] ?? 0)), 0)) : []

    return { cols, geosAll, geos, dimsAll, breakdowns, bands, bandMax }
  }, [columns, info, geoSel, dimsOff, geoLevel, rows])

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Native scroll, not the ScrollArea primitive: radix's viewport sizes
          itself to the Banner's intrinsic width and blows the pane out
          sideways (question-table.tsx records the same). */}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <div className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <ViewToggle views={ACROSS} value={across} onChange={setAcross} />
            <span className="rounded-[10px] border px-2.5 py-1.5 text-xs">
              Segments <b className="font-semibold text-pax2-blue">{grid?.cols.length ?? 0}</b>
            </span>
            {grid && grid.dimsAll.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="flex items-center gap-1 rounded-[10px] border px-2.5 py-1.5 text-xs hover:bg-muted/50 aria-expanded:bg-muted/50">
                    Breakdowns <b className="font-semibold text-pax2-blue">{dimsOff.length ? grid.dimsAll.length - dimsOff.length : "All"}</b>
                    <ChevronDownIcon className="size-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-max min-w-44">
                  {grid.dimsAll.map((d) => (
                    <DropdownMenuCheckboxItem key={d} checked={!dimsOff.includes(d)} onCheckedChange={() => setDimsOff((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))}>
                      {dimLabel(d)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {grid && grid.geosAll.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="flex items-center gap-1 rounded-[10px] border px-2.5 py-1.5 text-xs hover:bg-muted/50 aria-expanded:bg-muted/50">
                    Filter <b className="font-semibold text-pax2-blue">{geoSel ? `${geoSel.length} places` : "All"}</b>
                    <ChevronDownIcon className="size-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-80 w-max min-w-48 overflow-y-auto">
                  <DropdownMenuItem onClick={() => setGeoSel(null)}>The first nine</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {grid.geosAll.map((g) => (
                    <DropdownMenuCheckboxItem key={g} checked={!!geoSel && geoSel.includes(g)} onCheckedChange={() => setGeoSel((prev) => (prev ? (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]) : [g]))}>
                      {place(g)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <span className="ml-auto text-xs text-muted-foreground tabular-nums">{rows.length.toLocaleString("en-US")} rows</span>
          </div>

          {grid && across === "groups" ? (
            <BannerTable grid={grid} rows={rows} label={label} place={place} about={about} onPick={onPick} />
          ) : grid ? (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-[150px] border-b px-2.5 py-2 text-left text-xs font-medium text-muted-foreground">Band</th>
                  {grid.cols.map((c) => (
                    <th key={c.id} className="border-b px-2.5 py-2 text-left text-xs font-medium text-muted-foreground">
                      {label(c.id)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.bands && (
                  <>
                    <tr>
                      <td colSpan={grid.cols.length + 1} className="bg-pax2-mist px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
                        Bands
                      </td>
                    </tr>
                    {grid.bands.map((b) => (
                      <tr key={b.opt} className={rowDress(about != null && b.cells.includes(about.r))}>
                        <td className="w-[150px] border-b px-2.5 py-2 text-[13px]">{b.opt}</td>
                        {grid.cols.map((c, i) => (
                          <BandCell key={c.id} r={b.cells[i]} c={c} max={grid.bandMax[i]} segment={b.opt} onPick={onPick} />
                        ))}
                      </tr>
                    ))}
                  </>
                )}
                {grid.geos.length > 0 && (
                  <tr>
                    <td colSpan={grid.cols.length + 1} className="bg-pax2-mist px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
                      Geography
                    </td>
                  </tr>
                )}
                {grid.geos.map((g) => {
                  const cells = grid.cols.map((c) => latestRow(c.rs.filter((r) => !r[5] && r[1] === g)))
                  return (
                    <tr key={g} className={rowDress(about != null && cells.includes(about.r))}>
                      <td className="w-[150px] border-b px-2.5 py-2 text-[13px]">{place(g)}</td>
                      {grid.cols.map((c, i) => (
                        <Cell key={c.id} r={cells[i]} c={c} segment={place(g)} onPick={onPick} />
                      ))}
                    </tr>
                  )
                })}
                {grid.breakdowns.map((b) => (
                  <React.Fragment key={b.dim}>
                    <tr>
                      <td colSpan={grid.cols.length + 1} className="bg-pax2-mist px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
                        {dimLabel(b.dim)}
                      </td>
                    </tr>
                    {b.values.map((v) => {
                      const cells = grid.cols.map((c) => latestRow(c.rs.filter((r) => r[5] === b.dim && r[6] === v && r[1] === c.baseGeo)))
                      return (
                        <tr key={v} className={rowDress(about != null && cells.includes(about.r))}>
                          <td className="w-[150px] border-b px-2.5 py-2 text-[13px]">{v}</td>
                          {grid.cols.map((c, i) => (
                            <Cell key={c.id} r={cells[i]} c={c} segment={v} onPick={onPick} />
                          ))}
                        </tr>
                      )
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-8 text-sm text-muted-foreground">No column yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

const frame = "flex w-full items-center gap-1.5 rounded-[3px] text-left tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pax2-light-blue"

/** A data row's dress (Brendan, 2026-10-28): the list rows' hover and selected state, Gmail's lift included, as rows-view.tsx's rows wear it. The picked cell's whole row holds the selected state while the About panel holds it. */
export const rowDress = (sel: boolean) => cn("transition-[background-color,box-shadow] hover:bg-accent/60 hover:shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]", sel && "bg-muted shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]")

type Crosstab = ReturnType<typeof crosstabOf>
/** A Banner column: its header, whether it opens a group, and its cell in a question's crosstab. */
type BannerHead = { segment: string; first: boolean; at: (t: Crosstab, opt: string | null) => SourceRow | null }
/** The Banner's stub column, held at the left while the groups scroll. */
const STUB = "sticky left-0 z-[1]"

/** The Banner: Total, the places and each breakdown's values across; each
 *  question's answers down the side, read by crosstabOf. */
function BannerTable({
  grid,
  rows,
  label,
  place,
  about,
  onPick,
}: {
  grid: { cols: MetricInfo[]; geos: string[]; breakdowns: { dim: string; values: string[] }[] }
  rows: SourceRow[]
  label: (id: string) => string
  place: (code: string) => string
  about: About | null
  onPick: (a: About) => void
}) {
  // Every cell is read once here, not on each render (a pick re-renders).
  const table = React.useMemo(() => {
    // A place that is every question's baseline is already the Total.
    const geos = grid.geos.filter((g) => !grid.cols.every((c) => c.baseGeo === g))
    const heads: BannerHead[] = [
      { segment: "Total", first: true, at: (t, opt) => t.cell(opt, null, null) },
      ...geos.map((g, k): BannerHead => ({ segment: place(g), first: k === 0, at: (t, opt) => t.cell(opt, null, null, g) })),
      ...grid.breakdowns.flatMap((b) => b.values.map((v, k): BannerHead => ({ segment: v, first: k === 0, at: (t, opt) => t.cell(opt, b.dim, v) }))),
    ]
    const sections = grid.cols.map((c) => {
      const t = crosstabOf(
        rows.filter((r) => r[0] === c.id),
        c
      )
      return {
        c,
        latestYear: t.latestYear,
        capped: t.capped,
        bands: t.options.map((opt) => ({ opt, cells: heads.map((h) => h.at(t, opt)) })),
        bases: heads.map((h) => h.at(t, t.options[0])),
      }
    })
    return { geos, heads, sections }
  }, [grid, rows, place])
  const width = 1 + table.heads.length

  return (
    <div className="overflow-x-auto">
      <table className="w-max min-w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className={cn("min-w-[180px] border-b bg-background px-2.5 py-2", STUB)} />
            <th className="border-b border-l px-2.5 py-2 text-left text-xs font-semibold text-muted-foreground">Total</th>
            {table.geos.length > 0 && (
              <th colSpan={table.geos.length} className="border-b border-l px-2.5 py-2 text-left text-xs font-semibold text-muted-foreground">
                Geography
              </th>
            )}
            {grid.breakdowns.map((b) => (
              <th key={b.dim} colSpan={b.values.length} className="border-b border-l px-2.5 py-2 text-left text-xs font-semibold text-muted-foreground">
                {dimLabel(b.dim)}
              </th>
            ))}
          </tr>
          <tr>
            <th className={cn("border-b bg-background px-2.5 py-1.5", STUB)} />
            <th className="border-b border-l px-2.5 py-1.5" />
            {table.heads.slice(1).map((h, i) => (
              <th key={i} className={cn("border-b px-2.5 py-1.5 text-left text-xs font-medium whitespace-nowrap text-muted-foreground", h.first && "border-l")}>
                {h.segment}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.sections.map(({ c, latestYear, capped, bands, bases }) => (
            <React.Fragment key={c.id}>
              <tr>
                <td colSpan={width} className="bg-pax2-mist px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
                  <span className="sticky left-2.5 inline-block">{label(c.id)}</span>
                </td>
              </tr>
              {bands.map(({ opt, cells }) => {
                const sel = about != null && cells.includes(about.r)
                return (
                  <tr key={opt ?? "·"} className={rowDress(sel)}>
                    {/* Opaque, so the scrolled groups pass under it; muted with its row when picked. */}
                    <td className={cn("border-b px-2.5 py-2 font-medium whitespace-nowrap", STUB, sel ? "bg-muted" : "bg-background")}>{opt ?? label(c.id)}</td>
                    {cells.map((r, i) => (
                      <BannerCell key={i} r={r} metric={c.id} segment={table.heads[i].segment} first={table.heads[i].first} onPick={onPick} />
                    ))}
                  </tr>
                )
              })}
              <tr>
                <td className={cn("bg-background px-2.5 py-2 text-xs text-muted-foreground", STUB)}>Unweighted n</td>
                {bases.map((r, i) => (
                  <BaseCell key={i} r={r} latestYear={latestYear} first={table.heads[i].first} />
                ))}
              </tr>
              {capped && (
                <tr>
                  <td colSpan={width} className="px-2.5 pb-2 text-xs text-muted-foreground">
                    <span className="sticky left-2.5 inline-block">The first {MAX_BANNER_ROWS} options by the latest value.</span>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** A Banner cell: the Crosstab's own cell, the share with its margin small beside it; a count prints whole. */
function BannerCell({ r, metric, segment, first, onPick }: { r: SourceRow | null; metric: string; segment: string; first: boolean; onPick: (a: About) => void }) {
  if (!r) return <td className={cn("border-b px-2.5 py-2 text-xs text-muted-foreground/40", first && "border-l")}>—</td>
  return (
    <td className={cn("border-b px-2.5 py-2", first && "border-l")}>
      {/* The frame's focus ring, on the Crosstab cell's baseline. */}
      <button type="button" onClick={() => onPick({ r, metric, segment })} title={value(r[7], r[8], r[9])} className={cn(frame, "items-baseline gap-1")}>
        <span className="font-medium">{r[8] === "count" ? num(r[7], 0) : num(r[7])}</span>
        {r[9] != null && <span className="text-[11px] text-muted-foreground">±{num(r[9])}</span>}
      </button>
    </td>
  )
}

/** A Bands cell: the band's value with a level bar against the column's largest. */
function BandCell({ r, c, max, segment, onPick }: { r: SourceRow | null; c: MetricInfo; max: number; segment: string; onPick: (a: About) => void }) {
  if (!r) return <td className="border-b px-2.5 py-2 text-xs text-muted-foreground/40">—</td>
  if (r[8] === "lift_pp")
    return (
      <td className="border-b px-2.5 py-2">
        <button type="button" onClick={() => onPick({ r, metric: c.id, segment })} className={frame}>
          <Pennant delta={r[7]} moe={r[9]} />
        </button>
      </td>
    )
  const w = max > 0 ? Math.max(3, (Math.abs(r[7]) / max) * 110) : 3
  return (
    <td className="border-b px-2.5 py-2">
      <button type="button" onClick={() => onPick({ r, metric: c.id, segment })} className={frame}>
        <span aria-hidden className="h-[13px] shrink-0 rounded-[2px] bg-pax2-light-blue/40" style={{ width: w }} />
        <span className="text-[13px] font-semibold">{r[8] === "count" ? num(r[7], 0) : `${num(r[7])}%`}</span>
      </button>
    </td>
  )
}

/** A value cell: a count prints, a baseline anchors, everything else is a pennant against it. */
function Cell({ r, c, segment, onPick }: { r: SourceRow | null; c: MetricInfo; segment: string; onPick: (a: About) => void }) {
  if (!r) return <td className="border-b px-2.5 py-2 text-xs text-muted-foreground/40">—</td>
  let body: React.ReactNode
  if (r[8] === "count") body = <span className="text-[13px] font-semibold">{num(r[7], 0)}</span>
  else if (r[8] === "lift_pp") body = <Pennant delta={r[7]} moe={r[9]} />
  else if (c.topline && r === c.topline)
    body = (
      <>
        <span className="w-[34px] text-right text-xs text-muted-foreground">{num(r[7])}</span>
        <span className="text-xs text-muted-foreground">baseline</span>
      </>
    )
  else if (c.topline == null) body = <span className="text-[13px] font-semibold">{num(r[7])}%</span>
  else
    body = (
      <>
        <span className="w-[34px] shrink-0 text-right text-xs text-muted-foreground">{num(c.topline[7])}</span>
        <Pennant delta={r[7] - c.topline[7]} moe={r[9]} />
      </>
    )
  return (
    <td className="border-b px-2.5 py-2">
      <button type="button" onClick={() => onPick({ r, metric: c.id, segment })} className={frame}>
        {body}
      </button>
    </td>
  )
}

function Pennant({ delta, moe }: { delta: number; moe: number | null }) {
  // Inside its own margin the pennant fades; the figures stand in the panel.
  const weak = moe != null && Math.abs(delta) <= moe
  const w = Math.min(110, Math.max(4, Math.abs(delta) * 6))
  return (
    <span className={cn("flex items-center gap-1.5", weak && "opacity-35")}>
      <span
        aria-hidden
        className={cn("h-[13px] shrink-0 bg-pax2-light-blue", delta < 0 && "-scale-x-100")}
        style={{ width: w, clipPath: "polygon(0 0, calc(100% - 7px) 0, 100% 50%, calc(100% - 7px) 100%, 0 100%)" }}
      />
      <span className="text-[13px] font-semibold">
        {delta >= 0 ? "+" : "−"}
        {num(Math.abs(delta))}
      </span>
    </span>
  )
}
