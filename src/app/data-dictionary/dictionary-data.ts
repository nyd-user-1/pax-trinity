// The data dictionary's rows: every construct in the served audience index, with the
// sources that carry it. The index's question list names each question's source, so
// the rows come from the index alone (2026-10-29: this replaced a per-process scan of
// all 41 source files, ~140 MB, that made a fresh server's first request take 11 s;
// the two agree on all 8,028 constructs). Built rows are reused for five minutes.

// The new account's audience bucket (us-east-2), whose exports/ the bucket policy opens to public reads.
const BASE = "https://pax-trinity-audience-613473203863.s3.us-east-2.amazonaws.com/exports"

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
  constructs: { construct: string; label: string | null; definition: string | null }[]
  questions: { source: string; question: string }[]
}

export type DictionaryRow = { id: string; term: string; definition: string; section: string }

/** A to Z by the term, letters only, as the glossary sorts. */
const collator = new Intl.Collator("en", { sensitivity: "base" })
const letters = (s: string) => s.replace(/[^\p{L}\p{N} ]/gu, "")

function build(index: Index): DictionaryRow[] {
  const bySource = new Map<string, Set<string>>()
  for (const q of index.questions) {
    const short = SHORT_SOURCE[q.source] ?? q.source
    bySource.set(q.question, (bySource.get(q.question) ?? new Set<string>()).add(short))
  }
  const rows = index.constructs.map((c) => ({
    id: c.construct,
    term: c.label || c.construct,
    definition: c.definition ?? "",
    section: [...(bySource.get(c.construct) ?? [])].sort().join(", "),
  }))
  const keys = new Map(rows.map((r) => [r.id, letters(r.term)]))
  return rows.sort((a, b) => collator.compare(keys.get(a.id)!, keys.get(b.id)!) || a.id.localeCompare(b.id))
}

const FRESH_MS = 5 * 60_000
let cached: { at: number; rows: Promise<DictionaryRow[]> } | null = null

export function dictionaryRows(): Promise<DictionaryRow[]> {
  if (cached && Date.now() - cached.at < FRESH_MS) return cached.rows
  const rows = fetch(`${BASE}/index.json`, { cache: "no-store" }).then(async (res) => {
    if (!res.ok) throw new Error(`index.json: HTTP ${res.status}`)
    return build((await res.json()) as Index)
  })
  cached = { at: Date.now(), rows }
  rows.catch(() => {
    if (cached?.rows === rows) cached = null   // retry on the next request
  })
  return rows
}
