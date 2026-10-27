import * as React from "react"

import { fetchQuestionRows, num, period, year, type AudienceIndex, type SourceRow } from "../audience/audience-data"

// What the three wireframe routes share (/q/[source]/[id], /constructs,
// /electorate): one index read per tab, one fetch per question file, and the
// headline-band read every number on those pages comes from.

/** A construct as the export's families carry it. subject, subtopic and
 *  anchors arrive with the construct layer's canonical anchors (migration
 *  012); a member may name its source once members span sources. Every one
 *  is optional so the 17-family shape and the ~300 shape both read. */
export type Family = {
  id: string
  label: string
  definition?: string
  anchor?: string | null
  note?: string
  subject?: string | null
  subtopic?: string | null
  anchors?: { list: string; item: string; subject?: string | null; subtopic?: string | null; url?: string }[]
  members: { question: string; relation: string; of?: string; source?: string }[]
}
export type WireIndex = AudienceIndex & { families?: Family[] }

let indexRead: Promise<WireIndex> | null = null
export function loadIndex(): Promise<WireIndex> {
  if (!indexRead) {
    indexRead = fetch("/audience-data/index.json").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`index.json answered ${r.status}`))))
    indexRead.catch(() => (indexRead = null))
  }
  return indexRead
}

export function useWireIndex() {
  const [index, setIndex] = React.useState<WireIndex | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  React.useEffect(() => {
    let on = true
    loadIndex()
      .then((i) => on && setIndex(i))
      .catch((e: Error) => on && setError(e.message))
    return () => {
      on = false
    }
  }, [])
  return { index, error }
}

const rowReads = new Map<string, Promise<SourceRow[]>>()
/** One question's rows, each file fetched once per tab however many cells ask. */
export function loadRows(source: string, id: string): Promise<SourceRow[]> {
  const key = `${source}/${id}`
  let p = rowReads.get(key)
  if (!p) {
    p = fetchQuestionRows(source, id)
    p.catch(() => rowReads.delete(key))
    rowReads.set(key, p)
  }
  return p
}

export const rawHref = (source: string, id: string) => `/audience-data/q/${source.toLowerCase()}/${id}.json`
export const dossierHref = (source: string, id: string) => `/q/${source.toLowerCase()}/${encodeURIComponent(id)}`

// ── The headline band ────────────────────────────────────────────────────
// The band a question's numbers are read on. Brendan's wireframes
// (2026-10-27) name one for each construct they draw; the seed holds those,
// each checked against the question's own options before use. A band the
// picture draws across several options ("Agree + strongly", "1–3 (should)")
// sums them within one wave and cell, and only where every option is there.
// A question the picture does not draw reads on its largest option at the
// latest wave.

export type Band = { label: string; options: string[]; seeded: boolean }

const HEADLINE: Record<string, { label: string; options: string[] }> = {
  confidence_congress: { label: "Hardly any", options: ["Hardly any"] },
  confidence_federal_executive: { label: "Hardly any", options: ["Hardly any"] },
  confidence_press: { label: "Hardly any", options: ["Hardly any"] },
  social_trust: { label: "Most people can be trusted", options: ["Most people can be trusted"] },
  people_fair: { label: "Would try to be fair", options: ["Would try to be fair"] },
  people_helpful: { label: "Try to be helpful", options: ["Try to be helpful"] },
  get_ahead: { label: "Hard work most important", options: ["Hard work most important"] },
  gov_reduce_income_diff: { label: "1–3 (should)", options: ["1 (Government should reduce income differences)", "2", "3"] },
  income_gap_too_large: { label: "Agree + strongly", options: ["Agree", "Strongly agree"] },
  party_id_7: { label: "Independent (pure)", options: ["Independent"] },
  ideology_7: { label: "Moderate", options: ["Moderate, middle of the road"] },
  national_pride: { label: "Very proud", options: ["Very proud"] },
  nationalism: { label: "Agree", options: ["Agree"] },
  religious_attendance: { label: "Never", options: ["Never"] },
}

/** The value type a band reads in: shares where the rows carry them. */
export function typeOf(rows: SourceRow[]): string {
  let first: string | null = null
  for (const r of rows) {
    if (r[8] === "pct") return "pct"
    first ??= r[8]
  }
  return first ?? "pct"
}

/** The geography a question is read at first: the US, else the highest level its rows reach. */
export function baseGeoOf(rows: SourceRow[], level: (code: string) => string | undefined): string {
  const rank = (c: string) => ({ US: 0, STATE: 1, COUNTY: 2, TOWN: 3 })[level(c) ?? ""] ?? 9
  let best: string | null = null
  for (const r of rows) if (best == null || rank(r[1]) < rank(best)) best = r[1]
  return best ?? "US"
}

/** The wireframes' band for a question, where every option it names is one the question carries. */
export function seededBand(id: string, options: Iterable<string>, seed: Record<string, { label: string; options: string[] }> = HEADLINE): Band | null {
  const have = new Set(options)
  const s = seed[id]
  return s && s.options.every((o) => have.has(o)) ? { ...s, seeded: true } : null
}

export function bandOf(id: string, rows: SourceRow[], geo: string, seed: Record<string, { label: string; options: string[] }> = HEADLINE): Band {
  const have = new Set(rows.map((r) => r[4]).filter((o): o is string => o != null))
  const s = seededBand(id, have, seed)
  if (s) return s
  // The largest option at the geography's latest total.
  const type = typeOf(rows)
  const top = rows.filter((r) => r[1] === geo && !r[5] && r[8] === type && r[4] != null)
  const last = top.reduce<string>((b, r) => (r[3] > b ? r[3] : b), "")
  const at = top.filter((r) => r[3] === last).sort((a, b) => b[7] - a[7])[0]
  const opt = at?.[4] ?? [...have][0] ?? null
  return opt ? { label: opt, options: [opt], seeded: false } : { label: "", options: [], seeded: false }
}

/** One wave's read of a band in one cell. */
export type Point = {
  year: number
  end: string
  /** The wave as it prints: a year, or a five-year span ("2020–2024"). */
  span: string
  v: number
  moe: number | null
  n: number | null
  type: string
  summed: boolean
}

/** A band's series in one cell (a geography, the total or one subgroup):
 *  one point per year, the latest period within it, a multi-option band
 *  summed where every option stands in that period. */
export function seriesOf(rows: SourceRow[], band: Band, geo: string, dim: string | null = null, val: string | null = null, as?: string): Point[] {
  if (!band.options.length) return []
  const type = as ?? typeOf(rows)
  const want = new Set(band.options)
  const byEnd = new Map<string, SourceRow[]>()
  for (const r of rows) {
    if (r[1] !== geo || r[8] !== type || r[4] == null || !want.has(r[4])) continue
    if (dim ? r[5] !== dim || r[6] !== val : r[5]) continue
    const g = byEnd.get(r[3])
    if (g) g.push(r)
    else byEnd.set(r[3], [r])
  }
  const byYear = new Map<number, Point>()
  const one = want.size === 1
  for (const [end, rs] of byEnd) {
    // One row per option; a duplicate (two loaders on one cell) keeps its first.
    const per = new Map<string, SourceRow>()
    for (const r of rs) if (!per.has(r[4]!)) per.set(r[4]!, r)
    if (per.size !== want.size) continue
    let v = 0
    for (const r of per.values()) v += r[7]
    const p: Point = { year: Number(year(end)), end, span: period(rs[0][2], end), v, moe: one ? rs[0][9] : null, n: rs[0][11] ?? null, type, summed: !one }
    const had = byYear.get(p.year)
    if (!had || end > had.end) byYear.set(p.year, p)
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year)
}

export const BASE_YEAR = 2008

/** The first comparable wave: 2008 where the series has it, else its first
 *  wave after 2008, else its first wave. Null when that is the latest. */
export function baseWave(points: Point[]): Point | null {
  if (points.length < 2) return null
  const last = points[points.length - 1]
  const p = points.find((x) => x.year === BASE_YEAR) ?? points.find((x) => x.year > BASE_YEAR && x !== last) ?? points[0]
  return p === last ? null : p
}

// ── Formatting ───────────────────────────────────────────────────────────

export const MINUS = "−"
/** One decimal always, the way a topline prints: 45.0, not 45. */
export const one = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
export const fmt = (v: number, type: string) => (type === "count" ? num(v, 0) : one(v))
export const fmtPct = (v: number, type: string) => (type === "pct" ? `${one(v)}%` : fmt(v, type))
export const signed = (d: number) => `${d > 0 ? "+" : d < 0 ? MINUS : "±"}${one(Math.abs(d))}`
/** Ranges read with an en dash: "18-29" prints "18–29". */
export const dashed = (s: string) => s.replace(/(\d)\s*-\s*(\d)/g, "$1–$2")

const ORD = ["", "", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"]
export const ordinal = (k: number) => ORD[k] ?? `${k}th`

/** The postal code a state prints as on a chip; a town or county prints its first name part. */
const POSTAL: Record<string, string> = { "02": "AK", "08": "CO", "11": "DC", "16": "ID", "25": "MA", "32": "NV", "46": "SD" }
export const shortGeo = (code: string, name?: string) => (code === "US" ? "US" : POSTAL[code] ?? (name ? name.split(",")[0] : code))
