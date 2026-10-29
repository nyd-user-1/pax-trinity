#!/usr/bin/env node
// A seeded demo run of a message test: simulated respondents walk the respondent flow's own collector
// (POST /api/tests/<id>/responses), so the completion hook reads answers the way it reads a field's.
//
//   node scripts/results/seed-demo.mjs [--test open-primaries-1] [--per-arm 120] [--seed 29] [--origin http://localhost:3000]
//
// Each respondent is assigned an arm in turn, answers the entry questions from shares skewed the way
// online panels run (more college graduates and Democrats than Massachusetts, the analysis's own
// simulator's shares, audience/audience/simulate.py), and answers the ballot and comprehension
// questions with a chance that depends on party and education, raised by the arm's planted lift.
// Deterministic for a seed. The collector stamps every record with its env (development on the dev box).

import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..")
const argv = process.argv.slice(2)
const flag = (n, d) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 ? argv[i + 1] : d
}
const test = flag("test", "open-primaries-1")
const perArm = Number(flag("per-arm", "120"))
const origin = flag("origin", "http://localhost:3000")
let seed = Number(flag("seed", "29")) >>> 0

// mulberry32
const rand = () => {
  seed = (seed + 0x6d2b79f5) >>> 0
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pick = (values, shares) => {
  let x = rand() * shares.reduce((a, b) => a + b, 0)
  for (let i = 0; i < values.length; i++) if ((x -= shares[i]) < 0) return values[i]
  return values[values.length - 1]
}

// The arms' files, as the clips catalog serves them, on the CDN the dev server names.
const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8")
const cdn = env.match(/^NEXT_PUBLIC_CLIPS_CDN=(.+)$/m)?.[1]?.trim() ?? "https://d3tyjc2amjpyom.cloudfront.net"
const catalog = fs.readFileSync(path.join(ROOT, "src/components/clips/catalog.ts"), "utf8")
const fileOf = (arm) => catalog.match(new RegExp(`frame\\("${arm.replace(/^px-/, "")}",\\s*"([^"]+)"`))?.[1]
const PLACEBO_SRC = "https://assets.mixkit.co/videos/40700/40700-720.mp4"

// Each seeded test's arms and the lift planted in each (ballot, comprehension), in probability.
const PLANS = {
  "open-primaries-1": { placebo: [0, 0], "px-gaby": [0.09, 0.07], "px-msnow": [0.05, 0.04], "px-no-newscaster": [0.01, 0.02], "px-locked-out": [-0.02, 0.0] },
  // Massachusetts Wave 3: Wave 1's cuts again with Ajayi Harris, the six the Pollster fielded.
  "ma-wave-3": { placebo: [0, 0], "px-danielle": [0.11, 0.03], "px-jesse": [0.08, 0.02], "px-dustin": [0.06, 0.01], "px-paul": [0.05, 0.0], "px-ajayi": [0.04, 0.06], "px-alex": [0.01, 0.01] },
}
if (!PLANS[test]) throw new Error(`No seeded plan for ${test}; add its arms and lifts to PLANS.`)
const LIFT = PLANS[test]
const ARMS = Object.keys(LIFT)
const CHOICES = {
  ideology: [["liberal", "moderate", "conservative"], [0.38, 0.37, 0.25]],
  party: [["democrat", "independent-other", "republican"], [0.4, 0.38, 0.22]],
  education: [["hs-or-less", "some-college", "bachelors-plus"], [0.18, 0.22, 0.6]],
  vote2024: [["democrat", "republican", "other", "did-not-vote"], [0.5, 0.28, 0.04, 0.18]],
  mediaTrust: [["tv-broadcast", "direct-to-camera", "podcast-clip"], [0.45, 0.3, 0.25]],
}
const WRONG = ["party-primaries-open", "no-primaries", "ranked-choice"]

const now = Date.now()
const bodies = []
for (let i = 0; i < perArm * ARMS.length; i++) {
  const arm = ARMS[i % ARMS.length]
  const answers = Object.fromEntries(Object.entries(CHOICES).map(([k, [v, s]]) => [k, pick(v, s)]))
  const base = 0.46 + (answers.party === "independent-other" ? 0.08 : answers.party === "republican" ? -0.06 : 0) + (answers.education === "bachelors-plus" ? 0.03 : 0)
  const pYes = Math.min(0.95, Math.max(0.05, base + LIFT[arm][0]))
  const pRight = Math.min(0.95, Math.max(0.05, 0.44 + (answers.education === "bachelors-plus" ? 0.05 : 0) + LIFT[arm][1]))
  answers.ballot = rand() < pYes ? "yes" : rand() < 0.85 ? "no" : "would-not-vote"
  const right = rand() < pRight
  answers.comprehension = right ? "one-primary-top-two" : WRONG[Math.floor(rand() * WRONG.length)]
  const started = now - Math.floor(30 * 60_000 + rand() * 6 * 3600_000)
  const completed = started + Math.floor(150_000 + rand() * 240_000)
  bodies.push({
    test,
    status: "complete",
    pid: `demo-${String(i).padStart(4, "0")}`,
    arm,
    src: arm === "placebo" ? PLACEBO_SRC : `${cdn}/${fileOf(arm)}`,
    startedAt: new Date(started).toISOString(),
    completedAt: new Date(completed).toISOString(),
    answers,
    comprehensionCorrect: right,
    watched: Math.round((0.7 + rand() * 0.3) * 100) / 100,
    code: Math.floor(rand() * 0xffffffff).toString(16).toUpperCase().padStart(8, "0"),
  })
}

let ok = 0
const fails = new Map()
for (let i = 0; i < bodies.length; i += 8) {
  await Promise.all(
    bodies.slice(i, i + 8).map(async (b) => {
      const r = await fetch(`${origin}/api/tests/${test}/responses`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) })
      if (r.status === 201) ok++
      else {
        const e = `${r.status} ${(await r.text()).slice(0, 160)}`
        fails.set(e, (fails.get(e) ?? 0) + 1)
      }
    }),
  )
  if (i === 0 && fails.size) break
}
console.log(`posted ${ok} of ${bodies.length} complete records to ${origin}/api/tests/${test}/responses`)
for (const [e, n] of fails) console.log(`  ${n} × ${e}`)
