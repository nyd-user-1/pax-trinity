// Survey's Question Bank (Brendan via the lead, 2026-11-02): every question asked anywhere in Survey, once
// each, with every place it was asked. The places are a topline survey's questions, a Consensus survey's
// statements, a message test's entry, ballot and comprehension questions, and a pretraining's questions.
// One question is one America Thinks construct where the places carry its id, and one wording otherwise
// (case, spacing, quotes and closing punctuation aside). Pure, so the server builds it and the browser adds
// its own draft to it.

import type { Conversation } from "@/lib/consensus/data"
import type { LifeState } from "@/lib/lifecycle/rules"
import type { SurveyDraft } from "@/lib/consensus/draft"
import { testHref } from "@/lib/survey-links"
import type { Survey } from "@/lib/surveys/catalog"
import type { TestRecord } from "@/lib/tests/types"

export type Kind = "survey" | "consensus" | "test" | "pretraining"

/** A place questions were asked: its questions as it words them, `id` the construct where it names one. */
export type Origin = { kind: Kind; title: string; href: string | null; questions: { text: string; options: string[]; id?: string }[]; /** Its lifecycle state (lib/lifecycle), when the server knows it. */ state?: LifeState }

export type Appearance = { kind: Kind; title: string; href: string | null; state?: LifeState }
export type BankQuestion = { key: string; text: string; options: string[]; id: string | null; on: Appearance[] }

/** The wording as a key: lower case, one space, no quotes, no closing punctuation. */
export const wordingKey = (text: string) =>
  text
    .toLowerCase()
    .replace(/[“”"‘’']/g, "")
    .replace(/\s+/g, " ")
    .replace(/[\s.?!:;,]+$/, "")
    .trim()

/** Every origin's questions, merged, A to Z; each lists its places in the order the origins came. */
export function buildBank(origins: Origin[]): BankQuestion[] {
  const byId = new Map<string, BankQuestion>()
  const byText = new Map<string, BankQuestion>()
  const out: BankQuestion[] = []
  for (const o of origins) {
    const where: Appearance = { kind: o.kind, title: o.title, href: o.href, ...(o.state ? { state: o.state } : {}) }
    for (const q of o.questions) {
      const text = wordingKey(q.text)
      if (!text) continue
      let b = (q.id ? byId.get(q.id) : undefined) ?? byText.get(text)
      if (!b) {
        b = { key: q.id ? `id:${q.id}` : `text:${text}`, text: q.text.trim(), options: q.options, id: q.id ?? null, on: [] }
        out.push(b)
      }
      if (q.id) {
        b.id ??= q.id
        byId.set(q.id, b)
      }
      byText.set(text, b)
      if (!b.options.length && q.options.length) b.options = q.options
      if (!b.on.some((a) => a.kind === where.kind && a.title === where.title && a.href === where.href)) b.on.push(where)
    }
  }
  return out.sort((a, b) => a.text.localeCompare(b.text, "en-US", { sensitivity: "base" }))
}

/** A topline survey: its questions, each under its construct. */
export const surveyOrigin = (s: Survey): Origin => ({ kind: "survey", title: s.title, href: `/survey/${s.slug}`, questions: s.questions.map((q) => ({ text: q.text, options: q.options, id: q.id })) })

/** A Consensus survey: the statements it put to the room, not the ones a moderator pulled; each is agree, disagree or pass. */
export const consensusOrigin = (c: Conversation): Origin => ({
  kind: "consensus",
  title: c.title,
  href: `/survey?c=${encodeURIComponent(c.slug)}`,
  questions: c.statements.filter((s) => s.moderated !== -1).map((s) => ({ text: s.text, options: ["Agree", "Disagree", "Pass"] })),
})

/** A message test: its entry questions, its ballot and its comprehension question. */
export const testOrigin = (t: TestRecord): Origin => ({
  kind: "test",
  title: t.title || t.id,
  href: testHref(t.id),
  questions: [...t.entry.map((q) => ({ text: q.prompt, choices: q.choices })), { text: t.ballot.prompt, choices: t.ballot.choices }, { text: t.comprehension.prompt, choices: t.comprehension.choices }].map((q) => ({ text: q.text, options: q.choices.map((c) => c.label) })),
})

/** A pretraining, a seed one (its questions under their constructs) or the browser's draft. */
export const pretrainingOrigin = (p: SurveyDraft): Origin => ({
  kind: "pretraining",
  title: p.title,
  href: null,
  questions: p.questions.map((q) => ({ text: q.text, options: q.options, ...("id" in q && typeof q.id === "string" ? { id: q.id } : {}) })),
})
