import type { Arm, OutcomeDef, ResultSet, SubgroupCell, SubgroupDimension, Topline } from "./types"

// A completed message test's results, derived from its own responses (the loop's part A,
// docs/briefs/loop-pipeline.md): one pass that rakes the respondents to the population's targets
// and emits the three artifacts the surfaces already read, so /lift, /reports and /clips show a
// test that has finished with no change of their own:
//
//   resultSet    the register's shape (./types.ts), as /reports and /clips read it
//   rows         the audience export's pax_test rows (fourteen fields, significance included), as /lift reads them
//   indexEntry   the export index's PAX_TEST question entries for those rows
//
// The arithmetic is scripts/results/compute.mjs's, unchanged: iterative proportional fitting to the
// targets, weights normalized to mean 1 and capped at `trim`; per arm and outcome the weighted level,
// the lift against the placebo in points, a two-sided two-proportion z-test on Kish effective
// sizes, detectable when p < 1 − threshold and both groups have at least `minCell` respondents; the
// same per subgroup on the ballot. Added here: each lift's margin, the export's convention of
// 1.645 standard errors (90%). Pure: no reads, no writes.

export type DeriveTest = {
  id: string
  title: string
  entry: { key: string; prompt: string; choices: { value: string; label: string }[] }[]
  ballot: { prompt: string; choices: { value: string; label: string }[] }
  comprehension: { prompt: string; choices: { value: string; label: string }[]; correct: string }
  arms: string[]
  placeboSrc: string
}

export type DeriveItem = { kind: string; id: string; pid?: string | null; arm?: string; env?: string; receivedAt?: string; startedAt?: string; completedAt?: string; answers?: Record<string, string>; comprehensionCorrect?: boolean }

export type Targets = {
  populationName?: string
  threshold?: number
  minCell?: number
  trim?: number
  targetsSource?: string
  factors: Record<string, Record<string, number>>
  provenance?: Record<string, { source?: string; rows?: string; period?: string; universe?: string; proxy?: string; derivation?: string; derivedFromRounded?: boolean; notes?: string[] }>
}

export type DeriveOptions = {
  env: "production" | "development" | "all"
  /** The register's id for the set; defaults to <test>-computed. */
  id?: string
  study?: string
  wave?: number
  title?: string
  /** The export's geography (a state FIPS, "US"). */
  geo: string
  /** Where the responses were read, for the set's sources and the rows' source field. */
  source: string
  /** The arm's name as every surface shows it. */
  armName: (armId: string) => string
  /** The arm's clip, where it is one in the clips catalog. */
  clipOf?: (armId: string) => { clipId: string; durationSeconds?: number } | null
  /** The subgroup dimensions, from the entry questions; each maps to the export's dimension name. */
  dimensions?: { key: string; name: string; group: string; exportName: string; selfSelected?: boolean }[]
  now?: Date
}

export type ExportRow = [string, string, string, string, string | null, string | null, string | null, number, string, number | null, string | null, number | null, string | null, boolean?]

export type Derived = { resultSet: ResultSet; rows: ExportRow[]; indexEntry: { source: string; question: string; first: number; last: number; waves: number; options: string[] }[]; summary: string[] }

const PLACEBO = "placebo"
/** The register's outcomes under the export's metric names (/lift's Tests folder). */
export const METRICS: Record<string, string> = { ballot: "lift_support", comprehension: "lift_comprehension" }
/** The export's own names for the battery's entry questions, so a test's segments sit beside the MA waves'. */
export const EXPORT_DIMS: Record<string, string> = { ideology: "ideology", party: "party", education: "education", vote2024: "presidential_vote_2024", mediaTrust: "media_trust" }

const r1 = (x: number) => Math.round(x * 10) / 10

// Standard normal CDF (Abramowitz & Stegun 7.1.26 erf, |error| < 1.5e-7).
function phi(z: number) {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2))
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2)
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2
}

export function deriveResults(test: DeriveTest, items: DeriveItem[], cfg: Targets, o: DeriveOptions): Derived {
  const threshold = cfg.threshold ?? 0.9
  const minCell = cfg.minCell ?? 50
  const inEnv = (i: DeriveItem) => o.env === "all" || i.env === o.env

  // -- the counted respondents: complete records, the latest per panel pid ------------------
  const completes = items.filter((i) => i.kind === "complete" && inEnv(i))
  const byPid = new Map<string, DeriveItem>()
  for (const r of completes) {
    const key = r.pid ? `pid:${r.pid}` : `id:${r.id}`
    const prev = byPid.get(key)
    if (!prev || (r.receivedAt ?? "") > (prev.receivedAt ?? "")) byPid.set(key, r)
  }
  const resp = [...byPid.values()].filter((r) => r.arm && test.arms.includes(r.arm))
  const dropped = {
    otherEnv: items.filter((i) => i.kind === "complete" && !inEnv(i)).length,
    duplicates: completes.length - byPid.size,
    unknownArm: byPid.size - resp.length,
    screenouts: items.filter((i) => i.kind === "screenout" && inEnv(i)).length,
    starts: items.filter((i) => i.kind === "start" && inEnv(i)).length,
  }

  // -- raking -------------------------------------------------------------------------------
  const rakeNotes: string[] = []
  const w = resp.map(() => 1)
  const asked = new Set(test.entry.map((q) => q.key))
  const notAsked = Object.keys(cfg.factors).filter((k) => !asked.has(k))
  if (notAsked.length) rakeNotes.push(`Declared but not asked by this test, so not raked: ${notAsked.join(", ")}.`)
  const plan = Object.entries(cfg.factors)
    .filter(([key]) => asked.has(key))
    .map(([key, targets]) => {
      const present = Object.keys(targets).filter((c) => resp.some((r) => r.answers?.[key] === c))
      const missing = Object.keys(targets).filter((c) => !present.includes(c))
      const total = present.reduce((s, c) => s + targets[c], 0)
      if (missing.length) rakeNotes.push(`${key}: no counted respondent in ${missing.join(", ")}; those targets were dropped and the rest renormalized.`)
      return { key, targets: Object.fromEntries(present.map((c) => [c, total > 0 ? targets[c] / total : 0])) as Record<string, number> }
    })
    .filter((f) => Object.keys(f.targets).length > 0)
  const provenanceNotes = plan.map((f) => {
    const p = cfg.provenance?.[f.key]
    const targets = Object.entries(f.targets).map(([c, v]) => `${c} ${(v * 100).toFixed(1)}%`).join(", ")
    if (!p) return `Weighting target, ${f.key} (as raked): ${targets}; no provenance in the targets.`
    const parts = [p.source, p.rows, p.period ? `period ${p.period.replace("…", " to ")}` : null, p.universe ? `universe ${p.universe}` : null, p.proxy ?? null, p.derivation ? `derivation ${p.derivation}${p.derivedFromRounded ? " (from rounded figures)" : ""}` : null]
    return `Weighting target, ${f.key} (as raked): ${targets}. ${parts.filter(Boolean).join("; ")}.${p.notes?.length ? " " + p.notes.join(" ") : ""}`
  })
  let iterations = 0
  let gap = 0
  const shareGap = (f: (typeof plan)[number]) => {
    const idx = resp.map((r, i) => [r.answers?.[f.key], i] as const).filter(([v]) => v != null && v in f.targets)
    const known = idx.reduce((s, [, i]) => s + w[i], 0)
    return Object.keys(f.targets).map((c) => Math.abs(idx.filter(([v]) => v === c).reduce((s, [, i]) => s + w[i], 0) / (known || 1) - f.targets[c]))
  }
  for (; plan.length && iterations < 500; iterations++) {
    for (const f of plan) {
      const idx = resp.map((r, i) => [r.answers?.[f.key], i] as const).filter(([v]) => v != null && v in f.targets)
      const known = idx.reduce((s, [, i]) => s + w[i], 0)
      for (const c of Object.keys(f.targets)) {
        const inC = idx.filter(([v]) => v === c).map(([, i]) => i)
        const have = inC.reduce((s, i) => s + w[i], 0)
        if (have > 0) for (const i of inC) w[i] *= (f.targets[c] * known) / have
      }
    }
    gap = Math.max(0, ...plan.flatMap(shareGap))
    if (gap < 1e-6) {
      iterations++
      break
    }
  }
  const norm = () => {
    const m = w.length ? w.reduce((s, x) => s + x, 0) / w.length : 1
    for (let i = 0; i < w.length; i++) w[i] /= m
  }
  norm()
  let trimmed = 0
  if (cfg.trim) {
    for (let i = 0; i < w.length; i++)
      if (w[i] > cfg.trim) {
        w[i] = cfg.trim
        trimmed++
      }
    norm()
  }

  // -- statistics -----------------------------------------------------------------------------
  type Stat = { n: number; sw: number; neff: number; p: number }
  const yesOf = (r: DeriveItem) => r.answers?.ballot === "yes"
  const correctOf = (r: DeriveItem) => (typeof r.comprehensionCorrect === "boolean" ? r.comprehensionCorrect : r.answers?.comprehension === test.comprehension.correct)
  const OUTCOMES = [
    { id: "ballot", hit: yesOf },
    { id: "comprehension", hit: correctOf },
  ]
  const summarize = (ix: number[], hit: (r: DeriveItem) => boolean): Stat => {
    const sw = ix.reduce((s, i) => s + w[i], 0)
    const sw2 = ix.reduce((s, i) => s + w[i] * w[i], 0)
    const p = sw > 0 ? ix.reduce((s, i) => s + (hit(resp[i]) ? w[i] : 0), 0) / sw : NaN
    return { n: ix.length, sw, neff: sw2 > 0 ? (sw * sw) / sw2 : 0, p }
  }
  const compare = (a: Stat, b: Stat) => {
    if (!(a.n > 0 && b.n > 0)) return { se: null as number | null, detectable: false }
    const se = Math.sqrt((a.p * (1 - a.p)) / a.neff + (b.p * (1 - b.p)) / b.neff)
    const pValue = se > 0 ? 2 * (1 - phi(Math.abs((a.p - b.p) / se))) : null
    return { se, detectable: pValue !== null && pValue < 1 - threshold && a.n >= minCell && b.n >= minCell }
  }
  const armIx = (arm: string) => resp.map((r, i) => [r, i] as const).filter(([r]) => r.arm === arm).map(([, i]) => i)

  // -- arms, outcomes, toplines -------------------------------------------------------------------
  const armStats = Object.fromEntries(test.arms.map((a) => [a, Object.fromEntries(OUTCOMES.map((x) => [x.id, summarize(armIx(a), x.hit)]))])) as Record<string, Record<string, Stat>>
  const arms: Arm[] = test.arms.map((id) => {
    const n = armIx(id).length
    const arm: Arm = { id, name: o.armName(id), role: id === PLACEBO ? "placebo" : "treatment", nWeighted: r1(armStats[id].ballot.sw), note: `${n} actual respondent${n === 1 ? "" : "s"}${n < minCell ? `, below ${minCell}, so every comparison is inconclusive` : ""}` }
    if (id === PLACEBO) arm.watchUrl = test.placeboSrc
    else {
      const clip = o.clipOf?.(id)
      if (clip) {
        arm.clipId = clip.clipId
        if (clip.durationSeconds) arm.durationSeconds = clip.durationSeconds
      }
    }
    return arm
  })
  const labels = (q: { choices: { label: string }[] }) => q.choices.map((c) => c.label)
  const outcomes: OutcomeDef[] = [
    { id: "ballot", name: "Ballot support", question: test.ballot.prompt, options: labels(test.ballot), definition: "The weighted percentage selecting Yes, compared with the placebo arm." },
    {
      id: "comprehension",
      name: "Comprehension",
      question: test.comprehension.prompt,
      options: labels(test.comprehension),
      correct: test.comprehension.choices.find((c) => c.value === test.comprehension.correct)?.label,
      definition: "The weighted percentage choosing the correct description, compared with the placebo arm.",
    },
  ]
  const toplines: Topline[] = []
  const margins = new Map<string, number | null>()
  for (const a of test.arms)
    for (const x of OUTCOMES) {
      const s = armStats[a][x.id]
      const t: Topline = { armId: a, outcomeId: x.id, derivation: "computed" }
      if (s.n > 0) t.levelPct = r1(s.p * 100)
      if (a !== PLACEBO) {
        const base = armStats[PLACEBO][x.id]
        const c = compare(s, base)
        if (s.n > 0 && base.n > 0) t.liftPp = r1((s.p - base.p) * 100)
        t.verdict = c.detectable ? "detectable" : "inconclusive"
        margins.set(`${a}|${x.id}`, c.se != null ? r1(1.645 * c.se * 100) : null)
      }
      toplines.push(t)
    }

  // -- subgroups (ballot) -------------------------------------------------------------------------
  const dimConfigs = o.dimensions ?? test.entry.map((q) => ({ key: q.key, name: q.prompt, group: q.key, exportName: EXPORT_DIMS[q.key] ?? q.key, selfSelected: q.key === "mediaTrust" }))
  const dimensions: SubgroupDimension[] = []
  const cells: SubgroupCell[] = []
  const segRows: { dim: string; val: string; arm: string; level: number; lift: number | null; moe: number | null; significant: boolean }[] = []
  const totalW = w.reduce((s, x) => s + x, 0)
  for (const d of dimConfigs) {
    const q = test.entry.find((e) => e.key === d.key)
    if (!q) continue
    const categories = q.choices.map((c) => {
      const ix = resp.map((r, i) => [r, i] as const).filter(([r]) => r.answers?.[d.key] === c.value).map(([, i]) => i)
      const sw = ix.reduce((s, i) => s + w[i], 0)
      const cat: SubgroupDimension["categories"][number] = { id: c.value, name: c.label, nWeighted: r1(sw) }
      if (d.selfSelected && totalW > 0) cat.sharePct = r1((sw / totalW) * 100)
      if (test.arms.every((a) => ix.filter((i) => resp[i].arm === a).length < minCell)) cat.smallSampleAllCells = true
      return cat
    })
    let marked = 0
    let of = 0
    for (const c of q.choices) {
      const inCat = (i: number) => resp[i].answers?.[d.key] === c.value
      const base = summarize(armIx(PLACEBO).filter(inCat), yesOf)
      for (const a of test.arms) {
        const s = summarize(armIx(a).filter(inCat), yesOf)
        if (s.n === 0) continue
        const cmp = a !== PLACEBO ? compare(s, base) : null
        const significant = !!cmp?.detectable
        if (a !== PLACEBO) {
          of++
          if (significant) marked++
        }
        cells.push({ dimensionId: d.key, categoryId: c.value, armId: a, outcomeId: "ballot", levelPct: r1(s.p * 100), significant, smallSample: s.n < minCell })
        segRows.push({ dim: d.exportName, val: c.label, arm: a, level: r1(s.p * 100), lift: a !== PLACEBO && base.n > 0 ? r1((s.p - base.p) * 100) : null, moe: cmp?.se != null ? r1(1.645 * cmp.se * 100) : null, significant })
      }
    }
    const dim: SubgroupDimension = { id: d.key, name: d.name, group: d.group, askedBeforeExposure: true, markedOfCells: { marked, of }, categories }
    if (d.selfSelected) Object.assign(dim, { selfSelected: true, shareDerivation: "computed" })
    dimensions.push(dim)
  }

  // -- the result set -----------------------------------------------------------------------------
  const dates = resp.flatMap((r) => [r.startedAt, r.completedAt]).filter((x): x is string => !!x).sort()
  const fielded = { start: (dates[0] ?? "").slice(0, 10), end: (dates[dates.length - 1] ?? "").slice(0, 10) }
  const small = arms.filter((a) => armIx(a.id).length < minCell).map((a) => `${a.name} (${armIx(a.id).length})`)
  const weights = w.length ? `${r1(Math.min(...w) * 100) / 100} to ${r1(Math.max(...w) * 100) / 100}` : "none"
  const resultSet: ResultSet = {
    id: o.id ?? `${test.id}-computed`,
    study: o.study ?? test.title,
    wave: o.wave ?? 1,
    title: o.title ?? `${o.study ?? test.title}: what the test found`,
    population: cfg.populationName ? `Respondents who completed the test, weighted to ${cfg.populationName}` : "Respondents who completed the test",
    fielded,
    sample: { raw: resp.length, weighted: r1(totalW) },
    weightingFactors: plan.map((f) => f.key),
    threshold: { level: threshold, label: `${Math.round(threshold * 100)}% criterion (two-sided two-proportion test)` },
    sources: [`${o.source}, computed ${(o.now ?? new Date()).toISOString().slice(0, 10)} (env ${o.env}).`],
    arms,
    outcomes,
    toplines,
    dimensions,
    cells,
    pairings: [],
    stories: [],
    notes: {
      supported: ["Randomized comparison of each video arm with the placebo arm on stated ballot choice and comprehension."],
      notSupported: ["Comparisons between video arms: each arm is tested only against the placebo.", `A verdict from any arm or subgroup with fewer than ${minCell} actual respondents: those comparisons are inconclusive by rule.`],
      methodology: [
        `Counted: ${resp.length} complete record${resp.length === 1 ? "" : "s"}, the latest per panel id, env ${o.env}. Not counted: ${dropped.otherEnv} complete(s) from another env, ${dropped.duplicates} earlier duplicate(s), ${dropped.unknownArm} with an arm outside the test, ${dropped.screenouts} screenout(s); ${dropped.starts} start record(s) seen.`,
        plan.length
          ? `Raked to ${plan.map((f) => f.key).join(", ")} in ${iterations} iteration${iterations === 1 ? "" : "s"} (largest remaining gap ${gap.toExponential(1)}); weights normalized to mean 1, range ${weights}${cfg.trim ? `, capped at ${cfg.trim} (${trimmed} capped)` : ""}. Targets: ${(cfg.targetsSource ?? "not stated").replace(/\.$/, "")}.`
          : "Unweighted: the targets name no factor this test asks.",
        ...provenanceNotes,
        ...rakeNotes,
        `Levels are weighted percentages. Lifts are arm level minus placebo level, in points, with a margin of 1.645 standard errors. Each comparison is a two-sided two-proportion z-test with Kish effective sample sizes; detectable means p < ${r1(1 - threshold)} and at least ${minCell} actual respondents in both groups.`,
      ],
      limitations: [...(small.length ? [`Arms below ${minCell} actual respondents: ${small.join(", ")}.`] : []), "No multiplicity adjustment is applied across subgroups."],
      debriefQuestions: [],
      noEffectMeaning: "Inconclusive means the comparison did not meet the criterion; it is not evidence of zero effect.",
    },
  }

  // -- the export rows (pax_test's fourteen fields) ---------------------------------------------------
  const rows: ExportRow[] = []
  const name = (id: string) => (id === PLACEBO ? "Placebo" : o.armName(id))
  for (const t of toplines) {
    const metric = METRICS[t.outcomeId]
    const n = Math.round(armStats[t.armId][t.outcomeId].sw)
    if (t.levelPct != null) rows.push([metric, o.geo, fielded.start, fielded.end, name(t.armId), null, null, t.levelPct, "pct", null, null, n, o.source])
    if (t.liftPp != null) rows.push([metric, o.geo, fielded.start, fielded.end, name(t.armId), null, null, t.liftPp, "lift_pp", margins.get(`${t.armId}|${t.outcomeId}`) ?? null, null, n, o.source, t.verdict === "detectable"])
  }
  for (const s of segRows) {
    rows.push(["lift_support", o.geo, fielded.start, fielded.end, name(s.arm), s.dim, s.val, s.level, "pct", null, null, null, o.source])
    if (s.lift != null) rows.push(["lift_support", o.geo, fielded.start, fielded.end, name(s.arm), s.dim, s.val, s.lift, "lift_pp", s.moe, null, null, o.source, s.significant])
  }
  const year = Number(fielded.start.slice(0, 4)) || (o.now ?? new Date()).getFullYear()
  const indexEntry = Object.values(METRICS).map((metric) => ({ source: "PAX_TEST", question: metric, first: year, last: year, waves: 1, options: [...new Set(rows.filter((r) => r[0] === metric).map((r) => r[4] as string))] }))

  const lead = toplines.filter((t) => t.armId !== PLACEBO)
  const summary = [
    `${resp.length} respondents counted; ${JSON.stringify(dropped)}`,
    `raked to ${plan.map((f) => f.key).join(", ") || "nothing"} in ${iterations} iterations`,
    `detectable toplines ${lead.filter((t) => t.verdict === "detectable").length} of ${lead.length}; cells ${cells.length}; export rows ${rows.length}`,
  ]
  return { resultSet, rows, indexEntry, summary }
}
