#!/usr/bin/env node
// Renders every closed test's result video (docs/briefs/render-lambda.md, use case 3).
//
//   node scripts/results/render-videos.mjs <base-url> [test ...] [--cookie "<Cookie header>"] [--env production|development|all]
//
//   <base-url>   the app to run it against: http://localhost:3000, or the site
//   test ...     the tests; default, the known ones (TEST_CONFIGS in src/lib/results/complete.ts)
//   --cookie     a signed-in admin's Cookie header, for a deployed site (local development signs in by itself);
//                PAX_COOKIE works too
//   --env        passed to POST /api/results/<test> as ?env=
//
// Each test is POST /api/results/<test>: completeTest derives the result again and starts or continues its
// video (src/lib/results/video.ts). The video is keyed by its props, so a test whose video is already rendered
// costs nothing, and running the pass twice renders nothing twice. A render outlasts one request, so a test
// still rendering is posted again every 20 s until it is done or failed; a failed one is retried by the post.

import fs from "node:fs"
import path from "node:path"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..")
const argv = process.argv.slice(2)
const flag = (name) => {
  const i = argv.indexOf(`--${name}`)
  if (i < 0) return undefined
  const v = argv[i + 1]
  argv.splice(i, 2)
  return v
}
const cookie = flag("cookie") ?? process.env.PAX_COOKIE
const env = flag("env")
const [base, ...named] = argv
if (!base || !/^https?:\/\//.test(base)) {
  console.error('usage: node scripts/results/render-videos.mjs <base-url> [test ...] [--cookie "<Cookie header>"] [--env production|development|all]')
  process.exit(2)
}

function knownTests() {
  const src = fs.readFileSync(path.join(ROOT, "src/lib/results/complete.ts"), "utf8")
  const block = src.match(/const TEST_CONFIGS[^=]*=\s*\{([\s\S]*?)\n\}/)?.[1]
  const ids = block ? [...block.matchAll(/"([\w-]+)":/g)].map((m) => m[1]) : []
  if (!ids.length) throw new Error("No test ids found in TEST_CONFIGS (src/lib/results/complete.ts); name the tests.")
  return ids
}

const tests = named.length ? named : knownTests()
const origin = base.replace(/\/$/, "")

async function post(test) {
  const res = await fetch(`${origin}/api/results/${encodeURIComponent(test)}${env ? `?env=${env}` : ""}`, { method: "POST", headers: cookie ? { cookie } : {} })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) return { state: "error", error: `${res.status} ${body.error ?? res.statusText}` }
  return body.video ?? { state: "none" }
}

const ROUNDS = 15
let left = tests
const out = new Map()
for (let round = 1; left.length && round <= ROUNDS; round++) {
  if (round > 1) await new Promise((r) => setTimeout(r, 20_000))
  const now = await Promise.all(left.map(async (t) => [t, await post(t)]))
  for (const [t, v] of now) out.set(t, v)
  left = now.filter(([, v]) => v.state === "rendering").map(([t]) => t)
  if (left.length) console.log(`round ${round}: still rendering ${left.join(", ")}`)
}

let bad = 0
for (const [t, v] of out) {
  const line = v.state === "done" ? `${v.url}${v.poster ? `  poster ${v.poster}` : "  (no poster)"}` : v.state === "none" ? "no video (no treatment lift, or Lambda not configured there)" : (v.error ?? "")
  console.log(`${t}: ${v.state}  ${line}`)
  if (v.state === "failed" || v.state === "error" || v.state === "rendering") bad++
}
process.exit(bad ? 1 : 0)
