#!/usr/bin/env node
// Every instrument's lifecycle state, read once from its records and written as its first row (Brendan,
// 2026-11-02; the rules are lib/lifecycle/derive.ts). Writes lifecycle rows only, never a test record: where
// a reading differs from what a test's respondent gate does today, it is listed, not changed. An instrument
// that already has rows is left alone, so a second run writes nothing.
//
//   AWS_PROFILE=pax-new node scripts/lifecycle/derive.mjs [--dry]

import path from "node:path"

import { createJiti } from "jiti"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..")
const jiti = createJiti(import.meta.url, { alias: { "@": `${ROOT}/src`, "server-only": `${ROOT}/node_modules/server-only/empty.js` } })
const load = (p) => jiti.import(`${ROOT}/src/${p}`)
const DRY = process.argv.includes("--dry")

const { deriveState } = await load("lib/lifecycle/derive.ts")
const { historyOf, writeDerived } = await load("lib/lifecycle/store.ts")
const { testStatusFor } = await load("lib/lifecycle/rules.ts")
const { listTests } = await load("lib/tests/store.ts")
const { SURVEYS } = await load("lib/surveys/catalog.ts")
const { conversations } = await load("lib/consensus/store.ts")
const { PRETRAININGS } = await load("lib/consensus/pretrainings.ts")

const tests = (await listTests()).tests
const instruments = [
  ...tests.map((t) => ({ kind: "test", id: t.id, title: t.title, status: t.status })),
  ...SURVEYS.map((s) => ({ kind: "survey", id: s.slug, title: s.title })),
  ...(await conversations()).map((c) => ({ kind: "consensus", id: c.slug, title: c.title })),
  ...PRETRAININGS.map((p) => ({ kind: "pretraining", id: p.slug, title: p.title })),
]

const out = []
for (const i of instruments) {
  const had = (await historyOf(i.kind, i.id)).length
  const d = await deriveState(i.kind, i.id)
  const wrote = had ? false : DRY ? "would write" : await writeDerived(i.kind, i.id, d.state, d.reason)
  // A test whose reading and stored status disagree: the gate is left as it is, for Brendan's word.
  const mismatch = i.kind === "test" && testStatusFor(d.state) !== i.status ? `its respondent gate still reads its stored status (${i.status === "fielding" ? "recording answers" : i.status}); left as it is` : null
  out.push({ instrument: `${i.kind}:${i.id}`, title: i.title, state: d.state, reason: d.reason, written: had ? "already had rows" : wrote, ...(mismatch ? { mismatch } : {}) })
}
out.push({ instrument: "pretraining:(a browser's own draft)", title: "Draft survey", state: "Draft", reason: "held in the browser, unstored", written: "never stored" })
console.log(JSON.stringify({ dry: DRY, instruments: out }, null, 1))
