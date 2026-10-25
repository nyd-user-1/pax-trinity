/**
 * Types for the switchboard's Discord drill-down. NYSgpt backs these with a
 * live Neon read; pax-trinity carries no database for it (Brendan, 2026-10-24),
 * so getDigest always answers as an unreachable one — ok: false, zeros — which
 * the panel already renders as a failed read rather than a confident 0.
 */

export type DigestTopic = {
  /** The raw arXiv code — still what the Library is queried by. */
  topic: string
  /** "Artificial Intelligence (cs.AI)" — resolved here so the panel stays dumb. */
  label: string
  count: number
  recent: { slug: string; title: string }[]
}
export type Digest = {
  documents24h: number
  totals: { documents: number; patents: number; models: number; benchmarks: number }
  topics: DigestTopic[]
  /** null when the read failed — the UI says so rather than showing a confident 0. */
  ok: boolean
}

const EMPTY: Digest = {
  documents24h: 0,
  totals: { documents: 0, patents: 0, models: 0, benchmarks: 0 },
  topics: [],
  ok: false,
}

export async function getDigest(): Promise<Digest> {
  return EMPTY
}
