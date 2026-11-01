# Render Lambda: a closed test mints its own video

You are a worker window on pax-trinity. Build this exactly as written. Where the brief and the code disagree, read the code, follow it, and note the difference in your report. Questions go to the lead window (reply on the channel this arrived on), never to Brendan.

## Working rules

- This checkout is shared by several windows: never `git commit --amend`, never `git add -A` — stage explicit paths only.
- Commit each finished step in this repo's commit voice (read `git log -5` first: prose, what and why, ending "Parses; not pushed."). Never push. npm, not pnpm.
- Local `tsc`/`eslint` are hook-blocked. Prove each edited file parses (the recent commits' way: a per-file check in Node); the remote build is the type check.
- Progress and the final report go in `docs/migration/render-lambda-report.md`, git-ignored (add the ignore line if it isn't covered), appended as you go, never committed.
- AWS work runs as `AWS_PROFILE=pax-new`, region `us-east-2`. Never use the default profile or us-east-1. Do not reuse `PAX2_BUCKET` (old account) for anything new.
- **Flag at the top of your report every new env var and IAM change production will need.** You set nothing in Amplify yourself.

## Goal

Production server rendering via Remotion Lambda, plus the first callers, so all four are true when you finish:

1. A message test that closes mints its own result video, and the Analyst's readout mail carries it.
2. Chat's video card offers a server-rendered MP4 by link, not a browser render.
3. Re-rendering every closed test's video is one idempotent pass.
4. The readout mail embeds a poster image linking to the MP4 (email clients don't play MP4 inline; a linked poster is the honest form).

## Step 1 — deploy the Lambda and the site (infra)

- Add `@remotion/lambda@4.0.524` as a dependency (the whole remotion family is pinned at 4.0.524; do not float it).
- `npx remotion lambda functions deploy --region=us-east-2` under pax-new. Defaults are fine; templates are capped at 60s by the route.
- `npx remotion lambda sites create src/video/index.ts --site-name=pax-video --region=us-east-2`. Record the serve URL.
- IAM: `npx remotion lambda policies role` / `policies user` print what the function's role and the caller need. Create what's missing under pax-new; record every ARN and attached policy in the report. The caller in production is the Amplify compute role (needs `lambda:InvokeFunction` on the function and read on the remotion bucket) — list that as a production step, don't attach it yourself. The Lambda's role also needs `s3:PutObject` on the clips bucket (step 2's output).
- Add an npm script `"video:site": "remotion lambda sites create src/video/index.ts --site-name=pax-video --region=us-east-2"` — rerun after any template change; say so in the report.

## Step 2 — implement the seam

`src/video/render-server.ts` — fill the stub exactly along its own TODO:

- `renderOnLambda` uses `renderMediaOnLambda` + `getRenderProgress` from `@remotion/lambda/client` (static import is fine; add `@remotion/lambda` to `serverExternalPackages` in `next.config.ts`).
- Config from env: `REMOTION_LAMBDA_FUNCTION`, `REMOTION_LAMBDA_SERVE_URL`, `REMOTION_LAMBDA_REGION` (default `"us-east-2"` in code). `lambdaConfigured()` stays as is.
- Output goes straight to the clips bucket via `outName: { bucketName, key }` — bucket and region from `src/lib/clips/storage.ts` (`CLIPS_BUCKET`, `pax-trinity-clips-613473203863`, us-east-2), key `rendered/<templateId>-<props hash>.mp4` (FNV hash from `src/lib/catalog.ts`'s `hash` over the canonical props JSON, so the same props are the same file). Return `{ url: `${CLIPS_CDN}/${key}`, key }` — `CLIPS_CDN` from `src/components/clips/catalog.ts`.
- Add `renderStillOnLambda` the same way for a poster: `rendered/<same name>.png`, frame = the composition's midpoint.
- `/api/video/render` (`src/app/api/video/render/route.ts`): when Lambda is configured, answer JSON `{ url, poster }`; the dev-local bytes path is unchanged. Add an auth gate: `currentUser()` from `@/lib/auth`, admin only, 401 otherwise — the route spends Lambda money and has no gate today.

## Step 3 — use case 1: the close mints the video

New `src/lib/results/video.ts`, `resultVideo(testId)`:

- Reads `latestResult(testId)` (`src/lib/results/complete.ts`). Builds lift-card props for the headline outcome — the best-performing arm against the placebo, lift in points — validated through `src/video/specs.ts` (read `src/video/templates/lift-card` for the spec's exact fields; invent nothing).
- Renders MP4 + poster via step 2, then writes the row once in the responses table (same table/client as `complete.ts`), partition `result:<testId>`, id `video`, with `key`, `poster`, `renderedAt`, written with a conditional put so overlapping ticks can't double-render or double-spend.
- Called from the end of `completeTest` (covering the admin close, the fielding close, and `POST /api/results/<test>` in one choke point), inside try/catch: a render failure must never block the result write or the report mail — log and move on. Skip when `lambdaConfigured()` is false.

In `src/lib/fielding/engine.ts`, the Analyst's `readout()` (or `finish()`, whichever reads cleaner against the written-once report): when the video row exists, the readout gains the poster image linking to the MP4 (`[![Result video](posterUrl)](mp4Url)`) and a plain "Result video:" link line under it. Confirm `lib/mail/design.ts` renders a markdown image; if it doesn't, add minimal `<img>` support there. That is use case 4.

## Step 4 — use case 2: chat's card

`src/components/chat/video-block.tsx`: beside "Open in Studio", an admin-visible "Get MP4" button that POSTs `/api/video/render` with the card's templateId + props, shows a working state, and on `{ url }` opens the link. No new design — the card's existing button style.

## Step 5 — use case 3: the pass

`scripts/results/render-videos.mjs`: for each closed test id it's given (args, or the known config ids in `src/lib/results/complete.ts`), `POST /api/results/<test>` against a base URL from argv — `completeTest` now mints the video idempotently, so the pass is just that loop. Document the one-line invocation in the report.

## Verify, then stop

- Vitest unit test for the props builder (pure function: ResultSet in, lift-card props out), run with the existing `vitest run`.
- One real Lambda render of lift-card from a real computed result (`src/lib/results/computed/` has them); put the output CDN URL and the poster URL in the report.
- Each step its own commit. Final report appended to `docs/migration/render-lambda-report.md`: what shipped, the URLs, the env vars and IAM production needs (top), what you did not do.
