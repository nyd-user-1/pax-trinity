import type { DeliveryEvent, Kind, Stage } from "@/lib/delivery/types"

// The sample work local development shows (./store.ts adds it ahead of the table's events), dated from
// today so it neither ages nor goes overdue all at once. Ids are fixed, so a move made on the board
// lands on the same item after a reload. A deployed build never shows it.

const BRENDAN = "brendan@nysgpt.com"
const SAJEELA = "sajeela@parallaxinnovations.com"
const GARRETT = "garrett@parallaxinnovations.com"
const TED = "ted@parallaxinnovations.com"
const TED_UA = "ted@uniteamerica.org"

const DAY = 86_400_000
const at = (days: number, hour = 10) => {
  const d = new Date(Date.now() + days * DAY)
  d.setUTCHours(hour + 4, 0, 0, 0)
  return d.toISOString()
}
const on = (days: number) => at(days).slice(0, 10)

type Step = { stage: Stage; days: number; by: string; note?: string }
type Seed = { id: string; type: Kind; title: string; detail: string; by: string; opened: number; owner: string | null; due: number | null; steps?: Step[]; href?: string; notes?: { by: string; days: number; text: string }[] }

const SEEDS: Record<string, { owner: string; items: Seed[] }> = {
  "voter-freedom": {
    owner: GARRETT,
    items: [
      {
        id: "seed-vf-recut",
        type: "video",
        title: "Taxation without representation, 30s recut",
        detail: "Landon's cut runs 45s. Trim to 30 for Shorts and Reels, keep the open on the tax line.",
        by: GARRETT,
        opened: -9,
        owner: GARRETT,
        due: -1,
        steps: [{ stage: "production", days: -6, by: GARRETT }],
      },
      {
        id: "seed-vf-opdycke",
        type: "video",
        title: "Six shorts from the John Opdycke interview",
        detail: "Vertical, captioned, 30 to 60s each, one argument per cut.",
        by: GARRETT,
        opened: -12,
        owner: GARRETT,
        due: -2,
        steps: [
          { stage: "production", days: -10, by: GARRETT },
          { stage: "review", days: -3, by: GARRETT, note: "All six are on your desk in Clips. The first is linked." },
        ],
        href: "/clips?c=px-john-opdycke",
      },
      {
        id: "seed-vf-test",
        type: "test",
        title: "Open primaries message test",
        detail: "Four cuts of the locked-out argument against a placebo, 500 completes an arm.",
        by: GARRETT,
        opened: -14,
        owner: SAJEELA,
        due: 3,
        steps: [{ stage: "production", days: -8, by: SAJEELA, note: "In field." }],
      },
      { id: "seed-vf-explainer", type: "video", title: "Independents explainer, 30s", detail: "Who independents are and why they're locked out of primaries, for a cold audience.", by: GARRETT, opened: -1, owner: null, due: 8 },
      {
        id: "seed-vf-channel",
        type: "analysis",
        title: "Channel analysis, @voterfreedom",
        detail: "Retention and reach across the channel's shorts since January.",
        by: GARRETT,
        opened: -20,
        owner: GARRETT,
        due: -10,
        steps: [
          { stage: "production", days: -18, by: GARRETT },
          { stage: "review", days: -12, by: GARRETT },
          { stage: "delivered", days: -9, by: GARRETT },
        ],
      },
    ],
  },
  "unite-america": {
    owner: SAJEELA,
    items: [
      { id: "seed-ua-test", type: "test", title: "Primary reform message test", detail: "Which of the summit cuts moves support for top-four primaries, nationally.", by: TED_UA, opened: -1, owner: SAJEELA, due: 14 },
      {
        id: "seed-ua-report",
        type: "report",
        title: "October channel report",
        detail: "Views, retention and the month's best and worst shorts.",
        by: SAJEELA,
        opened: -6,
        owner: SAJEELA,
        due: 2,
        steps: [{ stage: "production", days: -4, by: SAJEELA }],
      },
      {
        id: "seed-ua-summit",
        type: "video",
        title: "Four shorts from the summit keynote",
        detail: "Vertical, captioned, under 60s.",
        by: TED_UA,
        opened: -15,
        owner: SAJEELA,
        due: -6,
        steps: [
          { stage: "production", days: -13, by: SAJEELA },
          { stage: "review", days: -7, by: SAJEELA, note: "Four cuts ready for your sign-off." },
        ],
        notes: [{ by: TED_UA, days: -5, text: "Looking this week; the comms team wants a pass too." }],
      },
    ],
  },
  yeson3: {
    owner: TED,
    items: [
      {
        id: "seed-y3-cutdown",
        type: "video",
        title: "Hold Them Accountable, 15s cutdown",
        detail: "A 15-second version of the spot for pre-roll.",
        by: TED,
        opened: -11,
        owner: TED,
        due: -4,
        steps: [
          { stage: "production", days: -9, by: TED },
          { stage: "review", days: -6, by: TED },
          { stage: "delivered", days: -4, by: TED, note: "Approved." },
        ],
        href: "/clips?c=px-hold-them-accountable",
      },
      {
        id: "seed-y3-readout",
        type: "report",
        title: "Massachusetts Wave 3 readout",
        detail: "Lift on support and comprehension for the six messengers, weighted to MA adults.",
        by: TED,
        opened: -5,
        owner: TED,
        due: 5,
        steps: [{ stage: "production", days: -2, by: TED }],
      },
      { id: "seed-y3-survey", type: "survey", title: "Post-election survey of MA voters", detail: "What moved late deciders, a week after the vote.", by: TED, opened: -2, owner: TED, due: 10 },
    ],
  },
  pax: {
    owner: BRENDAN,
    items: [
      {
        id: "seed-pax-channel",
        type: "video",
        title: "PAX channel launch: first three uploads",
        detail: "Make the channel, then the first three tested cuts from Wave 1.",
        by: BRENDAN,
        opened: -3,
        owner: BRENDAN,
        due: 6,
        steps: [{ stage: "production", days: -1, by: BRENDAN }],
      },
    ],
  },
}

export function seedEvents(partner: string): DeliveryEvent[] {
  const s = SEEDS[partner]
  if (!s) return []
  const out: DeliveryEvent[] = [{ ev: "account", owner: s.owner, by: BRENDAN, at: at(-30) }]
  for (const x of s.items) {
    out.push({ ev: "open", item: x.id, type: x.type, title: x.title, detail: x.detail, due: x.due === null ? null : on(x.due), owner: x.owner, stage: "requested", by: x.by, at: at(x.opened) })
    for (const step of x.steps ?? []) out.push({ ev: "stage", item: x.id, stage: step.stage, note: step.note, by: step.by, at: at(step.days, 11) })
    if (x.href) out.push({ ev: "link", item: x.id, href: x.href, by: x.owner ?? x.by, at: at(x.steps?.at(-1)?.days ?? x.opened, 12) })
    for (const n of x.notes ?? []) out.push({ ev: "note", item: x.id, text: n.text, by: n.by, at: at(n.days, 13) })
  }
  return out.sort((a, b) => a.at.localeCompare(b.at))
}
