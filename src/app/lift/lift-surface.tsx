"use client"

import * as React from "react"
import { ArrowDownUp, CircleDashed, Copy, Download, Folder, Funnel, Info, ListFilter, Loader2, SeparatorVertical, Share, Spline, Users } from "lucide-react"

import { cn } from "@/lib/utils"
import { BankFrame } from "@/components/bank/bank-frame"
import { BankRail, RailGroup, RailRow } from "@/components/bank/bank-rail"
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
import { rowDress } from "../america-thinks/segment-grid"
import { AboutResult } from "./about-result"
import { dimOf, fielding, isPlacebo, levelOf, metricShort, ordered, periodKey, POINT_LEFT, POINT_RIGHT, segKey, segOf, signed, significance, treatmentName, valOf, type Cell, type Pick } from "./lift-data"

// /lift — Swayable's results view (Brendan, 2026-10-28, from the Dream Crazy
// Campaign screen): the folders in the rail (the PAX tests, the archive of
// campaigns' own experiments); a toolbar of Treatments, Metrics, Segments and
// Filter menus with Options, Share, Download and the respondent count; then
// one table. Treatment and Segment down the left, each a resizable column;
// the metrics across under Primary and Secondary, each with its definition
// and a sort menu. Every treatment's Everyone row comes first, then a mist
// band per breakdown with each treatment's segments under it. A cell is the
// control group's level and a bar of the lift from it, its margin drawn
// through it where there is one, gray where the lift does not clear its test.
// A clicked cell's row takes the rows' selected dress and About Result comes
// in at the right. The archive's five hundred treatments read twenty-five at
// a time. ?source=PAX_TEST or ?source=LIFT_ARCHIVE opens on that folder.

const SOURCES: Record<string, string> = { PAX_TEST: "Tests", LIFT_ARCHIVE: "Archive" }
const PER_READ = 25
const BY_NAME = "@name"
const PLACEBO = "\u0000placebo"
/** The outcome each test was built to move: the MA tests' ballot support, the archive's two indices. The rest are Secondary. */
const PRIMARY = new Set(["lift_support", "lift_favorability", "lift_vote_choice"])
/** The share of a cell the table's largest lift spans from the axis. */
const REACH = 40

/** A treatment's thumbnail: one still frame of its tested video, cut once with ffmpeg (public/lift/thumbs/). */
const THUMB: Record<string, string> = {
  Pahlow: "/lift/thumbs/pahlow.jpg",
  DiZoglio: "/lift/thumbs/dizoglio.jpg",
  "Matt Wilson": "/lift/thumbs/matt-wilson.jpg",
  Green: "/lift/thumbs/green.jpg",
  "Danielle Allen": "/lift/thumbs/danielle-allen.jpg",
  Littlewood: "/lift/thumbs/littlewood.jpg",
  Dustin: "/lift/thumbs/dustin.jpg",
  Rodriguez: "/lift/thumbs/rodriguez.jpg",
}
/** The treatments a folder opens on (Brendan, 2026-10-29); the Treatments menu brings back the rest. */
const FEATURED: Record<string, string[]> = { PAX_TEST: ["DiZoglio", "Matt Wilson", "Pahlow"] }
/** A fielding the results register knows is its wave. */
const WAVE = new Map(RESULT_SETS.map((s) => [`${s.fielded.start}|${s.fielded.end}`, `Wave ${s.wave}`]))

const plural = (n: number, noun: string) => `${n.toLocaleString("en-US")} ${noun}${n === 1 ? "" : "s"}`
const toggled = (list: string[], x: string) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x])

const TOOL = "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-foreground/80 transition-colors hover:bg-muted hover:text-foreground aria-expanded:bg-muted"
const TOOL_ICON = "size-3.5 text-muted-foreground"
const TH = "border-b px-3 py-2 text-left text-[13px] font-medium whitespace-nowrap"
const TD = "border-b px-3 py-2 align-middle text-[13px]"
const HEAD_ICON = "shrink-0 text-muted-foreground hover:text-foreground aria-expanded:text-foreground"
/** A cell's button: the grid's focus frame, no pressed state; the row carries the selection. */
const FRAME = "block w-full rounded-[3px] text-left tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pax2-light-blue"

type Sort = { by: string; dir: 1 | -1 }

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
  // The Treatments menu's choice; null is the folder's opening set.
  const [picked, setPicked] = React.useState<string[] | null>(null)
  const [segsOff, setSegsOff] = React.useState<string[]>([])
  const [periodsOff, setPeriodsOff] = React.useState<string[]>([])
  const [sort, setSort] = React.useState<Sort | null>(null)
  const [about, setAbout] = React.useState<Pick | null>(null)
  const [depth, setDepth] = React.useState(PER_READ)
  const [widths, setWidths] = React.useState({ treatment: 220, segment: 170 })
  const [shared, setShared] = React.useState(false)

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
    setPicked(null)
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

  // The folder read once: its metrics (Primary first), fieldings, treatments
  // and breakdowns, and each result keyed for the table. A Filter narrows the
  // fieldings.
  const read = React.useMemo(() => {
    if (!rows) return null
    const off = new Set(periodsOff)
    const metrics: string[] = []
    const periods: { key: string; name: string; dates: string }[] = []
    const options: string[] = []
    const seen = new Set<string>()
    const dims = new Map<string, string[]>()
    const lifts = new Map<string, SourceRow>()
    const levels = new Map<string, SourceRow>()
    for (const r of rows) {
      const pk = periodKey(r)
      if (!periods.some((p) => p.key === pk)) periods.push({ key: pk, name: WAVE.get(pk) ?? fielding(r[2], r[3]), dates: fielding(r[2], r[3]) })
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
    metrics.sort((a, b) => Number(PRIMARY.has(b)) - Number(PRIMARY.has(a)))
    for (const [d, vs] of dims) dims.set(d, ordered(vs))
    const cell = (option: string, metric: string, sk: string): Cell | null => {
      const lift = lifts.get(`${option}\u0001${metric}\u0001${sk}`)
      if (!lift) return null
      const pk = periodKey(lift)
      return { lift, level: levels.get(`${option}\u0001${metric}\u0001${sk}\u0001${pk}`) ?? null, control: levels.get(`${PLACEBO}\u0001${metric}\u0001${sk}\u0001${pk}`) ?? null }
    }
    return { metrics, periods, options, dims, cell }
  }, [rows, periodsOff])

  const chosen = React.useMemo(() => {
    if (!read) return []
    const featured = FEATURED[source]
    return picked ?? (featured ? read.options.filter((o) => featured.includes(o)) : read.options)
  }, [read, picked, source])

  const view = React.useMemo(() => {
    if (!read) return null
    const metrics = read.metrics.filter((m) => !metricsOff.includes(m))
    const by = sort?.by === BY_NAME ? BY_NAME : sort && metrics.includes(sort.by) ? sort.by : (metrics[0] ?? BY_NAME)
    const dir = sort && sort.by === by ? sort.dir : by === BY_NAME ? 1 : -1
    const q = query.trim().toLowerCase()
    const lead = (o: string) => read.cell(o, by, "")?.lift[7]
    const treatments = read.options
      .filter((o) => chosen.includes(o) && (!q || o.toLowerCase().includes(q)) && metrics.some((m) => read.cell(o, m, "")))
      .sort((a, b) => {
        if (by === BY_NAME) return dir * treatmentName(a).localeCompare(treatmentName(b))
        const x = lead(a)
        const y = lead(b)
        // A treatment the sorting metric did not measure goes last either way.
        return x == null ? (y == null ? 0 : 1) : y == null ? -1 : dir * (x - y)
      })
    const groups = [
      { dim: null as string | null, name: "Everyone", segs: [{ key: "", name: "Everyone" }] },
      ...[...read.dims].map(([d, vs]) => ({ dim: d as string | null, name: dimLabel(d), segs: vs.map((v) => ({ key: segKey(d, v), name: v })) })),
    ]
      .map((g) => ({ ...g, segs: g.segs.filter((s) => !segsOff.includes(s.key)) }))
      .filter((g) => g.segs.length)
    // The longest bar is the table's own largest lift; every bar scales to it.
    let extent = 0
    let respondents = 0
    const placebos = new Map<string, number>()
    for (const o of treatments) {
      let n = 0
      for (const m of metrics) {
        for (const g of groups) for (const s of g.segs) extent = Math.max(extent, Math.abs(read.cell(o, m, s.key)?.lift[7] ?? 0))
        const c = read.cell(o, m, "")
        n = Math.max(n, c?.lift[11] ?? 0)
        if (c?.control?.[11]) placebos.set(periodKey(c.control), Math.max(placebos.get(periodKey(c.control)) ?? 0, c.control[11]))
      }
      respondents += n
    }
    for (const n of placebos.values()) respondents += n
    const primary = metrics.filter((m) => PRIMARY.has(m)).length
    return { metrics, primary, by, dir, treatments, groups, segCount: groups.reduce((n, g) => n + g.segs.length, 0), extent, respondents }
  }, [read, chosen, metricsOff, segsOff, sort, query])

  const shown = view ? view.treatments.slice(0, depth) : []
  const canLoad = view ? depth < view.treatments.length : false
  const more = React.useCallback(() => setDepth((d) => d + PER_READ), [])

  const everyRow = React.useMemo(() => Object.values(files).flat(), [files])
  const complete = Object.keys(SOURCES).every((s) => files[s])

  const download = () => {
    if (!read || !view) return
    const head = ["Breakdown", "Segment", "Treatment", ...view.metrics.flatMap((m) => [`${metricShort(m)} control`, `${metricShort(m)} treatment`, `${metricShort(m)} lift`, `${metricShort(m)} ±`, `${metricShort(m)} significant`, `${metricShort(m)} n`])]
    const lines = view.groups.flatMap((g) =>
      view.treatments.flatMap((o) =>
        g.segs
          .filter((s) => view.metrics.some((m) => read.cell(o, m, s.key)))
          .map((s) => [
            g.dim ? g.name : "Total",
            s.name,
            treatmentName(o),
            ...view.metrics.flatMap((m) => {
              const c = read.cell(o, m, s.key)
              const sig = c ? significance(c.lift) : null
              return [c?.control?.[7] ?? "", c?.level?.[7] ?? "", c?.lift[7] ?? "", c?.lift[9] ?? "", sig == null ? "" : sig ? "yes" : "no", c?.lift[11] ?? ""]
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

  const share = () => {
    const url = new URL(window.location.href)
    url.searchParams.set("source", source)
    navigator.clipboard.writeText(url.toString())
    setShared(true)
    window.setTimeout(() => setShared(false), 1400)
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
  const segGroups = read ? [{ dim: null as string | null, name: "Everyone", vals: [null as string | null] }, ...[...read.dims].map(([d, vs]) => ({ dim: d as string | null, name: dimLabel(d), vals: vs as (string | null)[] }))] : []
  const toolbar = (
    <div className="flex h-11 shrink-0 items-center gap-0.5 border-b px-3">
      <DropdownMenu onOpenChange={(o) => !o && setFind("")}>
        <DropdownMenuTrigger asChild>
          <button type="button" className={TOOL} disabled={!read}>
            <Copy className={TOOL_ICON} />
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
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                setPicked(read?.options ?? [])
              }}
            >
              Show all
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault()
                setPicked([])
              }}
            >
              Hide all
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {(read?.options ?? [])
              .filter((o) => !findQ || o.toLowerCase().includes(findQ))
              .map((o) => (
                <DropdownMenuCheckboxItem key={o} checked={chosen.includes(o)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => setPicked(toggled(chosen, o))}>
                  <span className="truncate">{treatmentName(o)}</span>
                </DropdownMenuCheckboxItem>
              ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={TOOL} disabled={!read}>
            <Spline className={TOOL_ICON} />
            {plural(view?.metrics.length ?? 0, "Metric")}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-max min-w-48">
          {(read?.metrics ?? []).map((m, i, all) => (
            <React.Fragment key={m}>
              {(i === 0 || PRIMARY.has(all[i - 1]) !== PRIMARY.has(m)) && <DropdownMenuLabel className="text-xs text-muted-foreground">{PRIMARY.has(m) ? "Primary" : "Secondary"}</DropdownMenuLabel>}
              <DropdownMenuCheckboxItem checked={!metricsOff.includes(m)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => setMetricsOff((prev) => toggled(prev, m))}>
                {metricShort(m)}
              </DropdownMenuCheckboxItem>
            </React.Fragment>
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
        <DropdownMenuContent align="start" className="max-h-[28rem] w-max min-w-56 overflow-y-auto">
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              setSegsOff([])
            }}
          >
            Show all
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault()
              setSegsOff(segGroups.flatMap((g) => (g.dim ? g.vals.map((v) => segKey(g.dim, v)) : [])))
            }}
          >
            Everyone only
          </DropdownMenuItem>
          {segGroups.map((g) => {
            const keys = g.vals.map((v) => segKey(g.dim, v))
            const on = keys.filter((k) => !segsOff.includes(k)).length
            return (
              <React.Fragment key={g.dim ?? ""}>
                <DropdownMenuSeparator />
                {g.dim && (
                  <DropdownMenuCheckboxItem
                    checked={on === keys.length ? true : on ? "indeterminate" : false}
                    onSelect={(e) => e.preventDefault()}
                    onCheckedChange={() => setSegsOff((prev) => (on === keys.length ? [...new Set([...prev, ...keys])] : prev.filter((k) => !keys.includes(k))))}
                    className="font-medium"
                  >
                    {g.name}
                  </DropdownMenuCheckboxItem>
                )}
                {g.vals.map((v) => {
                  const k = segKey(g.dim, v)
                  return (
                    <DropdownMenuCheckboxItem key={k} checked={!segsOff.includes(k)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => setSegsOff((prev) => toggled(prev, k))} className={cn(g.dim && "pl-12")}>
                      {v ?? "Everyone"}
                    </DropdownMenuCheckboxItem>
                  )
                })}
              </React.Fragment>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={TOOL} disabled={!read}>
            <Funnel className={TOOL_ICON} />
            {filterCount ? plural(filterCount, "Filter") : "Filter"}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-max min-w-52">
          {(read?.periods ?? []).map((p) => (
            <DropdownMenuCheckboxItem key={p.key} checked={!periodsOff.includes(p.key)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => setPeriodsOff((prev) => toggled(prev, p.key))}>
              <span className="flex-1">{p.name}</span>
              {p.name !== p.dates && <span className="ml-4 text-xs text-muted-foreground">{p.dates}</span>}
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
            <DropdownMenuRadioGroup value={view?.by ?? BY_NAME} onValueChange={(by) => setSort({ by, dir: by === BY_NAME ? 1 : -1 })}>
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
        <button type="button" className={TOOL} onClick={share}>
          <Share className={TOOL_ICON} />
          {shared ? "Link copied" : "Share"}
        </button>
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

  const sortMenu = (by: string, items: { label: string; dir: 1 | -1 }[], extra?: React.ReactNode) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Sort" className={HEAD_ICON}>
          <ListFilter className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-max min-w-44">
        <DropdownMenuRadioGroup value={view?.by === by ? String(view.dir) : ""} onValueChange={(d) => setSort({ by, dir: Number(d) as 1 | -1 })}>
          {items.map((it) => (
            <DropdownMenuRadioItem key={it.dir} value={String(it.dir)}>
              {it.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {extra}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const width = view ? 2 + view.metrics.length : 2
  const row = (o: string, s: { key: string; name: string }, first: boolean, last: boolean, sel: boolean) =>
    read &&
    view && (
      <tr key={`${o}\u0001${s.key}`} className={rowDress(sel)}>
        <td className={cn(TD, !last && "border-b-transparent")}>
          {first && (
            <span className="flex min-h-6 items-center gap-2.5">
              {THUMB[o] && <img src={THUMB[o]} alt="" width={36} height={24} className="h-6 w-9 shrink-0 rounded-[3px] bg-muted object-cover" />}
              <span className="line-clamp-2 font-medium" title={o}>
                {treatmentName(o)}
              </span>
            </span>
          )}
        </td>
        <td className={cn(TD, "border-l")}>{s.name}</td>
        {view.metrics.map((m) => {
          const c = read.cell(o, m, s.key)
          return (
            <td key={m} className={cn(TD, "border-l")}>
              {c ? (
                <button type="button" onClick={() => setAbout({ option: o, metric: m, seg: s.key, segName: s.name, cell: c })} className={FRAME}>
                  <Candle cell={c} extent={view.extent} />
                </button>
              ) : (
                <span className="block text-center text-xs text-muted-foreground/40">—</span>
              )}
            </td>
          )
        })}
      </tr>
    )

  const table = view && read && (
    <table className="w-full table-fixed border-collapse" style={{ minWidth: widths.treatment + widths.segment + view.metrics.length * 220 }}>
      <colgroup>
        <col style={{ width: widths.treatment }} />
        <col style={{ width: widths.segment }} />
        {view.metrics.map((m) => (
          <col key={m} />
        ))}
      </colgroup>
      <thead className="sticky top-0 z-[1] bg-background">
        <tr>
          <th rowSpan={2} className={cn(TH, "align-top")}>
            <span className="flex items-center gap-2">
              Treatment
              <span className="ml-auto flex items-center gap-2">
                {sortMenu(BY_NAME, [
                  { label: "Name, A to Z", dir: 1 },
                  { label: "Name, Z to A", dir: -1 },
                ])}
                <Resize width={widths.treatment} onWidth={(w) => setWidths((p) => ({ ...p, treatment: w }))} />
              </span>
            </span>
          </th>
          <th rowSpan={2} className={cn(TH, "border-l align-top")}>
            <span className="flex items-center gap-2">
              Segment
              <span className="ml-auto">
                <Resize width={widths.segment} onWidth={(w) => setWidths((p) => ({ ...p, segment: w }))} />
              </span>
            </span>
          </th>
          {view.primary > 0 && (
            <th colSpan={view.primary} className="border-b border-l px-3 pt-2 pb-1 text-left text-xs font-normal text-muted-foreground">
              Primary
            </th>
          )}
          {view.metrics.length > view.primary && (
            <th colSpan={view.metrics.length - view.primary} className="border-b border-l px-3 pt-2 pb-1 text-left text-xs font-normal text-muted-foreground">
              Secondary
            </th>
          )}
        </tr>
        <tr>
          {view.metrics.map((m) => (
            <th key={m} className={cn(TH, "border-l")}>
              <span className="flex items-center gap-2">
                <span className="truncate">{metricShort(m)}</span>
                <span className="ml-auto flex items-center gap-2">
                  {defs.get(m) && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" aria-label={`About ${labels.get(m) ?? metricShort(m)}`} className={HEAD_ICON}>
                          <Info className="size-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-72">{defs.get(m)}</TooltipContent>
                    </Tooltip>
                  )}
                  {sortMenu(
                    m,
                    [
                      { label: "Lift, high to low", dir: -1 },
                      { label: "Lift, low to high", dir: 1 },
                    ],
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setMetricsOff((prev) => [...prev, m])}>Hide this metric</DropdownMenuItem>
                    </>
                  )}
                </span>
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {view.groups.map((g) => (
          <React.Fragment key={g.dim ?? ""}>
            {g.dim && (
              <tr>
                <td className="border-b bg-pax2-mist" />
                <td colSpan={width - 1} className="border-b bg-pax2-mist px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                  {g.name}
                </td>
              </tr>
            )}
            {shown.flatMap((o) => {
              const segs = g.segs.filter((s) => view.metrics.some((m) => read.cell(o, m, s.key)))
              return segs.map((s, i) => row(o, s, i === 0, i === segs.length - 1, about?.option === o && about.seg === s.key))
            })}
          </React.Fragment>
        ))}
        {canLoad && <MoreRow span={width} onMore={more} />}
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

/** A result as Swayable draws it: the control group's level at the axis, a
 *  bar of the lift from it (its tip pointing the way the treatment moved), the
 *  lift at the tip, and the margin as a line through the bar where there is
 *  one. A lift that does not clear its test is gray. */
function Candle({ cell, extent }: { cell: Cell; extent: number }) {
  const d = cell.lift[7]
  const moe = cell.lift[9]
  const quiet = significance(cell.lift) === false
  const up = d >= 0
  const at = (x: number) => Math.min(100, Math.max(0, 50 + (extent > 0 ? (x / extent) * REACH : 0)))
  const tip = at(d)
  return (
    <span className="relative block h-6 w-full text-[13px]">
      {cell.control && (
        <span className="absolute top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground" style={up ? { right: "calc(50% + 5px)" } : { left: "calc(50% + 5px)" }} title={`Control group ${levelOf(cell.control)}`}>
          {num(cell.control[7])}
        </span>
      )}
      <span
        aria-hidden
        className={cn("absolute top-1/2 h-3.5 -translate-y-1/2", quiet ? "bg-muted-foreground/25" : up ? "bg-linear-to-r from-pax2-light-blue/45 to-pax2-light-blue" : "bg-linear-to-l from-pax2-red/45 to-pax2-red")}
        style={{ left: `${Math.min(50, tip)}%`, width: `max(6px, ${Math.abs(tip - 50)}%)`, clipPath: up ? POINT_RIGHT : POINT_LEFT }}
      />
      {moe != null && (
        <span aria-hidden className={cn("absolute top-1/2 h-[1.5px] -translate-y-1/2", quiet ? "bg-muted-foreground/45" : "bg-foreground/40")} style={{ left: `${at(d - moe)}%`, width: `${at(d + moe) - at(d - moe)}%` }} />
      )}
      <span
        className={cn("absolute top-1/2 -translate-y-1/2 font-semibold", quiet ? "font-medium text-muted-foreground" : !up && "text-pax2-red")}
        style={up ? { left: `calc(${tip}% + ${tip - 50 < 1 ? 8 : 3}px)` } : { right: `calc(${100 - tip}% + ${50 - tip < 1 ? 8 : 3}px)` }}
      >
        {signed(d)}
      </span>
    </span>
  )
}

/** The column-resize handle: drag it to set the column's width. */
function Resize({ width, onWidth }: { width: number; onWidth: (w: number) => void }) {
  const start = (e: React.PointerEvent) => {
    e.preventDefault()
    const x0 = e.clientX
    const move = (ev: PointerEvent) => onWidth(Math.min(480, Math.max(120, width + ev.clientX - x0)))
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }
  return (
    <button type="button" aria-label="Resize the column" title="Drag to resize" onPointerDown={start} className={cn(HEAD_ICON, "cursor-col-resize")}>
      <SeparatorVertical className="size-4" />
    </button>
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
