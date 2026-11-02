// The marketing flows' rows in the ledger (Brendan, 2026-11-01): append-only, every write a putOnce, the
// sends engine's discipline (lib/sends/engine.ts). Nothing here is updated in place, so a repeat
// visit can't re-enroll and two overlapping ticks can't send a step twice.
//
//   pk                   sk                         item
//   FLOW#<email>         <flowId>                   an enrollment: { email, flowId, enrolledAt, path }
//   FLOWS                <email>#<flowId>           the same enrollment in the roster the tick reads, so a tick is one
//                                                   query rather than a scan (the sends store's index)
//   FLOWSEND#<email>     DAY#<tick-day>             the user's one send for that day, claimed before anything goes
//   FLOWSEND#<email>     <flowId>#<day>             a step, claimed before its mail goes: { date, at, template }
//   FLOWSEND#<email>     <flowId>#<day>#outcome     what became of it: { sent } | { held } | { failed: reason }
//
// Pure: the store is passed in (the ledger in production, lib/flows/live.ts; a table double in the checks).

export type Row = { pk: string; sk: string; [k: string]: unknown }

/** The two ledger calls the flows use: write once, and read a partition (optionally by sk prefix). */
export type FlowStore = {
  putOnce(item: Row): Promise<boolean>
  query(pk: string, prefix?: string): Promise<Row[]>
}

export type Enrollment = { email: string; flowId: string; enrolledAt: string; path: string }

export const enrollmentKey = (email: string, flowId: string) => ({ pk: `FLOW#${email}`, sk: flowId })
export const ROSTER = "FLOWS"
export const sendsKey = (email: string) => `FLOWSEND#${email}`
export const daySk = (date: string) => `DAY#${date}`
export const stepSk = (flowId: string, day: number) => `${flowId}#${day}`

/** Enrolls once. False when the user was already in this flow: the enrollment stands as first written. */
export async function writeEnrollment(store: FlowStore, e: Enrollment): Promise<boolean> {
  const fresh = await store.putOnce({ ...enrollmentKey(e.email, e.flowId), ...e })
  if (fresh) await store.putOnce({ pk: ROSTER, sk: `${e.email}#${e.flowId}`, ...e })
  return fresh
}

/** Every enrollment, from the roster. */
export async function readRoster(store: FlowStore): Promise<Enrollment[]> {
  return (await store.query(ROSTER)).map((r) => ({ email: String(r.email), flowId: String(r.flowId), enrolledAt: String(r.enrolledAt), path: String(r.path ?? "") }))
}

/** A user's send rows: day claims, step claims and outcomes. */
export const readSends = (store: FlowStore, email: string) => store.query(sendsKey(email))

/** Claims the user's one send for the tick-day. False when a send already went that day. */
export const claimDay = (store: FlowStore, email: string, date: string, at: string) => store.putOnce({ pk: sendsKey(email), sk: daySk(date), date, at })

/** Claims a step before its mail goes. False when another tick claimed it first. */
export const claimStep = (store: FlowStore, email: string, flowId: string, day: number, date: string, at: string, template: string) =>
  store.putOnce({ pk: sendsKey(email), sk: stepSk(flowId, day), flowId, day, date, at, template })

/** What became of a claimed step. Written once; a failure is recorded, never retried. */
export const writeOutcome = (store: FlowStore, email: string, flowId: string, day: number, outcome: { sent?: string[]; held?: string[]; failed?: string; at: string }) =>
  store.putOnce({ pk: sendsKey(email), sk: `${stepSk(flowId, day)}#outcome`, ...outcome })
