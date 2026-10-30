import type { Conversation } from "@/lib/consensus/data"

// Every card's number (Brendan, 2026-10-30), after his sample 100126.200126. Each half is a kind, a
// sequence and a year: 1·001·26 is a survey, the first, of 2026; 2·001·26 a question, its survey's first,
// of 2026. A question's code is its survey's, then its own. These are original questions; the parts a
// number will carry later (the source library, topic, category, construct) are still to be settled, and
// a question drawn from America Thinks' libraries will be renumbered then.

/** The year the surveys were fielded, two digits. */
const YEAR = "26"
const pad = (n: number) => String(n).padStart(3, "0")

/** A survey's code, from its place in the directory (1 up). */
export const surveyCode = (survey: number) => `1${pad(survey)}${YEAR}`

/** A question's code: its survey's, then its own place in that survey (1 up). */
export const questionCode = (survey: number, question: number) => `${surveyCode(survey)}.2${pad(question)}${YEAR}`

/** Each standing statement's place in its survey, 1 up, in the order the Questions cards show them. */
export function questionNumbers(c: Conversation): Map<number, number> {
  return new Map(c.statements.filter((s) => s.moderated >= 0).map((s, i) => [s.tid, i + 1]))
}
