"use client"

import * as React from "react"
import { ArrowLeft, ChevronDownIcon, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"
import { ScrollArea } from "@govblock/ui/components/ny4/scroll-area"

import { dimLabel, latestRow, levelRank, num, period, shortSource, value, year, type AudienceIndex, type MetricInfo, type SourceGroup, type SourceRow } from "./audience-data"

// The reading pane: the opened metric as a grouped table. The Geography band
// reads each place against the metric's baseline geography, the breakdown
// bands read each segment against the topline; one column per checked metric;
// a cell inside its own margin fades rather than vanishes. Clicking a cell
// hands the row to the About panel, which arrives as the fourth column.

export type About = { r: SourceRow; metric: string; segment: string }

export function AudiencePane({
  rows,
  info,
  checked,
  focus,
  label,
  defs,
  place,
  geoLevel,
  about,
  onPick,
  back,
}: {
  rows: SourceRow[]
  info: Map<string, MetricInfo>
  checked: string[]
  focus: string | null
  label: (id: string) => string
  defs: Map<string, string>
  place: (code: string) => string
  geoLevel: Map<string, string>
  about: About | null
  onPick: (a: About) => void
  /** The no-split back arrow; absent beside the list. */
  back?: React.ReactNode
}) {
  const [geoSel, setGeoSel] = React.useState<string[] | null>(null)
  const [dimsOff, setDimsOff] = React.useState<string[]>([])

  const grid = React.useMemo(() => {
    const ids = checked.length ? checked : focus ? [focus] : []
    const cols = ids.map((id) => info.get(id)).filter((c): c is MetricInfo => !!c)
    if (!cols.length) return null
    const geoRows = new Map<string, number>()
    for (const c of cols) for (const r of c.rs) if (!r[5]) geoRows.set(r[1], (geoRows.get(r[1]) ?? 0) + 1)
    const geosAll = [...geoRows.keys()].sort((a, b) => levelRank(geoLevel.get(a)) - levelRank(geoLevel.get(b)) || geoRows.get(b)! - geoRows.get(a)!)
    const geos = geoSel ? geosAll.filter((g) => geoSel.includes(g)) : geosAll.slice(0, 9)
    const dimsAll: string[] = []
    for (const c of cols) for (const r of c.rs) if (r[5] && !dimsAll.includes(r[5])) dimsAll.push(r[5])
    const bands = dimsAll
      .filter((d) => !dimsOff.includes(d))
      .map((d) => {
        const values: string[] = []
        for (const c of cols) for (const r of c.rs) if (r[5] === d && r[6] && !values.includes(r[6])) values.push(r[6])
        return { dim: d, values }
      })
    return { cols, geosAll, geos, dimsAll, bands }
  }, [checked, focus, info, geoSel, dimsOff, geoLevel])

  const focused = focus ? info.get(focus) : undefined

  return (
    <div className="flex h-full min-h-0 flex-col">
      {back && (
        <div className="flex h-[52px] shrink-0 items-center gap-2 border-b px-4">
          {back}
          <span className="truncate text-sm font-medium">{focused ? label(focused.id) : "Audience"}</span>
        </div>
      )}
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="rounded-[10px] border px-2.5 py-1.5 text-xs">
              Sources <b className="font-semibold text-pax2-blue">1</b>
            </span>
            <span className="rounded-[10px] border px-2.5 py-1.5 text-xs">
              Metrics <b className="font-semibold text-pax2-blue">{grid?.cols.length ?? 0}</b>
            </span>
            {grid && grid.dimsAll.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="flex items-center gap-1 rounded-[10px] border px-2.5 py-1.5 text-xs hover:bg-muted/50 aria-expanded:bg-muted/50">
                    Segments <b className="font-semibold text-pax2-blue">{dimsOff.length ? grid.dimsAll.length - dimsOff.length : "All"}</b>
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

          {focused && (
            <>
              <h2 className="text-[17px] font-semibold text-pax2-blue">{label(focused.id)}</h2>
              <p className="mb-4 text-xs text-muted-foreground">
                {defs.get(focused.id)}
                {focused.option ? ` · ${focused.option}` : ""}
              </p>
            </>
          )}

          {grid ? (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-[150px] border-b px-2.5 py-2 text-left text-xs font-medium text-muted-foreground">Segment</th>
                  {grid.cols.map((c) => (
                    <th key={c.id} className="border-b px-2.5 py-2 text-left text-xs font-medium text-muted-foreground">
                      {label(c.id)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={grid.cols.length + 1} className="bg-pax2-mist px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
                    Geography
                  </td>
                </tr>
                {grid.geos.map((g) => (
                  <tr key={g}>
                    <td className="w-[150px] border-b px-2.5 py-2 text-[13px]">{place(g)}</td>
                    {grid.cols.map((c) => (
                      <Cell key={c.id} r={latestRow(c.rs.filter((r) => !r[5] && r[1] === g))} c={c} segment={place(g)} about={about} onPick={onPick} />
                    ))}
                  </tr>
                ))}
                {grid.bands.map((b) => (
                  <React.Fragment key={b.dim}>
                    <tr>
                      <td colSpan={grid.cols.length + 1} className="bg-pax2-mist px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
                        {dimLabel(b.dim)}
                      </td>
                    </tr>
                    {b.values.map((v) => (
                      <tr key={v}>
                        <td className="w-[150px] border-b px-2.5 py-2 text-[13px]">{v}</td>
                        {grid.cols.map((c) => (
                          <Cell key={c.id} r={latestRow(c.rs.filter((r) => r[5] === b.dim && r[6] === v && r[1] === c.baseGeo))} c={c} segment={v} about={about} onPick={onPick} />
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-8 text-sm text-muted-foreground">No metric is checked.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

/** A value cell: a count prints, a baseline anchors, everything else is a pennant against it. */
function Cell({ r, c, segment, about, onPick }: { r: SourceRow | null; c: MetricInfo; segment: string; about: About | null; onPick: (a: About) => void }) {
  if (!r) return <td className="border-b px-2.5 py-2 text-xs text-muted-foreground/40">—</td>
  const sel = about?.r === r
  const frame = cn("flex w-full items-center gap-1.5 rounded-[3px] text-left tabular-nums", sel && "outline-2 outline-offset-2 outline-pax2-light-blue")
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

/** The fourth column: everything the clicked value carries, at 420. */
export function AboutPanel({
  about,
  onClose,
  source,
  groups,
  files,
  info,
  label,
  place,
  geoLevel,
}: {
  about: About
  onClose: () => void
  source: string | null
  groups: SourceGroup[]
  files: Record<string, SourceRow[]>
  info: Map<string, MetricInfo>
  label: (id: string) => string
  place: (code: string) => string
  geoLevel: Map<string, string>
}) {
  // The same metric and option, read from every other source opened so far,
  // each at its own baseline geography.
  const bench = React.useMemo(() => {
    const out: { name: string; v: string; year: string }[] = []
    for (const [key, data] of Object.entries(files)) {
      if (key === source) continue
      const rs = data.filter((r) => r[0] === about.metric && !r[5])
      if (!rs.length) continue
      let base = rs[0][1]
      for (const r of rs) if (levelRank(geoLevel.get(r[1])) < levelRank(geoLevel.get(base))) base = r[1]
      const opt = about.r[4] ?? null
      const t = latestRow(rs.filter((r) => r[1] === base && (opt === null || (r[4] ?? null) === opt)))
      if (t) out.push({ name: `${shortSource(key)} · ${place(base)}`, v: value(t[7], t[8], null), year: year(t[3]) })
    }
    return out
  }, [about, files, source, geoLevel, place])

  const c = info.get(about.metric)
  return (
    <div className="relative w-[420px] shrink-0 overflow-y-auto border-l p-5">
      <button type="button" onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
        <X className="size-4" />
      </button>
      <h3 className="pr-7 text-sm font-semibold text-pax2-blue">
        {label(about.metric)} — {about.segment}
      </h3>
      <p className="mt-0.5 mb-3.5 text-xs text-muted-foreground">
        {groups.find((g) => g.source === source)?.label} · {period(about.r[2], about.r[3])}
      </p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 border-t py-2.5 text-[13px]">
        <dt className="text-muted-foreground">Estimate</dt>
        <dd className="text-right font-semibold tabular-nums">{value(about.r[7], about.r[8], null)}</dd>
        {about.r[9] != null && (
          <>
            <dt className="text-muted-foreground">Margin of error</dt>
            <dd className="text-right font-semibold tabular-nums">± {num(about.r[9])}</dd>
          </>
        )}
        {about.r[11] != null && (
          <>
            <dt className="text-muted-foreground">Respondents</dt>
            <dd className="text-right font-semibold tabular-nums">{num(about.r[11], 0)}</dd>
          </>
        )}
        {c?.topline && about.r !== c.topline && c.type === "pct" && (
          <>
            <dt className="text-muted-foreground">Baseline</dt>
            <dd className="text-right font-semibold tabular-nums">
              {value(c.topline[7], c.topline[8], null)} · {place(c.baseGeo)}
            </dd>
          </>
        )}
      </dl>
      {about.r[10] && <p className="my-2.5 rounded-[10px] bg-pax2-mist px-3 py-2.5 text-xs leading-5">{about.r[10]}</p>}
      {about.r[12] && (
        <a href={about.r[12]} target="_blank" rel="noreferrer" className="text-[11.5px] break-all text-muted-foreground underline-offset-2 hover:underline">
          {about.r[12]}
        </a>
      )}
      <div className="mt-3.5 border-t pt-2.5">
        <p className="mb-2 text-[11px] font-semibold tracking-[0.05em] text-muted-foreground uppercase">Same metric, other sources</p>
        {bench.length ? (
          bench.map((b) => (
            <div key={b.name} className="flex justify-between py-1 text-xs">
              <span className="min-w-0 truncate text-muted-foreground">
                {b.name} · {b.year}
              </span>
              <span className="ml-2 shrink-0 font-semibold tabular-nums">{b.v}</span>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground/70">Other sources join here as they are read from the rail.</p>
        )}
      </div>
    </div>
  )
}

export function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <Button variant="ghost" size="sm" aria-label="Back to the list" onClick={onBack}>
      <ArrowLeft className="size-4" />
    </Button>
  )
}
