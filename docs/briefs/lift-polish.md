# /lift polish — the details the lead's review found off

The lead's night review of /lift at 62acf99. The surface is strong; these seven are where the attention to detail falls short. Work them in order, items 1–6 as one commit, item 7 as a second.

## 1. The benchmark pools compare one metric, not every metric at once

`src/app/lift/about-result.tsx:55-68` — the "All ads" pool takes every `lift_pp` row in the pick's segment regardless of metric: comprehension lifts pooled with support lifts, a quintile among mixed scales that reads as nothing. Swayable's three benchmarks nest universe / category / own (All Brands, Financial Services, Chime Ads), all on the one metric.

Make all three pools same-metric, same-segment, nested:
- **All tests** — this metric, this segment, both folders.
- **The pick's folder** — named "Tests" or "Archive" as the rail names it.
- **This test** — unchanged.

`AboutResult` today receives one flat `rows` and cannot tell folders apart; pass what it needs from `lift-surface.tsx` (the per-folder map is already in state as `files`). The About Comparable Set rows follow the new names.

## 2. The active sort shows itself

Nothing in the header marks which column sorts the table. When `view.by` is a column, its ListFilter icon holds the foreground ink rather than muted, and its `th` carries `aria-sort` for the direction; the Treatment column's name sort likewise. `src/app/lift/lift-surface.tsx:526-544` (sortMenu), `:555-567` (contentHead), `:602-656` (metricHeads).

## 3. Share carries the whole view

`src/app/lift/lift-surface.tsx:331-337` — Share copies `?source` and nothing else; the receiver opens a different table than the sender saw. Encode the posture: display (bars/heatmap), the picked treatments when they differ from the folder's opening set, metricsOff, segsOff, periodsOff, bench off, and the open pick (treatment, metric, segment) so the link opens on the very cell under discussion with About Result out. Restore in the state initializers as `source` already does, so the view opens right with no flash. Treatment names carry commas and parentheses — encode each part; keep the param names short.

## 4. The empty table says why

`src/app/lift/lift-surface.tsx:769` — Hide all leaves "Nothing on file.", which is false: the folder is full. When the table is empty because no treatments are picked, say so: "No treatments picked — choose one under Treatments." Keep "Nothing on file." for a folder with nothing measured.

## 5. The CSV names each row's test

The download carries no fielding; two waves' rows are indistinguishable on a laptop in the morning. Add a Test column after Treatment: the wave's name where the results register knows the fielding (the `WAVE` map), else the study id (`testOf`). `src/app/lift/lift-surface.tsx:303-329`.

## 6. The toolbar's groups divide

Swayable rules a thin divider between Treatments | Metrics | Segments | Filter. Set the sidebar toggle's existing divider span (`mx-1 h-4 w-px bg-border`) between each of the four menus. `src/app/lift/lift-surface.tsx:351-356`.

## 7. About Result learns what the results register knows

Where the pick's test is a PAX wave (its `periodKey` is in the `WAVE` map, `lift-surface.tsx:73-74`), the panel's footer gains the register's knowledge, in the footer's quiet dress:
- the arm's line — producer, duration, its printed note (`Arm` in `src/lib/results/types.ts`; join `RESULT_SETS` by `fielded.start|end` = `periodKey(lift)`, the arm by `name` = `treatmentName(option)`);
- where the wave's `pairings` name this treatment, each pairing as "Pairing #N: {audience} — {finding}".

Archive picks render as today. Open-ends stays as it is until verbatims exist.

## Rules

- Shared checkout: stage only your own paths, never amend, don't push. Commit in the house voice.
- Verify headless against localhost:3000 while it lives — **the EC2 dev box goes off at 2 a.m.**; after that, parse checks only, and the commit message says what went unverified for the morning smoke.
- The typecheck is the Amplify build's; local tsc/eslint are hook-blocked. npm, not pnpm.
- Report to lead-agent by SendMessage when each commit lands; questions go to lead-agent, never to Brendan.
