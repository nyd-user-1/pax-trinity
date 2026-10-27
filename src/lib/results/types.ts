/** How a number was obtained — the report's provenance discipline. */
export type Derivation = "published" | "derived_from_rounded" | "computed"

/** A statistical decision at the study's stated criterion — never proof. */
export type Verdict = "detectable" | "inconclusive"

export interface ResultSet {
  id: string                       // "ma-wave-1"
  study: string                    // "Massachusetts Message Testing"
  wave: number
  title: string                    // "Massachusetts Wave 1: What the test found"
  population: string
  fielded: { start: string; end: string }   // ISO dates
  sample: { raw: number; weighted: number }
  weightingFactors: string[]
  threshold: { level: number; label: string }
  sources: string[]                // the source citations as printed
  arms: Arm[]
  outcomes: OutcomeDef[]
  toplines: Topline[]
  dimensions: SubgroupDimension[]
  cells: SubgroupCell[]
  pairings: Pairing[]
  stories: Story[]                 // narrative blocks as printed (card iteration, reading a lift…)
  notes: StudyNotes
}

export interface Arm {
  id: string
  name: string
  role: "placebo" | "treatment"
  producer?: string                // "Parallax-produced" | "Campaign-produced"
  durationSeconds?: number
  nWeighted: number
  clipId?: string                  // the clips catalog id when the video is in the library
  watchUrl?: string
  reviewUrl?: string               // the "Review copy" link, when printed beside the tested file
  sourceTitle?: string             // the video's title in the source report, as printed
  note?: string                    // the video card's descriptive line, as printed
}

export interface OutcomeDef {
  id: string                       // "ballot" | "comprehension"
  name: string
  question?: string                // exact wording when printed
  options?: string[]
  correct?: string
  definition: string               // the outcome's printed definition box
}

export interface Topline {
  armId: string
  outcomeId: string
  levelPct?: number                // the % level, when published
  liftPp?: number                  // vs own-wave placebo; absent on the placebo row
  derivation: Derivation
  verdict?: Verdict                // absent on the placebo row
}

export interface SubgroupDimension {
  id: string
  name: string                     // "Age"
  group: string                    // page grouping: "gender-age", "race-education", …
  selfSelected?: boolean           // chosen by the respondent, not assigned (media trust)
  askedBeforeExposure?: boolean
  needsVerification?: string       // e.g. "Exact question stem not printed in the report"
  whatItShows: string              // the "What the chart shows" text, as printed
  howToRead: string                // the "How to read it" text, as printed
  markedOfCells?: { marked: number; of: number }  // the printed "Marked vs placebo: X of Y cells" checksum
  shareDerivation?: Derivation     // how the categories' sharePct were obtained (≈ prints from it)
  categories: SubgroupCategory[]
}

export interface SubgroupCategory {
  id: string
  name: string
  smallSampleAllCells?: boolean
  sharePct?: number                // pre-exposure share of the sample (media-trust distribution)
  nWeighted?: number
}

export interface SubgroupCell {
  dimensionId: string
  categoryId: string
  armId: string
  outcomeId: string                // MA: "ballot" only
  levelPct: number                 // a LEVEL, not a lift
  significant: boolean             // vs placebo within this subgroup at the threshold
  smallSample: boolean
}

export interface Pairing {
  rank: number
  armIds: string[]                 // empty = "no clear match"
  audience: string
  finding: string
  caveat?: string
}

export interface Story { id: string; title: string; body: string }

export interface StudyNotes {
  supported: string[]              // what the study supports
  notSupported: string[]           // what it cannot establish
  methodology: string[]
  limitations: string[]
  debriefQuestions: string[]
  comprehensionCaveat?: string
  noEffectMeaning?: string         // the printed "no measurable effect" meaning
}
