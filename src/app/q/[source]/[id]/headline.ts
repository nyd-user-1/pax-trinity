import type { SourceRow } from "../../../america-thinks/audience-data"
import { bandOf, baseGeoOf, baseWave, fmtPct, seriesOf, type Band, type Point } from "../../../_wire/wire-data"

// The headline's sentence rules, shared by the dossier's Headline and the
// /audience list row's snippet: the value, who answers, the band in the
// sentence's own case, and the move from the base wave. A small file of its
// own so the list need not load the dossier to say it.

/** Sources whose rows are a general-population survey: their shares read "of Americans" (or "of people in" a state, as Survey's Consensus rows do). */
export const ATTITUDE = new Set(["GSS", "ANES", "CES", "CONSENSUS"])

/** A band in the sentence's case: "Fairly well" reads "fairly well" where the wording says it that way. */
export function inSentence(band: string, wording: string | null) {
  const w = band.split(/\s+/)[0]
  if (!/^[A-Z][a-z]+$/.test(w) || !wording) return band
  return new RegExp(`\\b${w.toLowerCase()}\\b`).test(wording) ? band.charAt(0).toLowerCase() + band.slice(1) : band
}

/** A sentence's first word capitalized. */
export const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/** Whether the headline may open "On {subject},": not when the subject is itself a question
 *  ("On how well has volunteer military worked?, 62.8%…"); the sentence then starts at the value. */
export const leadsWithSubject = (subject: string) => !/\?\s*$/.test(subject)

export type Clauses = {
  attitude: boolean
  /** The latest value as it prints ("62.8%"). */
  value: string
  /** The band, in the sentence's case. */
  band: string
  /** "Americans", or "people in" the open place. */
  who: string
  place: string
  move: { word: "up" | "down" | "unchanged"; was: string; year: number } | null
}

export function clausesOf({ source, band, wording, geo, place, latest, base }: { source: string; band: Band; wording: string | null; geo: string; place: string; latest: Point; base: Point | null }): Clauses {
  let move: Clauses["move"] = null
  if (base) {
    const d = latest.v - base.v
    move = { word: Math.abs(d) < 0.05 ? "unchanged" : d > 0 ? "up" : "down", was: fmtPct(base.v, latest.type), year: base.year }
  }
  return { attitude: ATTITUDE.has(source), value: fmtPct(latest.v, latest.type), band: inSentence(band.label, wording), who: geo === "US" ? "Americans" : `people in ${place}`, place, move }
}

/** The list row's snippet: the headline without its "On {subject}," lead, read from a question's own rows at its baseline geography. */
export function snippetOf(source: string, id: string, rows: SourceRow[], wording: string | null, level: (code: string) => string | undefined, placeOf: (code: string) => string): string | null {
  if (!rows.length) return null
  const geo = baseGeoOf(rows, level)
  const band = bandOf(id, rows, geo)
  const total = seriesOf(rows, band, geo)
  const latest = total[total.length - 1]
  if (!latest) return null
  const c = clausesOf({ source, band, wording, geo, place: geo === "US" ? "the United States" : placeOf(geo), latest, base: baseWave(total) })
  const open = c.attitude ? `${c.value} of ${c.who} answer ${c.band}.` : `${cap(c.band)} stands at ${c.value} in ${c.place}.`
  return c.move ? `${open} That is ${c.move.word} from ${c.move.was} in ${c.move.year}.` : open
}
