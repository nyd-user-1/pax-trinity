import type { Arm, Derivation, ResultSet, SubgroupCell, SubgroupDimension, Topline, Verdict } from "@/lib/results/types"

// The readout's arithmetic: every number on /reports comes through here from
// a ResultSet. Nothing is computed that the data cannot carry; a lift is only
// ever read against its own wave's placebo.

export const MINUS = "−"

export const placeboOf = (rs: ResultSet): Arm | undefined => rs.arms.find((a) => a.role === "placebo")
export const treatmentsOf = (rs: ResultSet): Arm[] => rs.arms.filter((a) => a.role === "treatment")

export const toplineOf = (rs: ResultSet, armId: string, outcomeId: string): Topline | undefined =>
  rs.toplines.find((t) => t.armId === armId && t.outcomeId === outcomeId)

/** The ≈ mark: printed on a figure derived from rounded values, never on a published one. */
export const approx = (d: Derivation | undefined) => (d === "derived_from_rounded" ? "≈ " : "")

const plain = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: 1 })

/** A lift as printed: "+18", "−3", "0". */
export const signed = (v: number) => (v > 0 ? `+${plain(v)}` : v < 0 ? `${MINUS}${plain(Math.abs(v))}` : "0")
export const pct = (v: number) => `${plain(v)}%`
export const count = (v: number) => Math.round(v).toLocaleString("en-US")

export const verdictWord = (v: Verdict) => (v === "detectable" ? "Detectable" : "Inconclusive")

/** A shared axis from the figures it carries: zero always on it, ends at the next multiple of five. */
export function axis(values: number[], floor = 0): { min: number; max: number; ticks: number[] } {
  const lo = Math.min(floor, ...values)
  const hi = Math.max(0, ...values)
  const min = Math.floor(lo / 5) * 5
  const max = Math.max(5, Math.ceil(hi / 5) * 5)
  const ticks: number[] = []
  for (let t = min; t <= max; t += 5) ticks.push(t)
  return { min, max, ticks }
}

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"]
export const word = (n: number) => NUMBER_WORDS[n] ?? String(n)
/** "Nine of ten", "None of four": a count of a whole, either case. */
export const countOf = (k: number, n: number, capital = true) => {
  const head = k === 0 ? "none" : word(k)
  return `${capital ? head.charAt(0).toUpperCase() + head.slice(1) : head} of ${word(n)}`
}
export const Word = (n: number) => {
  const w = word(n)
  return w.charAt(0).toUpperCase() + w.slice(1)
}

/** "October 2–7, 2026", "September 28 – October 3, 2026". */
export function dateRange(start: string, end: string): string {
  const a = new Date(`${start}T12:00:00Z`)
  const b = new Date(`${end}T12:00:00Z`)
  const m = (d: Date) => d.toLocaleString("en-US", { month: "long", timeZone: "UTC" })
  const y = b.getUTCFullYear()
  if (a.getUTCFullYear() !== y) return `${m(a)} ${a.getUTCDate()}, ${a.getUTCFullYear()} – ${m(b)} ${b.getUTCDate()}, ${y}`
  if (m(a) !== m(b)) return `${m(a)} ${a.getUTCDate()} – ${m(b)} ${b.getUTCDate()}, ${y}`
  return a.getUTCDate() === b.getUTCDate() ? `${m(a)} ${a.getUTCDate()}, ${y}` : `${m(a)} ${a.getUTCDate()}–${b.getUTCDate()}, ${y}`
}
export const monthYear = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })

/** "Waves 1 & 2", "Waves 1, 2 & 3", "Wave 1". */
export function wavesLine(waves: number[]): string {
  const w = [...waves].sort((a, b) => a - b)
  if (w.length === 1) return `Wave ${w[0]}`
  return `Waves ${w.slice(0, -1).join(", ")} & ${w[w.length - 1]}`
}

/** A campaign's own creative, set apart from the producer's in every chart. */
export const isCampaign = (a: Arm | undefined) => !!a?.producer && /campaign/i.test(a.producer)

export const cellOf = (rs: ResultSet, dim: string, cat: string, arm: string, outcome = "ballot"): SubgroupCell | undefined =>
  rs.cells.find((c) => c.dimensionId === dim && c.categoryId === cat && c.armId === arm && c.outcomeId === outcome)

/** A dimension's marks counted from its cells: treatment cells marked vs placebo, of all treatment cells. */
export function marksOf(rs: ResultSet, d: SubgroupDimension): { marked: number; of: number; small: string[] } {
  const treat = new Set(treatmentsOf(rs).map((a) => a.id))
  const cells = rs.cells.filter((c) => c.dimensionId === d.id && treat.has(c.armId))
  const small = d.categories.filter((cat) => cat.smallSampleAllCells || rs.cells.some((c) => c.dimensionId === d.id && c.categoryId === cat.id && c.smallSample)).map((c) => c.name)
  return { marked: cells.filter((c) => c.significant).length, of: cells.length, small }
}

/** A list read as prose: "A", "A and B", "A, B and C". */
export function listed(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? ""
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`
}

export const slugOf = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
