"use client"

import * as React from "react"
import { Combobox } from "@base-ui/react/combobox"
import { ArrowDown, ArrowUp, ChartColumn, ChevronDown, ChevronUp, EllipsisVertical, Grid3x3, ListTree, Table, Tags, Check, CircleDashed, Copy, Download, Folder, Funnel, Info, Loader2, PanelLeftClose, PanelLeftOpen, SeparatorVertical, Share, Spline } from "lucide-react"

import { cn } from "@/lib/utils"
import { BankFrame, BankRail as RailState } from "@/components/bank/bank-frame"
import { Reveal } from "@/components/reveal"
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@govblock/ui/components/ny4/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/ny4/tooltip"

import { dimLabel, groupSources, num, type AudienceIndex, type SourceRow } from "../america-thinks/audience-data"
import { rowDress } from "../america-thinks/segment-grid"
import { AboutResult } from "./about-result"
import { useShellPanel } from "@/components/shell"
import { PANE_PARAM } from "@/lib/pane"
import { LIFT_ANALYSIS_OPEN, openToolsOnCards } from "@/lib/lift-analyses"
import { AD_COLUMNS, AD_INFO, TRAIT_COLUMN, TRAIT_COLUMNS, adOffice, adWhen, adWhere, dimOf, fielding, isPlacebo, metricShort, ordered, periodKey, segKey, segOf, setAds, signed, significance, testOf, TRAIT_GROUPS, treatmentName, valOf, type AdColumn, type AdInfo, type Cell, type Pick } from "./lift-data"
import { AppealBar, AppealKey, axisOf, Candle, EmotionBar, EmotionKey, heat, HeatKey, sampleEmotions } from "./lift-marks"

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
// breakdown. Emotional Response stands in both views on placeholder shares;
// the Archive's ads carry their coded Emotional appeal instead, are named by
// their traits, and add a Traits view (Brendan, 2026-10-29): each trait's
// pooled lift, ads with it against ads without.

const SOURCES: Record<string, string> = { PAX_TEST: "Tests", LIFT_ARCHIVE: "Archive" }
const PER_READ = 25
const BY_NAME = "@name"
const PLACEBO = "\u0000placebo"
/** The outcome each test was built to move: the MA tests' ballot support, the archive's two indices. The rest are Secondary. */
const PRIMARY = new Set(["lift_support", "lift_favorability", "lift_vote_choice"])
/** The Emotional Response column's key in the Metrics menu and metricsOff. */
const EMOTION = "@emotion"

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
  Donut: "/lift/thumbs/donut.jpg",
  "Official campaign ad": "/lift/thumbs/official-campaign-ad.jpg",
}
/** The metrics a folder opens with hidden: the Archive's two-way vote is a recode of its vote choice. */
const DEFAULT_OFF: Record<string, string[]> = { LIFT_ARCHIVE: ["lift_vote_choice_dichotomized"] }
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x))
/** The treatments a folder opens on (Brendan, 2026-10-29); the Treatments menu brings back the rest. */
const FEATURED: Record<string, string[]> = { PAX_TEST: ["DiZoglio", "Matt Wilson", "Pahlow"] }
/** A fielding the results register knows is its wave. */
const WAVE = new Map(RESULT_SETS.map((s) => [`${s.fielded.start}|${s.fielded.end}`, `Wave ${s.wave}`]))

const plural = (n: number, noun: string) => `${n.toLocaleString("en-US")} ${noun}${n === 1 ? "" : "s"}`
const toggled = (list: string[], x: string) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x])

const TOOL = "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-foreground/80 outline-none transition-colors hover:bg-muted hover:text-pax2-blue focus-visible:bg-muted aria-expanded:bg-muted"
const TOOL_ICON = "size-3.5 text-muted-foreground"
// The toolbar's words show only where the table is wide (Brendan, 2026-10-31): narrow, its buttons are icons.
const TOOL_LABEL = "hidden @3xl/tools:inline"
const TH = "group/th border-b px-3 py-2 text-left text-[13px] font-medium whitespace-nowrap"
const TD = "border-b px-3 py-2 align-middle text-[13px]"
const HEAD_ICON = "shrink-0 text-muted-foreground hover:text-foreground aria-expanded:text-foreground"
// A header's info circle shows while the header is hovered or the circle has focus (Brendan, 2026-10-31).
const HEAD_INFO = `${HEAD_ICON} opacity-0 transition-opacity group-hover/th:opacity-100 focus-visible:opacity-100`
/** A cell's button: the grid's focus frame, no pressed state; the row carries the selection. */
const FRAME = "block w-full rounded-[3px] text-left tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pax2-light-blue"
/** A heatmap cell's button: the fill is the cell, the focus frame inside it. */
const HEAT = "flex h-10 w-full items-center justify-center text-[13px] tabular-nums focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-pax2-light-blue"

type Sort = { by: string; dir: 1 | -1 }

/** The right panel's key for About Result. */
const ABOUT_KEY = "lift:about"

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
  const [metricsOff, setMetricsOff] = React.useState<string[]>(() => (link.has("mo") ? link.list("mo") : (DEFAULT_OFF[link.one("source") ?? ""] ?? [])))
  // The Archive's column filters: the values a trait column hides, and per metric which ads it keeps.
  const [colFilter, setColFilter] = React.useState<Record<string, string[]>>({})
  const [metricFilter, setMetricFilter] = React.useState<Record<string, "measured" | "significant">>({})
  // The table's bands folded shut (a breakdown such as Education, or a test in the Archive's grouping).
  const [shut, setShut] = React.useState<string[]>([])
  // The Archive's ads under their tests, off until the Content column's filter turns it on.
  const [grouped, setGrouped] = React.useState(() => link.one("g") === "1")
  // The Archive's columns: the trait columns switched on (every coded trait is one), the standing ones switched off.
  const [traitCols, setTraitCols] = React.useState<string[]>(() => link.list("tc"))
  const [adColsOff, setAdColsOff] = React.useState<string[]>(() => link.list("ao"))
  // The Treatments menu's choice; null is the folder's opening set.
  const [picked, setPicked] = React.useState<string[] | null>(() => (link.has("t") ? link.list("t") : null))
  const [segsOff, setSegsOff] = React.useState<string[]>(() => link.list("so"))
  const [periodsOff, setPeriodsOff] = React.useState<string[]>(() => link.list("fo"))
  // A linked cell opens once its folder has read: [treatment, metric, segment].
  const [linkedPick, setLinkedPick] = React.useState<string[] | null>(() => (link.list("at").length >= 3 ? link.list("at") : null))
  // A Tools card on this page hands its pick here (from another page it comes through the address).
  React.useEffect(() => {
    const go = (e: Event) => {
      const { source: at, at: pick } = (e as CustomEvent<{ source: string; at: string[] }>).detail
      if (at in SOURCES) setSource(at)
      setLinkedPick(pick)
    }
    window.addEventListener(LIFT_ANALYSIS_OPEN, go)
    return () => window.removeEventListener(LIFT_ANALYSIS_OPEN, go)
  }, [])
  const [sort, setSort] = React.useState<Sort | null>(null)
  const [about, setAbout] = React.useState<Pick | null>(null)
  const [depth, setDepth] = React.useState(PER_READ)
  const [widths, setWidths] = React.useState({ treatment: 220, segment: 170 })
  const [metricWidths, setMetricWidths] = React.useState<Record<string, number>>({})
  // A dragged column's width; an undragged metric column shares the pane with the others.
  const widthOf = (key: string): number | undefined => metricWidths[key]
  const resizeMetric = (key: string) => (w: number) => setMetricWidths((p) => ({ ...p, [key]: w }))
  const [shared, setShared] = React.useState(false)
  // The Archive's list view is Traits in the toggle and the link (view=traits), its pooled table Attributes.
  const [display, setDisplay] = React.useState<"bars" | "heatmap" | "attributes">(() => {
    const v = link.one("view")
    return v === "heatmap" || v === "attributes" ? v : "bars"
  })
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
        ).then(async (parts: SourceRow[][]) => {
          // The Archive's ads arrive described, before its table draws; without the file they keep their ids.
          if (s === "LIFT_ARCHIVE") {
            const r = await fetch("/lift/archive-ads.json").catch(() => null)
            if (r?.ok) setAds((await r.json()) as Record<string, AdInfo>)
          }
          return [s, parts.flat()] as const
        })
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
    setMetricsOff(DEFAULT_OFF[key] ?? [])
    setColFilter({})
    setMetricFilter({})
    setGrouped(false)
    setTraitCols([])
    setAdColsOff([])
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
  const archive = source === "LIFT_ARCHIVE"
  // Attributes is the Archive's alone; another folder shows Bars in its place.
  const shownDisplay = display === "attributes" && !archive ? "bars" : display

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
      const level = levels.get(`${option}\u0001${metric}\u0001${sk}\u0001${pk}`) ?? null
      const control = levels.get(`${PLACEBO}\u0001${metric}\u0001${sk}\u0001${pk}`) ?? null
      // An archive ad starts from its own test's placebo group (the respondent file's mean), and lands at that plus its lift.
      const base = !control && sk === "" ? AD_INFO.get(option)?.control?.[metric] : undefined
      if (base) {
        const at = (v: number, n: number | null): SourceRow => [metric, lift[1], lift[2], lift[3], "Placebo", null, null, v, "mean", null, null, n, lift[12]]
        return { lift, level: at(base[0] + lift[7], lift[11] ?? null), control: at(base[0], base[1]) }
      }
      return { lift, level, control }
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
    const adCols = archive ? [...AD_COLUMNS.filter((c) => !adColsOff.includes(c.key)), ...traitCols.map((k) => TRAIT_COLUMN.get(k)!).filter(Boolean)] : []
    const adCol = (k: string | undefined) => adCols.find((c) => c.key === k)
    const by = sort?.by === BY_NAME || adCol(sort?.by) ? sort!.by : sort && metrics.includes(sort.by) ? sort.by : (metrics[0] ?? BY_NAME)
    const dir = sort && sort.by === by ? sort.dir : by === BY_NAME ? 1 : -1
    // An entry the metrics measured, and that the Archive's column filters keep.
    const keeps = (ek: string) => {
      if (!metrics.some((m) => read.cell(ek, m, ""))) return false
      for (const [m, f] of Object.entries(metricFilter)) {
        if (!metrics.includes(m)) continue
        const c = read.cell(ek, m, "")
        if (!c || (f === "significant" && significance(c.lift) !== true)) return false
      }
      const ad = archive ? AD_INFO.get(optionOf(ek)) : undefined
      if (ad) for (const c of adCols) if (colFilter[c.key]?.includes(c.value(ad))) return false
      return true
    }
    const measured = (o: string) => (read.byOption.get(o) ?? []).filter(keeps)
    // A treatment sorts by its latest entry the metric measured; its entries stay together, latest first.
    const lead = (o: string) => measured(o).map((ek) => read.cell(ek, by, "")?.lift[7]).find((v) => v != null)
    const treatments = read.options
      .filter((o) => chosen.includes(o) && measured(o).length)
      .sort((a, b) => {
        if (by === BY_NAME) return dir * treatmentName(a).localeCompare(treatmentName(b))
        const col = adCol(by)
        if (col) {
          const x = AD_INFO.get(a)
          const y = AD_INFO.get(b)
          return x && y ? dir * col.order(x).localeCompare(col.order(y)) : x ? -1 : y ? 1 : 0
        }
        // The Archive opens with the ads both its outcomes measured on top (Brendan, 2026-10-29).
        if (!sort && archive) {
          const both = (o: string) => metrics.filter((m) => measured(o).some((ek) => read.cell(ek, m, ""))).length
          const d = both(b) - both(a)
          if (d) return d
        }
        const x = lead(a)
        const y = lead(b)
        // A treatment the sorting metric did not measure goes last either way.
        return x == null ? (y == null ? 0 : 1) : y == null ? -1 : dir * (x - y)
      })
      .flatMap(measured)
    const groups = [
      { dim: null as string | null, name: "Everyone", segs: [{ key: "", name: "Everyone" }] },
      ...[...read.dims].map(([d, vs]) => ({ dim: d as string | null, name: dimLabel(d), segs: vs.map((v) => ({ key: segKey(d, v), name: v })) })),
    ]
      .map((g) => ({ ...g, segs: g.segs.filter((s) => !segsOff.includes(s.key)) }))
      .filter((g) => g.segs.length)
    // Zero sits where the table's own lifts need it, every bar on the one scale.
    let neg = 0
    let pos = 0
    for (const o of treatments)
      for (const m of metrics)
        for (const g of groups)
          for (const s of g.segs) {
            const v = read.cell(o, m, s.key)?.lift[7] ?? 0
            neg = Math.max(neg, -v)
            pos = Math.max(pos, v)
          }
    const { axis, scale } = axisOf(neg, pos)
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
    return { metrics, primary, emotion, by, dir, treatments, groups, segCount: groups.reduce((n, g) => n + g.segs.length, 0), axis, scale, spread, segment: !archive, adCols }
  }, [read, chosen, metricsOff, segsOff, sort, bench, median, archive, colFilter, metricFilter, traitCols, adColsOff])

  const shown = view ? view.treatments.slice(0, depth) : []
  const canLoad = view ? depth < view.treatments.length : false
  const more = React.useCallback(() => setDepth((d) => d + PER_READ), [])

  const complete = Object.keys(SOURCES).every((s) => files[s])
  // About Result opens in the shell's right panel (Brendan, 2026-10-31), in place of the card that floated over
  // the table: handed again whenever the pick or what it reads changes, taken back when the pick clears, and
  // closing the panel lets go of the pick.
  const { openAside, asideKey } = useShellPanel()
  const aboutShown = asideKey === ABOUT_KEY
  const aboutShownRef = React.useRef(aboutShown)
  aboutShownRef.current = aboutShown
  React.useEffect(() => {
    if (about)
      openAside({
        key: ABOUT_KEY,
        title: "Lift Analysis",
        flush: true,
        // Back climbs to Tools' Lift Analysis cards, however the analysis was opened (Brendan, 2026-10-31).
        back: openToolsOnCards,
        body: <AboutResult key={`${about.entry}\u0001${about.metric}\u0001${about.seg}`} pick={about} files={files} folder={source} folders={SOURCES} complete={complete} place={place} />,
      })
    else if (aboutShownRef.current) openAside(null)
    // openAside is the shell's; the body is handed again on what it reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [about, files, source, complete, place])
  React.useEffect(() => {
    if (!aboutShown) setAbout(null)
  }, [aboutShown])

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
  // opening set, what is hidden, the benchmark off, the grouping, and the open cell. The address bar keeps it
  // current, so the URL always says what the page shows.
  const linkUrl = () => {
    const pairs: [string, string[]][] = [["source", [source]]]
    if (shownDisplay !== "bars" || archive) pairs.push(["view", [shownDisplay === "bars" ? "traits" : shownDisplay]])
    const featured = FEATURED[source]
    const opening = read ? (featured ? read.options.filter((o) => featured.includes(o)) : read.options) : []
    if (picked && (picked.length !== opening.length || picked.some((o) => !opening.includes(o)))) pairs.push(["t", picked])
    if (!sameSet(metricsOff, DEFAULT_OFF[source] ?? [])) pairs.push(["mo", metricsOff])
    if (grouped) pairs.push(["g", ["1"]])
    if (traitCols.length) pairs.push(["tc", traitCols])
    if (adColsOff.length) pairs.push(["ao", adColsOff])
    if (segsOff.length) pairs.push(["so", segsOff])
    if (periodsOff.length) pairs.push(["fo", periodsOff])
    if (!bench) pairs.push(["bench", ["0"]])
    if (about) pairs.push(["at", [about.option, about.metric, about.seg, fieldingOf(about.entry)]])
    return `${window.location.origin}${window.location.pathname}?${pairs.map(([k, vs]) => `${k}=${vs.length ? vs.map(linkPart).join(",") : ""}`).join("&")}`
  }
  const url = read ? linkUrl() : null
  React.useEffect(() => {
    if (!url) return
    // The second panel's ?pane rides along (lib/pane.ts): the share link is Lift's own view, but the address keeps
    // both, or a reload lost the panel (Brendan, 2026-10-31).
    const pane = new URLSearchParams(window.location.search).get(PANE_PARAM)
    const next = pane ? `${url}&${PANE_PARAM}=${encodeURIComponent(pane)}` : url
    if (next !== window.location.href) window.history.replaceState(window.history.state, "", next)
  }, [url])
  const share = () => {
    navigator.clipboard.writeText(linkUrl())
    setShared(true)
    window.setTimeout(() => setShared(false), 1400)
  }

  const rail = (
    <BankRail title="Lift">
      <RailGroup label="Folders">
        {Object.entries(SOURCES).map(([key, name]) => (
          <RailRow key={key} on={source === key} onClick={() => openFolder(key)} pane={`/lift?source=${encodeURIComponent(key)}`} icon={Folder} label={name} count={questions.filter((q) => q.source === key).length || null} />
        ))}
      </RailGroup>
    </BankRail>
  )

  // The toolbar's Filter holds every filter (Brendan, 2026-10-31): the waves, each metric's, each Archive column's.
  const filterCount = (periodsOff.length ? 1 : 0) + Object.keys(metricFilter).length + Object.values(colFilter).filter((v) => v.length).length
  // An Archive column's values in the column's own order.
  const adValues = (c: AdColumn) => {
    const order = new Map<string, string>()
    for (const o of read?.options ?? []) {
      const a = AD_INFO.get(o)
      if (a) order.set(c.value(a), c.order(a))
    }
    return [...order.keys()].sort((x, y) => order.get(x)!.localeCompare(order.get(y)!))
  }
  const segGroups = read ? [{ dim: null as string | null, name: "Everyone", vals: [null as string | null] }, ...[...read.dims].map(([d, vs]) => ({ dim: d as string | null, name: dimLabel(d), vals: vs as (string | null)[] }))] : []
  const toolbar = (
    // 61px, so its rule lines up with the right panel's under its tabs (16px above and below them).
    <div className="@container/tools flex h-[61px] shrink-0 items-center gap-0.5 border-b px-3">
      <SidebarToggle />
      <span aria-hidden className="mx-1 h-4 w-px bg-border" />
      <TreatmentPicker options={read?.options ?? []} chosen={chosen} onChosen={setPicked} count={view ? new Set(view.treatments.map(optionOf)).size : 0} disabled={!read} />
      <span aria-hidden className="mx-1 h-4 w-px bg-border" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={TOOL} disabled={!read} title={plural((view?.metrics.length ?? 0) + (view?.emotion ? 1 : 0), "Metric")}>
            <Spline className={TOOL_ICON} />
            <span className={TOOL_LABEL}>{plural((view?.metrics.length ?? 0) + (view?.emotion ? 1 : 0), "Metric")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[28rem] w-max min-w-48 overflow-y-auto">
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
            {archive ? "Emotional appeal" : "Emotional response"}
          </DropdownMenuCheckboxItem>
          {archive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Traits</DropdownMenuLabel>
              {AD_COLUMNS.map((c) => (
                <DropdownMenuCheckboxItem key={c.key} checked={!adColsOff.includes(c.key)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => setAdColsOff((prev) => toggled(prev, c.key))}>
                  {c.name}
                </DropdownMenuCheckboxItem>
              ))}
              {TRAIT_COLUMNS.map((g) => (
                <React.Fragment key={g.group}>
                  <DropdownMenuLabel className="pt-2 text-[11px] font-normal text-muted-foreground">{g.group}</DropdownMenuLabel>
                  {g.columns.map((c) => (
                    <DropdownMenuCheckboxItem key={c.key} checked={traitCols.includes(c.key)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => setTraitCols((prev) => toggled(prev, c.key))}>
                      {c.name}
                    </DropdownMenuCheckboxItem>
                  ))}
                </React.Fragment>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <span aria-hidden className="mx-1 h-4 w-px bg-border" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={TOOL} disabled={!read} title={plural(view?.segCount ?? 0, "Segment")}>
            <CircleDashed className={TOOL_ICON} />
            <span className={TOOL_LABEL}>{plural(view?.segCount ?? 0, "Segment")}</span>
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
          {/* Each metric's filter and each Archive column's, which were funnels in the column heads. */}
          {!!view?.metrics.length && <DropdownMenuSeparator />}
          {view?.metrics.map((m) => (
            <DropdownMenuSub key={m}>
              <DropdownMenuSubTrigger>
                <span className="flex-1">{metricShort(m)}</span>
                {metricFilter[m] && <span className="ml-4 text-xs text-muted-foreground">{metricFilter[m] === "measured" ? "Measured" : "Clears its test"}</span>}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-max min-w-44">
                <DropdownMenuRadioGroup
                  value={metricFilter[m] ?? "all"}
                  onValueChange={(v) =>
                    setMetricFilter((p) => {
                      const next = { ...p }
                      if (v === "all") delete next[m]
                      else next[m] = v as "measured" | "significant"
                      return next
                    })
                  }
                >
                  <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="measured">Measured</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="significant">Clears its test</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ))}
          {!!view?.adCols.length && <DropdownMenuSeparator />}
          {view?.adCols.map((c) => {
            const off = colFilter[c.key] ?? []
            return (
              <DropdownMenuSub key={c.key}>
                <DropdownMenuSubTrigger>
                  <span className="flex-1">{c.name}</span>
                  {off.length > 0 && <span className="ml-4 text-xs text-muted-foreground">{off.length} hidden</span>}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-80 w-max min-w-44 overflow-y-auto">
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault()
                      setColFilter((p) => ({ ...p, [c.key]: [] }))
                    }}
                  >
                    Show all
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {adValues(c).map((v) => (
                    <DropdownMenuCheckboxItem key={v} checked={!off.includes(v)} onSelect={(e) => e.preventDefault()} onCheckedChange={() => setColFilter((p) => ({ ...p, [c.key]: toggled(p[c.key] ?? [], v) }))}>
                      {v}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )
          })}
          {archive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={grouped} onSelect={(e) => e.preventDefault()} onCheckedChange={() => setGrouped((g) => !g)}>
                Group by test
              </DropdownMenuCheckboxItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {shownDisplay === "heatmap" && (
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
        <span className="mr-1">
          {/* Icons (Brendan, 2026-10-31): Table (was Bars), Heatmap; the Archive's Traits and Attributes. */}
          <ViewToggle
            views={[
              { value: "bars" as const, label: archive ? "Traits" : "Table", icon: archive ? Tags : Table },
              { value: "heatmap" as const, label: "Heatmap", icon: Grid3x3 },
              ...(archive ? [{ value: "attributes" as const, label: "Attributes", icon: ListTree }] : []),
            ]}
            value={shownDisplay}
            onChange={setDisplay}
          />
        </span>
        {/* Sort, Share, Download and Refresh in the three-dot menu (Brendan, 2026-10-31). */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={cn(TOOL, "px-1.5")} aria-label="Table options" title="Table options">
              <EllipsisVertical className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-max min-w-48">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Sort by</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={view?.by ?? BY_NAME} onValueChange={(by) => setSort({ by, dir: by === BY_NAME ? 1 : -1 })}>
              {(view?.metrics ?? []).map((m) => (
                <DropdownMenuRadioItem key={m} value={m} disabled={!view}>
                  {metricShort(m)}
                </DropdownMenuRadioItem>
              ))}
              <DropdownMenuRadioItem value={BY_NAME} disabled={!view}>
                Treatment name
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={share}>
              <Share />
              {shared ? "Link copied" : "Share"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={download} disabled={!view}>
              <Download />
              Download
            </DropdownMenuItem>
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
      </div>
    </div>
  )

  const ariaSort = (by: string) => (view?.by === by ? (view.dir === 1 ? "ascending" : "descending") : undefined)
  // A header's label sorts its column on a click (again, the other way); its filters are the toolbar's Filter.
  const defaultDir = (key: string): 1 | -1 => (key === BY_NAME || (key.startsWith("@") && key !== "@tested") ? 1 : -1)
  const sortBy = (key: string) => setSort({ by: key, dir: view?.by === key ? (-view.dir as 1 | -1) : defaultDir(key) })
  const sortLabel = (key: string, label: string) => (
    <button type="button" onClick={() => sortBy(key)} className="flex min-w-0 items-center gap-1 hover:text-foreground">
      <span className="truncate" title={label}>
        {label}
      </span>
      {view?.by === key && (view.dir === 1 ? <ArrowUp aria-hidden className="size-3.5 shrink-0" /> : <ArrowDown aria-hidden className="size-3.5 shrink-0" />)}
    </button>
  )
  const cols = view ? view.adCols.length + view.metrics.length + (view.emotion ? 1 : 0) : 0

  // The Attributes view (the Archive only): each coded trait's pooled lift, ads with it less ads without, per metric.
  const attributes = React.useMemo(() => {
    if (!archive || shownDisplay !== "attributes" || !rows || !view) return null
    const off = new Set(periodsOff)
    const by = new Map<string, { ad: AdInfo; x: number; v: number }[]>()
    const ads = new Map<string, AdInfo>()
    for (const r of rows) {
      if (r[8] !== "lift_pp" || segOf(r) !== "" || r[9] == null || off.has(periodKey(r)) || !view.metrics.includes(r[0])) continue
      const ad = AD_INFO.get(r[4] ?? "")
      if (!ad) continue
      ads.set(r[4]!, ad)
      const se = r[9] / 1.645
      by.set(r[0], [...(by.get(r[0]) ?? []), { ad, x: r[7], v: se * se }])
    }
    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
    // The between-ad variance per metric (DerSimonian–Laird), so a pooled margin owns how much ads differ.
    const tau2 = new Map<string, number>()
    for (const [m, xs] of by) {
      const w = xs.map((p) => 1 / p.v)
      const sw = sum(w)
      const mean = sum(w.map((wi, i) => wi * xs[i].x)) / sw
      const q = sum(w.map((wi, i) => wi * (xs[i].x - mean) ** 2))
      tau2.set(m, Math.max(0, (q - (xs.length - 1)) / (sw - sum(w.map((wi) => wi * wi)) / sw)))
    }
    const pool = (xs: { x: number; v: number }[], t2: number) => {
      const w = xs.map((p) => 1 / (p.v + t2))
      const sw = sum(w)
      return { mean: sum(w.map((wi, i) => wi * xs[i].x)) / sw, se: Math.sqrt(1 / sw), n: xs.length }
    }
    let neg = 0
    let pos = 0
    const groups = TRAIT_GROUPS.map((g) => ({
      name: g.name,
      rows: g.traits
        .map((t) => ({
          key: t.key,
          name: t.name,
          n: [...ads.values()].filter(t.has).length,
          cells: view.metrics.map((m): Cell | null => {
            const xs = by.get(m) ?? []
            const yes = xs.filter((p) => t.has(p.ad))
            const no = xs.filter((p) => !t.has(p.ad))
            if (yes.length < 3 || no.length < 3) return null
            const a = pool(yes, tau2.get(m) ?? 0)
            const b = pool(no, tau2.get(m) ?? 0)
            const diff = a.mean - b.mean
            neg = Math.max(neg, -diff)
            pos = Math.max(pos, diff)
            return {
              lift: [m, "US", "", "", t.name, null, null, diff, "lift_pp", 1.645 * Math.sqrt(a.se ** 2 + b.se ** 2), null, yes.length, null],
              level: null,
              control: [m, "US", "", "", t.name, null, null, b.mean, "lift_pp", null, null, no.length, null],
            }
          }),
        }))
        .filter((r) => r.n > 0),
    })).filter((g) => g.rows.length)
    return { groups, ...axisOf(neg, pos), total: ads.size }
  }, [archive, shownDisplay, rows, view, periodsOff])
  // Stable, so a pick re-renders only the rows whose selection changed (the rows are memoized).
  // The same cell again closes the panel.
  const pick = React.useCallback(
    (ek: string, m: string, s: Seg, c: Cell) => setAbout((prev) => (prev && prev.entry === ek && prev.metric === m && prev.seg === s.key ? null : { option: optionOf(ek), entry: ek, metric: m, seg: s.key, segName: s.name, cell: c })),
    []
  )

  const contentHead = (first: boolean) => (
    <th aria-sort={ariaSort(BY_NAME)} className={cn(TH, !first && "border-l")}>
      <span className="flex items-center gap-2">
        {sortLabel(BY_NAME, "Content")}
        <span className="ml-auto flex items-center gap-2">
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
  // The Archive's trait columns: each sorts on its label, filters on its values.
  const adColHeads =
    view &&
    view.adCols.map((c) => (
      <th key={c.key} aria-sort={ariaSort(c.key)} className={cn(TH, "relative border-l")}>
        <span className="flex items-center gap-2">
          {sortLabel(c.key, c.name)}
          <span className="ml-auto">
            <Resize width={widthOf(c.key) ?? c.width} onWidth={resizeMetric(c.key)} max={640} />
          </span>
        </span>
      </th>
    ))
  const metricHeads = view && (
    <>
      {view.metrics.map((m, i) => (
        <th key={m} aria-sort={ariaSort(m)} className={cn(TH, "relative border-l")}>
          <span className="flex items-center gap-2">
            {sortLabel(m, metricShort(m))}
            <span className="ml-auto flex items-center gap-2">
              {defs.get(m) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label={`About ${labels.get(m) ?? metricShort(m)}`} className={HEAD_INFO}>
                      <Info className="size-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-72">{defs.get(m)}</TooltipContent>
                </Tooltip>
              )}
              <Resize width={widthOf(m)} onWidth={resizeMetric(m)} max={640} />
            </span>
          </span>
        </th>
      ))}
      {view.emotion && (
        <th className={cn(TH, "relative border-l")}>
          <span className="flex items-center gap-2">
            <span className="truncate">{archive ? "Emotional Appeal" : "Emotional Response"}</span>
            {!archive && <span className="rounded-md border px-1.5 py-px text-[10px] font-normal text-muted-foreground">Sample</span>}
            <span className="ml-auto flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label={archive ? "About Emotional Appeal" : "About Emotional Response"} className={HEAD_INFO}>
                    <Info className="size-4" />
                  </button>
                </TooltipTrigger>
                {archive ? (
                  <TooltipContent className="max-w-72">
                    <p className="mb-1.5">The archive coders&apos; ratings of the emotion each ad appeals to, each emotion&apos;s share of the ad&apos;s rated appeal.</p>
                    <AppealKey className="text-background/80" />
                  </TooltipContent>
                ) : (
                  <TooltipContent className="max-w-72">
                    <p className="mb-1.5">The share of respondents naming each feeling after the ad. No test has asked it yet: these shares are placeholders.</p>
                    <EmotionKey className="text-background/80" />
                  </TooltipContent>
                )}
              </Tooltip>
              <Resize width={widthOf(EMOTION)} onWidth={resizeMetric(EMOTION)} max={640} />
            </span>
          </span>
        </th>
      )}
    </>
  )
  // Columns fill the pane (Brendan, 2026-10-29: responsive, not fixed): Content, Segment and the trait columns
  // hold their widths, the metric and emotion columns share the rest until a drag sets one.
  const colgroup = (lead?: number) =>
    view && (
      <colgroup>
        {lead != null && <col style={{ width: lead }} />}
        <col style={{ width: widths.treatment }} />
        {view.segment && <col style={{ width: widths.segment }} />}
        {view.adCols.map((c) => (
          <col key={c.key} style={{ width: widthOf(c.key) ?? c.width }} />
        ))}
        {view.metrics.map((m) => (
          <col key={m} style={{ width: widthOf(m) }} />
        ))}
        {view.emotion && <col style={{ width: widthOf(EMOTION) }} />}
      </colgroup>
    )
  const tableMin = (lead = 0) =>
    view
      ? lead +
        widths.treatment +
        (view.segment ? widths.segment : 0) +
        view.adCols.reduce((n, c) => n + (widthOf(c.key) ?? c.width), 0) +
        [...view.metrics, ...(view.emotion ? [EMOTION] : [])].reduce((n, k) => n + (widthOf(k) ?? 160), 0)
      : 0
  const lead = view ? 1 + (view.segment ? 1 : 0) : 1

  const barsBody =
    view &&
    read &&
    (grouped && archive
      ? (() => {
          // Each test a band, its ads under it in the table's order.
          const tests = new Map<string, string[]>()
          for (const ek of shown) {
            const id = optionOf(ek).match(/\(study ([^)]+)\)/)?.[1] ?? ""
            tests.set(id, [...(tests.get(id) ?? []), ek])
          }
          return [...tests].map(([id, eks]) => {
            const a = AD_INFO.get(optionOf(eks[0]))
            return (
              <React.Fragment key={id}>
                <tr>
                  <td colSpan={lead + cols} className="border-b bg-pax2-mist p-0">
                    <BandToggle label={a ? `${adWhere(a)} ${adOffice(a)} · ${adWhen(a)} · ${a.ads} ${a.ads === 1 ? "ad" : "ads"}` : id} shut={shut.includes(`test:${id}`)} onToggle={() => setShut((p) => toggled(p, `test:${id}`))} />
                  </td>
                </tr>
                {!shut.includes(`test:${id}`) && eks.map((o) => (
                  <BarsRow key={o} o={o} s={EVERYONE} first last sel={about?.entry === o && about.seg === ""} read={read} view={view} onPick={pick} />
                ))}
              </React.Fragment>
            )
          })
        })()
      : view.groups.map((g) => (
          <React.Fragment key={g.dim ?? ""}>
            {g.dim && (
              <tr>
                <td className="border-b bg-pax2-mist" />
                <td colSpan={lead - 1 + cols} className="border-b bg-pax2-mist p-0">
                  <BandToggle label={g.name} shut={shut.includes(`seg:${g.dim}`)} onToggle={() => setShut((p) => toggled(p, `seg:${g.dim}`))} />
                </td>
              </tr>
            )}
            {!(g.dim && shut.includes(`seg:${g.dim}`)) && shown.flatMap((o) => {
              const segs = g.segs.filter((s) => view.metrics.some((m) => read.cell(o, m, s.key)))
              return segs.map((s, i) => <BarsRow key={`${o}\u0001${s.key}`} o={o} s={s} first={i === 0} last={i === segs.length - 1} sel={about?.entry === o && about.seg === s.key} read={read} view={view} onPick={pick} />)
            })}
          </React.Fragment>
        )))

  const barsTable = view && read && (
    <table className="w-full table-fixed border-collapse" style={{ minWidth: tableMin() }}>
      {colgroup()}
      <thead className="sticky top-0 z-[1] bg-background">
        <tr>
          {contentHead(true)}
          {view.segment && segmentHead}
          {adColHeads}
          {metricHeads}
        </tr>
      </thead>
      <tbody>
        {barsBody}
        {canLoad && <MoreRow span={lead + cols} onMore={more} />}
      </tbody>
    </table>
  )

  const heatTable = view && read && (
    <table className="w-full table-fixed border-collapse" style={{ minWidth: tableMin(110) }}>
      {colgroup(110)}
      <thead className="sticky top-0 z-[1] bg-background">
        <tr>
          <th className={TH}>Breakdown</th>
          {contentHead(false)}
          {view.segment && segmentHead}
          {adColHeads}
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
        {canLoad && <MoreRow span={1 + lead + cols} onMore={more} />}
      </tbody>
    </table>
  )

  const attributesTable = attributes && view && (
    <table className="w-full table-fixed border-collapse" style={{ minWidth: 260 + 110 + view.metrics.reduce((n, m) => n + (widthOf(m) ?? 200), 0) }}>
      <colgroup>
        <col style={{ width: 260 }} />
        <col style={{ width: 110 }} />
        {view.metrics.map((m) => (
          <col key={m} style={{ width: widthOf(m) }} />
        ))}
      </colgroup>
      <thead className="sticky top-0 z-[1] bg-background">
        <tr>
          <th className={TH}>Trait</th>
          <th className={cn(TH, "border-l")}>Ads</th>
          {view.metrics.map((m, i) => (
            <th key={m} className={cn(TH, "relative border-l")}>
              <span className="flex items-center gap-2">
                <span className="truncate">{metricShort(m)}</span>
                <span className="ml-auto flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" aria-label={`About the ${metricShort(m)} attributes`} className={HEAD_INFO}>
                        <Info className="size-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-72">
                      The average lift of ads with the trait less ads without it, each side pooled across the archive&apos;s ads with random-effects weights (DerSimonian–Laird); gray where its 90% margin crosses zero. The number at zero is the average without it.
                    </TooltipContent>
                  </Tooltip>
                  <Resize width={widthOf(m)} onWidth={resizeMetric(m)} max={640} />
                </span>
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {attributes.groups.map((g) => (
          <React.Fragment key={g.name}>
            <tr>
              <td colSpan={2 + view.metrics.length} className="border-b bg-pax2-mist px-3 py-1.5 text-xs font-semibold text-foreground">
                {g.name}
              </td>
            </tr>
            {g.rows.map((t) => (
              <tr key={t.key} className={rowDress(false)}>
                <td className={cn(TD, "font-medium")}>{t.name}</td>
                <td className={cn(TD, "border-l text-muted-foreground tabular-nums")}>
                  {t.n.toLocaleString("en-US")} of {attributes.total.toLocaleString("en-US")}
                </td>
                {t.cells.map((c, i) => (
                  <td key={view.metrics[i]} className={cn(TD, "border-l")}>
                    {c ? <Candle cell={c} axis={attributes.axis} scale={attributes.scale} baseTitle={`Ads without it average ${signed(c.control![7])}`} /> : <span className="block text-center text-xs text-muted-foreground/40">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  )
  const table = shownDisplay === "attributes" ? attributesTable : shownDisplay === "heatmap" ? heatTable : barsTable

  return (
    <BankFrame rail={rail} crumb="Lift" search={NO_SEARCH} bare railDefaultOpen={false}>
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
        </div>
      </div>
    </BankFrame>
  )
}

/** A band's label, which folds the rows under it into the band and opens them again (Brendan, 2026-10-31): open,
 *  the up chevron shows on hover; shut, the down chevron stays. */
function BandToggle({ label, shut, onToggle }: { label: string; shut: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={!shut} className="group/band flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs font-semibold text-foreground">
      {label}
      {shut ? <ChevronDown aria-hidden className="size-3.5 text-muted-foreground" /> : <ChevronUp aria-hidden className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/band:opacity-100" />}
    </button>
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
      <Combobox.Trigger className={cn(TOOL, "data-[popup-open]:bg-muted")} disabled={disabled} title={plural(count, "Treatment")}>
        <Copy className={TOOL_ICON} />
        <span className={TOOL_LABEL}>{plural(count, "Treatment")}</span>
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
type RowView = { metrics: string[]; emotion: boolean; axis: number; scale: number; spread: number; segment: boolean; adCols: AdColumn[] }
/** The Archive's one segment, its ads' only row each. */
const EVERYONE: Seg = { key: "", name: "Everyone" }
type OnPick = (o: string, m: string, s: Seg, c: Cell) => void

const fmt = (v: number) => `${v < 0 ? "−" : ""}${num(Math.abs(v))}`

/** A row's entry: a treatment in one fielding. */
const entryKey = (option: string, fielding: string) => `${option}\u0002${fielding}`
const optionOf = (ek: string) => ek.slice(0, ek.indexOf("\u0002"))
const fieldingOf = (ek: string) => ek.slice(ek.indexOf("\u0002") + 1)

function creative(ek: string) {
  const o = optionOf(ek)
  return (
    <span className="flex min-h-6 items-center gap-2.5">
      {THUMB[o] && <img src={THUMB[o]} alt="" width={36} height={24} className="h-6 w-9 shrink-0 rounded-[3px] bg-muted object-cover" />}
      <span className="line-clamp-2 font-medium" title={o}>
        {treatmentName(o)}
      </span>
    </span>
  )
}

/** An archive ad's trait cells, in the trait columns' order. */
function AdCells({ o, view }: { o: string | null; view: RowView }) {
  const ad = o ? AD_INFO.get(optionOf(o)) : undefined
  return (
    <>
      {view.adCols.map((c) => (
        <td key={c.key} className={cn(TD, "truncate border-l")}>
          {ad ? c.mark ? c.value(ad) === "Yes" && <Check aria-label="Yes" className="size-4 text-foreground" /> : c.value(ad) : null}
        </td>
      ))}
    </>
  )
}

/** The emotion column's cell: an archive ad's coded appeal, else the placeholder shares. */
function EmotionCell({ o, s, inChart }: { o: string; s: Seg; inChart?: boolean }) {
  const ad = AD_INFO.get(optionOf(o))
  return <td className={cn(TD, "border-l")}>{ad ? <AppealBar emotions={ad.emotions} inChart={inChart} /> : <EmotionBar shares={sampleEmotions(`${o}\u0001${s.key}`)} inChart={inChart} />}</td>
}

/** A bars-view row. Memoized: a pick re-renders only the rows it selects and unselects. */
const BarsRow = React.memo(function BarsRow({ o, s, first, last, sel, read, view, onPick }: { o: string; s: Seg; first: boolean; last: boolean; sel: boolean; read: RowRead; view: RowView; onPick: OnPick }) {
  return (
    <tr className={rowDress(sel)}>
      <td className={cn(TD, !last && "border-b-transparent")}>{first && creative(o)}</td>
      {view.segment && <td className={cn(TD, "border-l")}>{s.name}</td>}
      <AdCells o={o} view={view} />
      {view.metrics.map((m) => {
        const c = read.cell(o, m, s.key)
        return (
          <td key={m} className={cn(TD, "border-l")}>
            {c ? (
              <button type="button" onClick={() => onPick(o, m, s, c)} className={FRAME}>
                <Candle cell={c} axis={view.axis} scale={view.scale} />
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
  // The row's cells fade in the first time it comes into view (components/reveal.tsx).
  return (
    <Reveal as="tr" className={o ? rowDress(sel) : undefined}>
      <td className={cn(TD, "font-medium", !lastOfGroup && "border-b-transparent")}>{breakdown}</td>
      <td className={cn(TD, "border-l", !lastOfBlock && "border-b-transparent")}>
        {firstOfBlock &&
          (o ? (
            creative(o)
          ) : (
            <span className="flex min-h-6 items-center gap-2.5">
              <ChartColumn aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <span className="font-medium">All tests</span>
              <span className="rounded-md bg-muted px-1.5 py-px text-[11px] text-muted-foreground">Median</span>
            </span>
          ))}
      </td>
      {view.segment && <td className={cn(TD, "border-l")}>{s.name}</td>}
      <AdCells o={o} view={view} />
      {view.metrics.map((m) => {
        const med = median(m, s.key)
        if (!o)
          return (
            <td key={m} className="border-b border-l p-0">
              <span className="grow-in flex h-10 items-center justify-center bg-[#f0efec] text-[13px] tabular-nums" title={med ? `Median of ${med.n.toLocaleString("en-US")} lifts on file` : undefined}>
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
              className={cn(HEAT, "grow-in", significance(c.lift) === false ? "text-foreground/55" : "font-semibold")}
              style={{ background: heat(c.lift[7], center, view.spread) }}
            >
              {fmt(c.lift[7])}
            </button>
          </td>
        )
      })}
      {view.emotion && (o ? <EmotionCell o={o} s={s} inChart /> : <td className={cn(TD, "border-l")} />)}
    </Reveal>
  )
})

/** The column-resize handle: drag it to set the column's width. */
/** A column's resize control, in its head beside the label (Brendan, 2026-10-31: every column's, in place of the
 *  metric columns' grips on their dividers). A column no drag has sized starts from its width as drawn. */
function Resize({ width, onWidth, min = 120, max = 480 }: { width: number | undefined; onWidth: (w: number) => void; min?: number; max?: number }) {
  const start = (e: React.PointerEvent) => {
    e.preventDefault()
    const x0 = e.clientX
    const w0 = width ?? (e.currentTarget.closest("th") as HTMLElement).getBoundingClientRect().width
    const move = (ev: PointerEvent) => onWidth(Math.min(max, Math.max(min, w0 + ev.clientX - x0)))
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
