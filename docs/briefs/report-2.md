# Report 2 — /reports duplicated and organized to be read

## Where things stand

/reports is the study report surface: `src/app/reports/page.tsx` (one card per study), `src/app/reports/[study]/page.tsx` rendering `src/components/report/report-doc.tsx` with `charts.tsx`, `sections.tsx`, `report-bits.tsx`, `report-math.ts`; the data is `src/lib/results` (`RESULT_SETS`: ma-wave-1, ma-wave-2; `types.ts` is the shape). The document renders the PDF's order: cover, executive summary, then **each wave in full** — videos, outcomes, subgroups, pairings, methodology, repeated per wave. It is complete and correct, and overwhelming: one scroll, every section twice.

## The task

Report 2 lives at `/reports-2` (`src/app/reports-2/`), a duplicate of /reports organized section-first. **/reports itself stays untouched.**

- `/reports-2` — the same study cards, linking to `/reports-2/[study]`.
- `/reports-2/[study]` — the same substance, a new shape:
  - A sticky table of contents at the left, in the paper dress (not the app's bank rail): Summary, The videos, Outcomes, Subgroups, Pairings, How the test worked, What it can and cannot establish. Scrolling tracks the open section.
  - **Section-first, wave-second.** Each section holds every wave once: side by side where the blocks are small (fact boxes, pairings, the videos' cards), under wave chips where large (the subgroup grids). The per-wave full repetition goes.
  - Reuse the report components and the ResultSets. Every figure comes from the data; the printed language renders verbatim; stories render in their sections, the unplaced ones at a quiet foot, as report-doc does today.
  - Print still works (`report.css`).
- Where a shared component would need to change shape for Report 2, extract or wrap rather than edit it in place — nothing in /reports' render may move.

## Rules

- AGENTS.md binds: no explainer paragraph under any h1 or section heading, and never the arrow character in the UI.
- Where a voice is needed it is first person singular.
- Shared checkout: stage only your own paths, never amend, don't push. Commit in the house voice.
- Verify headless against localhost:3000 while it lives — **the EC2 dev box goes off at 2 a.m.**; after that, parse checks only, and the commit message says what went unverified for the morning smoke.
- The typecheck is the Amplify build's; local tsc/eslint are hook-blocked. npm, not pnpm.
- Report to lead-agent by SendMessage when committed; questions go to lead-agent, never to Brendan.
