import "server-only"

import fs from "node:fs"

import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"

// America Thinks for the chat's tools (Brendan, 2026-11-02: "instant and accurate access to all of the
// tables"). The export the page serves at /audience-data/ is the audience bucket's exports/: index.json
// (every construct with its wording, every source's questions with their years and options, the
// geographies) and one file per question, q/<source>/<id>.json, in the page's own 13-element rows. The
// index is read once per server; a question's rows once each, a few hundred kept. This checkout's
// public/audience-data serves development, as it serves the page there.

type Construct = { construct: string; label?: string; definition?: string; wording?: string; topics?: string[] }
type IndexQuestion = { source: string; question: string; first: number; last: number; waves: number; options: string[] }
type Geography = { code: string; name: string; level: string; parent: string | null }

/** [metric, geo, start, end, option, segment dim, segment value, estimate, type, moe, item text, n, url, significant?] */
export type Row = [string, string, string, string, string | null, string | null, string | null, number, string, number | null, string | null, (number | null)?, (string | null)?, (boolean | null)?]

export type Atlas = {
  constructs: Map<string, Construct>
  /** Each question id's entries, one per source that asks it. */
  questions: Map<string, IndexQuestion[]>
  geos: Map<string, Geography>
  /** A geography's code by its lower-cased name, so "Massachusetts" finds 25. */
  geoByName: Map<string, string>
}

const BUCKET = process.env.PAX2_BUCKET ?? "pax-trinity-audience-613473203863"
let s3: S3Client | null = null

/** An export file's text: this checkout's copy when there is one, else the bucket's exports/. */
async function readExport(parts: string[]): Promise<string | null> {
  // Assembled, not a literal, so the build's file tracer doesn't pull the export into the bundle.
  const local = [/*turbopackIgnore: true*/ process.cwd(), "public", "audience-data", ...parts].join("/")
  if (fs.existsSync(local)) return fs.promises.readFile(local, "utf8")
  s3 ??= new S3Client({ region: process.env.PAX2_BUCKET_REGION ?? "us-east-2" })
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: `exports/${parts.join("/")}` }))
    return (await r.Body?.transformToString()) ?? null
  } catch (e) {
    if ((e as { name?: string }).name === "NoSuchKey") return null
    throw e
  }
}

let atlasLoad: Promise<Atlas> | null = null

/** The index, read once per server (a failed read is tried again next time). */
export function atlas(): Promise<Atlas> {
  atlasLoad ??= (async () => {
    const text = await readExport(["index.json"])
    if (!text) throw new Error("America Thinks' index could not be read")
    const ix = JSON.parse(text) as { constructs?: Construct[]; questions?: IndexQuestion[]; geographies?: Geography[] }
    const questions = new Map<string, IndexQuestion[]>()
    for (const q of ix.questions ?? []) questions.set(q.question, [...(questions.get(q.question) ?? []), q])
    const geos = new Map((ix.geographies ?? []).map((g) => [g.code, g]))
    return {
      constructs: new Map((ix.constructs ?? []).map((c) => [c.construct, c])),
      questions,
      geos,
      geoByName: new Map((ix.geographies ?? []).map((g) => [g.name.toLowerCase(), g.code])),
    }
  })().catch((e) => {
    atlasLoad = null
    throw e
  })
  return atlasLoad
}

const STOP = new Set("a an and are as at be by do does for from has have how i in is it its of on or the this that to was what when where which who why will with you your about people question questions poll polls".split(" "))
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
const words = (q: string) => norm(q).split(" ").filter((w) => w.length > 1 && !STOP.has(w))

const yearsOf = (q: IndexQuestion) => (q.first === q.last ? String(q.first) : `${q.first}–${q.last}`)
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/** The words a question is asked in: the export's verbatim wording, else its label. */
export const wordingOf = (a: Atlas, id: string) => {
  const c = a.constructs.get(id)
  return c?.wording || c?.label || c?.definition || id
}

export type QuestionHit = { id: string; source: string; question: string; options: string[]; more_options?: number; years: string; waves: number }

/** Questions whose id, wording, label, definition, topics or source hold most of the words of `q` (all of
 *  one or two, three of four, and so on), best first: more words matched, then words in the wording. */
export function searchQuestions(a: Atlas, q: string, opts: { source?: string; limit: number }): { total: number; hits: QuestionHit[] } {
  const ws = words(q)
  const source = opts.source?.toUpperCase()
  const exact = q.trim()
  const scored: { id: string; entry: IndexQuestion; score: number }[] = []
  for (const [id, entries] of a.questions) {
    const entry = (source ? entries.find((e) => e.source === source) : entries[0]) ?? null
    if (!entry) continue
    if (id === exact) {
      scored.push({ id, entry, score: 1000 })
      continue
    }
    if (!ws.length) continue
    const c = a.constructs.get(id)
    const label = norm(`${c?.label ?? ""} ${c?.wording ?? ""}`)
    const hay = ` ${norm(id)} ${label} ${norm(c?.definition ?? "")} ${norm((c?.topics ?? []).join(" "))} ${entry.source.toLowerCase()} `
    const hit = ws.filter((w) => hay.includes(w)).length
    if (hit < Math.max(Math.min(ws.length, 2), Math.ceil(ws.length * 0.6))) continue
    // Words matched first, words in the label or wording next, then the longer-running series.
    const inLabel = ws.filter((w) => ` ${label} `.includes(` ${w} `)).length
    scored.push({ id, entry, score: 100 * hit + 10 * inLabel + Math.min(entry.waves, 20) / 2 })
  }
  scored.sort((x, y) => y.score - x.score || x.id.localeCompare(y.id))
  const hits = scored.slice(0, opts.limit).map(({ id, entry }) => {
    const options = entry.options.slice(0, 10)
    return {
      id,
      source: entry.source,
      question: cut(wordingOf(a, id), 240),
      options,
      ...(entry.options.length > options.length ? { more_options: entry.options.length - options.length } : {}),
      years: yearsOf(entry),
      waves: entry.waves,
    }
  })
  return { total: scored.length, hits }
}

const ROWS_KEPT = 300
const rowCache = new Map<string, Row[]>()

/** One question's rows from one source, kept (the oldest let go past a few hundred). */
export async function questionRows(source: string, id: string): Promise<Row[] | null> {
  const key = `${source}/${id}`
  const kept = rowCache.get(key)
  if (kept) return kept
  const text = await readExport(["q", source.toLowerCase(), `${id}.json`])
  if (!text) return null
  const rows = JSON.parse(text) as Row[]
  rowCache.set(key, rows)
  if (rowCache.size > ROWS_KEPT) rowCache.delete(rowCache.keys().next().value as string)
  return rows
}

const LEVEL_RANK: Record<string, number> = { US: 0, STATE: 1 }
const rank = (a: Atlas, code: string) => LEVEL_RANK[a.geos.get(code)?.level ?? ""] ?? 2
const r1 = (x: number | null | undefined) => (x == null ? null : Math.round(x * 10) / 10)
const yearOf = (iso: string) => iso.slice(0, 4)
const MAX_CELLS = 40

export type ToplineInput = { id: string; source?: string; geo?: string; by?: string; year?: string }

/**
 * A question's topline as America Thinks reads it: each answer option's estimate at the question's
 * highest geography (or the one named) for its latest wave (or the year named), with its n, margin and
 * source link; the lead option's trend; and, given `by`, the crosstab by that breakdown. What else the
 * rows hold (years, places, breakdowns) is listed so the next call can ask for it.
 */
export async function topline(a: Atlas, input: ToplineInput) {
  const entries = a.questions.get(input.id)
  if (!entries?.length) return { error: `No question has the id "${input.id}". Find it with find_questions.` }
  const entry = (input.source ? entries.find((e) => e.source === input.source!.toUpperCase()) : null) ?? entries[0]
  const rows = await questionRows(entry.source, input.id)
  if (!rows?.length) return { error: `The rows for ${input.id} (${entry.source}) could not be read.` }

  // The place: a code or a name the index knows, else the highest level the rows reach.
  const named = input.geo ? (a.geos.has(input.geo) ? input.geo : a.geoByName.get(input.geo.trim().toLowerCase())) : undefined
  if (input.geo && !named) return { error: `No geography is named "${input.geo}". Use a state's name or "US".` }
  const places = [...new Set(rows.map((r) => r[1]))]
  const geo = named ?? places.reduce((b, g) => (rank(a, g) < rank(a, b) ? g : b), places[0])
  const total = rows.filter((r) => !r[5] && r[1] === geo)
  if (!total.length) return { error: `${input.id} has no rows for ${a.geos.get(geo)?.name ?? geo}.`, places: places.slice(0, 12).map((g) => a.geos.get(g)?.name ?? g) }

  const ends = [...new Set(total.map((r) => r[3]))].sort()
  const end = input.year ? [...ends].reverse().find((e) => yearOf(e) === input.year || total.some((r) => r[3] === e && yearOf(r[2]) === input.year)) : ends[ends.length - 1]
  if (!end) return { error: `${input.id} has no wave in ${input.year} for ${a.geos.get(geo)?.name ?? geo}.`, years: ends.map(yearOf) }
  const wave = total.filter((r) => r[3] === end)
  const options: (string | null)[] = []
  for (const r of rows) if (!options.includes(r[4] ?? null)) options.push(r[4] ?? null)
  const shares = options.flatMap((o) => {
    const r = wave.find((x) => (x[4] ?? null) === o)
    return r ? [{ option: o ?? "(value)", estimate: r1(r[7]), ...(r[9] != null ? { moe: r1(r[9]) } : {}) }] : []
  })
  const lead = options[0] ?? null
  const trend = ends
    .slice(-15)
    .map((e) => total.find((r) => r[3] === e && (r[4] ?? null) === lead))
    .filter((r): r is Row => !!r)
    .map((r) => ({ year: yearOf(r[3]), estimate: r1(r[7]) }))
  const dims = [...new Set(rows.filter((r) => r[5]).map((r) => r[5] as string))]
  const first = wave[0]

  let crosstab: unknown = undefined
  if (input.by) {
    const cells = rows.filter((r) => r[5] === input.by && r[1] === geo && r[3] === end)
    if (!cells.length) crosstab = { error: `No breakdown "${input.by}" in this wave. The breakdowns: ${dims.join(", ") || "none"}.` }
    else {
      const values = [...new Set(cells.map((r) => r[6] as string))]
      const perValue = Math.max(1, options.length)
      const shown = values.slice(0, Math.max(1, Math.floor(MAX_CELLS / perValue)))
      crosstab = {
        by: input.by,
        groups: shown.map((v) => {
          const vr = cells.filter((r) => r[6] === v)
          return { group: v, n: vr.find((r) => r[11] != null)?.[11] ?? null, estimates: Object.fromEntries(vr.map((r) => [r[4] ?? "(value)", r1(r[7])])) }
        }),
        ...(values.length > shown.length ? { more_groups: values.length - shown.length } : {}),
      }
    }
  }

  return {
    id: input.id,
    source: entry.source,
    question: cut(first[10] || wordingOf(a, input.id), 300),
    place: a.geos.get(geo)?.name ?? geo,
    wave: yearOf(first[2]) === yearOf(first[3]) ? yearOf(first[3]) : `${first[2]} to ${first[3]}`,
    type: first[8],
    n: wave.reduce<number | null>((m, r) => (r[11] != null && (m == null || r[11] > m) ? r[11] : m), null),
    shares,
    trend: trend.length > 1 ? { option: lead ?? "(value)", points: trend } : undefined,
    crosstab,
    years: ends.length > 12 ? `${ends.length} waves, ${yearOf(ends[0])}–${yearOf(ends[ends.length - 1])}` : ends.map(yearOf),
    places: places.length > 1 ? `${places.length} places (US, states)` : undefined,
    breakdowns: dims.length ? dims : undefined,
    link: first[12] ?? null,
  }
}
