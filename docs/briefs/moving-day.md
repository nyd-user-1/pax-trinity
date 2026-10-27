# Brief — Moving day: execute the migration tonight

You are the window named `moving-day`. The migration brief `docs/briefs/pax-migration.md` is the detailed spec — read it first; this brief sequences it and sets the deadline: **an Amplify URL Brendan can open in the morning and connect to Cloudflare.** Brendan's words stand: stopping, copying and moving — **delete or stop nothing in the old account**; additions there only where they enable the copy (a cross-account read grant on a bucket is fine).

Accounts: old `212598082342`, default profile, us-east-1. New `613473203863`, profile `pax-new`, us-east-2, IAM user pax-cli (AdministratorAccess). Free-plan credits — smallest viable everything, no NAT gateways, and verify the `pax-monthly-guard` budget alarm is alive when you're done.

## Priorities, in order

1. **Amplify app in the new account on `nyd-user-1/pax-trinity`, every env var enumerated.** Pull the old app's full config on the default profile (`aws amplify get-app`, `list-branches`, `get-branch`, env vars at both app and branch level) and copy **every variable by name** — a missing env var cost this house $300k on Friday; the report lists each name (values redacted to their first characters). For the repo connection, try the no-click path first: `gh auth token` gives Brendan's GitHub token, and the Amplify GitHub App may already be installed on the repo owner from the old account's app — try `create-app` with the token. If the console OAuth click is truly unavoidable: create and configure everything configurable anyway, and write an exact one-click runbook into the report (which screen, which button, what to pick), so morning-Brendan clicks once and watches it build.
2. **Know what the build will show.** Amplify builds from GitHub; local main is ~30 commits ahead of origin and **you do not push — nobody pushes without Brendan's word**. The morning build shows the last pushed state; say so plainly in the report.
3. **Audience bucket**: new bucket in us-east-2 mirroring `exports/` and `raw/`, public read on `exports/` exactly as the old bucket policy grants it. Copy everything; then **re-sync `exports/` at the very end of your run** — Window R uploads a regenerated `index.json` tonight (concordance) after Window-Q already replaced it once (ETag `ab69696b…`). Set the new app's audience-data rewrite/env to the new bucket.
4. **Clips media + CloudFront**: copy the clips bucket, stand up a distribution, and make the CDN host configurable — the one allowed app-code change (`src/components/clips/catalog.ts:63`): env-driven with the old host as default. Path-limited commit; check `git log -1` first — four windows share this checkout tonight; touch no other file in the repo.
5. **DynamoDB**: `pax-trinity-tests` (currently empty — recreate schema) and `pax-trinity-test-responses` (copy item by item). On-demand billing.
6. **IAM**: re-mint the app's runtime permissions in the new account per the migration brief; no old-account keys baked anywhere new.
7. **DNS/Cloudflare**: inventory only — list what points where today; Brendan connects Cloudflare himself in the morning.

## Done means

The report (below, or in pax-migration.md's report section — your choice, say where) with: the Amplify URL (or the one-click runbook), the env-var name list, bucket names + object counts + the final exports re-sync ETags, table item counts, the IAM shape, the DNS inventory, and every dollar-bearing resource created. Ping the lead (`pax-trinity-1c`) the moment the Amplify URL is live or the moment you're blocked on the OAuth click — don't sit on a blocker.

---

## Worker report
