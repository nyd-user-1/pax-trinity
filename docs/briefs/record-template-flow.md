# Record → template: three more yes-on-3 cards, the chooser, the rail picker

You are worker-1 on pax-trinity. Build the three steps in order. Where the brief and the code disagree, follow the code and note it. Questions go to the lead (pax-trinity-60), never Brendan.

## Working rules

- Shared checkout: never amend, never `git add -A` — explicit paths only. Commit each finished step in the repo's commit voice (`git log -5`), never push. npm, not pnpm.
- Local `tsc`/`eslint`/builds are hook-blocked: prove each file parses in Node (esbuild transform, the recent commits' way); the lead runs the proving build.
- Report file: `docs/migration/record-template-report.md`, git-ignored, appended as you go, never committed.
- AGENTS.md holds: no "→" anywhere a user sees, video frames included.

## Step 1 — two or three more yes-on-3 templates

`src/video/templates/yes-on-3-card` is the pattern: `spec.ts` (defineSpec, fixture), `schema.ts` (zod props), `Composition.tsx`, registered in `src/video/specs.ts` and `src/video/registry.ts`, sharing `src/video/backdrop.tsx` (a `backdrop` URL prop plays a recorded take under the card). Its spec cites Report 2, page 18 — the Wave 2 card.

Design 2–3 siblings from Report 2's own findings (read `src/lib/results` — the measured waves — and `src/app/reports`): e.g. a captions/lower-third card for a plain-folks read, a text-on-screen hook opener with an end card, an endorsement/quote card. Each: vertical, `SIZES.vertical`, duration from a `seconds` prop, `backdrop` optional, fixture carrying honest sample copy (no invented trial claims — a fixture with result figures wears `simulated` the way lift-card does). Keep the family to four cards total including the existing one.

After any template change run `npm run video:site` (redeploys the Lambda site) and note it in the report.

## Step 2 — the post-record chooser, a tracked pair

Recordings are kept through Clips' Record (`components/clips/capture.tsx`, clips-app's capture mode) and Chat's record flow; a kept take has a row in `lib/clips/recorded.ts` and plays from the clips CDN.

When a recording is kept, offer the chooser: **two of the four** yes-on-3 templates, the pair drawn at random, each shown as a live thumbnail (`components/video/TemplatePlayer.tsx` or a still) with `backdrop` = the take's CDN URL. Picking one opens the template over the take in a player view with Get MP4 (the `video-block.tsx` pattern: POST `/api/video/render`, poll the 202). Skippable — keeping a recording never blocks on the chooser.

The pair is a tracked experiment. Ledger rows (`lib/ledger.ts`, append-only):
- `TPLPAIR#<recording id>` / `<iso>` — `{ shown: [two template ids] }`, written when the pair is offered (putOnce per recording+pair).
- `TPLPICK#<recording id>` / `<iso>` — `{ shown, picked, owner }`, written at the pick.
A small API route (signed-in gate) carries the writes; follow `api/clips/report-thread/route.ts` as the pattern.

## Step 3 — the rail picker on /clips

In the feed's rail (`components/clips/feed.tsx`, the `rail` block): replace the like, comment, send and bookmark slots with up to two template thumbnails (the same randomized pair, logged the same way), and give the kebab (`ClipMenu`, `menu.tsx`) an "Apply a template…" row listing all four. Same pick path as Step 2, `backdrop` = the clip's own `src`. Only for clips with a playable `src` — a YouTube embed keeps today's rail. Comments stay reachable through the panel; note the removal in your report.

## Verify, then stop

- Each new template renders in the local Player (the registry test `src/video/registry.test.ts` pattern — extend it to the new ids; `npx vitest run`).
- The chooser's ledger writes checked in Node against the putOnce semantics (an in-memory double is fine).
- Report: what shipped, the template ids, screenshots not required, what you did not do.
