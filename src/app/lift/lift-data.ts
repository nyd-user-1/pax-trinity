import { num, type SourceRow } from "../america-thinks/audience-data"

// What the results grid and its About Result panel share: how a lift row is
// keyed (treatment, metric, segment, fielding), the control group it stands
// against, and the arrow both draw.

/** An archive treatment's row label; the study id stays for the About panel. */
export const treatmentName = (option: string) => option.replace(/\s*\(study[^)]*\)/, "")

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
