"use client"

import * as React from "react"
import { ArrowDownUp, ChartSpline, CircleDashed, Download, Folder, Funnel, Info, Loader2, Package, Users } from "lucide-react"

import { cn } from "@/lib/utils"
import { BankFrame } from "@/components/bank/bank-frame"
import { BankRail, RailGroup, RailRow } from "@/components/bank/bank-rail"
import { PUBLISHED } from "@/components/clips/catalog"
import { RESULT_SETS } from "@/lib/results"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@govblock/ui/components/ny4/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/ny4/tooltip"

import { dimLabel, groupSources, num, type AudienceIndex, type SourceRow } from "../america-thinks/audience-data"
import { AboutResult } from "./about-result"
import { dimOf, fielding, isPlacebo, levelOf, metricShort, periodKey, POINT_LEFT, POINT_RIGHT, segKey, segOf, signed, treatmentName, valOf, type Cell, type Pick } from "./lift-data"

// /lift — Swayable's results view (Brendan, 2026-10-28): the folders in the
// rail (the PAX tests, the archive of campaigns' own experiments); a toolbar
// of Treatments, Metrics, Segments and Filter menus with Options, Download and
// the respondent count; then one table, Breakdown › Content › Segment down
// the left and a column per metric, each cell the control group's level and
// the arrow of the treatment's lift from it, faded inside its own margin. The
// placebo is the control group, not a row. A clicked cell brings About Result
// in at the right. The archive's five hundred treatments read twenty-five at
// a time. ?source=PAX_TEST or ?source=LIFT_ARCHIVE opens on that folder.

const SOURCES: Record<string, string> = { PAX_TEST: "Tests", LIFT_ARCHIVE: "Archive" }
const PER_READ = 25
const BY_NAME = "@name"
const PLACEBO = "\u0000placebo"

/** A treatment's creative: its cut in the clips library, else the tested MP4 the report lists. */
const CREATIVE = (() => {
  const m = new Map<string, string>()
  for (const set of RESULT_SETS)
    for (const arm of set.arms) {
      if (arm.role !== "treatment") continue
      const src = PUBLISHED.find((c) => c.id === arm.clipId)?.src || (arm.watchUrl?.endsWith(".mp4") ? arm.watchUrl : undefined)
      if (src) m.set(arm.name, src)
    }
  return m
})()

const plural = (n: number, noun: string) => `${n.toLocaleString("en-US")} ${noun}${n === 1 ? "" : "s"}`
const toggled = (list: string[], x: string) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x])

const TOOL = "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-foreground/80 transition-colors hover:bg-muted hover:text-foreground aria-expanded:bg-muted"
const TOOL_ICON = "size-3.5 text-muted-foreground"
const TH = "border-b px-3 py-2 text-left text-xs font-medium whitespace-nowrap text-muted-foreground"
const TD = "border-b px-3 py-2 align-middle text-[13px]"

export function LiftSurface() {
  const [index, setIndex] = React.useState<AudienceIndex | null>(null)
  const [source, setSource] = React.useState<string>(() => {
    const at = new URLSearchParams(window.location.search).get("source")
    return at && at in SOURCES ? at : "PAX_TEST"
  })
  const [files, setFiles] = React.useState<Record<string, SourceRow[]>>({})
  const [error, setError] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState("")
  const [find, setFind] = React.useState("")
  const [metricsOff, setMetricsOff] = React.useState<string[]>([])
  const [treatOff, setTreatOff] = React.useState<string[]>([])
  const [segsOff, setSegsOff] = React.useState<string[]>([])
  const [periodsOff, setPeriodsOff] = React.useState<string[]>([])
  const [sort, setSort] = React.useState<string | null>(null)
  const [about, setAbout] = React.useState<Pick | null>(null)
  const [depth, setDepth] = React.useState(PER_READ)

  React.useEffect(() => {
    let on = true
    fetch("/audience-data/index.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`index.json answered ${r.status}`))))
      .then((idx: AudienceIndex) => on && setIndex(idx))
      .catch((e: Error) => on && setError(e.message))
    return () => {
      on = false
    }
  }, [])

  // The open folder's files; About Result's benchmarks read every folder.
  const wanted = React.useMemo(() => (about ? Object.keys(SOURCES) : [source]), [about, source])
  React.useEffect(() => {
    if (!index) return
    const missing = wanted.filter((s) => !files[s])
    if (!missing.length) return
    const groups = groupSources(index.sources)
    let on = true
    Promise.all(
      missing.map((s) =>
        Promise.all(
          (groups.find((g) => g.source === s)?.files ?? []).map((f) => fetch(`/audience-data/${f}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${f} answered ${r.status}`)))))
        ).then((parts: SourceRow[][]) => [s, parts.flat()] as const)
      )
    )
      .then((got) => on && setFiles((prev) => ({ ...prev, ...Object.fromEntries(got) })))
      .catch((e: Error) => on && setError(e.message))
    return () => {
      on = false
    }
  }, [index, wanted, files])

  React.useEffect(() => {
    setMetricsOff([])
    setTreatOff([])
    setSegsOff([])
    setPeriodsOff([])
    setSort(null)
    setAbout(null)
    setDepth(PER_READ)
  }, [source])
  React.useEffect(() => setDepth(PER_READ), [query, sort])

  const labels = React.useMemo(() => new Map((index?.constructs ?? []).map((c) => [c.construct, c.label])), [index])
  const defs = React.useMemo(() => new Map((index?.constructs ?? []).map((c) => [c.construct, c.definition])), [index])
  const geoName = React.useMemo(() => new Map((index?.geographies ?? []).map((g) => [g.code, g.name])), [index])
  const place = React.useCallback((code: string) => geoName.get(code) ?? code, [geoName])
  const questions = React.useMemo(() => (index?.questions ?? []).filter((q) => q.source in SOURCES), [index])

  const rows = files[source]

  // The folder read once: its metrics, fieldings, treatments and breakdowns,
  // and each result keyed for the table. A Filter narrows the fieldings.
  const read = React.useMemo(() => {
    if (!rows) return null
    const off = new Set(periodsOff)
    const metrics: string[] = []
    const periods: { key: string; name: string }[] = []
    const options: string[] = []
    const seen = new Set<string>()
    const dims = new Map<string, string[]>()
    const lifts = new Map<string, SourceRow>()
    const levels = new Map<string, SourceRow>()
    for (const r of rows) {
      const pk = periodKey(r)
      if (!periods.some((p) => p.key === pk)) periods.push({ key: pk, name: fielding(r[2], r[3]) })
      if (off.has(pk)) continue
      if (!metrics.includes(r[0])) metrics.push(r[0])
      const d = dimOf(r)
      const v = valOf(r)
      if (d) {
        const vs = dims.get(d) ?? []
        if (v && !vs.includes(v)) vs.push(v)
        dims.set(d, vs)
      }
      if (r[4] == null) continue
      const sk = segOf(r)
      if (r[8] === "lift_pp") {
        const k = `${r[4]}\u0001${r[0]}\u0001${sk}`
        const had = lifts.get(k)
        if (!had || r[3] > had[3]) lifts.set(k, r)
        if (!seen.has(r[4])) {
          seen.add(r[4])
          options.push(r[4])
        }
      } else if (r[8] === "pct") levels.set(`${isPlacebo(r[4]) ? PLACEBO : r[4]}\u0001${r[0]}\u0001${sk}\u0001${pk}`, r)
    }
    periods.sort((a, b) => a.key.localeCompare(b.key))
    const cell = (option: string, metric: string, sk: string): Cell | null => {
      const lift = lifts.get(`${option}\u0001${metric}\u0001${sk}`)
      if (!lift) return null
      const pk = periodKey(lift)
      return { lift, level: levels.get(`${option}\u0001${metric}\u0001${sk}\u0001${pk}`) ?? null, control: levels.get(`${PLACEBO}\u0001${metric}\u0001${sk}\u0001${pk}`) ?? null }
    }
    return { metrics, periods, options, dims, cell }
  }, [rows, periodsOff])

  const view = React.useMemo(() => {
    if (!read) return null
    const metrics = read.metrics.filter((m) => !metricsOff.includes(m))
    const sortBy = sort === BY_NAME ? null : sort && metrics.includes(sort) ? sort : (metrics[0] ?? null)
    const q = query.trim().toLowerCase()
    const lead = (o: string) => (sortBy ? (read.cell(o, sortBy, "")?.lift[7] ?? -1e9) : 0)
    const treatments = read.options
      .filter((o) => !treatOff.includes(o) && (!q || o.toLowerCase().includes(q)) && metrics.some((m) => read.cell(o, m, "")))
      .sort(sortBy ? (a, b) => lead(b) - lead(a) : (a, b) => treatmentName(a).localeCompare(treatmentName(b)))
    const groups = [
      { dim: null as string | null, name: "Total", segs: [{ key: "", name: "Everyone" }] },
      ...[...read.dims].map(([d, vs]) => ({ dim: d as string | null, name: dimLabel(d), segs: vs.map((v) => ({ key: segKey(d, v), name: v })) })),
    ].map((g) => ({ ...g, segs: g.segs.filter((s) => !segsOff.includes(s.key)) }))
    // The widest arrow is the table's own largest lift; everything scales to it.
    let maxAbs = 0
    let respondents = 0
    const placebos = new Map<string, number>()
    for (const o of treatments) {
      let n = 0
      for (const m of metrics) {
        for (const g of groups) for (const s of g.segs) maxAbs = Math.max(maxAbs, Math.abs(read.cell(o, m, s.key)?.lift[7] ?? 0))
        const c = read.cell(o, m, "")
        n = Math.max(n, c?.lift[11] ?? 0)
        if (c?.control?.[11]) placebos.set(periodKey(c.control), Math.max(placebos.get(periodKey(c.control)) ?? 0, c.control[11]))
      }
      respondents += n
    }
    for (const n of placebos.values()) respondents += n
    return { metrics, sortBy, treatments, groups, segCount: groups.reduce((n, g) => n + g.segs.length, 0), maxAbs, respondents }
  }, [read, metricsOff, treatOff, segsOff, sort, query])

  const shown = view ? view.treatments.slice(0, depth) : []
  const canLoad = view ? depth < view.treatments.length : false
  const more = React.useCallback(() => setDepth((d) => d + PER_READ), [])

  const everyRow = React.useMemo(() => Object.values(files).flat(), [files])
  const complete = Object.keys(SOURCES).every((s) => files[s])

  const download = () => {
    if (!read || !view) return
    const head = ["Breakdown", "Segment", "Treatment", ...view.metrics.flatMap((m) => [`${metricShort(m)} control`, `${metricShort(m)} treatment`, `${metricShort(m)} lift`, `${metricShort(m)} ±`, `${metricShort(m)} n`])]
    const lines = view.groups.flatMap((g) =>
      view.treatments.flatMap((o) =>
        g.segs
          .filter((s) => view.metrics.some((m) => read.cell(o, m, s.key)))
          .map((s) => [
            g.name,
            s.name,
            treatmentName(o),
            ...view.metrics.flatMap((m) => {
              const c = read.cell(o, m, s.key)
              return [c?.control?.[7] ?? "", c?.level?.[7] ?? "", c?.lift[7] ?? "", c?.lift[9] ?? "", c?.lift[11] ?? ""]
            }),
          ])
      )
    )
    const esc = (x: string | number) => (/[",\n]/.test(String(x)) ? `"${String(x).replace(/"/g, '""')}"` : String(x))
    const url = URL.createObjectURL(new Blob([[head, ...lines].map((l) => l.map(esc).join(",")).join("\n")], { type: "text/csv" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `lift-${SOURCES[source].toLowerCase()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const rail = (
    <BankRail title="Lift">
      <RailGroup label="Folders">
        {Object.entries(SOURCES).map(([key, name]) => (
          <RailRow key={key} on={source === key} onClick={() => setSource(key)} icon={Folder} label={name} count={questions.filter((q) => q.source === key).length || null} />
        ))}
      </RailGroup>
    </BankRail>
  )

  const findQ = find.trim().toLowerCase()
  const filterCount = periodsOff.length ? 1 : 0
  const toolbar = (
    <div className="flex h-11 shrink-0 items-center gap-0.5 border-b px-3">
      <DropdownMenu onOpenChange={(o) => !o && setFind("")}>
        <DropdownMenuTrigger asChild>
          <button type="button" className={TOOL} disabled={!read}>
            <Package className={TOOL_ICON} />
            {plural(view?.treatments.length ?? 0, "Treatment")}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72 p-0">
          {read && read.options.length > 12 && (
            <div className="border-b p-1.5">
              <input
                value={find}
                onChange={(e) => setFind(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Find a treatment"
                className="w-full rounded-md px-2 py-1 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}
          <div className="max-h-80 overflow-y-auto p-1">
            <DropdownMenuItem onSelect={(e) => {
                e.preventDefault()
                setTreatOff([])
              }}>Show all</DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => {
                e.preventDefault()
                setTreatOff(read?.options ?? [])
              }}>Hide all</DropdownMenuItem>
            <DropdownMenuSeparator />
            {(read?.options ?? [])
              .filter((o) => !findQ || o.toLowerCase().includes(findQ))
              .map((o) => (
                <DropdownMenuCheckboxItem key={o} checked={!treatOff.includes(o)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => setTreatOff((prev) => toggled(prev, o))}>
                  <span className="truncate">{treatmentName(o)}</span>
                </DropdownMenuCheckboxItem>
              ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={TOOL} disabled={!read}>
            <ChartSpline className={TOOL_ICON} />
            {plural(view?.metrics.length ?? 0, "Metric")}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-max min-w-48">
          {(read?.metrics ?? []).map((m) => (
            <DropdownMenuCheckboxItem key={m} checked={!metricsOff.includes(m)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => setMetricsOff((prev) => toggled(prev, m))}>
              {metricShort(m)}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={TOOL} disabled={!read}>
            <CircleDashed className={TOOL_ICON} />
            {plural(view?.segCount ?? 0, "Segment")}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-96 w-max min-w-48 overflow-y-auto">
          {read &&
            [{ dim: null as string | null, name: "Total", vals: [null as string | null] }, ...[...read.dims].map(([d, vs]) => ({ dim: d as string | null, name: dimLabel(d), vals: vs as (string | null)[] }))].map((g, i) => (
              <React.Fragment key={g.dim ?? ""}>
                {i > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel className="text-xs text-muted-foreground">{g.name}</DropdownMenuLabel>
                {g.vals.map((v) => {
                  const k = segKey(g.dim, v)
                  return (
                    <DropdownMenuCheckboxItem key={k} checked={!segsOff.includes(k)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => setSegsOff((prev) => toggled(prev, k))}>
                      {v ?? "Everyone"}
                    </DropdownMenuCheckboxItem>
                  )
                })}
              </React.Fragment>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={TOOL} disabled={!read}>
            <Funnel className={TOOL_ICON} />
            {filterCount ? plural(filterCount, "Filter") : "Filter"}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-max min-w-48">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Fielded</DropdownMenuLabel>
          {(read?.periods ?? []).map((p) => (
            <DropdownMenuCheckboxItem key={p.key} checked={!periodsOff.includes(p.key)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => setPeriodsOff((prev) => toggled(prev, p.key))}>
              {p.name}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="ml-auto flex items-center gap-0.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={TOOL} disabled={!view}>
              <ArrowDownUp className={TOOL_ICON} />
              Options
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-max min-w-48">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Sort by</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={view?.sortBy ?? BY_NAME} onValueChange={setSort}>
              {(view?.metrics ?? []).map((m) => (
                <DropdownMenuRadioItem key={m} value={m}>
                  {metricShort(m)}
                </DropdownMenuRadioItem>
              ))}
              <DropdownMenuRadioItem value={BY_NAME}>Treatment name</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => {
                setError(null)
                setFiles((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== source)))
              }}
            >
              Refresh
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button type="button" className={TOOL} onClick={download} disabled={!view}>
          <Download className={TOOL_ICON} />
          Download
        </button>
        <span className="flex items-center gap-1.5 px-2 text-[13px] text-foreground/80 tabular-nums" title="Respondents">
          <Users className={TOOL_ICON} />
          {num(view?.respondents ?? 0, 0)}
        </span>
      </div>
    </div>
  )

  const table = view && read && (
    <table className="w-full border-collapse">
      <thead className="sticky top-0 z-[1] bg-background">
        <tr>
          <th className={cn(TH, "w-[100px]")}>Breakdown</th>
          <th className={cn(TH, "w-[200px] border-l")}>Content</th>
          <th className={cn(TH, "w-[120px] border-l")}>Segment</th>
          {view.metrics.map((m, i) => (
            <th key={m} className={cn(TH, "min-w-[180px] border-l")}>
              <span className="inline-flex items-center gap-1">
                <button type="button" onClick={() => setSort(m)} className="hover:text-foreground">
                  {i + 1}. {metricShort(m)}
                </button>
                {defs.get(m) && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label={`About ${labels.get(m) ?? metricShort(m)}`} className="hover:text-foreground">
                        <Info className="size-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-72">{defs.get(m)}</TooltipContent>
                  </Tooltip>
                )}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {view.groups.flatMap((g) => {
          const blocks = shown.map((o) => ({ o, segs: g.segs.filter((s) => view.metrics.some((m) => read.cell(o, m, s.key))) })).filter((b) => b.segs.length)
          const span = blocks.reduce((n, b) => n + b.segs.length, 0)
          return blocks.flatMap((b, bi) =>
            b.segs.map((s, si) => (
              <tr key={`${g.name}\u0001${b.o}\u0001${s.key}`}>
                {bi === 0 && si === 0 && (
                  <td rowSpan={span} className={cn(TD, "py-2.5 align-top")}>
                    {g.name}
                  </td>
                )}
                {si === 0 && (
                  <td rowSpan={b.segs.length} className={cn(TD, "border-l align-top")}>
                    <span className="flex min-h-6 items-center gap-2.5">
                      {CREATIVE.has(b.o) && (
                        <video src={`${CREATIVE.get(b.o)}#t=0.1`} preload="metadata" muted playsInline aria-hidden className="h-6 w-9 shrink-0 rounded-[3px] bg-muted object-cover" />
                      )}
                      <span className="line-clamp-2 font-medium" title={b.o}>
                        {treatmentName(b.o)}
                      </span>
                    </span>
                  </td>
                )}
                <td className={cn(TD, "border-l")}>{s.name}</td>
                {view.metrics.map((m) => {
                  const c = read.cell(b.o, m, s.key)
                  if (!c)
                    return (
                      <td key={m} className={cn(TD, "border-l text-center text-xs text-muted-foreground/40")}>
                        —
                      </td>
                    )
                  const sel = about?.cell.lift === c.lift
                  return (
                    <td key={m} className={cn(TD, "border-l")}>
                      <button
                        type="button"
                        onClick={() => setAbout({ option: b.o, metric: m, seg: s.key, segName: g.dim ? `${g.name}: ${s.name}` : s.name, cell: c })}
                        className={cn("w-full rounded-[3px] py-0.5 hover:bg-muted/60", sel && "bg-muted outline-2 outline-offset-1 outline-pax2-light-blue")}
                      >
                        <Shift cell={c} max={view.maxAbs} />
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))
          )
        })}
        {canLoad && <MoreRow span={3 + view.metrics.length} onMore={more} />}
      </tbody>
    </table>
  )

  return (
    <BankFrame rail={rail} crumb="Lift" search={{ query, onQuery: setQuery, placeholder: "Search treatments" }}>
      <div className="flex h-full min-h-0 flex-col">
        {toolbar}
        <div className="flex min-h-0 flex-1">
          {/* Native scroll, as the compare grid's: the table sets its own width. */}
          <div className="min-h-0 min-w-0 flex-1 overflow-auto">
            {error && <p className="p-6 text-center text-sm text-pax2-red">The data did not load: {error}</p>}
            {!error && !rows && (
              <p className="p-6 text-center text-sm text-muted-foreground">
                <Loader2 aria-hidden className="mr-2 inline size-4 animate-spin" />
                Reading {SOURCES[source]}…
              </p>
            )}
            {table}
            {view && !shown.length && <p className="p-6 text-center text-sm text-muted-foreground">{query.trim() ? `Nothing matching “${query.trim()}”.` : "Nothing on file."}</p>}
          </div>
          {about && <AboutResult key={`${about.option}\u0001${about.metric}\u0001${about.seg}`} pick={about} rows={everyRow} complete={complete} place={place} onClose={() => setAbout(null)} />}
        </div>
      </div>
    </BankFrame>
  )
}

/** A result: the control group's level, then the arrow of the lift from it,
 *  pointing the way the treatment moved. Inside its own margin it fades. */
function Shift({ cell, max }: { cell: Cell; max: number }) {
  const delta = cell.lift[7]
  const moe = cell.lift[9]
  const weak = moe != null && Math.abs(delta) <= moe
  const up = delta >= 0
  const w = max > 0 ? Math.max(5, (Math.abs(delta) / max) * 44) : 5
  const control = cell.control && (
    <span className="text-[11px] text-muted-foreground" title={`Control group ${levelOf(cell.control)}`}>
      {num(cell.control[7])}
    </span>
  )
  const arrow = (
    <span className={cn("flex items-center gap-1", !up && "flex-row-reverse", weak && "opacity-35")}>
      <span aria-hidden className={cn("h-[11px] shrink-0", up ? "bg-pax2-light-blue" : "bg-pax2-red")} style={{ width: w, clipPath: up ? POINT_RIGHT : POINT_LEFT }} />
      <span className={cn("text-[13px] font-semibold", !up && "text-pax2-red")}>{signed(delta)}</span>
    </span>
  )
  return (
    <span className="grid grid-cols-2 items-center gap-1.5 tabular-nums">
      <span className="flex justify-end">{up ? control : arrow}</span>
      <span className="flex justify-start">{up ? arrow : control}</span>
    </span>
  )
}

/** The end of the table: reaching it reads twenty-five more. */
function MoreRow({ span, onMore }: { span: number; onMore: () => void }) {
  const mark = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const el = mark.current
    if (!el) return
    const o = new IntersectionObserver((xs) => xs.some((x) => x.isIntersecting) && onMore())
    o.observe(el)
    return () => o.disconnect()
  }, [onMore])
  return (
    <tr>
      <td colSpan={span} className="py-3 text-center text-muted-foreground">
        <div ref={mark}>
          <Loader2 aria-label="Loading more" className="inline size-4 animate-spin" />
        </div>
      </td>
    </tr>
  )
}
