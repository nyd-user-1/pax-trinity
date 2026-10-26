import type { Conversation } from "@/lib/consensus/data"

// The drafted survey, held in the consensus store's local fallback: one
// Conversation-shaped object in this browser's localStorage, written by the
// audience Questions view and read by the consensus admin until it is wired
// into a live conversation or discarded.

export const DRAFT_SLUG = "audience-draft"
const KEY = "pax:consensus:draft"

const tally = () => ({ agree: 0, disagree: 0, pass: 0, seen: 0 })

export function saveDraft(texts: string[]): Conversation {
  const draft: Conversation = {
    slug: DRAFT_SLUG,
    title: "Draft survey",
    topic: "Drafted from the audience database",
    description: "Question wordings picked on /audience, verbatim from their sources.",
    source: "/audience",
    stats: { views: 0, voters: 0, commenters: 0, statements: texts.length, groups: 0, votes: 0 },
    groups: [],
    statements: texts.map((text, tid) => ({ tid, text, moderated: 0, votes: tally(), byGroup: {} })),
  }
  localStorage.setItem(KEY, JSON.stringify(draft))
  return draft
}

/** Statements joining an existing draft, duplicates dropped; no draft starts one. */
export function addToDraft(texts: string[]): Conversation {
  const held = readDraft()
  const kept = held ? held.statements.map((s) => s.text) : []
  return saveDraft([...kept, ...texts.filter((t) => !kept.includes(t))])
}

export function readDraft(): Conversation | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Conversation) : null
  } catch {
    return null
  }
}

export const clearDraft = () => localStorage.removeItem(KEY)
