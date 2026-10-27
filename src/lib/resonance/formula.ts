// Resonance r1: a 0–100 score for paid short-form video, relative to the creatives scored with it.
//
// What it assesses: among the people a creative was served to, how often they stopped for it, gave it
// fifteen seconds, finished it (for its length) and clicked — each measured against the other
// creatives delivered to the same audience and age band. 50 is the middle of the reference set;
// a higher number means the creative engaged the people it reached better than more of its peers.
// It is retrospective and relative: not a forecast for an unpublished video, not a measure of belief
// change, and not evidence of what caused the result.
//
// Pure: no I/O. scripts/results/resonance.mjs reads the CSV, calls scoreDataset, and writes scores.ts.
// docs/reports/resonance-r1.md walks one creative from raw rows to its score.

export const FORMULA_VERSION = "r1" as const
export type FormulaVersion = typeof FORMULA_VERSION

/** One record of the paid-content export, counts as reported. Derived columns are not read: every
 *  rate is recomputed from counts (the export's own rates are rounded and some are blank). */
export interface RawRow {
  recordId: string
  reportDate: string
  setId: string
  creativeId: string
  creativeName: string
  durationSeconds: number
  audience: string
  age: string
  spendUsd: number | null
  impressions: number
  clicks: number
  starts: number
  completions: number
  views15s: number
}

export type ComponentId = "stop" | "hold15" | "finish" | "act"

export interface ComponentDef {
  id: ComponentId
  name: string
  /** The rate, in words, with its numerator and denominator. */
  definition: string
  /** DESIGN CHOICE: the share of the score this component carries when present. */
  weight: number
  /** A stratum's rate is used only when its denominator reaches this count (limited evidence otherwise). */
  minDenominator: number
  denominator: "impressions" | "starts"
}

export const COMPONENTS: readonly ComponentDef[] = [
  {
    id: "stop",
    name: "Stop",
    definition: "Video starts ÷ impressions: of the people served the ad, the share who started the video.",
    weight: 0.3,
    minDenominator: 1000,
    denominator: "impressions",
  },
  {
    id: "hold15",
    name: "15-second hold",
    definition: "15-second views ÷ video starts: of those who started, the share who watched at least 15 seconds — the same span of attention whatever the video's length (every creative here runs 19 seconds or more).",
    weight: 0.35,
    minDenominator: 200,
    denominator: "starts",
  },
  {
    id: "finish",
    name: "Finish, for its length",
    definition: "Completions ÷ video starts, divided by the completion rate expected for a video of that length (a fit across this dataset), so a long video is not marked down for being long.",
    weight: 0.25,
    minDenominator: 200,
    denominator: "starts",
  },
  {
    id: "act",
    name: "Act",
    definition: "Clicks ÷ impressions: of the people served the ad, the share who clicked.",
    weight: 0.1,
    minDenominator: 1000,
    denominator: "impressions",
  },
]

export type Stratify = "audience-age" | "audience-age-set"

export interface Options {
  weights?: Partial<Record<ComponentId, number>>
  /** DESIGN CHOICE: the delivery cells creatives are compared within. */
  stratify?: Stratify
  /** Sensitivity only: skip the length adjustment on finish. */
  durationAdjust?: boolean
}

export interface DurationFit {
  /** ln(completion rate) = intercept + slope × ln(duration seconds), least squares over usable rows. */
  intercept: number
  slope: number
  rows: number
  rSquared: number
}

export interface StratumInput {
  stratum: string
  recordId: string
  reportDate: string
  spendUsd: number | null
  impressions: number
  starts: number
  views15s: number
  completions: number
  clicks: number
  /** Each component's rate in this stratum (a share 0–1; finish as observed ÷ expected), null when unusable. */
  rates: Record<ComponentId, number | null>
  /** Why a component's rate is null here, if it is. */
  excluded: Partial<Record<ComponentId, string>>
}

export interface ComponentResult {
  id: ComponentId
  name: string
  weight: number
  /** The weight after renormalizing over the components this creative has; 0 when absent. */
  effectiveWeight: number
  /** Mean within-stratum percentile, 0–100; null when no stratum was usable. */
  value: number | null
  /** effectiveWeight × value: the points this component adds to the score. */
  contribution: number | null
  strataUsed: number
  strataTotal: number
  perStratum: { stratum: string; rate: number | null; percentile: number | null; peers: number }[]
}

export type Status = "scored" | "partial" | "unscorable"

export interface ResonanceScore {
  formulaVersion: FormulaVersion
  creativeId: string
  creativeName: string
  setId: string
  reportDates: string[]
  durationSeconds: number
  score: number | null
  status: Status
  components: ComponentResult[]
  inputs: StratumInput[]
  flags: string[]
  /** Shown beside the score, never in it: what delivery cost. */
  context: { spendUsd: number; impressions: number; cpmUsd: number | null; clicksTotal: number }
}

export interface ScoredDataset {
  formulaVersion: FormulaVersion
  reference: { creatives: number; rows: number; strata: string[]; reportDates: string[]; stratify: Stratify }
  weights: Record<ComponentId, number>
  durationFit: DurationFit
  scores: ResonanceScore[]
}

// -- pieces ------------------------------------------------------------------------------

const strataKey = (r: RawRow, s: Stratify) => (s === "audience-age-set" ? `${r.audience} · ${r.age} · ${r.setId}` : `${r.audience} · ${r.age}`)

/** Mid-rank percentile of v among values, 0 (lowest) to 100 (highest); ties share the average rank. */
export function percentile(v: number, values: readonly number[]): number {
  if (values.length <= 1) return 50
  const below = values.filter((x) => x < v).length
  const equal = values.filter((x) => x === v).length
  const midRank = below + (equal + 1) / 2 // 1-based
  return (100 * (midRank - 1)) / (values.length - 1)
}

/** Completion rate with half a completion of smoothing, so a zero stays finite on the log scale. */
const smoothedCompletion = (r: RawRow) => (r.completions + 0.5) / (r.starts + 1)

export function fitDuration(rows: readonly RawRow[], minStarts: number): DurationFit {
  const pts = rows.filter((r) => r.starts >= minStarts).map((r) => [Math.log(r.durationSeconds), Math.log(smoothedCompletion(r))] as const)
  const n = pts.length
  if (n < 3) return { intercept: 0, slope: 0, rows: n, rSquared: 0 }
  const mx = pts.reduce((s, [x]) => s + x, 0) / n
  const my = pts.reduce((s, [, y]) => s + y, 0) / n
  const sxx = pts.reduce((s, [x]) => s + (x - mx) ** 2, 0)
  const sxy = pts.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0)
  const syy = pts.reduce((s, [, y]) => s + (y - my) ** 2, 0)
  const slope = sxx > 0 ? sxy / sxx : 0
  const intercept = my - slope * mx
  return { intercept, slope, rows: n, rSquared: sxx > 0 && syy > 0 ? (sxy * sxy) / (sxx * syy) : 0 }
}

function rowRates(r: RawRow, fit: DurationFit, durationAdjust: boolean): Pick<StratumInput, "rates" | "excluded"> {
  const rates: Record<ComponentId, number | null> = { stop: null, hold15: null, finish: null, act: null }
  const excluded: Partial<Record<ComponentId, string>> = {}
  for (const c of COMPONENTS) {
    const den = c.denominator === "impressions" ? r.impressions : r.starts
    if (den < c.minDenominator) {
      excluded[c.id] = den === 0 ? `no ${c.denominator}` : `${den} ${c.denominator}, under the ${c.minDenominator} needed`
      continue
    }
    if (c.id === "stop") rates.stop = r.starts / r.impressions
    if (c.id === "hold15") rates.hold15 = r.views15s / r.starts
    if (c.id === "act") rates.act = r.clicks / r.impressions
    if (c.id === "finish") {
      const expected = durationAdjust ? Math.exp(fit.intercept + fit.slope * Math.log(r.durationSeconds)) : 1
      rates.finish = smoothedCompletion(r) / expected
    }
  }
  return { rates, excluded }
}

const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d

// -- the score --------------------------------------------------------------------------------

export function scoreDataset(rows: readonly RawRow[], options: Options = {}): ScoredDataset {
  const stratify = options.stratify ?? "audience-age"
  const weights = Object.fromEntries(COMPONENTS.map((c) => [c.id, options.weights?.[c.id] ?? c.weight])) as Record<ComponentId, number>
  const fit = fitDuration(rows, COMPONENTS.find((c) => c.id === "finish")?.minDenominator ?? 200)
  const durationAdjust = options.durationAdjust ?? true

  const inputs = rows.map((r) => ({ row: r, stratum: strataKey(r, stratify), ...rowRates(r, fit, durationAdjust) }))
  const strata = [...new Set(inputs.map((i) => i.stratum))].sort()
  const creatives = [...new Set(rows.map((r) => r.creativeId))].sort()

  // Every creative's rate per component per stratum (rows in one creative × stratum are summed first).
  const cellRates = new Map<string, Record<ComponentId, number | null>>()
  for (const cid of creatives) {
    for (const s of strata) {
      const cell = inputs.filter((i) => i.row.creativeId === cid && i.stratum === s)
      if (!cell.length) continue
      if (cell.length === 1) {
        cellRates.set(`${cid}|${s}`, cell[0].rates)
        continue
      }
      const sum = (k: keyof RawRow) => cell.reduce((t, i) => t + Number(i.row[k] ?? 0), 0)
      const merged: RawRow = { ...cell[0].row, impressions: sum("impressions"), starts: sum("starts"), completions: sum("completions"), views15s: sum("views15s"), clicks: sum("clicks") }
      cellRates.set(`${cid}|${s}`, rowRates(merged, fit, durationAdjust).rates)
    }
  }

  const dateCounts = new Map<string, number>()
  for (const r of rows) dateCounts.set(r.reportDate, (dateCounts.get(r.reportDate) ?? 0) + 1)
  const usualDate = [...dateCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]

  const scores: ResonanceScore[] = creatives.map((cid) => {
    const own = inputs.filter((i) => i.row.creativeId === cid)
    const first = own[0].row
    const ownStrata = strata.filter((s) => cellRates.has(`${cid}|${s}`))
    const components: ComponentResult[] = COMPONENTS.map((c) => {
      const perStratum = ownStrata.map((s) => {
        const rate = cellRates.get(`${cid}|${s}`)?.[c.id] ?? null
        const peers = creatives.map((p) => cellRates.get(`${p}|${s}`)?.[c.id]).filter((x): x is number => typeof x === "number")
        return { stratum: s, rate: rate === null ? null : round(rate, 6), percentile: rate === null ? null : round(percentile(rate, peers), 2), peers: peers.length }
      })
      const used = perStratum.filter((p) => p.percentile !== null)
      const value = used.length ? round(used.reduce((t, p) => t + (p.percentile ?? 0), 0) / used.length, 2) : null
      return { id: c.id, name: c.name, weight: weights[c.id], effectiveWeight: 0, value, contribution: null, strataUsed: used.length, strataTotal: strata.length, perStratum }
    })
    const present = components.filter((c) => c.value !== null && c.weight > 0)
    const wsum = present.reduce((t, c) => t + c.weight, 0)
    for (const c of components) {
      if (c.value !== null && c.weight > 0 && wsum > 0) {
        c.effectiveWeight = round(c.weight / wsum, 4)
        c.contribution = round((c.weight / wsum) * c.value, 2)
      }
    }
    const score = present.length ? round(present.reduce((t, c) => t + (c.contribution ?? 0), 0), 1) : null

    const flags: string[] = []
    const missingStrata = strata.filter((s) => !ownStrata.includes(s))
    if (missingStrata.length) flags.push(`No record for ${missingStrata.join(", ")}.`)
    for (const i of own) for (const [k, why] of Object.entries(i.excluded)) flags.push(`${i.row.recordId} (${i.stratum}): ${COMPONENTS.find((c) => c.id === k)?.name} not used — ${why}.`)
    const thin = components.filter((c) => c.strataUsed > 0 && c.strataUsed < c.strataTotal)
    for (const c of thin) flags.push(`${c.name} rests on ${c.strataUsed} of ${c.strataTotal} delivery cells.`)
    const absent = components.filter((c) => c.value === null && c.weight > 0)
    if (absent.length && present.length) flags.push(`Scored without ${absent.map((c) => c.name).join(", ")}; the remaining weights are renormalized.`)
    const clicksTotal = own.reduce((t, i) => t + i.row.clicks, 0)
    if (clicksTotal < 20) flags.push(`Act rests on ${clicksTotal} click${clicksTotal === 1 ? "" : "s"} in total — limited evidence.`)
    const ownDates = [...new Set(own.map((i) => i.row.reportDate))]
    if (usualDate && ownDates.some((d) => d !== usualDate))
      flags.push(`Reported ${ownDates.join(", ")}, unlike most of the reference (${usualDate}); reporting windows are not supplied, so delivery conditions may differ.`)
    const spendKnown = own.filter((i) => i.row.spendUsd !== null)
    if (spendKnown.length < own.length) flags.push(`Spend is blank on ${own.filter((i) => i.row.spendUsd === null).map((i) => i.row.recordId).join(", ")} (cost context only; the score uses no spend).`)

    const spend = spendKnown.reduce((t, i) => t + (i.row.spendUsd ?? 0), 0)
    const impressions = own.reduce((t, i) => t + i.row.impressions, 0)
    const status: Status = score === null ? "unscorable" : components.every((c) => c.strataUsed === c.strataTotal) ? "scored" : "partial"

    return {
      formulaVersion: FORMULA_VERSION,
      creativeId: cid,
      creativeName: first.creativeName,
      setId: first.setId,
      reportDates: [...new Set(own.map((i) => i.row.reportDate))].sort(),
      durationSeconds: first.durationSeconds,
      score,
      status,
      components,
      inputs: own.map((i) => ({
        stratum: i.stratum,
        recordId: i.row.recordId,
        reportDate: i.row.reportDate,
        spendUsd: i.row.spendUsd,
        impressions: i.row.impressions,
        starts: i.row.starts,
        views15s: i.row.views15s,
        completions: i.row.completions,
        clicks: i.row.clicks,
        rates: Object.fromEntries(Object.entries(i.rates).map(([k, v]) => [k, v === null ? null : round(v, 6)])) as Record<ComponentId, number | null>,
        excluded: i.excluded,
      })),
      flags,
      context: { spendUsd: round(spend, 2), impressions, cpmUsd: impressions > 0 && spendKnown.length ? round((spend / impressions) * 1000, 2) : null, clicksTotal },
    }
  })

  return {
    formulaVersion: FORMULA_VERSION,
    reference: { creatives: creatives.length, rows: rows.length, strata, reportDates: [...new Set(rows.map((r) => r.reportDate))].sort(), stratify },
    weights,
    durationFit: { intercept: round(fit.intercept, 4), slope: round(fit.slope, 4), rows: fit.rows, rSquared: round(fit.rSquared, 4) },
    scores,
  }
}
