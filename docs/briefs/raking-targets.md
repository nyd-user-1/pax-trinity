# Brief: raking targets from the audience store

To: moving-day · From: lead (pax-trinity-1c) · 2026-10-27 · Approved by Brendan

## Why

`scripts/results/compute.mjs` rakes a test's respondents to the targets in
its config, and today those targets are OUR placeholders — round numbers we
wrote so the code could run, labeled unsourced in the config and in every
emitted ResultSet. Nothing placeholder touches the transcribed MA report;
this is only about computing results for our own tests. The real targets are
the population's true margins, and the vision says they come from our own
normative database: the audience store (census, turnout record, enrollment
rolls, five decades of surveys). This brief replaces guessed numbers with
sourced ones, provenance attached — "weighted to my audience store" made
literal.

The exemplar: **Massachusetts general adults** by age, gender, race,
education, party, and 2024 presidential vote — the factors the MA study
weighted on and the ones our configs declare.

## Phase 1 — inventory, then stop for a ruling

Before building anything, inventory what the audience store can actually
supply at the Massachusetts level, factor by factor. The store's data lives
behind the audience surfaces (start at `src/app/audience/audience-data.ts`
and the question files the pages read; the clips CDN host in
`NEXT_PUBLIC_CLIPS_CDN` serves the audience files' bucket layout too — all
reads, no writes). For each factor report:

- whether an MA-level margin is derivable, from exactly which rows/files;
- the number you'd derive and the year it describes;
- where the store falls short (party ID and 2024 vote by state are the
  likely gaps; MA enrollment rolls and official 2024 results may cover them
  if they're in the store — check, don't assume);
- what you propose for each gap: a store-derivable proxy (named as a proxy),
  or "unsupplied — the factor drops from raking and the output says so."

Message pax-trinity-1c the inventory and proposals; I rule, then you build.
**Do not source numbers from outside the repo and the store** — no web, no
memory. A margin the store cannot support is a finding, not a defect to
paper over.

## Phase 2 — build (after the ruling)

- `scripts/results/targets.mjs`: given a geography and population
  ("ma-general-adults") and a factor list, derives the margins from the
  store and writes a targets config under `scripts/results/configs/` in the
  exact shape `compute.mjs` consumes.
- Every factor in the emitted config carries its provenance: source dataset,
  the rows/files used, the reference year, and `derivation: "audience-store"`
  (vs the current unsourced label). `compute.mjs` passes the provenance
  through into the emitted ResultSet's methodology notes, so a computed
  report names its weighting source the way the MA report names Grow
  Progress's factors.
- The placeholder config for open-primaries-1 is replaced only if that
  test's population is in fact MA general adults — confirm from the test
  record; if it isn't, leave its placeholders flagged and add the
  ma-general-adults config beside it as the sourced exemplar.
- Usage documented at the top of the script; one worked run shown in your
  report.

## Phase 1 rulings (lead, 2026-10-27)

The inventory is accepted in full — all six factors supplied or derived from
the store, no outside numbers. The four calls:

1. **Party: CES 2024 pid3** (Democrat 37.26 / Republican 14.59 /
   Independent-Other 48.15, MOE ±4.0 in provenance). The test asks
   identification and enrollment measures registration — a different
   construct on a different universe. Enrollment is reserved for a test
   that asks enrollment.
2. **Blank presidential lines fold into "other"** (they cast a ballot;
   "did not vote" stays the behaviorally distinct stay-home group). At
   0.69% it moves nothing; the fold is noted in provenance.
3. **Education: the 25+ proxy, labeled** ("proxy: population 25+"). The
   industry weights education on B15003 25+; dropping the factor would
   leave the classic panel skew (college grads over-answer) uncorrected,
   which is worse than the labeled proxy.
4. **Vote-2024 universe: all adults** (non-vote 38.15). The declared
   population is MA general adults and the other factors stand on the
   all-adults universe; switching one factor to citizen adults would make
   the config incoherent. The over-report caution stays in the notes.

Also adopted: the CVAP-derived all-adult race margins
(derived_from_rounded, ±0.04 pt); all six factors emitted with
open-primaries-1's placeholders left flagged (its record names no
population); compute.mjs naming any declared factor the test never asked
in the output notes, replacing today's silent drop; per-factor category
mapping with the store's categories as default.

## Rules (you may be context-cleared; this is everything)

- You own `scripts/results/**` and, if compute.mjs needs the provenance
  pass-through, that file too. Touch nothing else.
- Shared checkout, several windows on main: `git log -1` before every
  commit, stage explicit paths, never amend, **never push**.
- No tsc, no eslint, no builds, no dev servers (hook-blocked; :3000 runs —
  leave it). Parse-check via node + typescript createSourceFile; be
  type-strict.
- All store access read-only. AWS: profile `pax-new` us-east-2 first, the
  default profile us-east-1 fallback — same as compute.mjs.
- Report to pax-trinity-1c after each phase.
