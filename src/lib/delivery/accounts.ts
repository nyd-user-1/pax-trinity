import "server-only"

import { PUBLISHED } from "@/components/clips/catalog"
import { CREATORS } from "@/components/clips/desks"
import { ledger } from "@/lib/delivery/store"
import type { Account, Person, ResultRow, TestRow } from "@/lib/delivery/types"
import { MEMBERS, PARTNERS } from "@/lib/roles"
import { lifecycleOf } from "@/lib/lifecycle/store"
import { listTests } from "@/lib/tests/store"
import { PLACEBO } from "@/lib/tests/types"

// The Delivery Board's accounts: each partner in lib/roles.ts with its desk in Clips, the message tests
// run on its videos, the results published for them, and its work from ./store.ts. Partners added to
// lib/roles.ts join the board as they are.

/** The Clips desk a partner's videos sit under; PAX's own desk is "parallax". */
const deskOf = (partner: string) => (partner === "pax" ? "parallax" : partner)
const partnerOfDesk = (desk: string) => (desk === "parallax" ? "pax" : desk)

/** The PAX side: the super admin and the admins, who own accounts and their work. */
export const STAFF: Person[] = MEMBERS.filter((m) => m.email && (m.role === "superadmin" || m.role === "admin")).map((m) => ({ email: m.email!.toLowerCase(), name: m.name, photo: m.photo }))

/** Everyone the board may name: the staff, and the partners' people under their own photo or their desk's. */
export const PEOPLE: Person[] = MEMBERS.filter((m) => m.email).map((m) => ({
  email: m.email!.toLowerCase(),
  name: m.name,
  photo: m.role === "partner" ? (CREATORS.find((c) => c.id === deskOf(m.partner ?? ""))?.image ?? undefined) : m.photo,
}))

export const isPartner = (id: string | null | undefined) => !!id && PARTNERS.some((p) => p.id === id)

/** The test's partner: the desk most of its arms come from. */
function testPartner(arms: string[]): string | null {
  const count = new Map<string, number>()
  for (const a of arms) {
    if (a === PLACEBO) continue
    const desk = PUBLISHED.find((c) => c.id === a)?.creatorId
    if (desk) count.set(desk, (count.get(desk) ?? 0) + 1)
  }
  const top = [...count].sort((a, b) => b[1] - a[1])[0]
  return top ? partnerOfDesk(top[0]) : null
}

/** The accounts named, or every partner's. reachable is false when the work could not be read. */
export async function accounts(ids?: string[]): Promise<{ accounts: Account[]; reachable: boolean }> {
  const partners = ids ? PARTNERS.filter((p) => ids.includes(p.id)) : PARTNERS
  const [{ tests }, ledgers] = await Promise.all([listTests(), Promise.all(partners.map((p) => ledger(p.id)))])
  // Each test's lifecycle state (lib/lifecycle), the word the dashboards show.
  const states = new Map(await Promise.all(tests.map(async (t) => [t.id, (await lifecycleOf("test", t.id)).state] as const)))
  const list = partners.map((p, i): Account => {
    const desk = deskOf(p.id)
    const clips = PUBLISHED.filter((c) => c.creatorId === desk)
    const testRows: TestRow[] = tests
      .filter((t) => testPartner(t.arms) === p.id)
      .map((t) => ({ id: t.id, title: t.title, state: states.get(t.id) ?? "Draft", arms: t.arms.filter((a) => a !== PLACEBO).length, updatedAt: t.updatedAt }))
    const results: ResultRow[] = clips
      .filter((c) => c.report)
      .map((c) => {
        const best = [...c.report!.outcomes].sort((a, b) => b.lift - a.lift)[0]
        return { clipId: c.id, title: c.title, study: c.report!.study, outcome: best.name, lift: best.lift, persuasive: best.label === "Persuasive" }
      })
      .sort((a, b) => b.lift - a.lift)
    return {
      id: p.id,
      name: p.name,
      image: CREATORS.find((c) => c.id === desk)?.image ?? null,
      youtube: p.youtube,
      contacts: PEOPLE.filter((x) => MEMBERS.some((m) => m.email?.toLowerCase() === x.email && m.role === "partner" && m.partner === p.id)),
      owner: ledgers[i].owner,
      desk: clips.length,
      tests: testRows,
      results,
      items: ledgers[i].items,
    }
  })
  return { accounts: list, reachable: ledgers.every((l) => l.reachable) }
}
