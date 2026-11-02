import type { SessionUser } from "@/lib/auth"
import { memberByEmail, PARTNERS } from "@/lib/roles"

// Whose material is whose: the partner lens (Brendan, 2026-11-02: a partner account sees its own sponsor's clips,
// surveys, tests, Lift and reports, not everyone's). PRODUCT ATTRIBUTION, PENDING BRENDAN'S REVIEW: the data names a
// sponsor only on clips (the catalog's creatorId); every other assignment below is this map's, approved by the lead
// on 2026-11-02 and his to change here, in one place. Nothing in the data is rewritten.
//
// The one call flagged to him: Open primaries splits. The Consensus survey is Unite America's, and the topline survey
// (its first question is MA Question 3) is Yes on 3's.
//
// A staff or admin account, or a signed-out reader, has no lens: it sees everything, as before. The gate is applied
// where the data is read, on the server, not in what a page draws.

/** The partner organizations a lens can name (lib/roles.ts PARTNERS). */
export type Org = string

/** A register study's sponsor: its reports, its Lift rows and the cuts it tested. */
export const STUDY_SPONSOR: Record<string, Org> = {
  "Massachusetts Message Testing": "yeson3",
  "Open Primaries Message Test": "voter-freedom",
}

/** A message test's sponsor, by test id. */
export const TEST_SPONSOR: Record<string, Org> = {
  "ma-wave-3": "yeson3",
  "open-primaries-1": "voter-freedom",
}

/** A Consensus survey's sponsor, by slug. */
export const CONVERSATION_SPONSOR: Record<string, Org> = {
  "open-primaries": "unite-america",
  "money-in-ballot-measures": "unite-america",
  "reform-by-ballot-measure": "unite-america",
  "ranked-choice-voting": "unite-america",
}

/** A topline survey's sponsor (lib/surveys/catalog.ts), by slug. */
export const TOPLINE_SPONSOR: Record<string, Org> = {
  "open-primaries": "yeson3",
}

const ORGS = new Set(PARTNERS.map((p) => p.id))

/** The lens a reader looks through: their organization for a partner account, else null (everything). */
export function lensOf(user: Pick<SessionUser, "email" | "admin"> | null): Org | null {
  if (!user || user.admin) return null
  const m = memberByEmail(user.email)
  return m?.role === "partner" && m.partner && ORGS.has(m.partner) ? m.partner : null
}

/** Whether a lens may see something sponsored by `orgs` (none named: no partner's). */
export const sees = (lens: Org | null, orgs: Iterable<Org | null | undefined>) => lens === null || [...orgs].includes(lens)

/** A clip's organizations: the one that made it (its creatorId, where that is a partner) and the sponsor of every
 *  study that tested it, so a cut made for one partner and tested in another's study is both of theirs. */
export function clipOrgs(clip: { id: string; creatorId?: string | null }, studies: { study: string; arms: { clipId?: string | null }[] }[]): Org[] {
  const out = new Set<Org>()
  if (clip.creatorId && ORGS.has(clip.creatorId)) out.add(clip.creatorId)
  for (const s of studies) {
    const org = STUDY_SPONSOR[s.study]
    if (org && s.arms.some((a) => a.clipId === clip.id)) out.add(org)
  }
  return [...out]
}

/** The Consensus surveys a lens sees. */
export const seesConversation = (lens: Org | null, slug: string) => sees(lens, [CONVERSATION_SPONSOR[slug]])
/** The topline surveys a lens sees. */
export const seesTopline = (lens: Org | null, slug: string) => sees(lens, [TOPLINE_SPONSOR[slug]])
