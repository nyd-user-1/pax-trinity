// The audience export's client-side contract, shared by the views: the index
// names the sources, metrics and geographies; each source ships as one or
// more files (a source over 4MB splits), every file an array of 13-element
// rows. The fetch collects every index entry for a source and concatenates.

export type SourceFile = { source: string; label: string; rows: number; file: string }
export type AudienceIndex = {
  sources: SourceFile[]
  /** wording arrived with Brief P (2026-10-26): the codebook's verbatim question text, absent where none is sourced. */
  constructs: { construct: string; label: string; definition: string; wording?: string }[]
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
export const shortSource = (key: string) => SHORT_SOURCE[key] ?? key

/** The rail branch's segment names, clipped to the word the row needs. */
export const SHORT_SEGMENT: Record<string, string> = {
  age_bucket: "Age",
  citizenship: "Citizenship",
  education_4: "Education",
  hh_income_bucket: "Income",
  race_eth: "Ethnicity",
  sex: "Sex",
}
export const shortSegment = (id: string, fallback: string) => SHORT_SEGMENT[id] ?? fallback

/** Per-source segment counts for the rail before a source is read; the live
 *  count replaces a seed the moment the source's files load. From the 2026-10
 *  export; a regenerated export corrects itself on first read. */
export const SEGMENT_SEED: Record<string, number> = {
  ACS: 6,
  ANES: 1518,
  CES: 943,
  CPS: 12,
  CVAP: 2,
  ELECTION_RESULT: 1,
  GSS: 5541,
  LIFT_ARCHIVE: 3,
  MA_ENROLLMENT: 1,
  PAX_TEST: 2,
  POLL: 4,
}

export const year = (x: string) => String(x).slice(0, 4)
export const period = (start: string, end: string) => (year(start) === year(end) ? year(start) : `${year(start)}–${year(end)}`)
export const num = (x: number, digits = 1) => x.toLocaleString("en-US", { maximumFractionDigits: digits })
export const value = (estimate: number, type: string, moe: number | null) => {
  const body = type === "pct" ? `${num(estimate)}%` : type === "lift_pp" ? `${estimate >= 0 ? "+" : "−"}${num(Math.abs(estimate))} pp` : num(estimate, 0)
  return moe == null ? body : `${body} ± ${num(moe, type === "count" ? 0 : 1)}`
}

// Seeded survey wordings (Brendan, 2026-10-26): a question card reads as the
// question would on a survey. Verified seeds only — the Rossi abortion
// battery and the 2018 module from GSS Methodological Report 133, the
// Congress forms phrased from their own response bands, PARTYID's canonical
// text — until Brief P lands the codebook's verbatim texts in the export.
// A question outside this map prints its source label.
const ROSSI = "Please tell me whether or not you think it should be possible for a pregnant woman to obtain a legal abortion if"
const ABHELP = "If a close family member or friend decided to have an abortion, which of the following kinds of help, if any, would you give if you were able —"
export const WORDING: Record<string, string> = {
  confidence_congress: "Would you say you have a great deal of confidence, only some confidence, or hardly any confidence at all in the people running Congress?",
  concong: "How much confidence do you have in Congress?",
  conlegiy: "On a scale of 1 to 7, where 1 is complete confidence and 7 is no confidence at all, how much confidence do you have in the people running Congress?",
  trcong: "On a scale of 0 to 10, where 0 is no trust at all and 10 is complete trust, how much do you personally trust Congress?",
  trlegis: "On a scale of 0 to 10, how much do you trust the U.S. Congress?",
  party_id_7: "Generally speaking, do you usually think of yourself as a Republican, Democrat, Independent, or what?",
  abdefect: `${ROSSI} there is a strong chance of serious defect in the baby?`,
  abdefectg: `${ROSSI} there is a strong chance of serious defect in the baby?`,
  abnomore: `${ROSSI} she is married and does not want any more children?`,
  abnomoreg: `${ROSSI} she is married and does not want any more children?`,
  abhlth: `${ROSSI} the woman's own health is seriously endangered by the pregnancy?`,
  abhlthg: `${ROSSI} the woman's own health is seriously endangered by the pregnancy?`,
  abpoor: `${ROSSI} the family has a very low income and cannot afford any more children?`,
  abpoorg: `${ROSSI} the family has a very low income and cannot afford any more children?`,
  abrape: `${ROSSI} she became pregnant as a result of rape?`,
  abrapeg: `${ROSSI} she became pregnant as a result of rape?`,
  absingle: `${ROSSI} she is not married and does not want to marry the man?`,
  absingleg: `${ROSSI} she is not married and does not want to marry the man?`,
  abany: `${ROSSI} the woman wants it for any reason?`,
  abanyg: `${ROSSI} the woman wants it for any reason?`,
  abfelegl: "Leaving aside what you think of abortion for yourself, do you think a woman should continue to be able to have an abortion legally or not, or would you say it depends?",
  abmelegl: "Leaving aside what you think of abortion for those close to you, do you think a woman should continue to be able to have an abortion legally or not, or would you say it depends?",
  abmoral: "Leaving aside whether you think abortion should be legal, are you morally opposed to abortion or not, or would you say it depends?",
  abstate1: "Here in your state, how easy or hard do you think it is for a woman to get an abortion?",
  abstate2: "Here in your state, do you think that laws should be changed to make it easier for a woman to get an abortion, be changed to make it harder for a woman to get an abortion, or should the laws stay as they are now?",
  abhelp1: `${ABHELP} help with arrangements, like a ride or childcare?`,
  abhelp2: `${ABHELP} help paying for the abortion?`,
  abhelp3: `${ABHELP} help paying for costs other than the abortion, like for a ride or hotel if she needs to stay overnight?`,
  abhelp4: `${ABHELP} help by providing emotional support?`,
  abinspay: "People use their health insurance to help cover the cost of receiving health care. Do you think people should be able to use their health insurance to help cover the cost of receiving an abortion?",
}
/** The badge: the source's own mnemonic for the question. */
const MNEMONIC: Record<string, string> = { confidence_congress: "CONLEGIS", party_id_7: "PARTYID" }
export const mnemonicOf = (id: string) => MNEMONIC[id] ?? id.toUpperCase()

/** The 2021 web transition's grid re-fieldings: verbatim their parents' text,
 *  a different administration — the card says so after the wording. */
export const WEB_GRID = new Set(["abanyg", "abdefectg", "abhlthg", "abnomoreg", "abpoorg", "abrapeg", "absingleg"])

/** The codebook ships questions wearing interviewer markup — "(Do you agree
 *  or disagree that . . .) Overall…", "[Besides the regular, weekly worship
 *  service,] What type…", "[Do you/Does someone in your household] belong…",
 *  a trailing "(Would you say...)" or "First mention". For display the
 *  question reads as one clean sentence: stems fuse in, an alternation takes
 *  its household form, interviewer fragments drop. The stored wording stays
 *  verbatim; this is the card's read of it. */
export function normalizeWording(w: string): string {
  let t = w
  // [A/B]: the interviewer picks per respondent; the card reads the last form.
  t = t.replace(/\[([^\]]*\/[^\]]*)\]/g, (_, inner: string) => (inner.split("/").pop() ?? "").trim())
  // A bracketed lead-in fuses into the sentence; after a mid-sentence comma the next word lowercases.
  const b = t.match(/^\s*\[([^\]]+)\]\s*(.+)$/s)
  if (b) {
    const lead = b[1].trim()
    t = /[.?!]$/.test(lead) ? `${lead} ${b[2]}` : `${lead} ${b[2].charAt(0).toLowerCase()}${b[2].slice(1)}`
  }
  // A leading parenthetical stem fuses, its trailing ellipsis dropped; an unclosed one sheds the bare paren.
  const m = t.match(/^\s*\(([^)]+)\)\s*(.+)$/s)
  if (m) {
    const stem = m[1].replace(/\s*(\.{3}|…|\.\s?\.\s?\.)\s*$/, "").trim()
    t = `${stem} ${m[2].trim()}`
  } else if (t.trimStart().startsWith("(")) {
    t = t.trimStart().slice(1)
  }
  // Trailing interviewer fragments: "(Would you say...)" and mention marks.
  t = t.replace(/\s*\([^)]*(\.{3}|…)\s*\)\s*$/, "").replace(/\s+\d*\.?\s*(First|Second|Third) mention\.?$/i, "")
  // An inline fill ellipsis — "abortion if. . . The woman wants it" — fuses, the next word lowercased.
  t = t.replace(/\s*(?:\.\s?\.\s?\.|\.{3}|…)\s*([A-Za-z])/g, (_, ch: string) => ` ${ch.toLowerCase()}`)
  return t.replace(/\s+/g, " ").trim()
}

/** The scale family a question's own bands reveal — the type badge beside the mnemonic. */
export function scaleOf(options: string[]): string | null {
  if (!options.length) return null
  const low = options.map((o) => o.toLowerCase().trim())
  if (options.length === 2 && low.includes("yes") && low.includes("no")) return "Yes / No"
  if (low.some((o) => o.includes("agree"))) return "Agree scale"
  const nums = options.map((o) => o.match(/^(\d+)/)?.[1])
  if (options.length >= 5 && nums.every(Boolean)) return `${nums[0]}–${nums[nums.length - 1]} scale`
  return null
}

/** The weight the loader's tally used, mirrored from audience/loaders/gss.py
 *  (2024 codebook R3a): WTSSNRPS from 2004 on, WTSSPS before. Only GSS is
 *  mapped; another source prints nothing until the export carries its weight. */
export const weightOf = (source: string | null, y: string) => (source === "GSS" ? (Number(y) >= 2004 ? "WTSSNRPS" : "WTSSPS") : null)

/** The names breakdown dimensions print under; a dim outside the list prints as itself. */
export const DIM_LABELS: Record<string, string> = { age: "Age", age_5: "Age", educ: "Education", party: "Party", race: "Race", race_eth: "Race and ethnicity", sex: "Sex", income: "Income" }
export const dimLabel = (d: string) => DIM_LABELS[d] ?? d.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())

const LEVEL_RANK: Record<string, number> = { US: 0, STATE: 1, COUNTY: 2, TOWN: 3 }
export const levelRank = (level: string | undefined) => LEVEL_RANK[level ?? ""] ?? 9

/** The latest-period row of a set, by period_end. */
export const latestRow = (rs: SourceRow[]) => rs.reduce<SourceRow | null>((b, r) => (!b || r[3] > b[3] ? r : b), null)

/** A metric's read: its lead response option, baseline geography and topline. */
export type MetricInfo = {
  id: string
  option: string | null
  type: string
  baseGeo: string
  topline: SourceRow | null
  /** The lead option's rows, the ones the grid reads. */
  rs: SourceRow[]
  /** Every response option the metric carries, in the file's order: its bands. */
  options: string[]
  /** An archive of one-shot lifts reads as their median, not a baseline. */
  median: { v: number; n: number } | null
}

export const metricIdsOf = (rows: SourceRow[]) => {
  // A Set, one pass: the includes scan was quadratic, and at GSS scale
  // (5,541 metrics over 461K rows) it alone cost billions of comparisons.
  const seen = new Set<string>()
  const ids: string[] = []
  for (const r of rows)
    if (!seen.has(r[0])) {
      seen.add(r[0])
      ids.push(r[0])
    }
  return ids
}

export function buildInfo(rows: SourceRow[], geoLevel: Map<string, string>): Map<string, MetricInfo> {
  // One pass groups the rows by metric; every per-metric read then works its
  // own slice alone. The old shape filtered the whole file once per metric,
  // which was quadratic and froze the tab the moment a bulk source opened.
  const groups = new Map<string, SourceRow[]>()
  for (const r of rows) {
    const g = groups.get(r[0])
    if (g) g.push(r)
    else groups.set(r[0], [r])
  }
  const m = new Map<string, MetricInfo>()
  for (const [id, all] of groups) {
    const option = all.find((r) => r[4] != null)?.[4] ?? null
    const optSet = new Set<string>()
    const options: string[] = []
    for (const r of all)
      if (r[4] != null && !optSet.has(r[4])) {
        optSet.add(r[4])
        options.push(r[4])
      }
    const rs = all.filter((r) => (r[4] ?? null) === option)
    const type = rs[0]?.[8] ?? "pct"
    // The baseline geography is the highest level the metric reaches: US
    // before a state, a state before its towns.
    let baseGeo = rs[0]?.[1] ?? "US"
    for (const r of rs) if (levelRank(geoLevel.get(r[1])) < levelRank(geoLevel.get(baseGeo))) baseGeo = r[1]
    const topline = latestRow(rs.filter((r) => !r[5] && r[1] === baseGeo))
    let median: MetricInfo["median"] = null
    if (type === "lift_pp") {
      const perOpt = new Map<string, SourceRow>()
      for (const r of all) {
        const k = r[4] ?? ""
        const had = perOpt.get(k)
        if (!had || r[3] > had[3]) perOpt.set(k, r)
      }
      const vals = [...perOpt.values()].map((r) => r[7]).sort((a, b) => a - b)
      if (vals.length) median = { v: vals[Math.floor(vals.length / 2)], n: vals.length }
    }
    m.set(id, { id, option, type, baseGeo, topline, rs, options, median })
  }
  return m
}

/** The list row's teaser: the topline the way the inbox snippets a thread. */
export function snippetOf(c: MetricInfo | undefined, place: (code: string) => string) {
  if (!c) return ""
  if (c.median) return `median ${c.median.v >= 0 ? "+" : "−"}${num(Math.abs(c.median.v))} pp · ${c.median.n.toLocaleString("en-US")} entries`
  const t = c.topline
  if (!t) return ""
  const head = t[8] === "count" ? num(t[7], 0) : `${num(t[7])}%`
  return `${head} · ${place(c.baseGeo)} · ${year(t[3])}`
}
