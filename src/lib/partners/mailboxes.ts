import { PARTNERS } from "@/lib/roles"

// Each partner organization's mailbox in the kept mail (Brendan, 2026-11-02): where the Analyst's readouts and the
// Pollster's status notes for its sponsored instruments land, in the app. Nothing sent here leaves the platform: an
// org's address is the platform's own, like an agent's (lib/mail/send.ts keeps it, never mails it). A partner account
// opens its own organization's mailbox beside its own; the super admin opens every one. Client-safe: the inbox's chip
// reads this list too. PAX is the platform itself, so it has none.

export type OrgBox = { box: string; org: string; name: string; email: string }

export const ORG_BOXES: OrgBox[] = PARTNERS.filter((p) => p.id !== "pax").map((p) => ({ box: `org:${p.id}`, org: p.id, name: p.name, email: `${p.id}@partners.pax.com` }))

/** An organization's mailbox, by its box ("org:<id>"), its id or its address; undefined when it is none. */
export const orgBox = (key: string | null | undefined): OrgBox | undefined => {
  const k = (key ?? "").trim().toLowerCase()
  return k ? ORG_BOXES.find((o) => o.box === k || o.org === k || o.email === k) : undefined
}
