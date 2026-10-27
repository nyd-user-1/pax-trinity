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

### The URL

**https://main.d2vlduiqvq0u36.amplifyapp.com**: Amplify app `d2vlduiqvq0u36`, account 613473203863, us-east-2, branch `main` (PRODUCTION, auto-build on). No console click was needed. `create-app` with `gh auth token` connected `nyd-user-1/pax-trinity` over SSH, the same clone method as the old app, and the push webhook works: the lead's pushes built jobs 2 and 3 on their own.

- It runs **origin/main `8cbaa14`**, job 3, the same commit as old-app job 29. Whatever is pushed is what both apps show. Every push now builds twice, once per app.
- Checked end to end from new-account resources:
  - `/`, `/audience`, `/clips`, `/lift` and `/signin` return 200. `/inbox-2` redirects 307 to `/audience`, as on the old app.
  - `/audience-data/index.json` and `/audience-data/q/acs/age_bucket.json` return 200 from the new bucket (the Last-Modified is my copy time, not the old object's).
  - `/clips` lists all 209 clip URLs on `d19bx9wfmnrb34.cloudfront.net`, the new distribution. A sampled clip plays with `video/mp4`.
  - Sign-in reaches Cognito ("No account with that email" for a probe address).
  - A test POST to `/api/tests/open-primaries-1/responses` (placebo arm, pid `moving-day-probe`) returned 201 and landed in the us-east-2 table stamped `env=production`, with nothing in the old table. I deleted it, and both tables read 6.

### Findings and the lead's rulings

1. **Old-prod sign-in was broken, and is now repaired.** `POST /api/auth/signin` on the old app returned 503 "Auth isn't configured in this environment."
   - Cause: Amplify gives console env vars to the build only, and nothing wrote them to `.env.production`, so the Next server never saw `AUTH_SECRET` or `PAX2_COGNITO_*`.
   - Both apps now carry one app-level buildSpec: Amplify's default steps, plus `env | grep -E '^(ADMIN_EMAILS|AUTH_SECRET|PAX2_COGNITO_CLIENT_ID|PAX2_COGNITO_DOMAIN|PAX2_COGNITO_POOL_ID|PAX2_REGION|PAX_TRINITY_TABLES_REGION)=' >> .env.production` before `npm run build`.
   - The lead ruled the old app gets it too. On `d7ae83v4rrcey` it was a buildSpec-only `update-app` at 06:42:20 UTC; I diffed every other field of the app against a snapshot and none moved.
   - The next auto-build (job 29, `8cbaa14`, 06:44:51) ran with it, and old-prod sign-in now reaches Cognito (400 "No account with that email" in place of the 503).
   - Side effects the lead accepted: `ADMIN_EMAILS` now gates admin (Brendan is admin), and `AUTH_SECRET` replaces the `"dev"` fallback in `consensus/ticket.ts`, so tickets minted under `"dev"` stop verifying.
2. **The test tables needed their own region.**
   - The new account sits under an org SCP (`p-qbiznb5q`, org `o-ed9y76h6ui`, owned by 212598082342) that denies regional services outside us-east-2. DynamoDB and Cognito are both denied in us-east-1 and us-west-2.
   - `PAX2_REGION` has to stay `us-east-1` for the Cognito pool. Login works across accounts because the SDK sends `InitiateAuth` unsigned (`smithy.api#noAuth`), so no IAM or SCP check applies.
   - The lead extended my allowance, and **`2dcb963`** (`src/lib/tests/store.ts` and `responses.ts`) reads `PAX_TRINITY_TABLES_REGION ?? PAX2_REGION ?? "us-east-1"`. The lead reviewed and pushed it in `8cbaa14`.
   - The new app sets `PAX_TRINITY_TABLES_REGION=us-east-2`. The old app leaves it unset and resolves exactly as before.
3. **The brief's old account number was wrong.** The default profile is **638175140432** (`user/2525-cli`), the account every old bucket is named for. 212598082342 is the organization that owns the new account's SCP.

### Env vars

The old app sets seven at app level and none at branch level. I copied all seven and checked them byte-identical by hash. The new app adds two.

| Name | Old app | New app | Where the new value comes from |
|---|---|---|---|
| `ADMIN_EMAILS` | `brenda…` | same | old value |
| `AUTH_SECRET` | `88…` (48 chars) | same | old value. Kept so tickets and email links signed under it stay valid in both apps. |
| `PAX2_COGNITO_CLIENT_ID` | `dvq0es…` | same | old value. The pool stays in the old account (see the note below). |
| `PAX2_COGNITO_DOMAIN` | `parall…` | same | old value |
| `PAX2_COGNITO_POOL_ID` | `us-eas…` | same | old value |
| `PAX2_REGION` | `us-east-1` | same | old value. It's Cognito's region. |
| `_LIVE_UPDATES` | Node 22 via nvm | same | old value |
| `NEXT_PUBLIC_CLIPS_CDN` | (none, so the old CDN by default) | `https://d19bx9wfmnrb34.cloudfront.net` | the new distribution (`1e562a8`) |
| `PAX_TRINITY_TABLES_REGION` | (none, so `PAX2_REGION`) | `us-east-2` | where the new tables live (`2dcb963`) |

On Cognito: the user pool stays in the old account, and the new app signs in against it with the same client. Copying the pool would orphan every existing login and every password. The pool is shared with pax2, so a pax2 sign-up exists here too, as it always has.

#### Read by the code, set in neither app

`git grep process.env` gives 55 names on origin/main, the same set as local main. None of these is set in either app. These are pre-existing gaps, and the copy reproduces them faithfully:

- **Defaults that name old-account private resources.** Neither compute role, old or new, grants any of these, so the features behind them fail in both apps:
  - `PAX2_BUCKET` (`pax-2-638175140432`), `VELOCITY_BUCKET` (`pax-2-velocity-…`), `CLIPS_BUCKET` (`govblock-clips-…`, used for uploads; playback goes through the CDN), `FORMS_BUCKET` (`livingston-bill-pdfs-…`)
  - `PAX2_LEDGER_TABLE` (`pax2-ledger`), `PAX2_HEADLINE_FN`, `PAX2_INGEST_FN` (Lambdas)
  - `POLICY_CLUSTER_ARN`, `POLICY_SECRET_ARN`, `POLICY_DATABASE` (Aurora Data API)
  - `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, `DISCORD_SECRET_ID`, `SLACK_BOT_TOKEN`, `SLACK_SECRET_ID` (SSM and Secrets Manager)
  - `AGENTCORE_WORKLOAD`, `GOOGLE_PROVIDER`
  - Bedrock: chat and scoring run under `PAX2_MODEL` / `PAX2_CHAT_MODEL` in `PAX2_REGION`, and neither role grants Bedrock. In the new account Bedrock would also need the us-east-2 region (the SCP), so it needs a second region variable before a grant would help.
- **Old-account public reads.** These work while the old buckets stay public:
  - `NEXT_PUBLIC_ASSET_BASE` defaults to `govblock-geo-638175140432/public`.
  - Hardcoded with no env var: `src/lib/geo.ts` (`govblock-geo-638175140432`) and `src/app/data-dictionary/dictionary-data.ts`. The latter reads `pax-trinity-audience-638175140432/exports` directly, so /data-dictionary on the new URL still reads the old bucket.
- **Keys in `.env.local` that neither app has.** Whatever needs them works locally and fails in prod:
  - `ELEVENLABS_API_KEY`, `EXA_API_KEY`, `HIGGSFIELD_API_KEY`, `KLING_API_KEY`, `RUNWAY_API_KEY`, `VEO_API_KEY`, `TAVILY_API_KEY`, `YOUTUBE_API_KEY`
  - `RESEND_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `PAX2_GOOGLE_CLIENT_ID`, `PAX2_GOOGLE_CLIENT_SECRET`, `AGENTS_ORIGIN`
  - Adding one means adding it to the app *and* to the buildSpec grep. `NEXT_PUBLIC_*` names need only the app.
- **Neither `.env.local` nor either app; the code default stands:**
  - `PAX2_URL` defaults to `http://localhost:3000`, so links in emails point at localhost in prod.
  - `PAX2_ORIGIN` defaults to `https://pax.nysgpt.com`, the pax-2 app's domain.
  - Also: `PAX2_MAIL_FROM`, `PAX2_MODEL`, `PAX2_CHAT_MODEL`, `PAX2_AUTOSCORE`, `PAX2_YOUTUBE_PRIVACY`, `PAX_TRINITY_TESTS_TABLE`, `PAX_TRINITY_TEST_RESPONSES_TABLE`, `BEDROCK_REGION`, `BRAVE_SEARCH_API_KEY`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `GOVBLOCK_INTERNAL_KEY`, `NEXT_PUBLIC_REMOTION_LICENSE_KEY`, `RESEND_FROM_EMAIL`, `SITE_ORIGIN`.
  - `AWS_REGION` and `NODE_ENV` are set by the platform.

### Buckets

The copy streams through this Mac's memory with boto3: read with the old profile, written with `pax-new`, carrying Content-Type and Cache-Control. Nothing is staged on disk. A server-side copy wasn't possible: the new account's org refuses outside principals. The old `2525-cli` admin was denied `ListObjectsV2` and `PutObject` on the new bucket even with an explicit bucket-policy grant, presumably a resource control policy. Objects under 64 MiB go up single-part, so their ETag is the MD5 and I compare it against the source's directly.

| Bucket (us-east-2) | Objects | Size | Verification against the old bucket |
|---|---|---|---|
| `pax-trinity-audience-613473203863` | 8,421 after the final re-sync (`exports/` 8,076: `index.json`, 41 row files, 8,034 `q/` files; `raw/` 343; `store/norms.duckdb`; `INVENTORY.md`) | 4.24 GiB | 8,421 = 8,421, no missing, no size mismatches, 8,393 MD5-comparable and all matching (the other 28 were multipart at the source, so I compared size). In `exports/` all 8,076 MD5-match. |
| `pax-trinity-clips-613473203863` | 209 | 1,253 MiB | 209 = 209, no missing, no size mismatches, 161 MD5-comparable and all matching (the other 48 were multipart at the source, so I compared size) |

- **Audience** matches the old bucket's posture exactly:
  - Public access block has BlockPublicAcls and IgnorePublicAcls on, BlockPublicPolicy and RestrictPublicBuckets off.
  - One policy statement, `PublicReadExports`: `s3:GetObject` on `exports/*` for `*`.
  - BucketOwnerEnforced, SSE-S3.
  - Checked: `exports/index.json` returns 200, `raw/…` returns 403, the listing returns 403.
- **Clips:** fully private (all four blocks on). Its only policy statement is `AllowCloudFrontOAC`, scoped to the new distribution's ARN. A direct S3 GET returns 403.
- **The final re-sync.** The concordance `index.json` that Window R started (Window-Q finished it under Brief U) landed in the old bucket at 07:17:24Z. My watcher saw it at 07:18:25Z, waited until it held steady (07:21:26Z), and re-synced the whole bucket. That copied 126 objects, 23 MiB, with no failures: `exports/index.json` plus Window-Q's 125 new raw files (`raw/gss/key_trends/key_trends.json`, `raw/anes/guide/guide.html` and `raw/anes/guide/top_tables/1–123.html`).
  - `exports/index.json` is now **`2be2425c0d0d954a8250ec235e79227c`**, 4,832,545 B, `application/json`. The old bucket, the new bucket and the new URL's `/audience-data/index.json` all serve that ETag. It replaced `ab69696b…`, 4,564,482 B.
  - The 41 row files and 8,034 `q/` files were unchanged, as Window-Q reported, and still MD5-match.

Uploads after the move: the new `pax-audience-uploader` profile (below) writes this bucket. Until the audience windows switch over, they keep writing the old bucket, and anything they upload after my final re-sync isn't in the new one. The cutover is the lead's call. A worker's command becomes `AWS_PROFILE=pax-audience-uploader aws s3 sync … s3://pax-trinity-audience-613473203863/…`. To catch up again, re-run `copy_bucket.py` (below) with the `exports/` prefix. It copies only what differs.

### CloudFront

- Distribution `EUGIR076RGLKV`, **`d19bx9wfmnrb34.cloudfront.net`**. Same behavior as the old `E1KWOUYTX2OF63`:
  - one S3 origin `clips-s3` on `pax-trinity-clips-613473203863.s3.us-east-2.amazonaws.com`
  - OAC `EANKQCMTZI1EK` (sigv4, always sign)
  - managed CachingOptimized (`658327ea…`), redirect-to-https, GET/HEAD only, no compression, http2, IPv6
- One change: PriceClass_100 instead of PriceClass_All, the smallest viable. It only affects viewers outside North America and Europe.
- Checked: a clip returns 200 with `video/mp4` and `public, max-age=31536000, immutable`, the same as the old CDN.

### DynamoDB (us-east-2, on-demand)

| Table | Key | Items old → new |
|---|---|---|
| `pax-trinity-tests` | `id` (S) | 1 → 1, identical. The brief had it empty; it now holds `open-primaries-1`, status fielding. |
| `pax-trinity-test-responses` | `test` (S) + `id` (S) | 6 → 6, identical. These are the dev walks, `env=development`. |

The comparison is a typed-attribute scan of both sides. TTL is off and there are no streams, as in the old tables. The old tables are untouched.

### IAM (new account)

- **`role/pax-trinity-amplify-compute`**: the new app's SSR compute role. It trusts `amplify.amazonaws.com`, the same as the old role, and has the same two inline policies re-pointed at us-east-2:
  - `pax-trinity-tests`: GetItem, PutItem, Scan
  - `pax-trinity-test-responses`: PutItem, Query
  - It has no keys. The old role grants nothing more (no Bedrock, no S3), and neither does this one.
- **`user/pax-audience-uploader`**: the uploader for the audience bucket. Inline `pax-trinity-audience-bucket` grants ListBucket and GetBucketLocation on the bucket, and Get, Put and Delete on its objects.
  - Its one access key went straight into `~/.aws/credentials` as profile `pax-audience-uploader` (region us-east-2). The secret never left that file.
  - Checked with `sts get-caller-identity` and a listing.
- No old-account key exists anywhere in the new account or the new app.

### DNS

- `nysgpt.com` is on **Cloudflare** DNS (`sonia` / `seamus.ns.cloudflare.com`). There are no Route 53 hosted zones in either account.
- **The old pax-trinity app has no custom domain.** It's reachable only at `main.d7ae83v4rrcey.amplifyapp.com`.
- `pax.nysgpt.com` belongs to a different app: CNAME `d13j7kgy0gyw1m.cloudfront.net`, the **pax-2** app `d19l6hnxwmfb25` (repo `pax2`).
- The other nysgpt.com names in the old account are out of scope:
  - apex and `www`: nysgpt app `d3etwd4srq8khx`
  - `policy`, `gov`, `govblocks`, `44gov`, `lab`: govblock app `d2a69zdzqun8m7`
  - `buckets`: `d33wlkvxg20gld`
  - `solar`: `d2bart0mempmp5`, status FAILED

Connecting a name in the morning takes three steps:

1. Run `aws amplify create-domain-association --profile pax-new --region us-east-2 --app-id d2vlduiqvq0u36 --domain-name nysgpt.com --sub-domain-settings prefix=<name>,branchName=main`. The console route is App → Hosting → Custom domains → Add domain.
2. Amplify returns two CNAMEs: the ACM validation record and `<name>` → a CloudFront host. Add both in Cloudflare, **DNS only (grey cloud)**, so ACM can validate.
3. `get-domain-association` turns AVAILABLE within minutes to an hour.

Using `pax` would mean taking it off the pax-2 app first. That's a separate decision.

### What I changed, by account

- **Old account (638175140432):**
  - One change, by the lead's ruling: the buildSpec on Amplify app `d7ae83v4rrcey`. Before it, the app had no stored spec. Nothing else on the app moved.
  - I didn't trigger any job; the lead's push built job 29.
  - Otherwise only reads, plus about 5.5 GiB read out of its two buckets for the streamed copy. S3 egress sits inside AWS's 100 GB-a-month free allowance, worst case about $0.50.
  - Nothing deleted, stopped or re-permissioned.
- **New account (613473203863):** everything listed above. The `MigrationCopyFromOldAccount` grants I tried on the two new buckets didn't work, and I removed them, so each bucket's policy is exactly what's listed.
- **Repo:** `1e562a8` (`src/components/clips/catalog.ts`) and `2dcb963` (`src/lib/tests/store.ts`, `src/lib/tests/responses.ts`). Both are path-limited, and the lead pushed both.
- **This Mac:** profile `pax-audience-uploader` in `~/.aws/credentials` and `~/.aws/config`. The copier is in this session's scratchpad (`copy_bucket.py`, `SRC DST [PREFIX] [--workers N] [--verify-only]`).

### Dollar-bearing resources created (new account)

| Resource | Cost driver | Expect |
|---|---|---|
| Amplify app `d2vlduiqvq0u36` | build minutes ($0.01/min on STANDARD_8GB, about 3 min per build, one per push), SSR requests and duration, hosting storage | about $1–3/month at current traffic |
| S3 `pax-trinity-audience-613473203863` and `pax-trinity-clips-613473203863` | about 5.5 GiB storage, plus about 8,500 PUTs once | about $0.13/month, $0.05 once |
| CloudFront `EUGIR076RGLKV` | per GB served and per request | $0 inside the always-free 1 TB and 10M requests |
| DynamoDB `pax-trinity-tests` and `pax-trinity-test-responses` | on-demand, under 2 KB | about $0 |
| IAM role and user | free | $0 |

No NAT gateways, no EC2, nothing that runs idle.

The `pax-monthly-guard` budget is alive: $20/month, an ACTUAL > 80% email to `bre…@nysgpt.com`, state OK, $0.00 spent at the time of the final check.
