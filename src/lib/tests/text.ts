// The setup form edits a test's questions as text. One question per block, blocks separated by a
// blank line:
//
//   party | Generally speaking, do you think of yourself as a Democrat, a Republican, or something else?
//   - democrat | Democrat
//   - independent-other | Independent or other
//   - republican | Republican
//
// Entry questions start with "key | prompt"; the ballot and comprehension blocks are the prompt
// alone. A choice is "- value | label"; the comprehension question marks its correct choice with
// "*" in place of "-". Pure functions, shared by the form and the server action.

import type { Choice, EntryQuestion } from "@/lib/tests/types"

type Parsed = { prompt: string; key: string; choices: Choice[]; correct: string | null }

const KEY = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/
const VALUE = /^[a-z0-9][a-z0-9-]{0,63}$/

function blocks(text: string): string[][] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((b) => b.split("\n").map((l) => l.trim()).filter(Boolean))
    .filter((b) => b.length)
}

function parseBlock(lines: string[], where: string, keyed: boolean, errors: string[]): Parsed {
  const [head, ...rest] = lines
  let key = ""
  let prompt = head
  if (keyed) {
    const at = head.indexOf("|")
    key = at < 0 ? "" : head.slice(0, at).trim()
    prompt = at < 0 ? head : head.slice(at + 1).trim()
    if (!KEY.test(key)) errors.push(`${where}: start with "key | prompt", the key a letter then letters, digits, - or _ (read "${head.slice(0, 40)}").`)
  }
  const choices: Choice[] = []
  let correct: string | null = null
  for (const line of rest) {
    const mark = line[0]
    const body = line.slice(1).trim()
    const at = body.indexOf("|")
    if ((mark !== "-" && mark !== "*") || at < 0) {
      errors.push(`${where}: a choice is "- value | label" (read "${line.slice(0, 40)}").`)
      continue
    }
    const value = body.slice(0, at).trim()
    const label = body.slice(at + 1).trim()
    if (!VALUE.test(value)) errors.push(`${where}: the value "${value}" must be lowercase letters, digits or hyphens.`)
    if (!label) errors.push(`${where}: the choice "${value}" has no label.`)
    if (mark === "*") correct = correct === null ? value : (errors.push(`${where}: mark only one choice with *.`), correct)
    choices.push({ value, label })
  }
  return { prompt, key, choices, correct }
}

export function parseEntry(text: string): { entry: EntryQuestion[]; errors: string[] } {
  const errors: string[] = []
  const entry = blocks(text).map((b, i) => {
    const q = parseBlock(b, `Entry question ${i + 1}`, true, errors)
    return { key: q.key, prompt: q.prompt, choices: q.choices }
  })
  return { entry, errors }
}

export function parseSingle(text: string, name: "Ballot" | "Comprehension"): { prompt: string; choices: Choice[]; correct: string | null; errors: string[] } {
  const errors: string[] = []
  const bs = blocks(text)
  if (bs.length !== 1) errors.push(`${name}: write exactly one question (found ${bs.length}).`)
  const q = bs.length ? parseBlock(bs[0], name, false, errors) : { prompt: "", key: "", choices: [], correct: null }
  if (name === "Ballot" && q.correct !== null) errors.push("Ballot: no choice is correct; use - for every choice.")
  return { prompt: q.prompt, choices: q.choices, correct: q.correct, errors }
}

const choiceLines = (choices: Choice[], correct?: string) => choices.map((c) => `${c.value === correct ? "*" : "-"} ${c.value} | ${c.label}`)

export const formatEntry = (entry: EntryQuestion[]) => entry.map((q) => [`${q.key} | ${q.prompt}`, ...choiceLines(q.choices)].join("\n")).join("\n\n")

export const formatSingle = (q: { prompt: string; choices: Choice[] }, correct?: string) => [q.prompt, ...choiceLines(q.choices, correct)].join("\n")
