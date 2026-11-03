#!/usr/bin/env node
// Writes a completed test's results where the surfaces read them (docs/briefs/loop-pipeline.md, part A).
//
//   node scripts/results/publish.mjs --test <id> [--from <origin>] [--sync]
//
//   --test <id>      the test whose results the completion hook kept (src/lib/results/complete.ts)
//   --from <origin>  where to read them: GET <origin>/api/results/<id>; default http://localhost:3000
//   --sync           also merge the export rows into the audience export bucket (exports/pax_test.json
//                    and exports/index.json, read from the bucket first so nothing else there is lost);
//                    the new account's only, since 2026-11-01
//
// Writes:
//   src/lib/results/computed/<resultSet id>.json   the ResultSet, as the hook derived it
//   src/lib/results/computed/index.ts              the register's list of computed sets, rewritten
//   public/audience-data/pax_test.json             this test's rows replaced (matched on the rows' source)
//   public/audience-data/index.json                PAX_TEST's row count and question entries updated
//
// /reports, /reports-2 and /clips read the register; /lift reads the export. None of them changes.

import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..")
const argv = process.argv.slice(2)
const flag = (name) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const test = flag("test")
const from = flag("from") ?? "http://localhost:3000"
if (!test) {
  console.error("usage: node scripts/results/publish.mjs --test <id> [--from <origin>] [--sync]")
  process.exit(2)
}

const res = await fetch(`${from}/api/results/${encodeURIComponent(test)}`)
if (!res.ok) throw new Error(`GET ${from}/api/results/${test} answered ${res.status}: ${await res.text()}`)
const item = await res.json()
const { resultSet, rows, indexEntry } = item
console.log(`read ${resultSet.id}: ${resultSet.sample.raw} respondents, ${resultSet.toplines.length} toplines, ${rows.length} export rows (computed ${item.computedAt}, env ${item.env})`)

// -- the register ------------------------------------------------------------------------------
const dir = path.join(ROOT, "src/lib/results/computed")
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, `${resultSet.id}.json`), JSON.stringify(resultSet, null, 2) + "\n")
const sets = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()
const ident = (f) => "SET_" + f.replace(/\.json$/, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_")
fs.writeFileSync(
  path.join(dir, "index.ts"),
  `// Written by scripts/results/publish.mjs: the ResultSets completed tests wrote (src/lib/results/complete.ts),
// one JSON file each beside this one. Do not edit by hand; publish rewrites it.
import type { ResultSet } from "../types"
${sets.map((f) => `import ${ident(f)} from "./${f}"`).join("\n")}

export const COMPUTED: ResultSet[] = [${sets.map((f) => `${ident(f)} as unknown as ResultSet`).join(", ")}]
`,
)
console.log(`register: ${sets.length} computed set(s) in src/lib/results/computed/index.ts`)

// -- the audience export -----------------------------------------------------------------------
const source = rows[0]?.[12]
function merge(paxPath, indexPath) {
  const pax = JSON.parse(fs.readFileSync(paxPath, "utf8"))
  const kept = pax.filter((r) => r[12] !== source)
  const next = [...kept, ...rows]
  fs.writeFileSync(paxPath, JSON.stringify(next))
  const idx = JSON.parse(fs.readFileSync(indexPath, "utf8"))
  for (const s of idx.sources) if (s.source === "PAX_TEST") s.rows = next.length
  for (const e of indexEntry) {
    const q = idx.questions.find((x) => x.source === e.source && x.question === e.question)
    const periods = new Set(next.filter((r) => r[0] === e.question).map((r) => `${r[2]}|${r[3]}`)).size
    if (q) {
      q.options = [...new Set([...q.options, ...e.options])]
      q.first = Math.min(q.first, e.first)
      q.last = Math.max(q.last, e.last)
      q.waves = periods
    } else idx.questions.push({ ...e, waves: periods })
  }
  fs.writeFileSync(indexPath, JSON.stringify(idx))
  return { replaced: pax.length - kept.length, total: next.length }
}
const local = merge(path.join(ROOT, "public/audience-data/pax_test.json"), path.join(ROOT, "public/audience-data/index.json"))
console.log(`export (local): ${local.replaced} earlier row(s) of this test replaced, ${rows.length} written, ${local.total} PAX_TEST rows`)

if (argv.includes("--sync")) {
  // Through the export's one way in and out (scripts/exports/sync.mjs): read decoded, written back with the
  // Cache-Control and the encoding the bucket already uses.
  const { DEFAULTS, getExports, pushExports } = await import("../exports/sync.mjs")
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "publish-"))
  const keys = ["pax_test.json", "index.json"]
  await getExports(tmp, keys)
  const r = merge(path.join(tmp, "pax_test.json"), path.join(tmp, "index.json"))
  await pushExports(tmp, keys)
  console.log(`export (${DEFAULTS.bucket}): ${r.replaced} replaced, ${r.total} PAX_TEST rows`)
}
