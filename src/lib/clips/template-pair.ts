import { getSpec, YES_ON_3_FAMILY, type YesOn3TemplateId } from "@/video/specs"

// The template pair, a tracked experiment (docs/briefs/record-template-flow.md). A kept recording, or a
// playable clip on /clips, is offered two of the four Yes on 3 templates drawn at random; the pair is drawn
// once per recording, so whoever opens it again sees the same two, and the offer is written once. A pick is
// written each time someone picks. Both are ledger rows, append-only:
//
//   pk                      sk      item
//   TPLPAIR#<recording>     <iso>   shown (the two ids), from
//   TPLPICK#<recording>     <iso>   shown, picked, owner (who picked), from
//
// `from` is where it happened: "record" (the chooser after keeping a take), "rail" (the /clips rail),
// "menu" (the clip menu's Apply a template, which shows all four, so its shown is the four).

export const pairKey = (recording: string) => `TPLPAIR#${recording}`
export const pickKey = (recording: string) => `TPLPICK#${recording}`

/** A recording's id or a clip's: rec-…, px-…, yt-…. */
export const RECORDING = /^[\w.:-]{1,80}$/

export const FROM = ["record", "rail", "menu"] as const
export type From = (typeof FROM)[number]

const FAMILY: readonly string[] = YES_ON_3_FAMILY
export const isTemplate = (id: unknown): id is YesOn3TemplateId => typeof id === "string" && FAMILY.includes(id)

/** The ledger calls this needs; lib/ledger.ts in the route, an in-memory double in a check. */
export type PairLedger = {
  query: (pk: string) => Promise<{ pk: string; sk: string; [k: string]: unknown }[]>
  putOnce: (item: { pk: string; sk: string; [k: string]: unknown }) => Promise<boolean>
  now: () => string
}

/** Two different templates of the four, drawn at random. */
export function drawPair(random: () => number = Math.random): [YesOn3TemplateId, YesOn3TemplateId] {
  const rest = [...YES_ON_3_FAMILY]
  const a = rest.splice(Math.floor(random() * rest.length), 1)[0]
  const b = rest[Math.floor(random() * rest.length)]
  return [a, b]
}

const shownOf = (row: { [k: string]: unknown }) => (Array.isArray(row.shown) && row.shown.length === 2 && row.shown.every(isTemplate) ? (row.shown as YesOn3TemplateId[]) : null)

/** The recording's pair: the one first offered, else a fresh draw, written once. `logged` says whether this call wrote it. */
export async function offerPair(recording: string, from: From, ledger: PairLedger, random?: () => number): Promise<{ shown: YesOn3TemplateId[]; logged: boolean }> {
  const first = (await ledger.query(pairKey(recording))).map(shownOf).find(Boolean)
  if (first) return { shown: first, logged: false }
  const shown = drawPair(random)
  if (await ledger.putOnce({ pk: pairKey(recording), sk: ledger.now(), shown, from })) return { shown, logged: true }
  // Another offer landed in the same instant: the pair is the one written.
  const again = (await ledger.query(pairKey(recording))).map(shownOf).find(Boolean)
  return { shown: again ?? shown, logged: false }
}

/** A pick: what was shown, what was picked and by whom. "bad" when it does not read (a template not shown),
 *  "clash" when another pick on the recording took the same instant. */
export async function recordPick(recording: string, pick: { shown: unknown; picked: unknown; owner: string; from: From }, ledger: PairLedger): Promise<"ok" | "bad" | "clash"> {
  const shown = Array.isArray(pick.shown) ? pick.shown : []
  if (!isTemplate(pick.picked) || !shown.length || shown.length > FAMILY.length || !shown.every(isTemplate) || new Set(shown).size !== shown.length || !shown.includes(pick.picked)) return "bad"
  return (await ledger.putOnce({ pk: pickKey(recording), sk: ledger.now(), shown, picked: pick.picked, owner: pick.owner, from: pick.from })) ? "ok" : "clash"
}

/** A template's sample copy over a take: the take as its backdrop, as long as the take (six seconds at
 *  least, room for the explainer's hook and end card; sixty at most, Record's limit). Pure, so the chooser
 *  and a check in Node read the same props. */
export function overTake(templateId: string, take: { src?: string; seconds?: number | null }, backdrop = true): Record<string, unknown> {
  const fixture = (getSpec(templateId)?.fixture ?? {}) as Record<string, unknown>
  const seconds = take.seconds ? Math.min(60, Math.max(6, Math.round(take.seconds))) : undefined
  return { ...fixture, ...(backdrop && take.src ? { backdrop: take.src } : {}), ...(seconds ? { seconds } : {}) }
}
