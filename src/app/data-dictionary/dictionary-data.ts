// The data dictionary's rows: every construct in the served audience index, with the
// sources that carry it. The index lists constructs and source files but not which
// source holds which construct, so the files are read once per server process (and
// again when the index changes), keeping only each row's first field.

const BASE = "https://pax-trinity-audience-638175140432.s3.amazonaws.com/exports"

/** Copied from src/app/audience/audience-data.ts (the rail's short names). */
const SHORT_SOURCE: Record<string, string> = {
  ACS: "U.S. Census",
  ANES: "ANES",
  CES: "CES",
  CPS: "Turnout",
  CVAP: "Voting Age",
  ELECTION_RESULT: "Results",
  GSS: "GSS",
  LIFT_ARCHIVE: "Lift",
  MA_ENROLLMENT: "Enrollment",
  PAX_TEST: "Tests",
  POLL: "Polls",
}

type Index = {
  sources: { source: string; label: string; rows: number; file: string }[]
  constructs: { construct: string; label: string | null; definition: string | null }[]
}

export type DictionaryRow = { id: string; term: string; definition: string; section: string }

/** A row of a source file is one line, `["<construct>",...`; files run sorted by construct. */
async function constructsIn(file: string): Promise<Set<string>> {
  const res = await fetch(`${BASE}/${file}`, { cache: "no-store" })
  if (!res.ok || !res.body) throw new Error(`${file}: HTTP ${res.status}`)
  const found = new Set<string>()
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let rest = ""
  let last = ""
  const take = (line: string) => {
    const m = /^\["([^"\\]*)"/.exec(line)
    if (m && m[1] !== last) {
      last = m[1]
      found.add(last)
    }
  }
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = (rest + decoder.decode(value, { stream: true })).split("\n")
    rest = lines.pop() ?? ""
    for (const line of lines) take(line)
  }
  take(rest + decoder.decode())
  return found
}

/** construct -> its sources' short names, scanning four files at a time. */
async function scanSources(index: Index): Promise<Map<string, string[]>> {
  const bySource = new Map<string, Set<string>>()
  const files = [...index.sources]
  const worker = async () => {
    for (let s = files.shift(); s; s = files.shift()) {
      const found = await constructsIn(s.file)
      const short = SHORT_SOURCE[s.source] ?? s.source
      for (const c of found) bySource.set(c, (bySource.get(c) ?? new Set<string>()).add(short))
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
  return new Map([...bySource].map(([c, names]): [string, string[]] => [c, [...names].sort()]))
}

let scanned: { key: string; sections: Promise<Map<string, string[]>> } | null = null

function sectionsFor(index: Index, key: string): Promise<Map<string, string[]>> {
  if (scanned?.key === key) return scanned.sections
  const sections = scanSources(index)
  scanned = { key, sections }
  sections.catch(() => {
    if (scanned?.sections === sections) scanned = null   // retry on the next request
  })
  return sections
}

/** A to Z by the term, letters only, as the glossary sorts. */
const collator = new Intl.Collator("en", { sensitivity: "base" })
const letters = (s: string) => s.replace(/[^\p{L}\p{N} ]/gu, "")

export async function dictionaryRows(): Promise<DictionaryRow[]> {
  const res = await fetch(`${BASE}/index.json`, { cache: "no-store" })
  if (!res.ok) throw new Error(`index.json: HTTP ${res.status}`)
  const index = (await res.json()) as Index
  const key = res.headers.get("etag") ?? index.sources.map((s) => `${s.file}:${s.rows}`).join("|")
  const sections = await sectionsFor(index, key)
  const rows = index.constructs.map((c) => ({
    id: c.construct,
    term: c.label || c.construct,
    definition: c.definition ?? "",
    section: (sections.get(c.construct) ?? []).join(", "),
  }))
  const keys = new Map(rows.map((r) => [r.id, letters(r.term)]))
  return rows.sort((a, b) => collator.compare(keys.get(a.id)!, keys.get(b.id)!) || a.id.localeCompare(b.id))
}
