# Brief: test results — the schema, the MA transcription, the compute path, the Resonance score

To: moving-day · From: lead (pax-trinity-1c) · 2026-10-27 · Approved by Brendan

## Why

The platform must generate the wave readout for real, from scratch. The model
is `docs/reports/report-2-ma-test-waves-1-2.pdf` (26 pages — read it first,
every page); the product requirements around it are
`docs/reports/report-1-assignment.pdf` (5 pages — read it too). The wireframes
window is building the `/reports` surface in parallel against the schema in
this brief; **your step 1 unblocks them, do it first**. Its acceptance test is
regenerating the MA report from your data, so transcription fidelity is the
whole game.

You own `src/lib/results/**`, `scripts/results/**`, `src/lib/resonance/**`,
`docs/reports/resonance-r1.md`. Touch nothing else — in particular not
`src/lib/home-data.ts` (surfaces is editing it right now), not
`src/app/**`, not the bank components.

## Step 1 — commit the contract (do this first, alone)

Create `src/lib/results/types.ts` with EXACTLY this content (plus nothing
else), commit it alone, then message BOTH `pax-trinity-1c` and `wireframes`
one line: "results types.ts committed <sha>".

```ts
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
```

If transcription reveals the contract can't hold something the report prints,
message me before changing types.ts — wireframes builds against it.

## Step 2 — transcribe Wave 1; Step 3 — transcribe Wave 2

`src/lib/results/ma-wave-1.ts` exporting `const MA_WAVE_1: ResultSet`, then
`ma-wave-2.ts` with `MA_WAVE_2`, and `index.ts` exporting
`RESULT_SETS: ResultSet[] = [MA_WAVE_1, MA_WAVE_2]`. One commit per wave.
Everything comes from the PDF's printed figures — Read the PDF pages (they
render as images) and transcribe. The epistemics are data, not prose:

- **Derivation**: Wave 1 lifts are published pre-rounding figures
  (`"published"`). Every Wave 2 lift is a subtraction of rounded displayed
  percentages (`"derived_from_rounded"` — the report's ≈). Wave 2 levels are
  published. Get this field right everywhere; the renderer prints ≈ from it.
- **Placebo rows** carry level (W2 ballot 47, comprehension 45) but no lift
  and no verdict. Lifts are only ever versus the own wave's placebo.
- **Levels vs lifts**: subgroup cells are levels (% selecting Yes), never
  lifts. `significant` means marked vs placebo within that subgroup at the
  source's 90% criterion.
- **Small-sample flags** exactly as printed (hatched/italic cells; and
  `smallSampleAllCells` where a whole column is flagged, e.g. W1 Rural, Other
  race, Voted Other, Unsure).
- **Media trust / media influence** is `selfSelected: true`,
  `askedBeforeExposure: true`, with the distribution shares on its categories
  (W2: 54.4%/24.5%/21.1%, n 1,290/581/501; W1 ≈54/24/22, n 1,919/855/790).
- **2022 turnout** carries `needsVerification: "Exact question stem not
  printed in the report"` (the report's own flag).
- `whatItShows` / `howToRead` / pairing text / notes / stories: transcribe the
  printed language verbatim — it is the register the house adopts.

Wave 1 anatomy: placebo (n 494) + six videos — Danielle Allen 512, Littlewood
484, Donut 518, Official campaign ad 491 (Campaign-produced), Dustin 520,
Rodriguez 546. Ballot lifts +18/+15/+12/+11/+11/+2 (Rodriguez inconclusive,
rest detectable); comprehension lifts +3/−3/0/+3/0/0, all inconclusive.
Twelve dimensions (gender, age, race, education, income, parenthood,
ideology, party, community, 2024 vote, 2022 turnout, media influence) = 36
subgroups × 7 arms of ballot levels. Ten pairings.

Wave 2 anatomy: placebo 443 + Pahlow 482 (32.6s), DiZoglio 484 (30s), Matt
Wilson 506 (36.4s), Green 457 (34.6s). Ballot levels 47/57/58/58/61, all four
detectable; comprehension levels 45/56/54/51/50 (Pahlow/DiZoglio/Matt Wilson
detectable, Green inconclusive). Same twelve dimensions plus media market =
38 subgroups. Ten pairings. Stories: the card iteration, reading a lift,
between videos, frames supplied.

**Verification pass (required, after each wave):** re-read every PDF page
against your file and reconcile three checksums — (1) each dimension's
printed "Marked vs placebo: X of Y cells" equals your `significant` counts,
(2) arm `nWeighted` sums to the printed totals (W1 3,565 rounded / 3,564
weighted; W2 2,372 / 2,371 — both shown as published), (3) toplines count =
arms × outcomes. Your report states each checksum's result per wave.

**Clip joins:** try matching each tested video to the clips catalog
(`src/components/clips/catalog.ts`) by title; set `clipId` where confident,
leave it off otherwise, and list the unmatched in your report. Don't block
on this.

## Step 4 — the compute path from our own responses

`scripts/results/compute.mjs`: reads a test's responses from DynamoDB
(`pax-trinity-tests`, `pax-trinity-test-responses` — read-only; prefer
profile `pax-new`, region us-east-2; fall back to the default profile in
us-east-1), rakes weights to targets supplied in a JSON config (factors
declared per test), computes per-arm weighted levels, lift vs placebo, a
two-proportion test at the 90% criterion, small-cell flags (<50 actual
respondents), and emits a valid `ResultSet` TypeScript module under
`src/lib/results/computed/` with every figure `derivation: "computed"`.
Acceptance: it runs end to end on `open-primaries-1` (6 responses today) and
emits an honest file — tiny n means everything inconclusive and every cell
small-sample flagged. That honesty IS the test. Document usage at the top of
the script. Don't commit the computed output for the 6-response run.

## Step 5 — the Resonance score, version r1

Read `docs/reports/report-1-assignment.pdf` Part One, then build it over
`docs/reports/paid-content-through-set-4.csv` (120 rows: 20 creatives × 3
audience groups × 2 age bands; 49 rows have blank derived cells). You design
the formula; the assignment's constraints are hard requirements:

- An interpretable 0–100 score with a stated definition of what it assesses,
  explicitly relative to this dataset (a percentile-style reference is fine
  if you say so).
- Spend-neutral: rates and efficiency, never raw volume; account for
  duration and delivery differences where the records support it.
- Inspectable: `src/lib/resonance/` holds a pure, versioned formula module
  (`FORMULA_VERSION = "r1"` as a field on every output) and a generated,
  committed `scores.ts`: per creative the inputs used, each component's
  value and contribution, the score, the version, and flags. Unscorable or
  partially scorable rows are flagged, never silently dropped or zeroed.
- No AI-assessed content signals exist in this CSV — r1 therefore has none;
  say so in the doc rather than inventing any.
- `docs/reports/resonance-r1.md`: the definition, inputs, scaling, weights
  (design choices labeled as design choices, not findings), one worked
  example traced from raw CSV row to final score, and a sensitivity note
  (one input changed, the score's movement shown).

## Rulings (lead, 2026-10-27, after wireframes' contract review)

1. `SubgroupDimension` gains `shareDerivation?: Derivation` — the media-trust
   distribution shares are approximations from rounded weighted counts in
   both waves, and ≈ prints only from a derivation field.
2. `Arm` gains `reviewUrl?: string` and `sourceTitle?: string` — the W2 cards
   print both a "Watch tested MP4" and a "Review copy" link, plus the source
   title.
3. Story-id convention: study-level blocks live in the `stories` of the
   study's LATEST wave (so a future wave 3 carries the new exec summary).
   Fixed ids — study level: `study-subtitle`, `caution-separate-studies`,
   `caution-published-vs-approximate`, `caution-campaign-ad`, `seen-in-both`,
   `flow-1`..`flow-5`, `question-trust`, `question-vote`,
   `question-understand`. Per wave: `overview-1`..`overview-4` (the numbered
   findings), `card-iteration`, `reading-a-lift`, `between-videos`,
   `frames-supplied`; W2 also `step-1`..`step-5` (page 19) and
   `written-explanation` (the ballot explanation as printed).
4. Headlines that count things ("Nine of the ten…", "Five of six…") are NOT
   transcribed — the renderer computes them from verdicts.

moving-day makes edits 1–2 to types.ts and follows 3; wireframes renders to
them.

5. `whatItShows` and `howToRead` become OPTIONAL on SubgroupDimension —
   absent means the wave doesn't print them (Wave 2 prints neither for its
   twelve breakdown dimensions; Wave 1 prints both for all twelve). The
   renderer never invents the pair. Wave 2's page-level strip transcribes as
   stories `breakdowns-levels`, `breakdowns-comparisons`,
   `breakdowns-small-cells`, `breakdowns-description`; the media-trust cards
   as `media-trust-self-selected`, `media-trust-within-group`,
   `media-trust-not-targeting`. No empty-string sentinels, ever.
6. Wave 1 has no printed "Marked vs placebo: X of Y" lines; its checksums
   are the narrative counts ("five of six marked…") and pairing 1's
   "significant in 29 of 36", which the transcription must reproduce.

## Rulings after the Wave 2 landing (lead, 2026-10-27)

7. One derivation per topline row stands. The renderer prints ≈ beside the
   LIFT only, when the row is derived_from_rounded; a levelPct never carries
   ≈ (levels are always the published display).
8. Ruling 4 covers renderer-generated headlines only. A transcribed story's
   printed title stays verbatim, counts included — the historical record is
   quoted, not recomputed.
9. The exec summary's homeless blocks: the page-5 short pairings and page-3
   comprehension cards are NOT transcribed — the renderer derives the
   pairing cards from each wave's pairings (first six, own wording from the
   data) and computes the countable comprehension statements from verdicts;
   the cards point stands on the card-iteration story. The page-4 intro
   sentence stays untranscribed (it is a lead-in; the house drops those).
   The media-trust stories media-trust-wording / media-trust-stated /
   media-trust-experimental are ADOPTED.
10. Accepted as transcribed: arm `name` from the exec summary with W1 pages'
   short names unreproduced; sourceTitle on W2 arms only; the
   needsVerification flag on 2022 turnout in both waves (true in both, printed
   in one); W1 notSupported empty (its limits live in methodology and
   captions, kept where printed); W2 debriefQuestions empty; flow story
   titles as the printed step numbers. The Pahlow/px-paul near-miss stays
   unjoined — identical report figures, mismatched name and duration — and
   goes to Brendan.

## Rules (you may be context-cleared; this is everything)

- Shared checkout, several windows on main: `git log -1` before every
  commit, stage explicit paths only, never amend, **never push**.
- No tsc, no eslint, no builds, no dev servers (a hook blocks them; :3000 is
  already running — don't restart it). Parse-check edited files via node +
  typescript `createSourceFile` parseDiagnostics. The Amplify build is the
  only type check, so be type-strict: no `any`, no clever casts, data
  modules typed `ResultSet` explicitly.
- Commit messages in the house narrative style; one commit per step.
- Report to pax-trinity-1c after steps 1, 3, 4 and 5: what landed (shas),
  the checksum results, unmatched clips, and anything the contract couldn't
  hold.
