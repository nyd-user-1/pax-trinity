import "server-only"

import { conversation } from "@/lib/consensus/store"
import { PRETRAININGS } from "@/lib/consensus/pretrainings"
import { latestResult } from "@/lib/results/complete"
import { events, sendIds, type SendDef } from "@/lib/sends/store"
import { surveyBySlug } from "@/lib/surveys/catalog"
import { itemsFor } from "@/lib/tests/responses"
import { getTest } from "@/lib/tests/store"

import type { InstrumentKind, LifeState } from "./rules"

// An instrument's state read honestly from its records, for the ones that predate the lifecycle (Brendan,
// 2026-11-02, with the lead's rulings): nothing gets a state its records don't support, and simulated
// respondents and simulated results don't count. Used when an instrument has no lifecycle rows yet, and by
// scripts/lifecycle/derive.mjs, which writes what it reads.
//
//   test         stored status draft: Draft. Otherwise its real completes (none when its result is
//                simulated) against its target per arm, and a real result: at quota with a real result,
//                Reported; at quota, or closed, without one, Closed; still recording, Open.
//   survey       a topline survey by its sends: none, Draft; one still out, Open; the latest closed with
//                its report, Reported; closed without, Closed.
//   consensus    takeable at /s/<slug>: Open.
//   pretraining  a question set nothing has sent: Draft. (The browser's own draft is Draft too, unstored.)

export type Derived = { state: LifeState; reason: string }

async function sendsFor(type: "test" | "survey", target: string) {
  const out: { def: SendDef; closed: boolean; reported: boolean }[] = []
  for (const fid of await sendIds()) {
    const ev = await events(fid)
    const def = ev.find((e): e is SendDef => e.kind === "fielding")
    if (def?.type === type && def.target === target) out.push({ def, closed: ev.some((e) => e.kind === "closed"), reported: ev.some((e) => e.kind === "report") })
  }
  return out.sort((a, b) => a.def.createdAt.localeCompare(b.def.createdAt))
}

export async function deriveState(kind: InstrumentKind, id: string): Promise<Derived> {
  if (kind === "pretraining" || kind === "poll") return { state: "Draft", reason: PRETRAININGS.some((p) => p.slug === id) ? "a seed question set nothing has sent" : "nothing has sent it" }
  if (kind === "consensus") return (await conversation(id)) ? { state: "Open", reason: `takeable at /s/${id}` } : { state: "Draft", reason: "no such conversation on record" }
  if (kind === "survey") {
    if (!surveyBySlug(id)) return { state: "Draft", reason: "no such survey in the catalog" }
    const sends = await sendsFor("survey", id)
    const last = sends[sends.length - 1]
    if (!last) return { state: "Draft", reason: "never sent" }
    if (sends.some((s) => !s.closed)) return { state: "Open", reason: "a send is still out" }
    return last.reported ? { state: "Reported", reason: "its latest send closed and its report was filed" } : { state: "Closed", reason: "its latest send closed without a report" }
  }
  const test = await getTest(id)
  if (!test) return { state: "Draft", reason: "no test record" }
  if (test.status === "draft") return { state: "Draft", reason: "stored status draft" }
  const result = await latestResult(id).catch(() => null)
  const simulated = !!result?.resultSet?.simulated
  const completes = new Map<string, number>()
  if (!simulated) for (const it of await itemsFor(id)) if (it.kind === "complete" && "arm" in it) completes.set(String(it.arm), (completes.get(String(it.arm)) ?? 0) + 1)
  const atQuota = test.arms.every((a) => (completes.get(a) ?? 0) >= test.targetPerArm)
  const real = [...completes.values()].reduce((a, b) => a + b, 0)
  const reported = !!result && !simulated
  const counts = simulated ? "its completes and result are simulated, so none count" : `${real} real completes against ${test.targetPerArm} an arm`
  if (atQuota && reported) return { state: "Reported", reason: `at quota (${counts}) with a real result filed` }
  if (test.status === "closed") return reported ? { state: "Reported", reason: "stored status closed, with a real result filed" } : { state: "Closed", reason: "stored status closed, no real result" }
  if (atQuota) return { state: "Closed", reason: `at quota (${counts}), no real result` }
  return { state: "Open", reason: `still recording answers (${counts})` }
}
