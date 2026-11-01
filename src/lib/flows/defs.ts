// The marketing flows (Brendan, 2026-11-01): a signed-in reader's first visit to a page enrolls them in
// that page's flow, four mails from the Assistant that teach it. The mail is the Flows kind in
// lib/agents/templates.ts, each step named by its template's name; the engine (lib/flows/) sends a
// step on its day, counted from enrolment, and when several flows have a step due, the lowest
// priority number mails first. Every flow keeps the same arc: day 0 the page and its one core move,
// day 2 its central workflow end to end, day 5 the feature most people miss, day 9 a power move and
// where help lives.

export type FlowDef = { id: string; page: string; priority: number; steps: { template: string; day: number }[] }

const DAYS = [0, 2, 5, 9] as const

/** A flow's four steps on the shared cadence, from its templates in order. */
const steps = (names: readonly [string, string, string, string]) => names.map((template, i) => ({ template, day: DAYS[i] }))

export const FLOWS: FlowDef[] = [
  {
    id: "chat",
    page: "/chat",
    priority: 1,
    steps: steps(["Chat flow 1: Ask in plain words", "Chat flow 2: Write and record a video", "Chat flow 3: Skills", "Chat flow 4: Ask about the page on screen"]),
  },
  {
    id: "lift",
    page: "/lift",
    priority: 2,
    steps: steps(["Lift flow 1: Read a lift", "Lift flow 2: What one lift means", "Lift flow 3: Every segment at once", "Lift flow 4: Filter, share and the Archive"]),
  },
  {
    id: "america-thinks",
    page: "/america-thinks",
    priority: 3,
    steps: steps(["America Thinks flow 1: Where opinion stands", "America Thinks flow 2: One question, five views", "America Thinks flow 3: Marks and sources", "America Thinks flow 4: Results against the norm"]),
  },
  {
    id: "studio",
    page: "/studio",
    priority: 4,
    steps: steps(["Studio flow 1: Templates and versions", "Studio flow 2: From Chat to Studio", "Studio flow 3: Graphics", "Studio flow 4: Studio beside Chat"]),
  },
  {
    id: "inbox",
    page: "/inbox",
    priority: 5,
    steps: steps(["Inbox flow 1: Three agents", "Inbox flow 2: Field a survey or a test", "Inbox flow 3: Templates", "Inbox flow 4: From a conversation to a test"]),
  },
  {
    id: "survey",
    page: "/survey",
    priority: 6,
    steps: steps(["Survey flow 1: Agree, disagree or pass", "Survey flow 2: From answers to results", "Survey flow 3: Two rules for consensus", "Survey flow 4: Toplines"]),
  },
]
