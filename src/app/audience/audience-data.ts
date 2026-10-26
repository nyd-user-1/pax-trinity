// The audience export's client-side contract, shared by the views: the index
// names the sources, metrics and geographies; each source ships as one or
// more files (a source over 4MB splits), every file an array of 13-element
// rows. The fetch collects every index entry for a source and concatenates.

export type SourceFile = { source: string; label: string; rows: number; file: string }
export type AudienceIndex = {
  sources: SourceFile[]
  constructs: { construct: string; label: string; definition: string }[]
  geographies: { code: string; name: string; level: string; parent: string | null }[]
}
// [metric, geo_code, period_start, period_end, response_option, subgroup_dim,
//  subgroup_value, estimate, estimate_type, moe, item_text, n, provenance_url]
// — item_text null except polls and results; n and provenance_url null where
// the store has none, and absent entirely in a pre-regeneration file.
export type SourceRow = [string, string, string, string, string | null, string | null, string | null, number, string, number | null, string | null, (number | null)?, (string | null)?]

/** One rail row per source key: a split source's parts summed back together. */
export type SourceGroup = { source: string; label: string; rows: number; files: string[] }
export const groupSources = (sources: SourceFile[]): SourceGroup[] => {
  const by = new Map<string, SourceGroup>()
  for (const s of sources) {
    const g = by.get(s.source)
    if (g) (g.rows += s.rows), g.files.push(s.file)
    else by.set(s.source, { source: s.source, label: s.label, rows: s.rows, files: [s.file] })
  }
  return [...by.values()]
}

/** The rail's short names; the full institutional label stays on the About panel. */
export const SHORT_SOURCE: Record<string, string> = {
  ACS: "Census (ACS)",
  ANES: "Election study (ANES)",
  CES: "Election study (CES)",
  CPS: "Turnout (CPS)",
  CVAP: "Voting-age citizens",
  ELECTION_RESULT: "Results",
  GSS: "Social survey (GSS)",
  LIFT_ARCHIVE: "Lift dataset",
  MA_ENROLLMENT: "MA enrollment",
  PAX_TEST: "PAX tests",
  POLL: "Polls",
}
export const shortSource = (key: string) => SHORT_SOURCE[key] ?? key

export const year = (x: string) => String(x).slice(0, 4)
export const period = (start: string, end: string) => (year(start) === year(end) ? year(start) : `${year(start)}–${year(end)}`)
export const num = (x: number, digits = 1) => x.toLocaleString("en-US", { maximumFractionDigits: digits })
export const value = (estimate: number, type: string, moe: number | null) => {
  const body = type === "pct" ? `${num(estimate)}%` : type === "lift_pp" ? `${estimate >= 0 ? "+" : "−"}${num(Math.abs(estimate))} pp` : num(estimate, 0)
  return moe == null ? body : `${body} ± ${num(moe, type === "count" ? 0 : 1)}`
}

/** The names breakdown dimensions print under; a dim outside the list prints as itself. */
export const DIM_LABELS: Record<string, string> = { age: "Age", age_5: "Age", educ: "Education", party: "Party", race: "Race", race_eth: "Race and ethnicity", sex: "Sex", income: "Income" }
export const dimLabel = (d: string) => DIM_LABELS[d] ?? d.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())

const LEVEL_RANK: Record<string, number> = { US: 0, STATE: 1, COUNTY: 2, TOWN: 3 }
export const levelRank = (level: string | undefined) => LEVEL_RANK[level ?? ""] ?? 9
