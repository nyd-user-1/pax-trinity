"use client"

import * as React from "react"
import { Combobox } from "@base-ui/react/combobox"
import { ArrowDownUp, ChartColumn, Check, CircleDashed, Copy, Download, Folder, Funnel, GripVerticalIcon, Info, ListFilter, Loader2, PanelLeftClose, PanelLeftOpen, SeparatorVertical, Share, Spline, Users } from "lucide-react"

import { cn } from "@/lib/utils"
import { BankFrame, BankRail as RailState } from "@/components/bank/bank-frame"
import { BankRail, RailGroup, RailRow } from "@/components/bank/bank-rail"
import { ViewToggle } from "@/components/bank/pane-bars"
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
import { dimOf, fielding, isPlacebo, metricShort, ordered, periodKey, segKey, segOf, significance, testOf, treatmentName, valOf, type Cell, type Pick } from "./lift-data"
import { Candle, EmotionBar, EmotionKey, heat, HeatKey, sampleEmotions } from "./lift-marks"

// /lift — Swayable's results view (Brendan, 2026-10-28, from the Dream Crazy
// Campaign screen): the folders in the rail (the PAX tests, the archive of
// campaigns' own experiments); a toolbar of Treatments, Metrics, Segments and
// Filter menus with Options, Share, Download and the respondent count; then
// one table. Treatment and Segment down the left, each a resizable column;
// the metrics across (Primary and Secondary label them in the Metrics menu), each with its definition
// and a sort menu. Every treatment's Everyone row comes first, then a mist
// band per breakdown with each treatment's segments under it. A cell is the
// control group's level and a bar of the lift from it, its margin drawn
// through it where there is one, gray where the lift does not clear its test.
// A clicked cell's row takes the rows' selected dress and About Result comes
// in at the right. The archive's five hundred treatments read twenty-five at
// a time. ?source=PAX_TEST or ?source=LIFT_ARCHIVE opens on that folder.
// Heatmap (the Chime Demo screen, Brendan, 2026-10-29) is the second view:
// Breakdown, Content and Segment down the left, each lift a number in a cell
// shaded from the benchmark's median, the median's own row leading each
// breakdown. Emotional Response stands in both views on placeholder shares.

const SOURCES: Record<string, string> = { PAX_TEST: "Tests", LIFT_ARCHIVE: "Archive" }
const PER_READ = 25
const BY_NAME = "@name"
const PLACEBO = "\u0000placebo"
/** The outcome each test was built to move: the MA tests' ballot support, the archive's two indices. The rest are Secondary. */
const PRIMARY = new Set(["lift_support", "lift_favorability", "lift_vote_choice"])
/** The Emotional Response column's key in the Metrics menu and metricsOff. */
const EMOTION = "@emotion"
/** Every metric column's opening width, Emotional Response's too (Brendan, 2026-10-29: the three alike); each drags on its own. */
const METRIC_WIDTH = 280

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

const TOOL = "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-foreground/80 outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:bg-muted aria-expanded:bg-muted"
const TOOL_ICON = "size-3.5 text-muted-foreground"
const TH = "border-b px-3 py-2 text-left text-[13px] font-medium whitespace-nowrap"
const TD = "border-b px-3 py-2 align-middle text-[13px]"
const HEAD_ICON = "shrink-0 text-muted-foreground hover:text-foreground aria-expanded:text-foreground"
/** A cell's button: the grid's focus frame, no pressed state; the row carries the selection. */
const FRAME = "block w-full rounded-[3px] text-left tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pax2-light-blue"
/** A heatmap cell's button: the fill is the cell, the focus frame inside it. */
const HEAT = "flex h-10 w-full items-center justify-center text-[13px] tabular-nums focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-pax2-light-blue"

type Sort = { by: string; dir: 1 | -1 }

export function LiftSurface() {
  // A shared link's view, read once before the first render (see share).
  const [link] = React.useState(readLink)
  const [index, setIndex] = React.useState<AudienceIndex | null>(null)
  const [source, setSource] = React.useState<string>(() => {
    const at = link.one("source")
    return at && at in SOURCES ? at : "PAX_TEST"
  })
  const [files, setFiles] = React.useState<Record<string, SourceRow[]>>({})
  const [error, setError] = React.useState<string | null>(null)
  const [metricsOff, setMetricsOff] = React.useState<string[]>(() => link.list("mo"))
  // The Treatments menu's choice; null is the folder's opening set.
  const [picked, setPicked] = React.useState<string[] | null>(() => (link.has("t") ? link.list("t") : null))
  const [segsOff, setSegsOff] = React.useState<string[]>(() => link.list("so"))
  const [periodsOff, setPeriodsOff] = React.useState<string[]>(() => link.list("fo"))
  // A linked cell opens once its folder has read: [treatment, metric, segment].
  const [linkedPick, setLinkedPick] = React.useState<string[] | null>(() => (link.list("at").length >= 3 ? link.list("at") : null))
  const [sort, setSort] = React.useState<Sort | null>(null)
  const [about, setAbout] = React.useState<Pick | null>(null)
  // About Result slides in and out: the last pick stays drawn while it slides shut.
  const [sheet, setSheet] = React.useState<Pick | null>(null)
  React.useEffect(() => {
    if (about) setSheet(about)
  }, [about])
  const [depth, setDepth] = React.useState(PER_READ)
  const [widths, setWidths] = React.useState({ treatment: 220, segment: 170 })
  const [metricWidths, setMetricWidths] = React.useState<Record<string, number>>({})
  const widthOf = (key: string) => metricWidths[key] ?? METRIC_WIDTH
  const resizeMetric = (key: string) => (w: number) => setMetricWidths((p) => ({ ...p, [key]: w }))
  const [shared, setShared] = React.useState(false)
  const [display, setDisplay] = React.useState<"bars" | "heatmap">(() => (link.one("view") === "heatmap" ? "heatmap" : "bars"))
  // The heatmap's benchmark: every lift on file for the metric and segment, by its median.
  const [bench, setBench] = React.useState(() => link.one("bench") !== "0")

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

  // Another folder opens on its own defaults.
  const openFolder = (key: string) => {
    if (key === source) return
    setSource(key)
    setMetricsOff([])
    setPicked(null)
    setSegsOff([])
    setPeriodsOff([])
    setSort(null)
    setAbout(null)
    setLinkedPick(null)
    setDepth(PER_READ)
  }
  React.useEffect(() => setDepth(PER_READ), [sort])

  const labels = React.useMemo(() => new Map((index?.constructs ?? []).map((c) => [c.construct, c.label])), [index])
  const defs = React.useMemo(() => new Map((index?.constructs ?? []).map((c) => [c.construct, c.definition])), [index])
  const geoName = React.useMemo(() => new Map((index?.geographies ?? []).map((g) => [g.code, g.name])), [index])
  const place = React.useCallback((code: string) => geoName.get(code) ?? code, [geoName])
  const questions = React.useMemo(() => (index?.questions ?? []).filter((q) => q.source in SOURCES), [index])

  const rows = files[source]

  // The folder read once: its metrics (Primary first), fieldings, treatments
  // and breakdowns, and each result keyed for the table. A row is a treatment
  // in one fielding (an entry): a treatment tested in two waves is two rows,
  // and the Filter's fieldings decide which survive (Brendan, 2026-10-29: the
  // latest fielding no longer shadows the others).
  const read = React.useMemo(() => {
    if (!rows) return null
    const off = new Set(periodsOff)
    const metrics: string[] = []
    const periods: { key: string; name: string; dates: string }[] = []
    const options: string[] = []
    const seen = new Set<string>()
    const entries: string[] = []
    const seenEntry = new Set<string>()
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
        const ek = entryKey(r[4], pk)
        lifts.set(`${ek}\u0001${r[0]}\u0001${sk}`, r)
        if (!seen.has(r[4])) {
          seen.add(r[4])
          options.push(r[4])
        }
        if (!seenEntry.has(ek)) {
          seenEntry.add(ek)
          entries.push(ek)
        }
      } else if (r[8] === "pct") levels.set(`${isPlacebo(r[4]) ? PLACEBO : r[4]}\u0001${r[0]}\u0001${sk}\u0001${pk}`, r)
    }
    periods.sort((a, b) => a.key.localeCompare(b.key))
    metrics.sort((a, b) => Number(PRIMARY.has(b)) - Number(PRIMARY.has(a)))
    for (const [d, vs] of dims) dims.set(d, ordered(vs))
    // Each treatment's entries, latest fielding first.
    const byOption = new Map<string, string[]>()
    for (const ek of entries) byOption.set(optionOf(ek), [...(byOption.get(optionOf(ek)) ?? []), ek])
    for (const list of byOption.values()) list.sort((a, b) => fieldingOf(b).localeCompare(fieldingOf(a)))
    const cell = (ek: string, metric: string, sk: string): Cell | null => {
      const lift = lifts.get(`${ek}\u0001${metric}\u0001${sk}`)
      if (!lift) return null
      const option = optionOf(ek)
      const pk = fieldingOf(ek)
      return { lift, level: levels.get(`${option}\u0001${metric}\u0001${sk}\u0001${pk}`) ?? null, control: levels.get(`${PLACEBO}\u0001${metric}\u0001${sk}\u0001${pk}`) ?? null }
    }
    return { metrics, periods, options, byOption, dims, cell }
  }, [rows, periodsOff])

  // The benchmark's median per metric and segment: every treatment's lift on file, every fielding.
  const medians = React.useMemo(() => {
    const by = new Map<string, number[]>()
    for (const r of rows ?? []) {
      if (r[8] !== "lift_pp") continue
      const k = `${r[0]}\u0001${segOf(r)}`
      by.set(k, [...(by.get(k) ?? []), r[7]])
    }
    const out = new Map<string, { median: number; n: number }>()
    for (const [k, vs] of by) {
      const s = [...vs].sort((a, b) => a - b)
      const m = s.length >> 1
      out.set(k, { median: s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2, n: s.length })
    }
    return out
  }, [rows])
  const median = React.useCallback((metric: string, seg: string) => medians.get(`${metric}\u0001${seg}`) ?? null, [medians])

  React.useEffect(() => {
    if (!read || !linkedPick) return
    const [o, m, sk, pk] = linkedPick
    const ek = pk ? entryKey(o, pk) : (read.byOption.get(o) ?? []).find((e) => read.cell(e, m, sk))
    const c = ek ? read.cell(ek, m, sk) : null
    if (ek && c) setAbout({ option: o, entry: ek, metric: m, seg: sk, segName: sk ? sk.slice(sk.indexOf("=") + 1) : "Everyone", cell: c })
    setLinkedPick(null)
  }, [read, linkedPick])

  const chosen = React.useMemo(() => {
    if (!read) return []
    const featured = FEATURED[source]
    // The opening set: the featured treatments, and every treatment of the fieldings on that they are not in
    // (Brendan, through the lead, 2026-10-29), so both waves on shows both waves.
    if (!picked && featured) {
      const theirs = new Set(featured.flatMap((o) => (read.byOption.get(o) ?? []).map(fieldingOf)))
      if (theirs.size) return read.options.filter((o) => featured.includes(o) || (read.byOption.get(o) ?? []).some((ek) => !theirs.has(fieldingOf(ek))))
    }
    const on = picked ?? featured ?? read.options
    // The Filter wins: a set with no rows in the surviving fieldings gives way to those fieldings' treatments.
    return on.length && !on.some((o) => read.options.includes(o)) ? read.options : on.filter((o) => read.options.includes(o))
  }, [read, picked, source])

  const view = React.useMemo(() => {
    if (!read) return null
    const metrics = read.metrics.filter((m) => !metricsOff.includes(m))
    const by = sort?.by === BY_NAME ? BY_NAME : sort && metrics.includes(sort.by) ? sort.by : (metrics[0] ?? BY_NAME)
    const dir = sort && sort.by === by ? sort.dir : by === BY_NAME ? 1 : -1
    const measured = (o: string) => (read.byOption.get(o) ?? []).filter((ek) => metrics.some((m) => read.cell(ek, m, "")))
    // A treatment sorts by its latest entry the metric measured; its entries stay together, latest first.
    const lead = (o: string) => measured(o).map((ek) => read.cell(ek, by, "")?.lift[7]).find((v) => v != null)
    const treatments = read.options
      .filter((o) => chosen.includes(o) && measured(o).length)
      .sort((a, b) => {
        if (by === BY_NAME) return dir * treatmentName(a).localeCompare(treatmentName(b))
        const x = lead(a)
        const y = lead(b)
        // A treatment the sorting metric did not measure goes last either way.
        return x == null ? (y == null ? 0 : 1) : y == null ? -1 : dir * (x - y)
      })
      .flatMap(measured)
    // With more than one fielding on, each row names its own.
    const names = new Map(read.periods.map((p) => [p.key, p.name]))
    const several = read.periods.filter((p) => !periodsOff.includes(p.key)).length > 1
    const waveOf = (ek: string) => (several ? (names.get(fieldingOf(ek)) ?? null) : null)
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
    // The heatmap shades each lift from its center, the benchmark's median or zero.
    let spread = 0
    for (const o of treatments)
      for (const m of metrics)
        for (const g of groups)
          for (const s of g.segs) {
            const c = read.cell(o, m, s.key)
            if (c) spread = Math.max(spread, Math.abs(c.lift[7] - (bench ? (median(m, s.key)?.median ?? 0) : 0)))
          }
    const primary = metrics.filter((m) => PRIMARY.has(m)).length
    const emotion = !metricsOff.includes(EMOTION)
    return { metrics, primary, emotion, by, dir, treatments, waveOf, groups, segCount: groups.reduce((n, g) => n + g.segs.length, 0), extent, spread, respondents }
  }, [read, chosen, metricsOff, segsOff, periodsOff, sort, bench, median])

  const shown = view ? view.treatments.slice(0, depth) : []
  const canLoad = view ? depth < view.treatments.length : false
  const more = React.useCallback(() => setDepth((d) => d + PER_READ), [])

  const complete = Object.keys(SOURCES).every((s) => files[s])

  const download = () => {
    if (!read || !view) return
    const head = ["Breakdown", "Segment", "Treatment", "Test", ...view.metrics.flatMap((m) => [`${metricShort(m)} control`, `${metricShort(m)} treatment`, `${metricShort(m)} lift`, `${metricShort(m)} ±`, `${metricShort(m)} significant`, `${metricShort(m)} n`])]
    const lines = view.groups.flatMap((g) =>
      view.treatments.flatMap((o) =>
        g.segs
          .filter((s) => view.metrics.some((m) => read.cell(o, m, s.key)))
          .map((s) => [
            g.dim ? g.name : "Total",
            s.name,
            treatmentName(optionOf(o)),
            testName(view.metrics.map((m) => read.cell(o, m, s.key)).find(Boolean)!.lift),
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

  // The link carries the whole view: the folder, the display, the treatments where they differ from the folder's
  // opening set, what is hidden, the benchmark off, and the open cell.
  const share = () => {
    const pairs: [string, string[]][] = [["source", [source]]]
    if (display === "heatmap") pairs.push(["view", ["heatmap"]])
    const featured = FEATURED[source]
    const opening = read ? (featured ? read.options.filter((o) => featured.includes(o)) : read.options) : []
    if (picked && (picked.length !== opening.length || picked.some((o) => !opening.includes(o)))) pairs.push(["t", picked])
    if (metricsOff.length) pairs.push(["mo", metricsOff])
    if (segsOff.length) pairs.push(["so", segsOff])
    if (periodsOff.length) pairs.push(["fo", periodsOff])
    if (!bench) pairs.push(["bench", ["0"]])
    if (about) pairs.push(["at", [about.option, about.metric, about.seg, fieldingOf(about.entry)]])
    const url = `${window.location.origin}${window.location.pathname}?${pairs.map(([k, vs]) => `${k}=${vs.map(linkPart).join(",")}`).join("&")}`
    navigator.clipboard.writeText(url)
    setShared(true)
    window.setTimeout(() => setShared(false), 1400)
  }

  const rail = (
    <BankRail title="Lift">
      <RailGroup label="Folders">
        {Object.entries(SOURCES).map(([key, name]) => (
          <RailRow key={key} on={source === key} onClick={() => openFolder(key)} icon={Folder} label={name} count={questions.filter((q) => q.source === key).length || null} />
        ))}
      </RailGroup>
    </BankRail>
  )

  const filterCount = periodsOff.length ? 1 : 0
  const segGroups = read ? [{ dim: null as string | null, name: "Everyone", vals: [null as string | null] }, ...[...read.dims].map(([d, vs]) => ({ dim: d as string | null, name: dimLabel(d), vals: vs as (string | null)[] }))] : []
  const toolbar = (
    <div className="flex h-11 shrink-0 items-center gap-0.5 border-b px-3">
      <SidebarToggle />
      <span aria-hidden className="mx-1 h-4 w-px bg-border" />
      <TreatmentPicker options={read?.options ?? []} chosen={chosen} onChosen={setPicked} count={view ? new Set(view.treatments.map(optionOf)).size : 0} disabled={!read} />
      <span aria-hidden className="mx-1 h-4 w-px bg-border" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={TOOL} disabled={!read}>
            <Spline className={TOOL_ICON} />
            {plural((view?.metrics.length ?? 0) + (view?.emotion ? 1 : 0), "Metric")}
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
          <DropdownMenuLabel className="text-xs text-muted-foreground">Emotion</DropdownMenuLabel>
          <DropdownMenuCheckboxItem checked={!metricsOff.includes(EMOTION)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => setMetricsOff((prev) => toggled(prev, EMOTION))}>
            Emotional response
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <span aria-hidden className="mx-1 h-4 w-px bg-border" />
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

      <span aria-hidden className="mx-1 h-4 w-px bg-border" />
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

      {display === "heatmap" && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={TOOL} disabled={!read}>
                <ChartColumn className={TOOL_ICON} />
                {bench ? "All tests (Median)" : "No benchmark"}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-max min-w-52">
              <DropdownMenuRadioGroup value={bench ? "median" : "none"} onValueChange={(v) => setBench(v === "median")}>
                <DropdownMenuRadioItem value="median">All tests (Median)</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="none">No benchmark</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <HeatKey center={bench ? "median" : "zero"} />
        </>
      )}

      <div className="ml-auto flex items-center gap-0.5">
        <span className="mr-1.5">
          <ViewToggle
            views={[
              { value: "bars", label: "Bars" },
              { value: "heatmap", label: "Heatmap" },
            ]}
            value={display}
            onChange={setDisplay}
          />
        </span>
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

  const ariaSort = (by: string) => (view?.by === by ? (view.dir === 1 ? "ascending" : "descending") : undefined)
  const sortMenu = (by: string, items: { label: string; dir: 1 | -1 }[], extra?: React.ReactNode) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Sort" className={cn(HEAD_ICON, view?.by === by && "text-foreground")}>
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

  const cols = view ? view.metrics.length + (view.emotion ? 1 : 0) : 0
  const metricsWidth = view ? view.metrics.reduce((n, m) => n + widthOf(m), 0) + (view.emotion ? widthOf(EMOTION) : 0) : 0
  // Stable, so a pick re-renders only the rows whose selection changed (the rows are memoized).
  // The same cell again closes the panel.
  const pick = React.useCallback(
    (ek: string, m: string, s: Seg, c: Cell) => setAbout((prev) => (prev && prev.entry === ek && prev.metric === m && prev.seg === s.key ? null : { option: optionOf(ek), entry: ek, metric: m, seg: s.key, segName: s.name, cell: c })),
    []
  )

  const contentHead = (first: boolean) => (
    <th aria-sort={ariaSort(BY_NAME)} className={cn(TH, !first && "border-l")}>
      <span className="flex items-center gap-2">
        Content
        <span className="ml-auto flex items-center gap-2">
          {sortMenu(BY_NAME, [
            { label: "Name, A to Z", dir: 1 },
            { label: "Name, Z to A", dir: -1 },
          ])}
          <Resize width={widths.treatment} onWidth={(w) => setWidths((p) => ({ ...p, treatment: w }))} />
        </span>
      </span>
    </th>
  )
  const segmentHead = (
    <th className={cn(TH, "border-l")}>
      <span className="flex items-center gap-2">
        Segment
        <span className="ml-auto">
          <Resize width={widths.segment} onWidth={(w) => setWidths((p) => ({ ...p, segment: w }))} />
        </span>
      </span>
    </th>
  )
  const metricHeads = view && (
    <>
      {view.metrics.map((m, i) => (
        <th key={m} aria-sort={ariaSort(m)} className={cn(TH, "relative border-l")}>
          <span className="flex items-center gap-2">
            <span className="truncate" title={metricShort(m)}>
              {metricShort(m)}
            </span>
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
          <ColumnGrip width={widthOf(m)} onWidth={resizeMetric(m)} last={!view.emotion && i === view.metrics.length - 1} />
        </th>
      ))}
      {view.emotion && (
        <th className={cn(TH, "relative border-l")}>
          <span className="flex items-center gap-2">
            Emotional Response
            <span className="rounded-md border px-1.5 py-px text-[10px] font-normal text-muted-foreground">Sample</span>
            <span className="ml-auto flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="About Emotional Response" className={HEAD_ICON}>
                    <Info className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-72">
                  <p className="mb-1.5">The share of respondents naming each feeling after the ad. No test has asked it yet: these shares are placeholders.</p>
                  <EmotionKey className="text-background/80" />
                </TooltipContent>
              </Tooltip>
            </span>
          </span>
          <ColumnGrip width={widthOf(EMOTION)} onWidth={resizeMetric(EMOTION)} last />
        </th>
      )}
    </>
  )
  const barsTable = view && read && (
    <table className="table-fixed border-collapse" style={{ width: widths.treatment + widths.segment + metricsWidth, minWidth: "100%" }}>
      <colgroup>
        <col style={{ width: widths.treatment }} />
        <col style={{ width: widths.segment }} />
        {view.metrics.map((m) => (
          <col key={m} style={{ width: widthOf(m) }} />
        ))}
        {view.emotion && <col style={{ width: widthOf(EMOTION) }} />}
      </colgroup>
      <thead className="sticky top-0 z-[1] bg-background">
        <tr>
          {contentHead(true)}
          {segmentHead}
          {metricHeads}
        </tr>
      </thead>
      <tbody>
        {view.groups.map((g) => (
          <React.Fragment key={g.dim ?? ""}>
            {g.dim && (
              <tr>
                <td className="border-b bg-pax2-mist" />
                <td colSpan={1 + cols} className="border-b bg-pax2-mist px-3 py-1.5 text-xs font-semibold text-foreground">
                  {g.name}
                </td>
              </tr>
            )}
            {shown.flatMap((o) => {
              const segs = g.segs.filter((s) => view.metrics.some((m) => read.cell(o, m, s.key)))
              return segs.map((s, i) => <BarsRow key={`${o}\u0001${s.key}`} o={o} s={s} first={i === 0} last={i === segs.length - 1} sel={about?.entry === o && about.seg === s.key} read={read} view={view} onPick={pick} />)
            })}
          </React.Fragment>
        ))}
        {canLoad && <MoreRow span={2 + cols} onMore={more} />}
      </tbody>
    </table>
  )

  const heatTable = view && read && (
    <table className="table-fixed border-collapse" style={{ width: 110 + widths.treatment + widths.segment + metricsWidth, minWidth: "100%" }}>
      <colgroup>
        <col style={{ width: 110 }} />
        <col style={{ width: widths.treatment }} />
        <col style={{ width: widths.segment }} />
        {view.metrics.map((m) => (
          <col key={m} style={{ width: widthOf(m) }} />
        ))}
        {view.emotion && <col style={{ width: widthOf(EMOTION) }} />}
      </colgroup>
      <thead className="sticky top-0 z-[1] bg-background">
        <tr>
          <th className={TH}>Breakdown</th>
          {contentHead(false)}
          {segmentHead}
          {metricHeads}
        </tr>
      </thead>
      <tbody>
        {view.groups.map((g) => {
          // The benchmark's median rows lead each breakdown, then each treatment's segments.
          const blocks = [
            ...(bench ? [{ o: null as string | null, segs: g.segs.filter((s) => view.metrics.some((m) => median(m, s.key))) }] : []),
            ...shown.map((o) => ({ o: o as string | null, segs: g.segs.filter((s) => view.metrics.some((m) => read.cell(o, m, s.key))) })),
          ].filter((b) => b.segs.length)
          // Named once at the top of its run, the way the bars view names a treatment: no row spans, so a row's dress stays its own.
          return blocks.flatMap((b, bi) =>
            b.segs.map((s, si) => (
              <HeatRow
                key={`${g.dim ?? ""}\u0001${b.o ?? "@median"}\u0001${s.key}`}
                o={b.o}
                s={s}
                breakdown={bi === 0 && si === 0 ? (g.dim ? g.name : "Overall") : null}
                firstOfBlock={si === 0}
                lastOfBlock={si === b.segs.length - 1}
                lastOfGroup={bi === blocks.length - 1 && si === b.segs.length - 1}
                sel={b.o != null && about?.entry === b.o && about.seg === s.key}
                read={read}
                view={view}
                bench={bench}
                median={median}
                onPick={pick}
              />
            ))
          )
        })}
        {canLoad && <MoreRow span={3 + cols} onMore={more} />}
      </tbody>
    </table>
  )
  const table = display === "heatmap" ? heatTable : barsTable

  return (
    <BankFrame rail={rail} crumb="Lift" search={NO_SEARCH} bare>
      <div className="flex h-full min-h-0 flex-col">
        {toolbar}
        <div className="relative flex min-h-0 flex-1">
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
            {view && !shown.length && (
              <p className="p-6 text-center text-sm text-muted-foreground">{read && read.options.length && !chosen.length ? "No treatments picked — choose one under Treatments." : "Nothing on file."}</p>
            )}
          </div>
          {/* About Result in the house drawer's dress (the shell's Discussion panel): a card floating over the table at
              the right, 18px in from the edges, sliding in and out on its transform. */}
          <div
            className={cn("absolute inset-y-[18px] right-[18px] z-20 w-[min(400px,calc(100%-36px))] transition-transform duration-300 ease-in-out", about ? "translate-x-0" : "pointer-events-none translate-x-[calc(100%+18px)]")}
            onTransitionEnd={(e) => e.target === e.currentTarget && !about && setSheet(null)}
          >
            {(about ?? sheet) && (
              <AboutResult key={`${(about ?? sheet)!.entry}\u0001${(about ?? sheet)!.metric}\u0001${(about ?? sheet)!.seg}`} pick={(about ?? sheet)!} files={files} folder={source} folders={SOURCES} complete={complete} place={place} onClose={() => setAbout(null)} />
            )}
          </div>
        </div>
      </div>
    </BankFrame>
  )
}

/** The frame is bare (Brendan, 2026-10-29): no header row, so no header search; the rail's toggle leads the toolbar. */
const NO_SEARCH = { query: "", onQuery: () => {}, placeholder: "" }

/** The rail's open and close, at the toolbar's head (Brendan, 2026-10-29). */
function SidebarToggle() {
  const rail = React.useContext(RailState)
  if (!rail) return null
  const Icon = rail.open ? PanelLeftClose : PanelLeftOpen
  const label = rail.open ? "Hide sidebar" : "Show sidebar"
  return (
    <button type="button" onClick={rail.toggle} aria-label={label} title={label} className={cn(TOOL, "px-1.5")}>
      <Icon className="size-4 text-muted-foreground" />
    </button>
  )
}

/** The Treatments menu as a combobox: type to narrow, arrow keys and Enter (or a click) to show or hide one. */
function TreatmentPicker({ options, chosen, onChosen, count, disabled }: { options: string[]; chosen: string[]; onChosen: (v: string[]) => void; count: number; disabled: boolean }) {
  const input = React.useRef<HTMLInputElement>(null)
  return (
    <Combobox.Root items={options} multiple autoHighlight value={chosen} onValueChange={(v) => onChosen(v as string[])} itemToStringLabel={(o: string) => treatmentName(o)}>
      <Combobox.Trigger className={cn(TOOL, "data-[popup-open]:bg-muted")} disabled={disabled}>
        <Copy className={TOOL_ICON} />
        {plural(count, "Treatment")}
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner align="start" sideOffset={4} className="z-50">
          <Combobox.Popup initialFocus={input} className="w-72 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
            <div className="border-b p-1.5">
              <Combobox.Input ref={input} aria-label="Find a treatment" className="w-full rounded-md px-2 py-1 text-sm outline-none" />
            </div>
            <Combobox.Empty className="px-3 py-2 text-sm text-muted-foreground empty:hidden">Nothing matching.</Combobox.Empty>
            <Combobox.List className="max-h-80 overflow-y-auto p-1 empty:hidden">
              {(o: string) => (
                <Combobox.Item key={o} value={o} className="relative flex cursor-default items-center rounded-sm py-1.5 pr-2 pl-8 text-sm outline-none select-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground">
                  <Combobox.ItemIndicator className="absolute left-2 flex size-3.5 items-center justify-center">
                    <Check className="size-4" />
                  </Combobox.ItemIndicator>
                  {THUMB[o] ? <img src={THUMB[o]} alt="" width={36} height={24} className="mr-2.5 h-6 w-9 shrink-0 rounded-[3px] bg-muted object-cover" /> : <span aria-hidden className="mr-2.5 h-6 w-9 shrink-0 rounded-[3px] bg-muted" />}
                  <span className="truncate">{treatmentName(o)}</span>
                </Combobox.Item>
              )}
            </Combobox.List>
            <div className="flex justify-between border-t px-2 py-1.5 text-xs">
              <button type="button" onClick={() => onChosen(options)} className="rounded px-1.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                Show all
              </button>
              <button type="button" onClick={() => onChosen([])} className="rounded px-1.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                Hide all
              </button>
            </div>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}

/** A link's parts: each percent-encoded, so a treatment's commas and parentheses survive; Everyone's empty key reads "all". */
const linkPart = (x: string) => encodeURIComponent(x || "all")
function readLink() {
  const raw = new Map<string, string>()
  for (const pair of window.location.search.slice(1).split("&")) {
    const i = pair.indexOf("=")
    if (i > 0) raw.set(pair.slice(0, i), pair.slice(i + 1))
  }
  const part = (x: string) => {
    const v = decodeURIComponent(x)
    return v === "all" ? "" : v
  }
  return {
    has: (k: string) => raw.has(k),
    one: (k: string) => (raw.has(k) ? part(raw.get(k)!) : null),
    list: (k: string) => (raw.get(k) ? raw.get(k)!.split(",").map(part) : []),
  }
}

/** A row's test in the CSV: the wave's name where the results register knows the fielding, else the study. */
const testName = (lift: SourceRow) => WAVE.get(periodKey(lift)) ?? testOf(lift)

type Seg = { key: string; name: string }
type RowRead = { cell: (option: string, metric: string, sk: string) => Cell | null }
type RowView = { metrics: string[]; emotion: boolean; extent: number; spread: number; waveOf: (ek: string) => string | null }
type OnPick = (o: string, m: string, s: Seg, c: Cell) => void

const fmt = (v: number) => `${v < 0 ? "−" : ""}${num(Math.abs(v))}`

/** A row's entry: a treatment in one fielding. */
const entryKey = (option: string, fielding: string) => `${option}\u0002${fielding}`
const optionOf = (ek: string) => ek.slice(0, ek.indexOf("\u0002"))
const fieldingOf = (ek: string) => ek.slice(ek.indexOf("\u0002") + 1)

function creative(ek: string, wave: string | null) {
  const o = optionOf(ek)
  return (
    <span className="flex min-h-6 items-center gap-2.5">
      {THUMB[o] && <img src={THUMB[o]} alt="" width={36} height={24} className="h-6 w-9 shrink-0 rounded-[3px] bg-muted object-cover" />}
      <span className="line-clamp-2 font-medium" title={o}>
        {treatmentName(o)}
      </span>
      {wave && <span className="shrink-0 rounded-md border px-1.5 py-px text-[10.5px] whitespace-nowrap text-muted-foreground">{wave}</span>}
    </span>
  )
}

function EmotionCell({ o, s }: { o: string; s: Seg }) {
  return (
    <td className={cn(TD, "border-l")}>
      <EmotionBar shares={sampleEmotions(`${o}\u0001${s.key}`)} />
    </td>
  )
}

/** A bars-view row. Memoized: a pick re-renders only the rows it selects and unselects. */
const BarsRow = React.memo(function BarsRow({ o, s, first, last, sel, read, view, onPick }: { o: string; s: Seg; first: boolean; last: boolean; sel: boolean; read: RowRead; view: RowView; onPick: OnPick }) {
  return (
    <tr className={rowDress(sel)}>
      <td className={cn(TD, !last && "border-b-transparent")}>{first && creative(o, view.waveOf(o))}</td>
      <td className={cn(TD, "border-l")}>{s.name}</td>
      {view.metrics.map((m) => {
        const c = read.cell(o, m, s.key)
        return (
          <td key={m} className={cn(TD, "border-l")}>
            {c ? (
              <button type="button" onClick={() => onPick(o, m, s, c)} className={FRAME}>
                <Candle cell={c} extent={view.extent} />
              </button>
            ) : (
              <span className="block text-center text-xs text-muted-foreground/40">—</span>
            )}
          </td>
        )
      })}
      {view.emotion && <EmotionCell o={o} s={s} />}
    </tr>
  )
})

/** A heatmap row: a treatment's segment, or (o null) the benchmark's median for it. Memoized as BarsRow is. */
const HeatRow = React.memo(function HeatRow({
  o,
  s,
  breakdown,
  firstOfBlock,
  lastOfBlock,
  lastOfGroup,
  sel,
  read,
  view,
  bench,
  median,
  onPick,
}: {
  o: string | null
  s: Seg
  breakdown: string | null
  firstOfBlock: boolean
  lastOfBlock: boolean
  lastOfGroup: boolean
  sel: boolean
  read: RowRead
  view: RowView
  bench: boolean
  median: (metric: string, seg: string) => { median: number; n: number } | null
  onPick: OnPick
}) {
  // Named once at the top of its run, the way the bars view names a treatment: no row spans, so a row's dress stays its own.
  return (
    <tr className={o ? rowDress(sel) : undefined}>
      <td className={cn(TD, "font-medium", !lastOfGroup && "border-b-transparent")}>{breakdown}</td>
      <td className={cn(TD, "border-l", !lastOfBlock && "border-b-transparent")}>
        {firstOfBlock &&
          (o ? (
            creative(o, view.waveOf(o))
          ) : (
            <span className="flex min-h-6 items-center gap-2.5">
              <ChartColumn aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <span className="font-medium">All tests</span>
              <span className="rounded-md bg-muted px-1.5 py-px text-[11px] text-muted-foreground">Median</span>
            </span>
          ))}
      </td>
      <td className={cn(TD, "border-l")}>{s.name}</td>
      {view.metrics.map((m) => {
        const med = median(m, s.key)
        if (!o)
          return (
            <td key={m} className="border-b border-l p-0">
              <span className="flex h-10 items-center justify-center bg-[#f0efec] text-[13px] tabular-nums" title={med ? `Median of ${med.n.toLocaleString("en-US")} lifts on file` : undefined}>
                {med ? fmt(med.median) : "—"}
              </span>
            </td>
          )
        const c = read.cell(o, m, s.key)
        if (!c)
          return (
            <td key={m} className={cn(TD, "border-l text-center text-xs text-muted-foreground/40")}>
              —
            </td>
          )
        const center = bench ? (med?.median ?? 0) : 0
        return (
          <td key={m} className="border-b border-l p-0">
            <button
              type="button"
              onClick={() => onPick(o, m, s, c)}
              title={`${treatmentName(optionOf(o))} · ${s.name}: ${fmt(c.lift[7])}${bench && med ? `, median ${fmt(med.median)}` : ""}`}
              className={cn(HEAT, significance(c.lift) === false ? "text-foreground/55" : "font-semibold")}
              style={{ background: heat(c.lift[7], center, view.spread) }}
            >
              {fmt(c.lift[7])}
            </button>
          </td>
        )
      })}
      {view.emotion && (o ? <EmotionCell o={o} s={s} /> : <td className={cn(TD, "border-l")} />)}
    </tr>
  )
})

/** The column-resize handle: drag it to set the column's width. */
function Resize({ width, onWidth, min = 120, max = 480 }: { width: number; onWidth: (w: number) => void; min?: number; max?: number }) {
  const start = (e: React.PointerEvent) => {
    e.preventDefault()
    const x0 = e.clientX
    const move = (ev: PointerEvent) => onWidth(Math.min(max, Math.max(min, width + ev.clientX - x0)))
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

/** A metric column's resize grip, America Thinks' panel handle (components/ui resizable's withHandle box) on the
 *  column's right divider: drag it to set the column's width. The last column's sits inside the table's edge. */
function ColumnGrip({ width, onWidth, last = false }: { width: number; onWidth: (w: number) => void; last?: boolean }) {
  const start = (e: React.PointerEvent) => {
    e.preventDefault()
    const x0 = e.clientX
    const move = (ev: PointerEvent) => onWidth(Math.min(640, Math.max(120, width + ev.clientX - x0)))
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }
  return (
    <span role="separator" aria-orientation="vertical" aria-label="Resize the column" onPointerDown={start} className={cn("absolute top-0 z-10 flex h-full w-3.5 cursor-col-resize touch-none items-center justify-center", last ? "right-0" : "-right-[7px]")}>
      <span className="flex h-4 w-3 items-center justify-center rounded-xs border bg-border">
        <GripVerticalIcon className="size-2.5" />
      </span>
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
