"use client"

import * as React from "react"
import Link from "next/link"
import { Search } from "lucide-react"

import { cn } from "@/lib/utils"

import { SHORT_SEGMENT, type SourceRow } from "../audience/audience-data"
import { Absent, Tag, pillClass } from "../_wire/wire-bits"
import { bandOf, loadRows, one, signed, typeOf, useWireIndex, type Band } from "../_wire/wire-data"

// /electorate — the population and electorate slice, as Brendan drew it
// (docs/wireframes/electorate-slice.png): the sources down the rail, the
// open source's dimensions as cards, and the table reading each dimension's
// headline band for Massachusetts with its towns or counties below.

const MA = "25"

const ATTITUDES: { key: string; label: string }[] = [
  { key: "GSS", label: "GSS" },
  { key: "ANES", label: "ANES" },
  { key: "CES", label: "CES" },
  { key: "POLL", label: "Polls" },
]
const SLICE: { key: string; label: string }[] = [
  { key: "ACS", label: "Census (ACS)" },
  { key: "CVAP", label: "Voting age (CVAP)" },
  { key: "CPS", label: "Turnout (CPS)" },
  { key: "MA_ENROLLMENT", label: "Enrollment" },
  { key: "ELECTION_RESULT", label: "Results" },
]
const SLICE_KEYS = SLICE.map((s) => s.key)

// The wireframe's names for the Census dimensions: the card's title and
// line, the table's name. A question outside the map reads its own label.
const NAMES: Record<string, { card: string; line: string; table: string }> = {
  sex: { card: "Sex", line: "Population by sex", table: "Sex" },
  age_bucket: { card: "Age", line: "Population by age bucket", table: "Age (18+)" },
  citizenship: { card: "Citizenship", line: "Nativity and citizenship", table: "Citizenship" },
  education_4: { card: "Education", line: "Educational attainment, 25+", table: "Education (25+)" },
  hh_income_bucket: { card: "Household income", line: "Income buckets", table: "Household income" },
  race_eth: { card: "Race / ethnicity", line: "Hispanic origin by race", table: "Race / ethnicity" },
}

// The headline bands the wireframe draws for the slice, plus the two the
// electorate sources name outright. B05001 counts every age, so its band
// reads "Citizen" (by birth or naturalized), not the picture's "Citizen, 18+":
// the 18+ citizen share is CVAP's own row.
const SLICE_SEED: Record<string, { label: string; options: string[] }> = {
  sex: { label: "Female", options: ["Female"] },
  age_bucket: { label: "65+", options: ["65+"] },
  citizenship: { label: "Citizen", options: ["Citizen by birth", "Naturalized citizen"] },
  education_4: { label: "BA or higher", options: ["BA", "Grad"] },
  hh_income_bucket: { label: "Under $50K", options: ["Under $25,000", "$25,000-$49,999"] },
  race_eth: { label: "White, non-Hispanic", options: ["White"] },
  cvap: { label: "Citizen, 18 and over", options: ["Citizen, 18 and over"] },
  turnout: { label: "Voted", options: ["Voted"] },
  registration: { label: "Registered", options: ["Registered"] },
}

type Cell = { v: number; moe: number | null; end: string; start: string }

/** A band's latest total in every geography at once: one pass over the rows,
 *  a multi-option band summed where all its options stand in that period. */
function latestByGeo(rows: SourceRow[], band: Band, type: string): Map<string, Cell> {
  const want = new Set(band.options)
  const acc = new Map<string, Map<string, Map<string, SourceRow>>>()
  for (const r of rows) {
    if (r[5] || r[8] !== type || r[4] == null || !want.has(r[4])) continue
    const byEnd = acc.get(r[1]) ?? new Map<string, Map<string, SourceRow>>()
    acc.set(r[1], byEnd)
    const opts = byEnd.get(r[3]) ?? new Map<string, SourceRow>()
    byEnd.set(r[3], opts)
    if (!opts.has(r[4])) opts.set(r[4], r)
  }
  const out = new Map<string, Cell>()
  for (const [geo, byEnd] of acc) {
    const ends = [...byEnd.keys()].sort().reverse()
    for (const end of ends) {
      const opts = byEnd.get(end)!
      if (opts.size !== want.size) continue
      const rs = [...opts.values()]
      out.set(geo, { v: rs.reduce((s, r) => s + r[7], 0), moe: rs.length === 1 ? rs[0][9] : null, end, start: rs[0][2] })
      break
    }
  }
  return out
}

/** Each geography's base for ranking places: every option's count at its latest period. */
function baseByGeo(rows: SourceRow[]): Map<string, number> {
  const last = new Map<string, string>()
  for (const r of rows) if (!r[5] && r[8] === "count" && r[3] > (last.get(r[1]) ?? "")) last.set(r[1], r[3])
  const out = new Map<string, number>()
  for (const r of rows) if (!r[5] && r[8] === "count" && r[3] === last.get(r[1])) out.set(r[1], (out.get(r[1]) ?? 0) + r[7])
  return out
}

const vintageOf = (c: Cell | undefined) => {
  if (!c) return ""
  const a = Number(c.start.slice(0, 4))
  const b = Number(c.end.slice(0, 4))
  return b - a === 4 ? `${b} 5-yr` : String(b)
}
const placeName = (name: string) => name.split(",")[0].replace(/ (city|town)$/, "")

type Dim = {
  id: string
  card: string
  line: string | null
  table: string
  tableId: string | null
  harm: boolean
  band: Band
  share: Map<string, Cell>
  count: Map<string, Cell>
  base: Map<string, number>
  hasMA: boolean
  states: number
  counties: string[]
  towns: string[]
}

type Level = "MA" | "COUNTY" | "TOWN"

export function ElectorateSlice({ initial }: { initial: string }) {
  const { index, error } = useWireIndex()
  const [open, setOpen] = React.useState(SLICE_KEYS.includes(initial) ? initial : "ACS")
  const [files, setFiles] = React.useState<Record<string, SourceRow[] | "error">>({})
  const [query, setQuery] = React.useState("")
  const [filter, setFilter] = React.useState<"all" | "state" | "towns">("all")
  const [checked, setChecked] = React.useState<string[]>([])
  const [level, setLevel] = React.useState<Level>("MA")

  const counts = React.useMemo(() => {
    const m = new Map<string, number>()
    for (const q of index?.questions ?? []) m.set(q.source, (m.get(q.source) ?? 0) + 1)
    return m
  }, [index])
  const bank = React.useMemo(() => new Set((index?.questions ?? []).map((q) => q.question)).size, [index])
  const geo = React.useMemo(() => new Map((index?.geographies ?? []).map((g) => [g.code, g])), [index])
  const label = SLICE.find((s) => s.key === open)?.label ?? open
  // The Census dimensions in the wireframe's order; any other source in the index's.
  const questions = React.useMemo(() => {
    const qs = (index?.questions ?? []).filter((q) => q.source === open)
    const order = Object.keys(NAMES)
    const rank = (id: string) => (order.includes(id) ? order.indexOf(id) : order.length)
    return open === "ACS" ? [...qs].sort((a, b) => rank(a.question) - rank(b.question)) : qs
  }, [index, open])

  // A new source starts over and keeps its key in the address.
  React.useEffect(() => {
    setQuery("")
    setFilter("all")
    setChecked([])
    setLevel("MA")
    const u = new URL(window.location.href)
    u.searchParams.set("source", open)
    window.history.replaceState(null, "", u)
  }, [open])

  React.useEffect(() => {
    let on = true
    for (const q of questions) {
      const key = `${open}/${q.question}`
      if (files[key]) continue
      loadRows(open, q.question)
        .then((rs) => on && setFiles((prev) => ({ ...prev, [key]: rs })))
        .catch(() => on && setFiles((prev) => ({ ...prev, [key]: "error" })))
    }
    return () => {
      on = false
    }
  }, [questions, open, files])

  const dims = React.useMemo<(Dim | { id: string; card: string; line: string | null; pending: true })[]>(() => {
    const cons = new Map((index?.constructs ?? []).map((c) => [c.construct, c]))
    return questions.map((q) => {
      const c = cons.get(q.question)
      const names = open === "ACS" ? NAMES[q.question] : undefined
      const card = names?.card ?? c?.label ?? q.question
      // The definition is the card's line only where it says more than the title.
      const line = names?.line ?? (c?.definition && !c.label.startsWith(c.definition) ? c.definition : null)
      const rows = files[`${open}/${q.question}`]
      if (!rows || rows === "error") return { id: q.question, card, line, pending: true as const }
      const band = bandOf(q.question, rows, MA, SLICE_SEED)
      const levels = new Map<string, Set<string>>()
      for (const r of rows) {
        const lv = r[1] === "US" ? "US" : (geo.get(r[1])?.level ?? "?")
        const s = levels.get(lv) ?? new Set<string>()
        s.add(r[1])
        levels.set(lv, s)
      }
      const tableId = rows.find((r) => r[12])?.[12]?.match(/group\(([A-Z]\d+[A-Z]?)\)/)?.[1] ?? null
      return {
        id: q.question,
        card,
        line,
        table: names?.table ?? card,
        tableId,
        harm: q.question in SHORT_SEGMENT,
        band,
        share: latestByGeo(rows, band, typeOf(rows)),
        count: latestByGeo(rows, band, "count"),
        base: baseByGeo(rows),
        hasMA: levels.get("STATE")?.has(MA) ?? false,
        states: levels.get("STATE")?.size ?? 0,
        counties: [...(levels.get("COUNTY") ?? [])],
        towns: [...(levels.get("TOWN") ?? [])],
      }
    })
  }, [questions, files, open, index, geo])

  const q = query.trim().toLowerCase()
  const shown = dims.filter((d) => {
    if (q && !`${d.card} ${d.line ?? ""} ${d.id}`.toLowerCase().includes(q)) return false
    if (filter === "all") return true
    if ("pending" in d) return false
    return filter === "state" ? d.hasMA : d.towns.length > 0
  })
  const ready = shown.filter((d): d is Dim => !("pending" in d))
  const anyTowns = ready.some((d) => d.towns.length)
  const anyCounties = ready.some((d) => d.counties.length)
  const toggle = (id: string) => setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))

  // The places below the state rows: the checked dimensions', else the first that reaches the level.
  const placeLevel = level === "COUNTY" ? "counties" : "towns"
  const placeDims = (() => {
    const picked = ready.filter((d) => checked.includes(d.id) && d[placeLevel].length)
    return picked.length ? picked : ready.filter((d) => d[placeLevel].length).slice(0, 1)
  })()

  return (
    <div className="flex h-full min-h-[640px] w-full min-w-0" data-electorate={open}>
      {/* Rail */}
      <nav className="w-[260px] shrink-0 overflow-y-auto border-r px-3 py-4 text-[15px]">
        <RailHead>Scope</RailHead>
        <RailLink href="/audience" label="All sources" count={index ? bank : null} />
        <RailHead>Attitudes</RailHead>
        {ATTITUDES.map((s) => (
          <RailLink key={s.key} href={`/audience?source=${s.key}`} label={s.label} count={index ? (counts.get(s.key) ?? 0) : null} />
        ))}
        <RailHead>Population &amp; electorate</RailHead>
        {SLICE.map((s) => (
          <button
            key={s.key}
            type="button"
            aria-pressed={open === s.key}
            onClick={() => setOpen(s.key)}
            className={cn("flex w-full items-center justify-between rounded-lg px-3.5 py-2 text-left", open === s.key ? "bg-muted font-semibold" : "hover:bg-muted/60")}
          >
            <span>{s.label}</span>
            <span className="tabular-nums">{index ? (counts.get(s.key) ?? 0) : ""}</span>
          </button>
        ))}
        {error && <p className="mt-4 px-3 text-xs text-muted-foreground">{error}</p>}
      </nav>

      {/* Dimension cards */}
      <section className="flex w-[440px] shrink-0 flex-col border-r">
        <div className="border-b p-4">
          <label className="flex h-11 items-center gap-2 rounded-lg border-2 border-foreground px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${questions.length || ""} ${label} questions…`}
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
            />
          </label>
          <div className="mt-3 flex gap-2">
            <button type="button" className={pillClass(filter === "all")} onClick={() => setFilter("all")}>
              All {questions.length}
            </button>
            <button type="button" className={pillClass(filter === "state")} onClick={() => setFilter("state")}>
              Statewide
            </button>
            <button type="button" className={pillClass(filter === "towns")} onClick={() => setFilter("towns")}>
              Towns
            </button>
          </div>
        </div>
        <ul className="min-h-0 flex-1 divide-y overflow-y-auto border-b">
          {shown.map((d) => {
            const on = checked.includes(d.id)
            return (
              <li key={d.id}>
                <button type="button" onClick={() => toggle(d.id)} aria-pressed={on} className={cn("w-full px-4 py-3.5 text-left", on ? "bg-muted/70" : "hover:bg-muted/40")}>
                  <span className="flex items-center gap-2">
                    <span className="line-clamp-2 text-[16px] font-semibold">{d.card}</span>
                    {"harm" in d && d.harm && <Tag>Harm</Tag>}
                  </span>
                  {d.line && <span className="mt-0.5 line-clamp-1 block text-sm text-foreground/75">{d.line}</span>}
                  <span className="mt-0.5 block text-[13px] text-muted-foreground">{"pending" in d ? <span className="inline-block h-3 w-28 animate-pulse rounded bg-muted" /> : spanLine(d)}</span>
                </button>
              </li>
            )
          })}
          {index && !shown.length && <li className="p-6 text-center text-sm text-muted-foreground">{q ? `Nothing matching “${query.trim()}”.` : "No questions on file."}</li>}
        </ul>
      </section>

      {/* The table */}
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-[52px] shrink-0 items-center gap-2 border-b px-5">
          <h1 className="text-[17px] font-semibold">{label}</h1>
          <div className="ml-auto flex gap-2">
            <button type="button" className={pillClass(level === "MA")} onClick={() => setLevel("MA")}>
              MA
            </button>
            <button type="button" className={cn(pillClass(level === "COUNTY"), "disabled:opacity-40")} disabled={!anyCounties} onClick={() => setLevel("COUNTY")}>
              County
            </button>
            <button type="button" className={cn(pillClass(level === "TOWN"), "disabled:opacity-40")} disabled={!anyTowns} onClick={() => setLevel("TOWN")}>
              Town
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="border-b-2 border-foreground/15 text-left text-[13px] text-foreground/80">
                <th className="w-8 py-2 pl-3">
                  <input
                    type="checkbox"
                    aria-label="Select every dimension"
                    checked={ready.length > 0 && ready.every((d) => checked.includes(d.id))}
                    onChange={(e) => setChecked(e.target.checked ? ready.map((d) => d.id) : [])}
                    className="size-3.5 accent-foreground"
                  />
                </th>
                <th className="px-3 py-2 font-medium">Dimension</th>
                <th className="px-3 py-2 font-medium">Headline band</th>
                <th className="px-3 py-2 text-right font-medium">Share</th>
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Count / vs MA</th>
                <th className="px-3 py-2 font-medium">Geography</th>
                <th className="px-3 py-2 font-medium">Vintage</th>
                <th className="px-3 py-2 font-medium">Views</th>
              </tr>
            </thead>
            <tbody>
              <Section>By state: MA</Section>
              {shown.map((d) =>
                "pending" in d ? (
                  <tr key={d.id} className="border-b">
                    <td />
                    <td className="px-3 py-2.5 font-semibold">{NAMES[d.id]?.table ?? d.card}</td>
                    <td colSpan={6} className="px-3 py-2.5">
                      <span className="inline-block h-3 w-40 animate-pulse rounded bg-muted" />
                    </td>
                  </tr>
                ) : (
                  <StateRow key={d.id} d={d} on={checked.includes(d.id)} onToggle={() => toggle(d.id)} />
                )
              )}
            </tbody>
            {placeDims.length > 0 && (
              <tbody>
                <Section>{level === "COUNTY" ? "By county" : "By town"}</Section>
                {placeDims.flatMap((d) => {
                  const ma = d.share.get(MA)
                  const ids = [...d[placeLevel]].sort((a, b) => (d.base.get(b) ?? 0) - (d.base.get(a) ?? 0))
                  return (level === "MA" ? ids.slice(0, 6) : ids).map((g) => {
                    const c = d.share.get(g)
                    return (
                      <tr key={`${d.id}:${g}`} className="border-b">
                        <td />
                        <td className="px-3 py-2">{placeName(geo.get(g)?.name ?? g)}</td>
                        <td className="px-3 py-2 text-foreground/80">{d.band.label}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{c ? `${one(c.v)}%` : <Absent />}</td>
                        <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{c && ma ? `vs MA ${signed(c.v - ma.v)}` : <Absent />}</td>
                        <td className="px-3 py-2">{level === "COUNTY" ? "county" : "town"}</td>
                        <td className="px-3 py-2 tabular-nums">{c ? c.end.slice(0, 4) : ""}</td>
                        <td />
                      </tr>
                    )
                  })
                })}
              </tbody>
            )}
          </table>
        </div>
      </section>
    </div>
  )
}

function spanLine(d: Dim) {
  const where = d.hasMA ? "MA" : d.states ? `${d.states} states` : "US"
  const v = vintageOf(d.share.get(MA) ?? [...d.share.values()][0])
  return `${where}${d.towns.length ? ` + ${d.towns.length} towns` : ""}${v ? ` · ${v.replace(" 5-yr", "")}` : ""}`
}

function StateRow({ d, on, onToggle }: { d: Dim; on: boolean; onToggle: () => void }) {
  const s = d.share.get(MA)
  const c = d.count.get(MA)
  const geoLine = [d.hasMA ? "MA" : d.states ? `${d.states} states` : null, d.counties.length ? `${d.counties.length} counties` : null, d.towns.length ? `${d.towns.length} towns` : null]
    .filter(Boolean)
    .join(" · ")
  return (
    <tr className={cn("border-b", on && "bg-muted/50")}>
      <td className="py-2.5 pl-3 align-middle">
        <input type="checkbox" aria-label={`Read ${d.table} by place`} checked={on} onChange={onToggle} className="size-3.5 accent-foreground" />
      </td>
      <td className="px-3 py-2">
        <span className="block min-w-[150px] max-w-[320px] font-semibold">{d.table}</span>
        <span className="block text-[12px] text-muted-foreground">{d.tableId ?? <code className="font-mono text-[11px]">{d.id}</code>}</span>
      </td>
      <td className="min-w-[230px] px-3 py-2">
        <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="text-foreground/85">{d.band.label}</span>
          <Tag>Headline</Tag>
        </span>
      </td>
      <td className="px-3 py-2 text-right font-semibold tabular-nums" title={s?.moe != null ? `±${one(s.moe)}` : s ? "A sum of the band's options; no margin" : undefined}>
        {s ? `${one(s.v)}%` : <Absent />}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{c ? Math.round(c.v).toLocaleString("en-US") : <Absent />}</td>
      <td className="px-3 py-2 whitespace-nowrap">{geoLine || <Absent />}</td>
      <td className="px-3 py-2 whitespace-nowrap tabular-nums">{vintageOf(s ?? c)}</td>
      <td className="px-3 py-2">
        <button type="button" disabled title="No map surface yet" className={cn(pillClass(false), "h-6 cursor-not-allowed px-2.5 opacity-50")}>
          Map
        </button>
      </td>
    </tr>
  )
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <tr className="border-b bg-muted/40">
      <th colSpan={8} className="px-3 py-1.5 text-left text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
        {children}
      </th>
    </tr>
  )
}

function RailHead({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-5 mb-1.5 px-3.5 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase first:mt-1">{children}</h2>
}

function RailLink({ href, label, count }: { href: string; label: string; count: number | null }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-lg px-3.5 py-2 hover:bg-muted/60">
      <span>{label}</span>
      <span className="tabular-nums">{count != null ? count.toLocaleString("en-US") : ""}</span>
    </Link>
  )
}

