# Brief: box guides — each of the ten plate boxes explains itself

To: surfaces · From: lead (pax-trinity-1c) · 2026-10-27

## Why

Each of the ten boxes on the / contents plate (PAX_BOXES, `src/lib/home-data.ts`)
opens a dialog that today carries a body line, a count, maybe shots. Brendan
wants each box to carry a guide: an explainer plus a how-to a partner or end
user can follow, honest about what is not built. These guides double as our
improvement ledger — Brendan will read them to decide what we build next, so
**reality beats polish: write only what you watched work on :3000.** We will
revise them as the products grow; this pass is the first honest draft.

## The work

1. **New optional field** on `HomeCardData` in `src/lib/home-data.ts`:

   ```ts
   /** The box's guide: an explainer, the steps that work today, and what is not built (2026-10-27). */
   guide?: {
     /** What this is and where it sits in the pipeline. 2–4 sentences, app voice. */
     about: string
     /** Numbered concrete steps a partner can take today. Every step verified on :3000. May be empty for an unbuilt product. */
     steps: string[]
     /** What is not built yet. Plain present-tense sentences. */
     gaps: string[]
   }
   ```

2. **Render it in `src/app/CardDialog.tsx`** as the dialog's final content
   section, after the existing body/shots/stats and before the Visit footer.
   The `about` paragraph leads unlabeled (the body line stays as is); the steps
   under a small section head **"How to use it"** as a numbered list; the gaps
   under **"Still to build"** as plain lines. Match the dialog's existing type
   scale and spacing; keep the dialog scrollable; no new dependencies. A card
   without `guide` renders exactly as today (the dialog is shared with the
   switchboard decks — don't disturb them). Skip empty parts (no "How to use
   it" head over zero steps).

3. **Write the ten guides** into PAX_BOXES. Truth sketches below are my best
   current knowledge — **verify every step by driving :3000 before writing**.
   Where the page disagrees with my sketch, the page wins, and your report
   tells me where. Don't change the boxes' counts, bodies, hrefs or order.

Dev server if down: `BRENDAN_OK_LOCAL_BUILD=1 npm run dev` (background; the
hook blocks a plain `npm run dev`).

## Voice and vocabulary (hard rules)

- The app speaks **first person singular** — "I", "me", "my" — never "we"/"our",
  never the product named in third person ("PAX does…" is banned).
- Steps address the reader in the imperative ("Open a topic…").
- Never the "→" character. No lead-in/explainer paragraphs under page titles.
- "chip"/"badge", never "pill". "raw", never "bulk". Never the words
  "white pill" or "coinage". Don't mention LegiScan in any UI text.
- Gaps are honest but not apologetic and never roadmap-speak ("coming soon",
  "stay tuned" are banned). A gap line states what does not exist, plainly:
  "A new test's lift does not land on this curve yet."

## Per-box truth sketches (verify each)

**Audience** (`/audience`, Data, 213,518 rows). Believed working: the topic
rail (20 topics plus a collapsed Data group), search in the rail dress, rows
with the three marks (select box, importance arrow, star) and a headline
sentence that fills in as its file loads, the question pane with Data /
Crosstab / Trend / Global views, the split toggle, the standalone dossier at
`/q/[source]/[id]`, Favorites and Important rows, sources GSS/ANES/CES plus
census, turnout and enrollment. Gaps I know of: constructs have no pages of
their own (verify what the rail's Constructs row does today); roughly 2,800
questions carry no topic tag and sit outside the topic rail (verify how they
are findable); no export or download of a selection.

**Chat** (`/chat`). I have no verified state. Drive it: what can be asked,
what it searches or answers over, whether sign-in is required, whether answers
cite sources. Write the guide to exactly what you observe; if parts stub or
fail, the steps carry what works and the gap lines carry the rest.

**Clips** (`/clips`, 209 videos). Believed working: the library of partner
cuts and shorts, channels per partner desk, watching, discussion/review
threads. Verify: posting a comment (sign-in?), rosters, and whether a clip can
actually be sent to a message test from here — I believe it cannot, which
would be a gap line.

**Consensus** (`/consensus`). Tabbed Surveys | Questions | Results | Admin.
Verify what a signed-out partner can browse versus what needs sign-in (Admin
is gated to admin emails). Gaps: whichever tabs stub out, and whether a survey
can be created and fielded end to end (believed incomplete).

**Scripts** (no page; the box says Underway). Nothing is built. The guide is
`about` + `gaps` only, steps empty. About: from brief to draft — the scripts
the cuts are shot from, written and revised in place, tied to the clips they
become. Gaps: no page exists; scripts live outside me today; drafting,
revision history, and the handoff to a shoot are unbuilt.

**Lift Benchmarks** (`/lift?source=LIFT_ARCHIVE`, 1,583 effects). Believed
working: browsing and searching the archive of ad-level effects from prior
randomized tests, opening one, reading its effect. Verify which pane views
exist for an effect. Gaps: it is a reading room, not yet a tool — a new test's
lift is not placed on this curve by the system, and there is no comparison or
overlay surface.

**Message Tests** (`/test/open-primaries-1`, 5 arms). Verify the respondent
flow end to end: land, get an arm, watch, answer the ballot, submit. The
partner-facing step today is previewing the instrument. Gaps (believed): a
test is wired by hand in code (no builder), there is no fielding surface
(no invite or panel flow), no results readout anywhere, and the system does
not compute the lift.

**Partners** (`/clips`, 4 desks). Lives inside clips: Voter Freedom, Yes on 3,
Unite America, and PAX desks — channels, rosters, review threads. Verify what
switching desks shows and what a roster is today. Gaps: whatever a partner
cannot yet do for themselves (per-desk sign-in, managing their own roster or
uploads — verify).

**Polls** (`/audience?source=POLL`, 20 polls). Believed working: thirteen
public polls and seven official measure results on open primaries as an
audience source; rows open in the pane like any question; trend where there
are multiple waves. Verify what the crosstab view offers for a poll row.

**Reports** (no page; the box says Underway). Nothing is built. `about` +
`gaps` only. About: the wave readout I build from a finished test — each
arm's lift against the placebo, weighted to my audience store, placed on the
lift benchmark. Gaps: no page exists; the prior reports were built by hand;
nothing yet generates one from a finished test.

## Smoke, commit, report

- Parse-check edited files only (node + typescript `createSourceFile`
  parseDiagnostics). **No tsc, no eslint, no builds** — the hook blocks them;
  the Amplify build is the only type check, so be type-strict (no clever
  casts; the `guide` field optional everywhere).
- Smoke: `/` 200; open all ten dialogs; each guide renders; a switchboard
  card's dialog (no guide) unchanged.
- Commit on main in the shared checkout: `git log -1` first, stage explicit
  paths only, never amend, **no push**.
- Report to pax-trinity-1c in one message: what you wrote, every box's gap
  lines collected into one list (Brendan reviews these as the improvement
  ledger), and anywhere reality contradicted this brief.
