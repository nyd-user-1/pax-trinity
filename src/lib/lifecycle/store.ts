import "server-only"

import { putOnce, query } from "@/lib/ledger"
import { getTest, saveTest } from "@/lib/tests/store"

import { deriveState } from "./derive"
import { LIFECYCLE, refusal, testStatusFor, type Actor, type InstrumentKind, type LifeState, type Transition } from "./rules"

// The lifecycle's record (./rules.ts), in the ledger table, append-only as the ledger is:
//
//   pk                      sk                  item
//   LIFE#<kind>:<id>        <iso>#<n><state>    a transition: { state, at, by, note? }
//
// n is the state's place in the lifecycle, so two moves in one millisecond keep their order. An instrument's
// state is its newest row; one with no rows has its state read from its records (./derive.ts) until its
// first move writes that reading down as the first row. A test's moves also set the stored status its
// respondent gate reads (Open records answers; Closed and Reported stop).

const pkOf = (kind: InstrumentKind, id: string) => `LIFE#${kind}:${id}`

type Row = Transition & { pk: string; sk: string }

export async function historyOf(kind: InstrumentKind, id: string): Promise<Transition[]> {
  const rows = await query<Row>(pkOf(kind, id))
  return rows.sort((a, b) => a.sk.localeCompare(b.sk)).map(({ state, at, by, note }) => ({ state, at, by, ...(note ? { note } : {}) }))
}

export type Lifecycle = { state: LifeState; history: Transition[]; derived?: string }

/** Where an instrument stands: its newest transition, or, with none written, its records' reading. */
export async function lifecycleOf(kind: InstrumentKind, id: string): Promise<Lifecycle> {
  const history = await historyOf(kind, id)
  if (history.length) return { state: history[history.length - 1].state, history }
  const d = await deriveState(kind, id)
  return { state: d.state, history: [], derived: d.reason }
}

async function write(kind: InstrumentKind, id: string, t: Transition) {
  await putOnce({ pk: pkOf(kind, id), sk: `${t.at}#${LIFECYCLE.indexOf(t.state)}${t.state}`, ...t })
}

/** The state an instrument starts in, written once (a new test at its creation). */
export async function begin(kind: InstrumentKind, id: string, by: string) {
  if ((await historyOf(kind, id)).length) return
  await write(kind, id, { state: "Draft", at: new Date().toISOString(), by })
}

/** A records-read state written down as the instrument's first row (the derivation script; a first move). */
export async function writeDerived(kind: InstrumentKind, id: string, state: LifeState, reason: string): Promise<boolean> {
  if ((await historyOf(kind, id)).length) return false
  await write(kind, id, { state, at: new Date().toISOString(), by: "derived", note: reason })
  return true
}

export type Moved = { ok: true; state: LifeState } | { ok: false; error: string; state: LifeState }

/** One step forward, if the actor may take it; a test's stored status follows. */
export async function move(kind: InstrumentKind, id: string, to: LifeState, actor: Actor, note?: string): Promise<Moved> {
  const now = await lifecycleOf(kind, id)
  const refused = refusal(now.state, to, actor)
  if (refused) return { ok: false, error: refused, state: now.state }
  if (now.derived) await writeDerived(kind, id, now.state, now.derived)
  await write(kind, id, { state: to, at: new Date().toISOString(), by: actor === "system" ? "system" : actor.email, ...(note ? { note } : {}) })
  if (kind === "test") {
    const test = await getTest(id)
    const status = testStatusFor(to)
    if (test && test.status !== status) await saveTest({ ...test, status }, { create: false })
  }
  return { ok: true, state: to }
}

/** The super admin's one click from Draft: Approved, then Open, both written. From Approved, just Open. */
export async function approveAndOpen(kind: InstrumentKind, id: string, actor: Actor): Promise<Moved> {
  const now = await lifecycleOf(kind, id)
  if (now.state === "Draft") {
    const approved = await move(kind, id, "Approved", actor)
    if (!approved.ok) return approved
  }
  return move(kind, id, "Open", actor)
}
