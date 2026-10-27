# Brief: the /reports surface — render the wave readout from the results store

To: wireframes · From: lead (pax-trinity-1c) · 2026-10-27 · Approved by Brendan

## Why

Reports is the last box on the plate with nothing behind it, and it is the
point of the whole pipeline. The model is
`docs/reports/report-2-ma-test-waves-1-2.pdf` (26 pages — read every page
before you write a line of code; the register, the caveats and the chart
grammar are the product). The moving-day window is transcribing that report
into typed data under `src/lib/results/` against a fixed contract
(`src/lib/results/types.ts`, committed first — its brief is
`docs/briefs/test-results.md`, read the types block there). **Acceptance test:
`/reports` regenerates the MA report from `RESULT_SETS` — every figure from
the data modules, zero hardcoded numbers in components.**

You own `src/app/reports/**` and `src/components/report/**` (new). Touch
nothing else — in particular not `src/lib/home-data.ts` (surfaces is editing
it right now; the home box's href flips to /reports in a later pass), not
`src/lib/results/**` (moving-day's), not the bank components.

## The surface

- **`/reports`**: the index — one card per study for now ("Massachusetts
  Message Testing · Waves 1 & 2", field dates, samples, arm counts, derived
  from the result sets). Composed studies group their waves (same `study`
  string).
- **`/reports/[study]`** (slug from the study): the full readout, one long
  document page, in-app shell, the paper editorial register of the home (not
  the bank anatomy). Sections, in the PDF's order:
  1. **Cover band**: study title, waves line, the descriptive subtitle, and
     the per-wave fact strips (dates, n raw/weighted, arms).
  2. **Executive summary**: (a) the cross-wave ballot-support chart — every
     treatment of both waves on one shared 0 to +20 pp scale against its OWN
     wave's placebo, wave chip leading each row, verdict ("Detectable" /
     "Inconclusive") and comprehension-lift column trailing, the
     campaign-produced arm visually distinguished (its `producer`), ≈ on
     every `derived_from_rounded` figure; with the three printed caution
     cards (separate studies/own placebos, published vs approximate, the
     campaign ad is a treatment). (b) Comprehension: the W2 levels chart
     (0–100% scale, dashed placebo line) with W1's inconclusive lifts as
     context chips, the card-iteration story and its limitation box. (c) Test
     setup: the five-step instrument flow (numbered boxes — never the "→"
     character), the three questions, and the media-trust distribution bars
     by wave. (d) Pairings: six cards per wave plus the seen-in-both strip.
  3. **Per wave** (W1 headed as the historical record, reproduced from its
     data): the overview with topline fact boxes and the dual-outcome lift
     chart; the video cards (producer chip, both outcome bars with verdict
     chips, weighted n, watch link, note; thumbnail only if a `clipId` lands
     — design the card to stand without one); the ten pairings; the subgroup
     pages grouped by `dimension.group` — horizontal level bars per category
     panel (0–100%, dashed placebo line, significance outline, small-sample
     hatch + italic value), each dimension closing with its printed "What the
     chart shows" / "How to read it" pair; the methodology page (supported /
     cannot establish, methodology bullets, weighted counts by arm table,
     debrief questions, the comprehension caveat and "no measurable effect"
     boxes).
- Charts are small local components (flex/grid bars, no chart library, no new
  dependencies), legible in both themes.

## Epistemic rendering rules (hard — these are the product)

- A lift renders only against its own wave's placebo; never draw or imply a
  video-vs-video comparison.
- `derivation: "derived_from_rounded"` always prints the ≈ mark;
  `"published"` never does.
- Verdict language is exactly "detectable" / "inconclusive" — never
  "significant improvement", never "proof", and inconclusive is never
  rendered as zero.
- No confidence intervals anywhere — the source supplies none.
- Subgroup bars are LEVELS and the page says so; significance marks compare
  one arm with placebo inside one subgroup only.
- `selfSelected` dimensions carry their badge and framing (stated trust, not
  an outcome); `needsVerification` renders the report's own flag.
- Small-sample cells are visibly flagged wherever they appear.

## Voice and house rules

- Transcribed language from the data (whatItShows, howToRead, notes,
  stories, pairings) renders verbatim — it is the register. New chrome text
  you write follows the house: first person singular where a voice is
  needed, never "we"/"our", never third-person product voice.
- Never "→" in the UI. No lead-in/explainer paragraphs under the h1 or
  section headings. "chip"/"badge", never "pill"; "raw", never "bulk"; no
  labels that restate what the layout already says.

## Sequencing

Build the page structure and components against the types in the test-results
brief now; `types.ts` lands as moving-day's first commit (they will message
you the sha) and the two wave modules follow, Wave 1 first. Until data lands,
drive layout with a throwaway local stub typed `ResultSet` — delete it before
your final commit; never commit a stub into `src/lib/results/`. If the
contract pinches, message pax-trinity-1c — don't edit types.ts yourself.

## Rules (you may be context-cleared; this is everything)

- Shared checkout, several windows on main: `git log -1` before every
  commit, stage explicit paths only, never amend, **never push**.
- No tsc, no eslint, no builds, no dev servers (a hook blocks them; :3000 is
  already running — don't restart it, smoke against it). Parse-check edited
  files via node + typescript `createSourceFile` parseDiagnostics; the
  Amplify build is the only type check, so be type-strict.
- Smoke: /reports and the study page 200 with the MA data once it lands;
  screenshots of the exec summary, one video-card row and one subgroup page
  into docs/wireframes/ (reports-*.png).
- Commit per section group, house narrative messages. Report to
  pax-trinity-1c: shas, screenshots, any figure you could not trace to the
  data, any contract pinch.
