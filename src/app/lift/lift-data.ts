import { num, type SourceRow } from "../america-thinks/audience-data"

// What the results grid and its About Result panel share: how a lift row is
// keyed (treatment, metric, segment, fielding), the control group it stands
// against, and the arrow both draw.

/** What the archive records about one of its ads (public/lift/archive-ads.json, written by
 *  audience/audience/lift_ads.py). The campaigns are anonymized and stay so. */
export type AdInfo = { state: string; race: string | null; date: string | null; cycle: number; ad: number; ads: number; tone: string | null; focus: string | null; traits: string[]; emotions: Record<string, number> }
export const AD_INFO = new Map<string, AdInfo>()
/** The ads' descriptions arrive with the Archive's rows, before its table draws. */
export function setAds(ads: Record<string, AdInfo>) {
  for (const [k, v] of Object.entries(ads)) AD_INFO.set(k, v)
}

const RACE: Record<string, string> = { Presidential: "President", Congress: "Congress", Gov: "Governor", StateLeg: "State legislature", Runoff: "Runoff", Other: "Other race" }
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
/** Where an archive ad's test ran: a state, two, a count of states, or national. */
export function adWhere(a: AdInfo) {
  const states = a.state.split(",").map((x) => x.trim()).filter(Boolean)
  return a.state === "National" ? "National" : states.length > 2 ? `${states.length} states` : states.join(", ")
}
export const adOffice = (a: AdInfo) => (a.race ? (RACE[a.race] ?? a.race) : "—")
export const adWhen = (a: AdInfo) => (a.date ? `${MONTH[Number(a.date.slice(5, 7)) - 1]} ${a.date.slice(0, 4)}` : String(a.cycle))
const cap = (x: string | null) => (x ? x[0].toUpperCase() + x.slice(1) : "—")
/** An archive ad named on one line (Brendan's rework, 2026-10-29), its traits in their own columns: "AZ Congress · Ad 1 of 4". */
function adLabel(a: AdInfo) {
  return `${[adWhere(a), a.race ? (RACE[a.race] ?? a.race) : null].filter(Boolean).join(" ")} · Ad ${a.ad} of ${a.ads}`
}

/** The Archive's trait columns: each its cell's value, its sort key, and the value its filter lists. */
export const AD_COLUMNS: { key: string; name: string; width: number; value: (a: AdInfo) => string; order: (a: AdInfo) => string }[] = [
  { key: "@office", name: "Office", width: 124, value: adOffice, order: adOffice },
  { key: "@state", name: "State", width: 92, value: adWhere, order: adWhere },
  { key: "@tested", name: "Tested", width: 96, value: adWhen, order: (a) => a.date ?? String(a.cycle) },
  { key: "@tone", name: "Tone", width: 92, value: (a) => cap(a.tone), order: (a) => cap(a.tone) },
  { key: "@focus", name: "Focus", width: 96, value: (a) => cap(a.focus), order: (a) => cap(a.focus) },
]

/** A treatment's row label: an archive ad by its traits where the archive describes it, else its name. */
export const treatmentName = (option: string) => {
  const ad = AD_INFO.get(option)
  return ad ? adLabel(ad) : option.replace(/\s*\(study[^)]*\)/, "")
}

/** The Traits view's rows: each a test an ad passes, grouped as the archive's coders grouped them. */
export const TRAIT_GROUPS: { name: string; traits: { key: string; name: string; has: (a: AdInfo) => boolean }[] }[] = [
  { name: "Tone", traits: ["positive", "negative", "contrast"].map((t) => ({ key: `tone:${t}`, name: t[0].toUpperCase() + t.slice(1), has: (a) => a.tone === t })) },
  { name: "Focus", traits: ["candidate", "issues"].map((t) => ({ key: `focus:${t}`, name: t[0].toUpperCase() + t.slice(1), has: (a) => a.focus === t })) },
  { name: "Race", traits: Object.entries(RACE).filter(([k]) => k !== "Other").map(([k, n]) => ({ key: `race:${k}`, name: n, has: (a) => a.race === k })) },
  { name: "Cycle", traits: [2018, 2020].map((y) => ({ key: `cycle:${y}`, name: String(y), has: (a) => a.cycle === y })) },
  {
    name: "Content",
    traits: (
      [
        ["policy_facts", "Policy facts"],
        ["candidate_facts", "Candidate facts"],
        ["mentions_party", "Mentions a party"],
        ["mentions_trump", "Mentions Trump"],
        ["cites_source", "Cites a source"],
      ] as const
    ).map(([k, n]) => ({ key: k, name: n, has: (a) => a.traits.includes(k) })),
  },
  {
    name: "Technique",
    traits: (
      [
        ["name_calling", "Name-calling"],
        ["testimonial", "Testimonial"],
        ["plain_folks", "Plain folks"],
      ] as const
    ).map(([k, n]) => ({ key: k, name: n, has: (a) => a.traits.includes(k) })),
  },
  {
    name: "Emotional appeal",
    traits: ["anger", "disgust", "enthusiasm", "fear", "humor", "pride", "sadness", "somber"].map((e) => ({ key: `emotion:${e}`, name: e[0].toUpperCase() + e.slice(1), has: (a) => (a.emotions[e] ?? 0) >= 0.5 })),
  },
  {
    name: "Messenger",
    traits: (
      [
        ["messenger_female", "Woman"],
        ["messenger_male", "Man"],
        ["messenger_black", "Black"],
        ["messenger_white", "White"],
        ["messenger_elderly", "Older adult"],
        ["messenger_children", "Children"],
      ] as const
    ).map(([k, n]) => ({ key: k, name: n, has: (a) => a.traits.includes(k) })),
  },
]

const METRIC_SHORT: Record<string, string> = {
  lift_comprehension: "Comprehension",
  lift_support: "Support",
  lift_favorability: "Favorability",
  lift_vote_choice: "Vote choice",
  lift_vote_choice_dichotomized: "Vote choice (two-way)",
}
export const metricShort = (id: string) => METRIC_SHORT[id] ?? id

/** The export writes the store's "all" subgroup as null: the Total row. */
export const dimOf = (r: SourceRow) => (r[5] && r[5] !== "all" ? r[5] : null)
export const valOf = (r: SourceRow) => (dimOf(r) ? r[6] : null)
export const segKey = (dim: string | null, val: string | null) => (dim ? `${dim}=${val ?? ""}` : "")
export const segOf = (r: SourceRow) => segKey(dimOf(r), valOf(r))
export const periodKey = (r: SourceRow) => `${r[2]}|${r[3]}`
/** The test a lift came from: an archive study, or a PAX wave's fielding. */
export const testOf = (r: SourceRow) => r[4]?.match(/\(study ([^)]+)\)/)?.[1] ?? periodKey(r)
export const isPlacebo = (option: string | null) => !!option && /^placebo$/i.test(option.trim())

/** One result: the treatment's lift, its own level where published, and its control group's level. */
export type Cell = { lift: SourceRow; level: SourceRow | null; control: SourceRow | null }
/** entry: the row's treatment-in-a-fielding key; option: the treatment alone. */
export type Pick = { option: string; entry: string; metric: string; seg: string; segName: string; cell: Cell }

/** Whether a lift clears its test: the source's own call where it makes one,
 *  else its margin; null where there is neither. */
export const significance = (r: SourceRow): boolean | null => (typeof r[13] === "boolean" ? r[13] : r[9] != null ? Math.abs(r[7]) > r[9] : null)

/** A breakdown's segments in reading order: by their first number where every
 *  one has a number (ages, incomes), else as the export lists them. */
export function ordered(values: string[]) {
  const lead = (v: string) => Number(v.replace(/,/g, "").match(/\d+(\.\d+)?/)?.[0])
  return values.every((v) => Number.isFinite(lead(v))) ? [...values].sort((a, b) => lead(a) - lead(b)) : values
}

export const signed = (x: number) => `${x >= 0 ? "+" : "−"}${num(Math.abs(x))}`
export const levelOf = (r: SourceRow) => (r[8] === "pct" ? `${num(r[7])}%` : `${num(r[7])} pts`)

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
/** A fielding window: a whole year as the year, otherwise its days. */
export function fielding(start: string, end: string) {
  const [ys, ms, ds] = start.slice(0, 10).split("-").map(Number)
  const [ye, me, de] = end.slice(0, 10).split("-").map(Number)
  if (ms === 1 && ds === 1 && me === 12 && de === 31) return ys === ye ? String(ys) : `${ys}–${ye}`
  if (ys === ye && ms === me) return ds === de ? `${MONTHS[ms - 1]} ${ds}, ${ys}` : `${MONTHS[ms - 1]} ${ds}–${de}, ${ys}`
  if (ys === ye) return `${MONTHS[ms - 1]} ${ds} – ${MONTHS[me - 1]} ${de}, ${ys}`
  return `${MONTHS[ms - 1]} ${ds}, ${ys} – ${MONTHS[me - 1]} ${de}, ${ye}`
}

/** The arrow's two headings: the lift's direction from the control group. */
export const POINT_RIGHT = "polygon(0 0, calc(100% - 6px) 0, 100% 50%, calc(100% - 6px) 100%, 0 100%)"
export const POINT_LEFT = "polygon(6px 0, 100% 0, 100% 100%, 6px 100%, 0 50%)"
