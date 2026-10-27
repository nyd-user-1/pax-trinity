#!/usr/bin/env node
// Computes a message test's results from our own responses and emits them as a ResultSet module.
//
//   node scripts/results/compute.mjs --config scripts/results/configs/<test>.json [options]
//
//   --config <path>   required: the test's config (JSON, shape below)
//   --test <id>       the test id; defaults to the config's "test"
//   --env <which>     production | development | all; defaults to the config's "env", else production
//                     (development items are dev walks, not field data)
//   --out <path>      defaults to src/lib/results/computed/<test>.ts
//   --profile <name>  with --region, read only from that AWS profile; otherwise pax-new in us-east-2
//   --region <name>   is tried first, then the default profile in us-east-1
//   --print           compute and print the summary; write nothing
//   --from-json <f>   read { "test": <TestRecord>, "items": [<ResponseItem>…] } from a file instead of
//                     DynamoDB (an export, or a synthetic set for checking the arithmetic)
//
// Reads, never writes: GetItem on pax-trinity-tests (the test record) and Query on
// pax-trinity-test-responses (every item for the test). Counts complete records only, the latest per
// panel pid (a null pid counts once per record). Then:
//
//   1. Rakes weights (iterative proportional fitting) to the config's targets, one factor per entry
//      question it names. A target category no counted respondent falls in is dropped and the factor's
//      remaining targets renormalized; respondents with no answer for a factor keep their weight on it.
//      Weights are normalized to mean 1, optionally capped at `trim` × the mean first.
//   2. Per arm and outcome: the weighted level (% selecting Yes; % choosing the correct description),
//      the lift vs the placebo arm in points, and a two-sided two-proportion z-test using Kish effective
//      sample sizes. A difference is "detectable" when p < 1 − threshold AND both groups have at least
//      `minCell` actual respondents; anything else is "inconclusive" (a design rule: a test on a handful
//      of respondents is not evidence either way).
//   3. The same per subgroup for ballot choice, one dimension per entry question: levels, `significant`
//      under the same rule within the subgroup, and `smallSample` below `minCell` actual respondents.
//      A cell with no respondents is left out.
//
// Every figure is derivation "computed". Config shape:
//
//   {
//     "test": "open-primaries-1",
//     "id": "open-primaries-1-computed",          optional ResultSet id
//     "study": "…", "title": "…", "wave": 1,    optional; default from the test record
//     "population": "…",                          what the respondents are, in words
//     "env": "production",
//     "threshold": 0.9, "minCell": 50, "trim": 5,
//     "targetsSource": "…",                       where the targets come from, printed in the notes
//     "factors": { "<entry key>": { "<choice value>": share, … }, … },
//     "provenance": { "<entry key>": { source, rows, period, universe, derivation, notes, … } },
//                                                  per factor, written by targets.mjs; printed into the
//                                                  methodology notes. A declared factor the test never
//                                                  asks is named in the notes and not raked.
//     "dimensions": [ { "key": "<entry key>", "name": "…", "group": "…", "selfSelected": true } ],
//     "armNames": { "<arm id>": "…" }
//   }

import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..")
const require = createRequire(path.join(ROOT, "package.json"))
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb")
const { DynamoDBDocumentClient, GetCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb")

const TESTS_TABLE = "pax-trinity-tests"
const RESPONSES_TABLE = "pax-trinity-test-responses"
const PLACEBO = "placebo"

// -- arguments ---------------------------------------------------------------------------

const argv = process.argv.slice(2)
const flag = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const configPath = flag("config")
if (!configPath) {
  console.error("usage: node scripts/results/compute.mjs --config <path> [--test <id>] [--env production|development|all] [--out <path>] [--print]")
  process.exit(2)
}
const config = JSON.parse(fs.readFileSync(configPath, "utf8"))
const testId = flag("test") ?? config.test
const env = flag("env") ?? config.env ?? "production"
const threshold = config.threshold ?? 0.9
const minCell = config.minCell ?? 50
const out = flag("out") ?? path.join(ROOT, "src/lib/results/computed", `${testId}.ts`)
if (!testId) throw new Error("no test id: pass --test or set \"test\" in the config")
if (!["production", "development", "all"].includes(env)) throw new Error(`--env must be production, development or all, not ${env}`)

// -- reading ---------------------------------------------------------------------------

const SOURCES = flag("profile")
  ? [{ profile: flag("profile"), region: flag("region") ?? "us-east-2" }]
  : [
      { profile: "pax-new", region: "us-east-2" },
      { profile: "default", region: "us-east-1" },
    ]

async function read(source) {
  const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: source.region, profile: source.profile }))
  const test = (await db.send(new GetCommand({ TableName: TESTS_TABLE, Key: { id: testId } }))).Item
  if (!test) throw new Error(`no ${testId} item in ${TESTS_TABLE}`)
  const items = []
  let start
  do {
    const r = await db.send(
      new QueryCommand({
        TableName: RESPONSES_TABLE,
        KeyConditionExpression: "#t = :t",
        ExpressionAttributeNames: { "#t": "test" },
        ExpressionAttributeValues: { ":t": testId },
        ExclusiveStartKey: start,
      }),
    )
    items.push(...(r.Items ?? []))
    start = r.LastEvaluatedKey
  } while (start)
  return { test, items }
}

let data, source
if (flag("from-json")) {
  data = JSON.parse(fs.readFileSync(flag("from-json"), "utf8"))
  source = { profile: `file ${path.basename(flag("from-json"))}`, region: "offline" }
}
for (const s of data ? [] : SOURCES) {
  try {
    data = await read(s)
    source = s
    break
  } catch (e) {
    console.error(`  ${s.profile} / ${s.region}: ${e.name ?? "Error"}: ${e.message}`)
  }
}
if (!data) throw new Error("could not read the test from any source")
const { test, items } = data
console.log(`read ${items.length} items for ${testId} from ${source.profile} / ${source.region}`)

// -- the counted respondents ---------------------------------------------------------------

const inEnv = (i) => env === "all" || i.env === env
const completes = items.filter((i) => i.kind === "complete" && inEnv(i))
const byPid = new Map()
for (const r of completes) {
  const key = r.pid ? `pid:${r.pid}` : `id:${r.id}`
  const prev = byPid.get(key)
  if (!prev || r.receivedAt > prev.receivedAt) byPid.set(key, r)
}
const resp = [...byPid.values()].filter((r) => test.arms.includes(r.arm))
const dropped = {
  otherEnv: items.filter((i) => i.kind === "complete" && !inEnv(i)).length,
  duplicates: completes.length - byPid.size,
  unknownArm: byPid.size - resp.length,
  screenouts: items.filter((i) => i.kind === "screenout" && inEnv(i)).length,
  starts: items.filter((i) => i.kind === "start" && inEnv(i)).length,
}
console.log(`counting ${resp.length} complete respondents (env ${env}); ${JSON.stringify(dropped)}`)

// -- raking --------------------------------------------------------------------------------

const factors = config.factors ?? {}
const rakeNotes = []
const w = resp.map(() => 1)
// A declared factor the test never asks has no answers to adjust: it drops from raking, by name.
const asked = new Set(test.entry.map((q) => q.key))
const notAsked = Object.keys(factors).filter((k) => !asked.has(k))
if (notAsked.length)
  rakeNotes.push(`Declared but not asked by this test, so not raked: ${notAsked.join(", ")}. The config's targets for ${notAsked.length === 1 ? "it stand" : "them stand"} unused.`)
const plan = Object.entries(factors).filter(([key]) => asked.has(key)).map(([key, targets]) => {
  const present = Object.keys(targets).filter((c) => resp.some((r) => r.answers?.[key] === c))
  const missing = Object.keys(targets).filter((c) => !present.includes(c))
  const total = present.reduce((s, c) => s + targets[c], 0)
  if (missing.length) rakeNotes.push(`${key}: no counted respondent in ${missing.join(", ")}; those targets were dropped and the rest renormalized.`)
  const known = new Set(Object.keys(targets))
  const unanswered = resp.filter((r) => !known.has(r.answers?.[key])).length
  if (unanswered) rakeNotes.push(`${key}: ${unanswered} respondent(s) without a targeted answer keep their weight on this factor.`)
  if (!present.length) rakeNotes.push(`${key}: no counted respondent gave a targeted answer, so the factor is not raked.`)
  return { key, targets: Object.fromEntries(present.map((c) => [c, total > 0 ? targets[c] / total : 0])) }
}).filter((f) => Object.keys(f.targets).length > 0)

// Each raked factor's provenance, as the targets config records it (scripts/results/targets.mjs).
const provenanceNotes = plan.flatMap((f) => {
  const p = config.provenance?.[f.key]
  if (!p) return [`Weighting target, ${f.key}: no provenance in the config.`]
  const parts = [`${p.source}`, p.rows, p.period ? `period ${p.period.replace("…", " to ")}` : null, p.universe ? `universe ${p.universe}` : null, p.proxy ?? null, `derivation ${p.derivation}${p.derivedFromRounded ? " (from rounded figures)" : ""}`]
  const targets = Object.entries(f.targets).map(([c, v]) => `${c} ${(v * 100).toFixed(1)}%`).join(", ")
  return [`Weighting target, ${f.key} (as raked): ${targets}. ${parts.filter(Boolean).join("; ")}.${p.notes?.length ? " " + p.notes.join(" ") : ""}`]
})
let iterations = 0
let gap = 0
for (; plan.length && iterations < 500; iterations++) {
  for (const f of plan) {
    const idx = resp.map((r, i) => [r.answers?.[f.key], i]).filter(([v]) => v in f.targets)
    const known = idx.reduce((s, [, i]) => s + w[i], 0)
    for (const c of Object.keys(f.targets)) {
      const inC = idx.filter(([v]) => v === c).map(([, i]) => i)
      const have = inC.reduce((s, i) => s + w[i], 0)
      if (have > 0) for (const i of inC) w[i] *= (f.targets[c] * known) / have
    }
  }
  gap = Math.max(
    0,
    ...plan.flatMap((f) => {
      const idx = resp.map((r, i) => [r.answers?.[f.key], i]).filter(([v]) => v in f.targets)
      const known = idx.reduce((s, [, i]) => s + w[i], 0)
      return Object.keys(f.targets).map((c) => Math.abs(idx.filter(([v]) => v === c).reduce((s, [, i]) => s + w[i], 0) / known - f.targets[c]))
    }),
  )
  if (gap < 1e-6) {
    iterations++
    break
  }
}
const mean = w.length ? w.reduce((s, x) => s + x, 0) / w.length : 1
for (let i = 0; i < w.length; i++) w[i] /= mean
let trimmed = 0
if (config.trim) {
  for (let i = 0; i < w.length; i++) {
    if (w[i] > config.trim) {
      w[i] = config.trim
      trimmed++
    }
  }
  const m2 = w.reduce((s, x) => s + x, 0) / (w.length || 1)
  for (let i = 0; i < w.length; i++) w[i] /= m2
}

// -- statistics ----------------------------------------------------------------------------

const yesOf = (r) => r.answers?.ballot === "yes"
const correctOf = (r) => (typeof r.comprehensionCorrect === "boolean" ? r.comprehensionCorrect : r.answers?.comprehension === test.comprehension.correct)
const OUTCOMES = [
  { id: "ballot", hit: yesOf },
  { id: "comprehension", hit: correctOf },
]

function summarize(ix, hit) {
  const sw = ix.reduce((s, i) => s + w[i], 0)
  const sw2 = ix.reduce((s, i) => s + w[i] * w[i], 0)
  const p = sw > 0 ? ix.reduce((s, i) => s + (hit(resp[i]) ? w[i] : 0), 0) / sw : NaN
  return { n: ix.length, sw, neff: sw2 > 0 ? (sw * sw) / sw2 : 0, p }
}

// Standard normal CDF (Abramowitz & Stegun 7.1.26 erf, |error| < 1.5e-7).
function phi(z) {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2))
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2)
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2
}

function compare(a, b) {
  if (!(a.n > 0 && b.n > 0)) return { pValue: null, detectable: false }
  const se = Math.sqrt((a.p * (1 - a.p)) / a.neff + (b.p * (1 - b.p)) / b.neff)
  const pValue = se > 0 ? 2 * (1 - phi(Math.abs((a.p - b.p) / se))) : null
  return { pValue, detectable: pValue !== null && pValue < 1 - threshold && a.n >= minCell && b.n >= minCell }
}

const r1 = (x) => Math.round(x * 10) / 10
const armIx = (arm) => resp.map((r, i) => [r, i]).filter(([r]) => r.arm === arm).map(([, i]) => i)

// -- arms, outcomes, toplines ------------------------------------------------------------------

const catalog = new Map()
for (const m of fs.readFileSync(path.join(ROOT, "src/components/clips/catalog.ts"), "utf8").matchAll(/frame\("([^"]+)",\s*"[^"]+",\s*\{([^\n]*)\}\)/g)) {
  const field = (k) => m[2].match(new RegExp(`${k}: "([^"]+)"`))?.[1]
  const dur = m[2].match(/duration: (\d+(?:\.\d+)?)/)?.[1]
  catalog.set(`px-${m[1]}`, { title: field("title"), messenger: field("messenger"), duration: dur ? Number(dur) : undefined })
}
const armName = (id) => {
  if (config.armNames?.[id]) return config.armNames[id]
  if (id === PLACEBO) return "Placebo"
  const c = catalog.get(id)
  if (!c?.title) return id
  return c.messenger ? `${c.title} — ${c.messenger}` : c.duration ? `${c.title} (${c.duration} s)` : c.title
}

const armStats = Object.fromEntries(test.arms.map((a) => [a, Object.fromEntries(OUTCOMES.map((o) => [o.id, summarize(armIx(a), o.hit)]))]))
const arms = test.arms.map((id) => {
  const n = armIx(id).length
  const arm = {
    id,
    name: armName(id),
    role: id === PLACEBO ? "placebo" : "treatment",
    nWeighted: r1(armStats[id].ballot.sw),
    note: `${n} actual respondent${n === 1 ? "" : "s"}${n < minCell ? ` — below ${minCell}, so every comparison is inconclusive` : ""}`,
  }
  if (id === PLACEBO) arm.watchUrl = test.placeboSrc
  else if (catalog.has(id)) {
    arm.clipId = id
    if (catalog.get(id).duration) arm.durationSeconds = catalog.get(id).duration
  }
  return arm
})

const choiceLabels = (q) => q.choices.map((c) => c.label)
const outcomes = [
  {
    id: "ballot",
    name: "Ballot support",
    question: test.ballot.prompt,
    options: choiceLabels(test.ballot),
    definition: "The weighted percentage selecting Yes, compared with the placebo arm.",
  },
  {
    id: "comprehension",
    name: "Comprehension",
    question: test.comprehension.prompt,
    options: choiceLabels(test.comprehension),
    correct: test.comprehension.choices.find((c) => c.value === test.comprehension.correct)?.label,
    definition: "The weighted percentage choosing the correct description, compared with the placebo arm.",
  },
]

const toplines = []
for (const a of test.arms) {
  for (const o of OUTCOMES) {
    const s = armStats[a][o.id]
    const t = { armId: a, outcomeId: o.id, derivation: "computed" }
    if (s.n > 0) t.levelPct = r1(s.p * 100)
    if (a !== PLACEBO) {
      const base = armStats[PLACEBO][o.id]
      if (s.n > 0 && base.n > 0) t.liftPp = r1((s.p - base.p) * 100)
      t.verdict = compare(s, base).detectable ? "detectable" : "inconclusive"
    }
    toplines.push(t)
  }
}

// -- subgroups ---------------------------------------------------------------------------------

const dimConfigs = config.dimensions ?? test.entry.map((q) => ({ key: q.key }))
const dimensions = []
const cells = []
let omitted = 0
for (const d of dimConfigs) {
  const q = test.entry.find((e) => e.key === d.key)
  if (!q) throw new Error(`dimension ${d.key} is not one of the test's entry questions`)
  const totalW = w.reduce((s, x) => s + x, 0)
  const categories = q.choices.map((c) => {
    const ix = resp.map((r, i) => [r, i]).filter(([r]) => r.answers?.[d.key] === c.value).map(([, i]) => i)
    const sw = ix.reduce((s, i) => s + w[i], 0)
    const cat = { id: c.value, name: c.label, nWeighted: r1(sw) }
    if (d.selfSelected && totalW > 0) cat.sharePct = r1((sw / totalW) * 100)
    if (test.arms.every((a) => ix.filter((i) => resp[i].arm === a).length < minCell)) cat.smallSampleAllCells = true
    return cat
  })
  let marked = 0
  let of = 0
  for (const c of q.choices) {
    const inCat = (i) => resp[i].answers?.[d.key] === c.value
    const base = summarize(armIx(PLACEBO).filter(inCat), yesOf)
    for (const a of test.arms) {
      const s = summarize(armIx(a).filter(inCat), yesOf)
      if (s.n === 0) {
        omitted++
        continue
      }
      const significant = a !== PLACEBO && compare(s, base).detectable
      if (a !== PLACEBO) {
        of++
        if (significant) marked++
      }
      cells.push({ dimensionId: d.key, categoryId: c.value, armId: a, outcomeId: "ballot", levelPct: r1(s.p * 100), significant, smallSample: s.n < minCell })
    }
  }
  const dim = { id: d.key, name: d.name ?? q.prompt, group: d.group ?? d.key, askedBeforeExposure: true, markedOfCells: { marked, of }, categories }
  if (d.selfSelected) Object.assign(dim, { selfSelected: true, shareDerivation: "computed" })
  dimensions.push(dim)
}

// -- the result set ------------------------------------------------------------------------------

const dates = resp.flatMap((r) => [r.startedAt, r.completedAt]).filter(Boolean).sort()
const small = arms.filter((a) => armIx(a.id).length < minCell).map((a) => `${a.name} (${armIx(a.id).length})`)
const empty = arms.filter((a) => armIx(a.id).length === 0).map((a) => a.name)
const weights = w.length ? `${r1(Math.min(...w) * 100) / 100}–${r1(Math.max(...w) * 100) / 100}` : "none"

const resultSet = {
  id: config.id ?? `${testId}-computed`,
  study: config.study ?? test.title,
  wave: config.wave ?? 1,
  title: config.title ?? `${test.title}: computed results`,
  population: config.population ?? "Respondents who completed the survey — not a verified or representative sample",
  fielded: { start: (dates[0] ?? "").slice(0, 10), end: (dates[dates.length - 1] ?? "").slice(0, 10) },
  sample: { raw: resp.length, weighted: r1(w.reduce((s, x) => s + x, 0)) },
  weightingFactors: plan.map((f) => f.key),
  threshold: { level: Math.round(threshold * 100), label: `${Math.round(threshold * 100)}% criterion (two-sided two-proportion test)` },
  sources: [
    `${RESPONSES_TABLE} and ${TESTS_TABLE}, read from ${source.profile} / ${source.region} on ${new Date().toISOString().slice(0, 10)} (env: ${env}).`,
  ],
  arms,
  outcomes,
  toplines,
  dimensions,
  cells,
  pairings: [],
  stories: [],
  notes: {
    supported: ["Randomized comparison of each video arm with the placebo arm on stated ballot choice and comprehension."],
    notSupported: [
      "Comparisons between video arms: each arm is tested only against the placebo.",
      `A verdict from any arm or subgroup with fewer than ${minCell} actual respondents: those comparisons are inconclusive by rule.`,
    ],
    methodology: [
      `Counted: ${resp.length} complete record${resp.length === 1 ? "" : "s"}, the latest per panel id, env ${env}. Not counted: ${dropped.otherEnv} complete(s) from another env, ${dropped.duplicates} earlier duplicate(s), ${dropped.unknownArm} with an arm outside the test, ${dropped.screenouts} screenout(s); ${dropped.starts} start record(s) seen.`,
      plan.length
        ? `Raked to ${plan.map((f) => f.key).join(", ")} in ${iterations} iteration${iterations === 1 ? "" : "s"} (largest remaining gap ${gap.toExponential(1)}); weights normalized to mean 1, range ${weights}${config.trim ? `, capped at ${config.trim} (${trimmed} capped)` : ""}. Targets: ${(config.targetsSource ?? "not stated in the config").replace(/\.$/, "")}.`
        : "Unweighted: the config declares no raking factors.",
      ...provenanceNotes,
      ...rakeNotes,
      `Levels are weighted percentages. Lifts are arm level minus placebo level, in points. Each comparison is a two-sided two-proportion z-test with Kish effective sample sizes; detectable means p < ${r1(1 - threshold)} and at least ${minCell} actual respondents in both groups.`,
      `Small-sample flags mark fewer than ${minCell} actual respondents in a cell; weighted counts are shown.`,
    ],
    limitations: [
      ...(small.length ? [`Arms below ${minCell} actual respondents: ${small.join(", ")}.`] : []),
      ...(empty.length ? [`Arms with no counted respondents (no level shown): ${empty.join(", ")}.`] : []),
      ...(omitted ? [`${omitted} subgroup cell${omitted === 1 ? "" : "s"} with no respondents ${omitted === 1 ? "is" : "are"} left out.`] : []),
      "No multiplicity adjustment is applied across subgroups.",
    ],
    debriefQuestions: [],
    noEffectMeaning: "Inconclusive means the comparison did not meet the criterion; it is not evidence of zero effect.",
  },
}

// -- output ---------------------------------------------------------------------------------------

const constName = `COMPUTED_${testId.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`
const module = `// Generated by scripts/results/compute.mjs from ${testId} (env ${env}, ${resp.length} respondents) — do not edit by hand.
import type { ResultSet } from "../types"

export const ${constName}: ResultSet = ${JSON.stringify(resultSet, null, 2)}
`

const t = resultSet.toplines.filter((x) => x.armId !== PLACEBO)
console.log(`arms ${arms.length}, toplines ${toplines.length}, dimensions ${dimensions.length}, cells ${cells.length} (${omitted} empty left out)`)
console.log(`detectable toplines ${t.filter((x) => x.verdict === "detectable").length} of ${t.length}; significant cells ${cells.filter((c) => c.significant).length}; small-sample cells ${cells.filter((c) => c.smallSample).length} of ${cells.length}`)
for (const x of toplines) console.log(`  ${x.armId.padEnd(18)} ${x.outcomeId.padEnd(14)} level ${String(x.levelPct ?? "—").padStart(5)}  lift ${String(x.liftPp ?? "—").padStart(5)}  ${x.verdict ?? ""}`)

if (argv.includes("--print")) process.exit(0)
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, module)
try {
  const ts = require("typescript")
  const parsed = ts.createSourceFile(out, module, ts.ScriptTarget.Latest, true)
  console.log(`wrote ${path.relative(ROOT, out)} (${parsed.parseDiagnostics.length} parse diagnostics) as ${constName}`)
} catch {
  console.log(`wrote ${path.relative(ROOT, out)} as ${constName}`)
}
