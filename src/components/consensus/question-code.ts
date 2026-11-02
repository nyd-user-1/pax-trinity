import type { Conversation } from "@/lib/consensus/data"

// Every card's number (Brendan, 2026-10-30), read from his 100126.200126. Each half is a kind, a
// three-digit sequence and the year: 1·001·26 is a question, the first, of 2026; 2·001·26 a survey, the
// first, of 2026. A question's code is its own half, then its survey's; a survey's card carries its half
// alone. These are original questions; the parts a number will carry later (the source library, topic,
// category, construct) are still to be settled, and a question drawn from America Thinks' libraries will
// be renumbered then.

/** The year the surveys were fielded, two digits. */
const YEAR = "26"
const pad = (n: number) => String(n).padStart(3, "0")

/** A survey's code, from its place in the directory (1 up): 200126 for the first of 2026. */
export const surveyCode = (survey: number) => `2${pad(survey)}${YEAR}`

/** A question's code: its own place in its survey (1 up), then the survey's code. Question 1 of survey 1 is 100126.200126. */
export const questionCode = (survey: number, question: number) => `1${pad(question)}${YEAR}.${surveyCode(survey)}`

/** Each standing statement's place in its survey, 1 up, in the order the Questions cards show them. */
export function questionNumbers(c: Conversation): Map<number, number> {
  return new Map(c.statements.filter((s) => s.moderated >= 0).map((s, i) => [s.tid, i + 1]))
}

/** The anchor a question card wears, for Blocks to open it at: its kind (the vote card, the walkthrough's, Results')
 *  and its code, so a page holding two kinds of the same question keeps them apart. Plain, so a server component
 *  (Results' StatementCard) can call it. */
export const questionAnchor = (kind: "question" | "result" | "statement", code: string | undefined, tid: number) => `${kind}-${code ? code.replace(/\./g, "-") : `t${tid}`}`
