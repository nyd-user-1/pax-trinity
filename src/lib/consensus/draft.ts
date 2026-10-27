// The drafted survey, held in this browser's localStorage: written by the
// audience instrument's Add to survey and read by the consensus admin until
// it is fielded or discarded. A picked segment arrives as a question — its
// wording verbatim where the source carries one, its label where it does not
// — with the segment's bands as the answer options, the shape a survey
// actually needs. (Conversation-shaped until 2026-10-26, which could hold
// only bare statements.)

export const DRAFT_SLUG = "audience-draft"
const KEY = "pax:consensus:draft"

export type DraftQuestion = { text: string; options: string[] }
export type SurveyDraft = { slug: string; title: string; description: string; questions: DraftQuestion[] }

export function saveDraft(questions: DraftQuestion[]): SurveyDraft {
  const draft: SurveyDraft = {
    slug: DRAFT_SLUG,
    title: "Draft survey",
    description: "Questions picked in America Thinks, each with its source's own answer options.",
    questions,
  }
  localStorage.setItem(KEY, JSON.stringify(draft))
  return draft
}

/** Questions joining the held draft, duplicates by wording dropped; no draft starts one. */
export function addToDraft(questions: DraftQuestion[]): SurveyDraft {
  const held = readDraft()
  const kept = held?.questions ?? []
  const texts = kept.map((q) => q.text)
  return saveDraft([...kept, ...questions.filter((q) => !texts.includes(q.text))])
}

export function readDraft(): SurveyDraft | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as SurveyDraft
    // A Conversation-shaped draft from before the reshape reads as empty.
    return Array.isArray(parsed.questions) ? parsed : null
  } catch {
    return null
  }
}

export const clearDraft = () => localStorage.removeItem(KEY)
