// An instrument's one lifecycle (Brendan, 2026-11-02): a Consensus survey, a topline survey, a message test,
// a pretraining, and any poll or questionnaire to come, each carries the same five states, in these words:
//
//   Draft, then Approved (the super admin's act), then Open (taking answers; sends may run), then Closed
//   (its quota or its date, or closed by hand), then Reported (its readout filed or delivered).
//
// One direction only, one step at a time; Approved comes before Open, always. The delivery job under Open
// has no name of its own: what shows of it is counts (invited, answered, reminders sent). Client-safe: the
// chips read the words and tones here; the store is ./store.ts.

export const LIFECYCLE = ["Draft", "Approved", "Open", "Closed", "Reported"] as const
export type LifeState = (typeof LIFECYCLE)[number]

export type InstrumentKind = "consensus" | "survey" | "test" | "pretraining" | "poll"

/** One step of an instrument's history: the state it entered, when, and who moved it ("system" for the
 *  engine's own closes and reports, "derived" for a state read from the records before the lifecycle). */
export type Transition = { state: LifeState; at: string; by: string; note?: string }

export type Actor = { email: string; admin: boolean; superAdmin: boolean } | "system"

export const isLifeState = (s: unknown): s is LifeState => typeof s === "string" && (LIFECYCLE as readonly string[]).includes(s)
export const nextState = (s: LifeState): LifeState | null => LIFECYCLE[LIFECYCLE.indexOf(s) + 1] ?? null

/** Why an actor may not move an instrument from one state to another, or null when it may. */
export function refusal(from: LifeState, to: LifeState, actor: Actor): string | null {
  if (from === to) return `It is already ${to}.`
  if (to === "Open" && from === "Draft") return "It opens only once it is Approved."
  if (nextState(from) !== to) return LIFECYCLE.indexOf(to) < LIFECYCLE.indexOf(from) ? `A ${from} instrument doesn't go back to ${to}.` : `${from} goes to ${nextState(from) ?? "nothing further"}, not ${to}.`
  if (to === "Approved") return actor !== "system" && actor.superAdmin ? null : "Only the super admin approves."
  if (to === "Open") return actor !== "system" && actor.admin ? null : "Only an admin opens it."
  return actor === "system" || actor.admin ? null : "Only an admin closes or reports it."
}

/** Each state's chip dress. */
export const LIFE_TONE: Record<LifeState, string> = {
  Draft: "bg-slate-100 text-slate-600",
  Approved: "bg-amber-50 text-amber-800",
  Open: "bg-emerald-50 text-emerald-700",
  Closed: "bg-slate-200 text-slate-700",
  Reported: "bg-pax2-lavender text-pax2-blue",
}

/** The stored status a test's respondent gate reads, for a state (the stored values predate the lifecycle). */
export const testStatusFor = (s: LifeState): "draft" | "fielding" | "closed" => (s === "Open" ? "fielding" : s === "Closed" || s === "Reported" ? "closed" : "draft")
