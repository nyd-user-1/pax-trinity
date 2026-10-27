#!/usr/bin/env node
// Derives raking targets from the audience store and writes a config compute.mjs consumes.
//
//   node scripts/results/targets.mjs [--population ma-general-adults] [--factors age,gender,race,education,party,vote2024]
//                                    [--map pax-entry | <map.json>] [--out <path>] [--print]
//
//   --population  a population this script knows (POPULATIONS below); defaults to ma-general-adults
//   --factors     which factors to derive, comma-separated; defaults to all six
//   --map         how store categories become a test's choice values, per factor. Without it every
//                 factor is keyed by the store's own categories. "pax-entry" maps party, education and
//                 vote2024 to the PAX message tests' entry values (open-primaries-1's), and leaves age,
//                 gender and race on the store's categories (no PAX test asks them yet). A JSON file maps
//                 { "<factor>": { "<test value>": ["<store category>", …] } } and overrides per factor.
//   --party-year  the CES year for party identification; defaults to 2024, matching the vote target
//   --out         defaults to scripts/results/configs/<population>.json
//   --print       derive and print; write nothing
//
// Reads, never writes: the audience export (exports/index.json and the source files it names) from
// pax-trinity-audience-613473203863 with profile pax-new in us-east-2, falling back to
// pax-trinity-audience-638175140432 with the default profile in us-east-1. Every number comes from
// the store's rows; a factor the store cannot supply is reported and left out, never filled in.
//
// The factors, for a state population (rows at the state's geo code):
//   age        ACS 5-year B01001, age_bucket counts: adults 18+.
//   gender     ACS 5-year B01001, sex counts: adults 18+ (their total equals the age buckets').
//   race       CVAP special tabulation: each race's citizen-adult count ÷ its citizen share of adults,
//              giving all adults by race (ACS race_eth is all ages). The shares are printed to 0.1, so
//              the derivation is from rounded figures.
//   education  ACS 5-year B15003, education_4 counts: population 25+, a labeled proxy for 18+.
//   party      CES common content pid3 at the state, commonweight: party identification, a survey
//              estimate with its margin of error.
//   vote2024   Official 2024 presidential results ÷ ACS adults 18+: each candidate's votes, the blank
//              presidential lines, and the adults who cast no ballot ("Did not vote").
//
// Each factor in the output carries its provenance: source, rows, reference period, derivation
// "audience-store", universe, and notes. compute.mjs prints it into the result set's methodology.

import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..")
const require = createRequire(path.join(ROOT, "package.json"))
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3")

const argv = process.argv.slice(2)
const flag = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined)

const POPULATIONS = {
  "ma-general-adults": { geo: "25", name: "Massachusetts general adults (18+)", state: "Massachusetts" },
}
const ALL_FACTORS = ["age", "gender", "race", "education", "party", "vote2024"]

const populationId = flag("population") ?? "ma-general-adults"
const population = POPULATIONS[populationId]
if (!population) throw new Error(`unknown population ${populationId}; known: ${Object.keys(POPULATIONS).join(", ")}`)
const factors = (flag("factors") ?? ALL_FACTORS.join(",")).split(",").map((f) => f.trim()).filter(Boolean)
for (const f of factors) if (!ALL_FACTORS.includes(f)) throw new Error(`unknown factor ${f}; known: ${ALL_FACTORS.join(", ")}`)
const out = flag("out") ?? path.join(ROOT, "scripts/results/configs", `${populationId}.json`)

// -- category maps ---------------------------------------------------------------------------

const PRESETS = {
  "pax-entry": {
    party: { democrat: ["Democrat"], republican: ["Republican"], "independent-other": ["Independent", "Other", "Not Sure"] },
    education: { "hs-or-less": ["HS or less"], "some-college": ["Some college"], "bachelors-plus": ["BA", "Grad"] },
    // Candidates are matched by their party label; "other" takes every other candidate line and the blanks.
    vote2024: { democrat: ["(Democratic)"], republican: ["(Republican)"], other: ["*"], "did-not-vote": ["Did not vote"] },
  },
}
const mapArg = flag("map")
const MAP = !mapArg ? {} : PRESETS[mapArg] ?? JSON.parse(fs.readFileSync(mapArg, "utf8"))

/** Groups store categories into a test's values. A pattern "(Democratic)" matches any category containing
 *  it; "*" takes whatever no other value claimed. Unmapped factors keep the store's categories. */
function applyMap(factor, shares) {
  const m = MAP[factor]
  if (!m) return { targets: shares, mapping: null }
  const claimed = new Set()
  const targets = {}
  const mapping = {}
  const matches = (cat, pat) => cat === pat || (pat.startsWith("(") && cat.includes(pat))
  for (const [value, pats] of Object.entries(m)) {
    if (pats.includes("*")) continue
    const cats = Object.keys(shares).filter((c) => pats.some((p) => matches(c, p)))
    cats.forEach((c) => claimed.add(c))
    targets[value] = cats.reduce((t, c) => t + shares[c], 0)
    mapping[value] = cats
  }
  for (const [value, pats] of Object.entries(m)) {
    if (!pats.includes("*")) continue
    const cats = Object.keys(shares).filter((c) => !claimed.has(c))
    targets[value] = cats.reduce((t, c) => t + shares[c], 0)
    mapping[value] = cats
  }
  const unmapped = Object.keys(shares).filter((c) => !Object.values(mapping).flat().includes(c))
  if (unmapped.length) throw new Error(`${factor}: store categories ${unmapped.join(", ")} map to no value`)
  return { targets, mapping }
}

// -- reading the store ---------------------------------------------------------------------------

const BUCKETS = [
  { bucket: "pax-trinity-audience-613473203863", profile: "pax-new", region: "us-east-2" },
  { bucket: "pax-trinity-audience-638175140432", profile: "default", region: "us-east-1" },
]
let store
async function get(key) {
  const tries = store ? [store] : BUCKETS
  for (const b of tries) {
    try {
      const s3 = new S3Client({ region: b.region, profile: b.profile })
      const r = await s3.send(new GetObjectCommand({ Bucket: b.bucket, Key: key }))
      store = b
      return JSON.parse(await r.Body.transformToString())
    } catch (e) {
      if (store) throw e
      console.error(`  ${b.bucket} (${b.profile}): ${e.name}: ${e.message}`)
    }
  }
  throw new Error(`could not read ${key} from the store`)
}

const index = await get("exports/index.json")
console.log(`store: s3://${store.bucket} (${store.profile} / ${store.region})`)
const fileCache = new Map()
async function sourceRows(source) {
  if (!fileCache.has(source)) {
    const files = index.sources.filter((s) => s.source === source).map((s) => s.file)
    if (!files.length) {
      fileCache.set(source, { rows: [], files: [], label: null })
    } else {
      const rows = []
      for (const f of files) rows.push(...(await get(`exports/${f}`)))
      fileCache.set(source, { rows, files, label: index.sources.find((s) => s.source === source).label })
    }
  }
  return fileCache.get(source)
}
// [metric, geo, period_start, period_end, option, subgroup_dim, subgroup_value, estimate, estimate_type, moe, item_text, n, provenance_url]
const pick = (rows, metric, type, { dim = null, year = null } = {}) =>
  rows.filter((r) => r[0] === metric && r[1] === population.geo && r[8] === type && (r[5] ?? null) === dim && (year === null || r[2].slice(0, 4) === year))
const one = (rows, what) => {
  const periods = [...new Set(rows.map((r) => `${r[2]}…${r[3]}`))]
  if (periods.length > 1) throw new Error(`${what}: more than one period (${periods.join(", ")}); pick one`)
  return periods[0]
}
const pct = (counts) => {
  const total = Object.values(counts).reduce((t, x) => t + x, 0)
  return Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, (100 * v) / total]))
}
const r2 = (x) => Math.round(x * 100) / 100

// -- the factors ---------------------------------------------------------------------------------

const derivers = {
  async age() {
    const acs = await sourceRows("ACS")
    const rows = pick(acs.rows, "age_bucket", "count")
    if (!rows.length) return null
    const counts = Object.fromEntries(rows.map((r) => [r[4], r[7]]))
    return {
      shares: pct(counts),
      provenance: {
        source: acs.label, files: acs.files, rows: `age_bucket @${population.geo}, count`, period: one(rows, "age"), url: rows[0][12] ?? null,
        universe: "adults 18+", derivation: "audience-store", notes: [`${Object.values(counts).reduce((t, x) => t + x, 0).toLocaleString("en-US")} adults across ${rows.length} bands.`],
      },
    }
  },
  async gender() {
    const acs = await sourceRows("ACS")
    const rows = pick(acs.rows, "sex", "count")
    if (!rows.length) return null
    const counts = Object.fromEntries(rows.map((r) => [r[4], r[7]]))
    const ageTotal = pick(acs.rows, "age_bucket", "count").reduce((t, r) => t + r[7], 0)
    const total = Object.values(counts).reduce((t, x) => t + x, 0)
    return {
      shares: pct(counts),
      provenance: {
        source: acs.label, files: acs.files, rows: `sex @${population.geo}, count`, period: one(rows, "gender"), url: rows[0][12] ?? null,
        universe: "adults 18+", derivation: "audience-store",
        notes: [`${total.toLocaleString("en-US")} people${total === ageTotal ? ", the same total as the 18+ age bands, so the rows are adults" : `; the 18+ age bands total ${ageTotal.toLocaleString("en-US")}, so check the universe`}.`],
      },
    }
  },
  async race() {
    const cvap = await sourceRows("CVAP")
    const counts = pick(cvap.rows, "cvap", "count", { dim: "race_eth" })
    const shares = pick(cvap.rows, "cvap", "pct", { dim: "race_eth" })
    if (!counts.length || counts.length !== shares.length) return null
    const adults = {}
    for (const c of counts) {
      const s = shares.find((x) => x[6] === c[6])
      adults[c[6]] = c[7] / (s[7] / 100)
    }
    const total = Object.values(adults).reduce((t, x) => t + x, 0)
    const acsAdults = pick((await sourceRows("ACS")).rows, "age_bucket", "count").reduce((t, r) => t + r[7], 0)
    return {
      shares: pct(adults),
      provenance: {
        source: cvap.label, files: cvap.files, rows: `cvap × race_eth @${population.geo}: count and pct (citizen share of the race's adults)`, period: one(counts, "race"), url: counts[0][12] ?? null,
        universe: "adults 18+", derivation: "audience-store", derivedFromRounded: true,
        notes: [
          "All adults per race = citizen-adult count ÷ citizen share (ACS race_eth covers all ages, so it is not used).",
          `The derived adults total ${Math.round(total).toLocaleString("en-US")}${acsAdults ? `, against ${acsAdults.toLocaleString("en-US")} ACS adults (${(((total - acsAdults) / acsAdults) * 100).toFixed(3)}%)` : ""}.`,
          "The citizen shares are printed to 0.1, so each margin carries a rounding band of a few hundredths of a point.",
        ],
      },
    }
  },
  async education() {
    const acs = await sourceRows("ACS")
    const rows = pick(acs.rows, "education_4", "count")
    if (!rows.length) return null
    const counts = Object.fromEntries(rows.map((r) => [r[4], r[7]]))
    return {
      shares: pct(counts),
      provenance: {
        source: acs.label, files: acs.files, rows: `education_4 @${population.geo}, count`, period: one(rows, "education"), url: rows[0][12] ?? null,
        universe: "population 25+", derivation: "audience-store", proxy: "proxy: population 25+",
        notes: ["B15003 covers ages 25 and over; the store has no 18–24 education for the state, so the 25+ distribution stands in for adults 18+ and likely overstates bachelor's-or-higher for them."],
      },
    }
  },
  async party() {
    const ces = await sourceRows("CES")
    const years = [...new Set(pick(ces.rows, "pid3", "pct").map((r) => r[2].slice(0, 4)))].sort()
    const year = flag("party-year") ?? "2024"
    const rows = pick(ces.rows, "pid3", "pct", { year })
    if (!rows.length) return null
    const others = years.filter((y) => y !== year).slice(-2).map((y) => {
      const rs = pick(ces.rows, "pid3", "pct", { year: y })
      return `${y} (n ${rs[0]?.[11] ?? "?"}, ±${Math.max(...rs.map((r) => r[9] ?? 0))})`
    })
    const raw = Object.fromEntries(rows.map((r) => [r[4], r[7]]))
    const sum = Object.values(raw).reduce((t, x) => t + x, 0)
    const moe = Math.max(...rows.map((r) => r[9] ?? 0))
    return {
      shares: pct(raw),
      provenance: {
        source: ces.label, files: ces.files, rows: `pid3 @${population.geo}, ${year}, pct (commonweight)`, period: one(rows, "party"), url: rows[0][12] ?? null,
        universe: "adults 18+ (CES state respondents, commonweight)", derivation: "audience-store", survey: { n: rows[0][11] ?? null, moePct: moe },
        notes: [
          `Party identification, a survey estimate: n ${rows[0][11] ?? "unknown"}, margin of error up to ±${moe} points.`,
          `The printed shares sum to ${r2(sum)} and are renormalized to 100.`,
          "Identification, not enrollment: the state's party enrollment measures registration, a different construct on a different universe.",
          `${year} is used to match the 2024 vote target (--party-year picks another); the store also holds ${others.join(" and ")}.`,
        ],
      },
    }
  },
  async vote2024() {
    const er = await sourceRows("ELECTION_RESULT")
    const rows = pick(er.rows, "presidential_vote", "count", { year: "2024" })
    if (!rows.length) return null
    const total = rows.find((r) => r[4] === "Total Votes Cast")?.[7]
    const lines = rows.filter((r) => r[4] !== "Total Votes Cast")
    const sumLines = lines.reduce((t, r) => t + r[7], 0)
    const adults = pick((await sourceRows("ACS")).rows, "age_bucket", "count").reduce((t, r) => t + r[7], 0)
    if (!total || !adults) return null
    if (sumLines !== total) throw new Error(`vote2024: the lines sum to ${sumLines}, not the ${total} total ballots`)
    const counts = Object.fromEntries(lines.map((r) => [r[4], r[7]]))
    counts["Did not vote"] = adults - total
    return {
      shares: pct(counts),
      provenance: {
        source: `${er.label}; ${index.sources.find((s) => s.source === "ACS")?.label}`, files: [...er.files, ...(await sourceRows("ACS")).files],
        rows: `presidential_vote @${population.geo}, 2024, count; ACS age_bucket @${population.geo} (adults 18+)`, period: one(rows, "vote2024"), url: rows[0][12] ?? null,
        universe: "adults 18+", derivation: "audience-store",
        notes: [
          `${total.toLocaleString("en-US")} ballots cast ÷ ${adults.toLocaleString("en-US")} adults 18+; "Did not vote" is the adults who cast no ballot (${(((adults - total) / adults) * 100).toFixed(2)}%), non-citizen adults included.`,
          "Blank presidential lines (a ballot cast, no presidential choice) count with \"other\" under the pax-entry map.",
          "Respondents over-report voting, so raking to the true non-vote share up-weights the non-voters a panel yields.",
        ],
      },
    }
  },
}

// -- derive and write ----------------------------------------------------------------------------

const config = {
  population: populationId,
  populationName: population.name,
  derivedAt: new Date().toISOString().slice(0, 10),
  store: `s3://${store.bucket}/exports (index ${index.sources.length} files)`,
  env: "production",
  threshold: 0.9,
  minCell: 50,
  trim: 5,
  targetsSource: `${population.name}, derived from the audience store by scripts/results/targets.mjs`,
  factors: {},
  provenance: {},
}
const unsupplied = []
for (const f of factors) {
  const d = await derivers[f]()
  if (!d) {
    unsupplied.push(f)
    continue
  }
  const { targets, mapping } = applyMap(f, d.shares)
  const total = Object.values(targets).reduce((t, x) => t + x, 0)
  config.factors[f] = Object.fromEntries(Object.entries(targets).map(([k, v]) => [k, Math.round((v / total) * 1e6) / 1e6]))
  config.provenance[f] = { ...d.provenance, storeCategories: Object.fromEntries(Object.entries(d.shares).map(([k, v]) => [k, r2(v)])), ...(mapping ? { mapping } : {}) }
  console.log(`${f.padEnd(10)} ${Object.entries(config.factors[f]).map(([k, v]) => `${k} ${(v * 100).toFixed(2)}`).join(" · ")}`)
}
if (unsupplied.length) {
  config.unsupplied = unsupplied
  console.log(`unsupplied by the store for ${population.name}: ${unsupplied.join(", ")} — these factors drop from raking`)
}
if (argv.includes("--print")) process.exit(0)
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(config, null, 2) + "\n")
console.log(`wrote ${path.relative(ROOT, out)}`)
