// A message test as data: what /message-tests sets up, /test/<id> serves, and the collector
// validates against. Plain types and pure helpers, safe on the client and the server; the
// DynamoDB side lives in ./store.ts.

import { ARMS, PLACEBO_SRC, TEST } from "@/lib/tests/open-primaries"

export type Choice = { value: string; label: string }
export type EntryQuestion = { key: string; prompt: string; choices: Choice[] }
export type Status = "draft" | "fielding" | "closed"
export const STATUSES: Status[] = ["draft", "fielding", "closed"]

/** The panel vendor's three return links. Each carries {pid}, replaced with the respondent's panel id. */
export type PanelConfig = { vendor: string; completeUrl: string; screenoutUrl: string; quotaFullUrl: string }

export type TestRecord = {
  id: string
  title: string
  entry: EntryQuestion[]
  explanationTitle: string
  explanation: string
  ballot: { prompt: string; choices: Choice[] }
  comprehension: { prompt: string; choices: Choice[]; correct: string }
  /** Arm ids the page draws from: "placebo" (played from placeboSrc) and clip-store PUBLISHED ids. */
  arms: string[]
  placeboSrc: string
  /** Finished completes wanted in each arm. */
  targetPerArm: number
  status: Status
  panel: PanelConfig | null
  createdAt?: string
  updatedAt?: string
}

export const PLACEBO = "placebo"
export const PID = "{pid}"
export const DEFAULT_PLACEBO_SRC = PLACEBO_SRC

/** The seeded test, as a record: the survey /test/open-primaries-1 has served since the flow shipped.
 *  Its target per arm is a setup default, editable in /message-tests. */
export const SEED: TestRecord = {
  id: TEST.id,
  title: TEST.title,
  entry: TEST.entry.map((q) => ({ key: q.key, prompt: q.prompt, choices: q.choices.map((c) => ({ ...c })) })),
  explanationTitle: TEST.explanationTitle,
  explanation: TEST.explanation,
  ballot: { prompt: TEST.ballot.prompt, choices: TEST.ballot.choices.map((c) => ({ ...c })) },
  comprehension: {
    prompt: TEST.comprehension.prompt,
    choices: TEST.comprehension.choices.map((c) => ({ ...c })),
    correct: TEST.comprehension.correct,
  },
  arms: [...ARMS],
  placeboSrc: PLACEBO_SRC,
  targetPerArm: 500,
  status: "fielding",
  panel: null,
}

/** A new test's starting point: the seeded battery, no arms beyond the placebo, a draft. */
export function blankTest(id = ""): TestRecord {
  return { ...structuredClone(SEED), id, title: "", arms: [PLACEBO], status: "draft", panel: null, createdAt: undefined, updatedAt: undefined }
}

const ID = /^[a-z0-9][a-z0-9-]{1,62}$/

/** Every problem with a record, in words an admin can act on; an empty list means it can be saved.
 *  clipIds are the PUBLISHED ids an arm may name, playable clips only (the server reads them from
 *  @/components/clips/catalog); null checks the ids' form only. unplayable names published clips
 *  with no video file (YouTube-only), which the survey's player can't show. */
export function problems(t: TestRecord, clipIds: ReadonlySet<string> | null, unplayable?: ReadonlySet<string>): string[] {
  const out: string[] = []
  if (!ID.test(t.id)) out.push("The id must be 2-63 lowercase letters, digits or hyphens, starting with a letter or digit.")
  if (!t.title.trim()) out.push("The title is empty.")
  if (!t.arms.includes(PLACEBO)) out.push("The arms must include the placebo.")
  if (t.arms.length < 2) out.push("Pick at least one clip besides the placebo.")
  if (new Set(t.arms).size !== t.arms.length) out.push("An arm is listed twice.")
  for (const a of t.arms) {
    if (a === PLACEBO) continue
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/.test(a)) out.push(`${a} is not a clip id.`)
    else if (unplayable?.has(a)) out.push(`The clip ${a} has no video file (it plays on YouTube only), so the survey can't show it.`)
    else if (clipIds && !clipIds.has(a)) out.push(`No published clip has the id ${a}.`)
  }
  if (!/^https:\/\/\S+$/.test(t.placeboSrc)) out.push("The placebo source must be an https URL.")
  if (!Number.isInteger(t.targetPerArm) || t.targetPerArm < 1) out.push("The target per arm must be a whole number of at least 1.")
  if (!t.entry.length) out.push("There are no entry questions.")
  const keys = t.entry.map((q) => q.key)
  if (new Set(keys).size !== keys.length) out.push("Two entry questions share a key.")
  for (const q of [...t.entry, { key: "ballot", ...t.ballot }, { key: "comprehension", ...t.comprehension }]) {
    if (!q.prompt.trim()) out.push(`The ${q.key} question has no prompt.`)
    if (q.choices.length < 2) out.push(`The ${q.key} question needs at least two choices.`)
    const values = q.choices.map((c) => c.value)
    if (new Set(values).size !== values.length) out.push(`The ${q.key} question repeats a choice value.`)
  }
  if (!t.comprehension.choices.some((c) => c.value === t.comprehension.correct)) out.push("Mark exactly one comprehension choice correct (with *).")
  if (!t.explanation.trim()) out.push("The explanation is empty.")
  if (!STATUSES.includes(t.status)) out.push("The status must be draft, fielding or closed.")
  if (t.panel) {
    if (!t.panel.vendor.trim()) out.push("Name the panel vendor, or leave every panel field empty.")
    for (const [name, url] of [["complete", t.panel.completeUrl], ["screenout", t.panel.screenoutUrl], ["quota-full", t.panel.quotaFullUrl]] as const) {
      if (!/^https:\/\/\S+$/.test(url)) out.push(`The ${name} redirect must be an https URL.`)
      else if (!url.includes(PID)) out.push(`The ${name} redirect must contain ${PID}.`)
    }
  }
  return out
}

/** A redirect template with the respondent's panel id in place of {pid}. */
export const panelRedirect = (template: string, pid: string) => template.split(PID).join(encodeURIComponent(pid))
