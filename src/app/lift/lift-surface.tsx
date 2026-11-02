"use client"

import * as React from "react"
import { ArrowDown, ArrowUp, ChartColumn, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Download, EllipsisVertical, Flag, Info, Loader2, Minus, PanelRight, PlayIcon, Copy, Search, SeparatorVertical, Shapes, Share, Star } from "lucide-react"

import { cn } from "@/lib/utils"
import { BankFrame, RailToggle } from "@/components/bank/bank-frame"
import { Reveal } from "@/components/reveal"
import { BankRail, RailGroup, RailRow } from "@/components/bank/bank-rail"
import { SearchField } from "@/components/bank/pane-bars"
import { ImportantIcon } from "@/components/bank/marks"
import { Button } from "@govblock/ui/components/nova/button"
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
import { MenuFoot, MenuHeader, MenuRow, MenuSeparator } from "@/components/kebab-menu"
import { RowMenu } from "@/components/row-dress"
import { AboutResult } from "./about-result"
import { useShellPanel } from "@/components/shell"
import { PANE_PARAM } from "@/lib/pane"
import { LIFT_ANALYSIS_OPEN, openToolsOnCards } from "@/lib/lift-analyses"
import { AD_COLUMNS, AD_INFO, TRAIT_COLUMN, TRAIT_COLUMNS, adOffice, adWhen, adWhere, dimOf, fieldPeriod, isPlacebo, metricShort, ordered, periodKey, segKey, segOf, setAds, signed, significance, testOf, TRAIT_GROUPS, treatmentName, valOf, type AdColumn, type AdInfo, type Cell, type Pick } from "./lift-data"
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
/** A field period the results register knows is its wave. */
const WAVE = new Map(RESULT_SETS.map((s) => [`${s.fielded.start}|${s.fielded.end}`, `Wave ${s.wave}`]))

const toggled = (list: string[], x: string) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x])

const TH = "group/th border-b px-3 py-2 text-left text-[13px] font-medium whitespace-nowrap"
// The house row's cell (components/row-dress.tsx, Brendan, 2026-10-31): 40px on one line, its line under it.
const TD = "h-10 border-b border-slate-200 px-3 py-0 align-middle text-[13px]"
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
  // The inbox pages' search (Brendan, 2026-10-31): the rail's box, and the toolbar's, opened on its empty run.
  const [query, setQuery] = React.useState("")
  const [searching, setSearching] = React.useState(false)
  // Favorites and Important: treatments starred or flagged on their rows, kept in this browser; the rail's two
  // rows show only them.
  const [favorites, setFavorites] = useStoredList("lift:favorites")
  const [important, setImportant] = useStoredList("lift:important")
  const [mark, setMark] = React.useState<"fav" | "imp" | null>(null)
  const marks = React.useMemo(
    () => ({ fav: favorites, imp: important, toggle: (kind: "fav" | "imp", o: string) => (kind === "fav" ? setFavorites : setImportant)((p) => toggled(p, o)) }),
    [favorites, important, setFavorites, setImportant]
  )
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

  const rows = files[source]
  const archive = source === "LIFT_ARCHIVE"
  // Attributes is the Archive's alone; another folder shows Bars in its place.
  const shownDisplay = display === "attributes" && !archive ? "bars" : display

  // The folder read once: its metrics (Primary first), field periods, treatments
  // and breakdowns, and each result keyed for the table. A row is a treatment
  // in one field period (an entry): a treatment tested in two waves is two rows,
  // and the Filter's field periods decide which survive (Brendan, 2026-10-29: the
  // latest field period no longer shadows the others).
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
      if (!periods.some((p) => p.key === pk)) periods.push({ key: pk, name: WAVE.get(pk) ?? fieldPeriod(r[2], r[3]), dates: fieldPeriod(r[2], r[3]) })
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
    // Each treatment's entries, latest field period first.
    const byOption = new Map<string, string[]>()
    for (const ek of entries) byOption.set(optionOf(ek), [...(byOption.get(optionOf(ek)) ?? []), ek])
    for (const list of byOption.values()) list.sort((a, b) => periodOf(b).localeCompare(periodOf(a)))
    const cell = (ek: string, metric: string, sk: string): Cell | null => {
      const lift = lifts.get(`${ek}\u0001${metric}\u0001${sk}`)
      if (!lift) return null
      const option = optionOf(ek)
      const pk = periodOf(ek)
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

  // The benchmark's median per metric and segment: every treatment's lift on file, every field period.
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
    // The opening set: the featured treatments, and every treatment of the field periods on that they are not in
    // (Brendan, through the lead, 2026-10-29), so both waves on shows both waves.
    if (!picked && featured) {
      const theirs = new Set(featured.flatMap((o) => (read.byOption.get(o) ?? []).map(periodOf)))
      if (theirs.size) return read.options.filter((o) => featured.includes(o) || (read.byOption.get(o) ?? []).some((ek) => !theirs.has(periodOf(ek))))
    }
    const on = picked ?? featured ?? read.options
    // The Filter wins: a set with no rows in the surviving field periods gives way to those periods' treatments.
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
    const q = query.trim().toLowerCase()
    const treatments = read.options
      .filter((o) => chosen.includes(o) && measured(o).length)
      .filter((o) => (!q || treatmentName(o).toLowerCase().includes(q)) && (mark !== "fav" || favorites.includes(o)) && (mark !== "imp" || important.includes(o)))
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
  }, [read, chosen, metricsOff, segsOff, sort, bench, median, archive, colFilter, metricFilter, traitCols, adColsOff, query, mark, favorites, important])

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
    if (about) pairs.push(["at", [about.option, about.metric, about.seg, periodOf(about.entry)]])
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
  // The table's rows in reading order, for the toolbar's arrows: the Archive's test bands, else each breakdown's
  // segments under each treatment, skipping folded bands.
  const order = React.useMemo(() => {
    if (!view || !read) return [] as { o: string; s: Seg }[]
    if (grouped && archive) {
      const tests = new Map<string, string[]>()
      for (const ek of shown) {
        const id = optionOf(ek).match(/\(study ([^)]+)\)/)?.[1] ?? ""
        tests.set(id, [...(tests.get(id) ?? []), ek])
      }
      return [...tests].filter(([id]) => !shut.includes(`test:${id}`)).flatMap(([, eks]) => eks.map((o) => ({ o, s: EVERYONE })))
    }
    return view.groups.flatMap((g) => (g.dim && shut.includes(`seg:${g.dim}`) ? [] : shown.flatMap((o) => g.segs.filter((s) => view.metrics.some((m) => read.cell(o, m, s.key))).map((s) => ({ o, s })))))
  }, [view, read, shown, grouped, archive, shut])
  // The arrows step the open analysis to the row before or after it with the same metric (Brendan, 2026-10-31).
  const neighbor = (dir: 1 | -1) => {
    if (!about || !read) return null
    const at = order.findIndex((r) => r.o === about.entry && r.s.key === about.seg)
    if (at < 0) return null
    for (let j = at + dir; j >= 0 && j < order.length; j += dir) {
      const c = read.cell(order[j].o, about.metric, order[j].s.key)
      if (c) return { ...order[j], c }
    }
    return null
  }
  const step = (dir: 1 | -1) => {
    const n = neighbor(dir)
    if (n && about) setAbout({ option: optionOf(n.o), entry: n.o, metric: about.metric, seg: n.s.key, segName: n.s.name, cell: n.c })
  }

  // The inbox pages' toolbar (Brendan, 2026-10-31): the menu, the rail's toggle, the search its empty run opens,
  // and the arrows. Treatments, Metrics and Segments are the rail's; View, Sort, Filter, Share, Download and Refresh
  // the menu's.
  const toolbar = (
    <div
      className={cn("flex h-[52px] shrink-0 items-center gap-1 border-b px-3", !(searching || query) && "cursor-text")}
      onClick={(event) => {
        const target = event.target as HTMLElement
        if (event.currentTarget.contains(target) && !target.closest("button, [data-keep]")) setSearching(true)
      }}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="More" disabled={!read}>
            <EllipsisVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-max min-w-52">
          <DropdownMenuLabel className="text-xs text-muted-foreground">View</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={shownDisplay} onValueChange={(v) => setDisplay(v as "bars" | "heatmap" | "attributes")}>
            <DropdownMenuRadioItem value="bars">{archive ? "Traits" : "Table"}</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="heatmap">Heatmap</DropdownMenuRadioItem>
            {archive && <DropdownMenuRadioItem value="attributes">Attributes</DropdownMenuRadioItem>}
          </DropdownMenuRadioGroup>
          {shownDisplay === "heatmap" && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <span className="flex-1">Benchmark</span>
                <span className="ml-4 text-xs text-muted-foreground">{bench ? "All tests (Median)" : "None"}</span>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-max min-w-52">
                <DropdownMenuRadioGroup value={bench ? "median" : "none"} onValueChange={(v) => setBench(v === "median")}>
                  <DropdownMenuRadioItem value="median">All tests (Median)</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="none">No benchmark</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <span className="flex-1">Sort by</span>
              <span className="ml-4 text-xs text-muted-foreground">{view ? (view.by === BY_NAME ? "Treatment name" : metricShort(view.by)) : ""}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-max min-w-48">
              <DropdownMenuRadioGroup value={view?.by ?? BY_NAME} onValueChange={(by) => setSort({ by, dir: by === BY_NAME ? 1 : -1 })}>
                {(view?.metrics ?? []).map((m) => (
                  <DropdownMenuRadioItem key={m} value={m}>
                    {metricShort(m)}
                  </DropdownMenuRadioItem>
                ))}
                <DropdownMenuRadioItem value={BY_NAME}>Treatment name</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <span className="flex-1">Filter</span>
              {filterCount > 0 && <span className="ml-4 text-xs text-muted-foreground">{filterCount} on</span>}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-max min-w-52">
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
            </DropdownMenuSubContent>
          </DropdownMenuSub>
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
      <RailToggle />
      {(searching || query) && (
        <div className="min-w-0 flex-1">
          <SearchField query={query} onQuery={setQuery} placeholder="Search treatments…" autoFocus={searching} onClose={() => (setQuery(""), setSearching(false))} />
        </div>
      )}
      {shownDisplay === "heatmap" && (
        <span data-keep className="ml-2 cursor-default">
          <HeatKey center={bench ? "median" : "zero"} />
        </span>
      )}
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" aria-label="Previous" disabled={!neighbor(-1)} onClick={() => step(-1)}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Next" disabled={!neighbor(1)} onClick={() => step(1)}>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )

  // America Thinks' rail (Brendan, 2026-10-31): its search, the folders, Favorites and Important, then the header's
  // old menus as checklists: Treatments, Metrics and Segments, all checked to start, each row on or off.
  const railSearch = (
    <div className="flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-pax2-surface px-3 shadow-e1 transition-colors focus-within:border-slate-300">
      <Search className="size-4 shrink-0 text-slate-400" />
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search…" aria-label="Search treatments" className="w-full min-w-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400" />
      <span aria-hidden className="flex shrink-0 gap-1">
        <kbd className="rounded-md border border-slate-200 bg-pax2-mist px-1.5 py-0.5 text-[11px] text-slate-500">⌘</kbd>
        <kbd className="rounded-md border border-slate-200 bg-pax2-mist px-1.5 py-0.5 text-[11px] text-slate-500">K</kbd>
      </span>
    </div>
  )
  const options = read?.options ?? []
  const rail = (
    <BankRail header={railSearch}>
      <RailGroup>
        {Object.entries(SOURCES).map(([key, name]) => (
          <RailRow key={key} on={source === key && !mark} onClick={() => (setMark(null), openFolder(key))} pane={`/lift?source=${encodeURIComponent(key)}`} icon={Shapes} label={name} />
        ))}
        <RailRow on={mark === "fav"} onClick={() => setMark((m) => (m === "fav" ? null : "fav"))} icon={Star} label="Favorites" count={favorites.length} />
        <RailRow on={mark === "imp"} onClick={() => setMark((m) => (m === "imp" ? null : "imp"))} icon={Flag} label="Important" count={important.length} />
      </RailGroup>
      <RailGroup label="Treatments" collapsible defaultOpen={false} maxRows={12}>
        {options.map((o) => (
          <RailCheck key={o} on={chosen.includes(o)} onToggle={() => setPicked(toggled(chosen, o))} lead={<Thumb o={o} />} label={treatmentName(o)} />
        ))}
        <RailActions actions={[["Show all", () => setPicked(options)], ["Hide all", () => setPicked([])]]} />
      </RailGroup>
      <RailGroup label="Metrics" collapsible defaultOpen={false}>
        {(read?.metrics ?? []).map((m, i, all) => (
          <React.Fragment key={m}>
            {(i === 0 || PRIMARY.has(all[i - 1]) !== PRIMARY.has(m)) && <RailLabel>{PRIMARY.has(m) ? "Primary" : "Secondary"}</RailLabel>}
            <RailCheck on={!metricsOff.includes(m)} onToggle={() => setMetricsOff((prev) => toggled(prev, m))} label={metricShort(m)} />
          </React.Fragment>
        ))}
        <RailLabel>Emotion</RailLabel>
        <RailCheck on={!metricsOff.includes(EMOTION)} onToggle={() => setMetricsOff((prev) => toggled(prev, EMOTION))} label={archive ? "Emotional appeal" : "Emotional response"} />
        {archive && (
          <>
            <RailLabel>Traits</RailLabel>
            {AD_COLUMNS.map((c) => (
              <RailCheck key={c.key} on={!adColsOff.includes(c.key)} onToggle={() => setAdColsOff((prev) => toggled(prev, c.key))} label={c.name} />
            ))}
            {TRAIT_COLUMNS.map((g) => (
              <React.Fragment key={g.group}>
                <RailLabel>{g.group}</RailLabel>
                {g.columns.map((c) => (
                  <RailCheck key={c.key} on={traitCols.includes(c.key)} onToggle={() => setTraitCols((prev) => toggled(prev, c.key))} label={c.name} />
                ))}
              </React.Fragment>
            ))}
          </>
        )}
      </RailGroup>
      <RailGroup label="Segments" collapsible defaultOpen={false} maxRows={12}>
        <RailActions actions={[["Show all", () => setSegsOff([])], ["Everyone only", () => setSegsOff(segGroups.flatMap((g) => (g.dim ? g.vals.map((v) => segKey(g.dim, v)) : [])))]]} />
        {segGroups.map((g) => {
          const keys = g.vals.map((v) => segKey(g.dim, v))
          const on = keys.filter((k) => !segsOff.includes(k)).length
          return (
            <React.Fragment key={g.dim ?? ""}>
              {g.dim && (
                <RailCheck
                  on={on === keys.length ? true : on ? "mixed" : false}
                  onToggle={() => setSegsOff((prev) => (on === keys.length ? [...new Set([...prev, ...keys])] : prev.filter((k) => !keys.includes(k))))}
                  label={g.name}
                  strong
                />
              )}
              {g.vals.map((v) => {
                const k = segKey(g.dim, v)
                return <RailCheck key={k} on={!segsOff.includes(k)} onToggle={() => setSegsOff((prev) => toggled(prev, k))} label={v ?? "Everyone"} indent={!!g.dim} />
              })}
            </React.Fragment>
          )
        })}
      </RailGroup>
    </BankRail>
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
                <td className="absolute top-1/2 right-5 -translate-y-1/2 border-0 p-0">
                  <RowMenu label={`${t.name} options`} className="rounded-lg bg-pax2-lift">
                    <MenuHeader text={t.name} copy={t.name} />
                    <MenuSeparator />
                    <MenuRow icon={<Copy />} label="Copy row" onClick={() => void navigator.clipboard.writeText(`${t.name}\t${t.n} of ${attributes.total}`)} />
                    <MenuSeparator />
                    <MenuFoot title={t.name} sub={g.name} />
                  </RowMenu>
                </td>
              </tr>
            ))}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  )
  const table = shownDisplay === "attributes" ? attributesTable : shownDisplay === "heatmap" ? heatTable : barsTable

  return (
    <Marks.Provider value={marks}>
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
    </Marks.Provider>
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

/** The frame is bare (Brendan, 2026-10-29): no header row, so no header search; the search is the toolbar's. */
const NO_SEARCH = { query: "", onQuery: () => {}, placeholder: "" }

/** A list of ids kept in this browser (America Thinks' useStoredIds). */
function useStoredList(key: string) {
  const [ids, setIds] = React.useState<string[]>([])
  React.useEffect(() => {
    try {
      const v: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]")
      if (Array.isArray(v)) setIds(v.filter((x): x is string => typeof x === "string"))
    } catch {}
  }, [key])
  const set = React.useCallback(
    (next: (prev: string[]) => string[]) =>
      setIds((prev) => {
        const v = next(prev)
        try {
          window.localStorage.setItem(key, JSON.stringify(v))
        } catch {}
        return v
      }),
    [key]
  )
  return [ids, set] as const
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

/** A row's test in the CSV: the wave's name where the results register knows the field period, else the study. */
const testName = (lift: SourceRow) => WAVE.get(periodKey(lift)) ?? testOf(lift)

type Seg = { key: string; name: string }
type RowRead = { cell: (option: string, metric: string, sk: string) => Cell | null }
type RowView = { metrics: string[]; emotion: boolean; axis: number; scale: number; spread: number; segment: boolean; adCols: AdColumn[] }
/** The Archive's one segment, its ads' only row each. */
const EVERYONE: Seg = { key: "", name: "Everyone" }
type OnPick = (o: string, m: string, s: Seg, c: Cell) => void

const fmt = (v: number) => `${v < 0 ? "−" : ""}${num(Math.abs(v))}`

/** A row's entry: a treatment in one field period. */
const entryKey = (option: string, period: string) => `${option}\u0002${period}`
const optionOf = (ek: string) => ek.slice(0, ek.indexOf("\u0002"))
const periodOf = (ek: string) => ek.slice(ek.indexOf("\u0002") + 1)

/** A treatment's picture: its video's frame, or the clips partners' play mark in a frame's shape (Brendan,
 *  2026-10-31: every row has one). */
function Thumb({ o }: { o: string }) {
  return THUMB[o] ? (
    <img src={THUMB[o]} alt="" width={36} height={24} className="h-6 w-9 shrink-0 rounded-[3px] bg-muted object-cover" />
  ) : (
    <span aria-hidden className="flex h-6 w-9 shrink-0 items-center justify-center rounded-[3px] bg-muted text-slate-500">
      <PlayIcon className="size-3.5" strokeWidth={1.75} />
    </span>
  )
}

/** Favorites and Important, for the rows' star and flag (the rail's two rows read the same lists). */
const Marks = React.createContext<{ fav: string[]; imp: string[]; toggle: (kind: "fav" | "imp", o: string) => void } | null>(null)

/** A row's treatment: its picture and its name on one line, cut short rather than wrapped (Brendan, 2026-10-31), and
 *  on the row's hover America Thinks' star and flag, which stay once set. */
function Creative({ ek }: { ek: string }) {
  const o = optionOf(ek)
  const marks = React.useContext(Marks)
  const fav = !!marks?.fav.includes(o)
  const imp = !!marks?.imp.includes(o)
  const mark = (kind: "fav" | "imp") => (event: React.MouseEvent) => (event.stopPropagation(), marks?.toggle(kind, o))
  return (
    <span className="flex min-h-6 min-w-0 items-center gap-2.5">
      <Thumb o={o} />
      <span className="min-w-0 flex-1 truncate font-medium" title={treatmentName(o)}>
        {treatmentName(o)}
      </span>
      {marks && (
        <span className="flex shrink-0 items-center">
          <button type="button" aria-pressed={imp} aria-label={imp ? "Not important" : "Important"} onClick={mark("imp")} className={cn("flex size-6 items-center justify-center rounded-md hover:bg-foreground/8", !imp && "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100")}>
            <ImportantIcon className={imp ? "size-3.5 fill-amber-400 text-amber-400" : "size-3.5 fill-transparent text-muted-foreground"} />
          </button>
          <button type="button" aria-pressed={fav} aria-label={fav ? "Unfavorite" : "Favorite"} onClick={mark("fav")} className={cn("flex size-6 items-center justify-center rounded-md hover:bg-foreground/8", !fav && "opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100")}>
            <Star className={fav ? "size-3.5 fill-amber-400 text-amber-400" : "size-3.5 text-muted-foreground"} />
          </button>
        </span>
      )}
    </span>
  )
}

/** A rail checklist row: a header menu's checkbox, moved into the rail. `on` "mixed" is a breakdown partly shown. */
function RailCheck({ on, onToggle, label, lead, indent, strong }: { on: boolean | "mixed"; onToggle: () => void; label: string; lead?: React.ReactNode; indent?: boolean; strong?: boolean }) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={on === "mixed" ? "mixed" : on}
      onClick={onToggle}
      className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm outline-none transition-colors hover:bg-pax2-lift/70 hover:text-pax2-blue", on ? "text-slate-700" : "text-slate-400", indent && "pl-7", strong && "font-medium")}
    >
      {on === "mixed" ? <Minus className="size-3.5 shrink-0" /> : <Check className={cn("size-3.5 shrink-0", !on && "invisible")} />}
      {lead}
      <span className="min-w-0 truncate">{label}</span>
    </button>
  )
}

function RailLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-2 pt-2 pb-0.5 text-[11px] text-slate-400">{children}</p>
}

function RailActions({ actions }: { actions: [string, () => void][] }) {
  return (
    <div className="flex justify-between px-2 py-1 text-xs">
      {actions.map(([label, run]) => (
        <button key={label} type="button" onClick={run} className="rounded px-1 py-0.5 text-slate-500 hover:text-pax2-blue">
          {label}
        </button>
      ))}
    </div>
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
    <tr className={cn(rowDress(sel), "group/row")}>
      <td className={cn(TD, !last && "border-b-transparent")}>{first && <Creative ek={o} />}</td>
      {view.segment && (
        <td className={cn(TD, "truncate border-l")} title={s.name}>
          {s.name}
        </td>
      )}
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
      <RowEnd o={o} s={s} read={read} view={view} onPick={onPick} />
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
            <Creative ek={o} />
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
      {o && <RowEnd o={o} s={s} read={read} view={view} onPick={onPick} />}
    </Reveal>
  )
})

/** The house row's kebab (components/row-dress.tsx; Brendan, 2026-10-31): at the row's end over its last cell, as
 *  the inbox rows' kebab takes their span's place. Positioned out of the table's flow, so it adds no column. */
function RowEnd({ o, s, read, view, onPick }: { o: string; s: Seg; read: RowRead; view: RowView; onPick: OnPick }) {
  const marks = React.useContext(Marks)
  const opt = optionOf(o)
  const name = treatmentName(opt)
  const fav = !!marks?.fav.includes(opt)
  const imp = !!marks?.imp.includes(opt)
  const first = view.metrics.map((m) => ({ m, c: read.cell(o, m, s.key) })).find((x) => x.c)
  return (
    <td className="absolute top-1/2 right-5 -translate-y-1/2 border-0 p-0">
      <RowMenu label={`${name} options`} className="rounded-lg bg-pax2-lift">
        <MenuHeader text={name} copy={name} />
        <MenuSeparator />
        {first && <MenuRow icon={<PanelRight />} label="Open the analysis" onClick={() => onPick(o, first.m, s, first.c!)} />}
        {marks && (
          <>
            <MenuRow icon={<Star className={fav ? "fill-amber-400 text-amber-400" : undefined} />} label={fav ? "Unfavorite" : "Favorite"} onClick={() => marks.toggle("fav", opt)} />
            <MenuRow icon={<ImportantIcon className={imp ? "fill-amber-400 text-amber-400" : "fill-transparent"} />} label={imp ? "Mark as not important" : "Mark as important"} onClick={() => marks.toggle("imp", opt)} />
          </>
        )}
        <MenuSeparator />
        <MenuFoot title={name} sub={s.name} />
      </RowMenu>
    </td>
  )
}

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
