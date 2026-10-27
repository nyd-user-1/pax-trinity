"use client"

import * as React from "react"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"
import { ScrollArea } from "@govblock/ui/components/ny4/scroll-area"

import { dimLabel, latestRow, levelRank, num, type MetricInfo, type SourceRow } from "./audience-data"
import { type About } from "./audience-pane"

// The compare grid (the Swayable shape in /public/Reference Images): one
// column per question added from a row's kebab. The Bands section leads —
// every band of the first column as a row, a level bar against the largest so
// the distribution is the picture — then Geography reads each place against
// the question's baseline, and each breakdown reads its bands against the
// topline as delta pennants. A cell inside its own margin fades rather than
// vanishes. Clicking a cell hands the row to the About panel, which arrives
// as the fourth column.

const MAX_BAND_ROWS = 16

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
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-5">
          <div className="mb-4 flex items-center gap-2">
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

          {grid ? (
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
                          <BandCell key={c.id} r={b.cells[i]} c={c} max={grid.bandMax[i]} segment={b.opt} about={about} onPick={onPick} />
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
                        <Cell key={c.id} r={cells[i]} c={c} segment={place(g)} about={about} onPick={onPick} />
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
                            <Cell key={c.id} r={cells[i]} c={c} segment={v} about={about} onPick={onPick} />
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
      </ScrollArea>
    </div>
  )
}

const frameOf = (sel: boolean) => cn("flex w-full items-center gap-1.5 rounded-[3px] text-left tabular-nums", sel && "outline-2 outline-offset-2 outline-pax2-light-blue")

/** A data row's dress (Brendan, 2026-10-27): the list rows' hover, and the
 *  picked cell's whole row on the muted ground while the panel holds it. */
const rowDress = (sel: boolean) => cn("transition-colors hover:bg-accent/60", sel && "bg-muted")

/** A Bands cell: the band's value with a level bar against the column's largest. */
function BandCell({ r, c, max, segment, about, onPick }: { r: SourceRow | null; c: MetricInfo; max: number; segment: string; about: About | null; onPick: (a: About) => void }) {
  if (!r) return <td className="border-b px-2.5 py-2 text-xs text-muted-foreground/40">—</td>
  if (r[8] === "lift_pp")
    return (
      <td className="border-b px-2.5 py-2">
        <button type="button" onClick={() => onPick({ r, metric: c.id, segment })} className={frameOf(about?.r === r)}>
          <Pennant delta={r[7]} moe={r[9]} />
        </button>
      </td>
    )
  const w = max > 0 ? Math.max(3, (Math.abs(r[7]) / max) * 110) : 3
  return (
    <td className="border-b px-2.5 py-2">
      <button type="button" onClick={() => onPick({ r, metric: c.id, segment })} className={frameOf(about?.r === r)}>
        <span aria-hidden className="h-[13px] shrink-0 rounded-[2px] bg-pax2-light-blue/40" style={{ width: w }} />
        <span className="text-[13px] font-semibold">{r[8] === "count" ? num(r[7], 0) : `${num(r[7])}%`}</span>
      </button>
    </td>
  )
}

/** A value cell: a count prints, a baseline anchors, everything else is a pennant against it. */
function Cell({ r, c, segment, about, onPick }: { r: SourceRow | null; c: MetricInfo; segment: string; about: About | null; onPick: (a: About) => void }) {
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
      <button type="button" onClick={() => onPick({ r, metric: c.id, segment })} className={frameOf(about?.r === r)}>
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
