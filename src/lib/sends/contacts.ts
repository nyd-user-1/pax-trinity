// The contact groups a send can actually go to: real people with real
// addresses, as opposed to the Inbox's demo panels, which have a size and no
// members. Until Brendan widens the allowlist the only one is the test panel:
// fourteen respondents who all receive at brendan@nysgpt.com, each invitation
// with a link of its own, so a survey or a test can be fielded end to end
// without mailing anyone else (two per arm for a six-cut test with its
// placebo). nysgpt.com's mail runs through Cloudflare Email Routing, which
// bounces plus-addresses, so the panel uses the one address fourteen times.

export type Contact = { email: string; name: string }
export type ContactGroup = { handle: string; name: string; members: Contact[] }

const pad = (n: number) => String(n).padStart(2, "0")

export const CONTACT_GROUPS: ContactGroup[] = [
  {
    handle: "group-test-panel",
    name: "Test panel",
    members: Array.from({ length: 14 }, (_, i) => ({ email: "brendan@nysgpt.com", name: `Respondent ${pad(i + 1)}` })),
  },
]

export const contactGroup = (handle: string) => CONTACT_GROUPS.find((g) => g.handle === handle) ?? null
