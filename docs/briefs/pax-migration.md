# Brief: copy pax-trinity to the new AWS account, end to end

You are an Opus window taking the migration brief. The mission in Brendan's words: **"We're not moving and deleting — we're just stopping, copying and moving."** Make a complete, working copy of pax-trinity's runtime in the new AWS account, so development resumes there. **You delete nothing, change nothing, and stop nothing in the old account** — it keeps running untouched; leuk and govblock live there and are out of scope entirely.

Ground rules as the other briefs: commit locally by explicit path (`git commit <paths>`), never push, never run builds or a second dev server on this Mac (the :3000 dev server is Brendan's), report appended below. Cost Explorer and read-only calls are free game on both accounts.

## The accounts

- **Old (source): 212598082342** — the default CLI profile. Read-only for you, with one exception: you may ADD things that enable copying (a bucket policy statement granting the new account read, a DynamoDB export) — additions only, nothing modified or removed.
- **New (target): 613473203863** — CLI profile `pax-new`, region **us-east-2**. $200 credits, free plan to 2027-04-26, a $20/month budget alarm already set. Bedrock Anthropic access already live (Haiku 4.5 and Sonnet 4.6 verified by invocation). IAM user pax-cli has AdministratorAccess.

## What to copy

1. **The audience data bucket** — `pax-trinity-audience-638175140432` (us-east-1): every prefix — `exports/` (index.json + the 41 row files + all 8,034 `q/` files), `raw/`. Create the new bucket in us-east-2 with the same public-read posture on `exports/` only; sync; verify object counts and spot md5s match. Keep the bucket name pattern (`pax-trinity-audience-613473203863` or similar) and report it.
2. **The clips media** — the private S3 bucket behind the clips CloudFront distribution (find it from the distribution's origin) plus a new CloudFront distribution in the new account with the same behavior (private origin, OAC, same cache posture). The new CDN hostname will differ: find where the app holds the old one (env var or constant), make it configurable if it is hardcoded, and set the new value — the one code change this brief allows, committed by explicit path.
3. **DynamoDB** — `pax-trinity-test-responses` and the tests table (confirm exact names from the code: src/lib/tests/store.ts). Create the tables in us-east-2 with the same key schema and on-demand billing; copy the items (they are small — a scan-and-put copy is fine); verify item counts.
4. **IAM for the app** — recreate what the app and collectors need in the new account: the scoped role/keys the collector route uses for DynamoDB, and an uploader principal for the audience bucket (what the worker windows use). New keys; report where each goes.
5. **Amplify** — a new Amplify app in the new account on the same GitHub repo (`nyd-user-1/pax-trinity`, branch main) with:
   - **Every environment variable enumerated.** Read the old app's env vars (`aws amplify get-app` / `get-branch` on the old account) and list them name by name in the report with where each new value comes from (same value, new-account key, or new CDN hostname). Missing env vars in prod is the house's $300k lesson — this list is the heart of the brief.
   - The `/audience-data/*` rewrite pointed at the NEW bucket.
   - The GitHub connection is the one step that needs Brendan's hands (OAuth in the console). Prepare everything to the point where his click is the only gap, then message the lead session (pax-trinity-1c) to get him.
6. **DNS/domain** — inventory only: find where the app's domain lives (old-account Route 53? external registrar? Amplify default domain only?) and report the exact repointing step. Do not repoint; Brendan decides when the copy is verified.

## Explicitly out of scope

- Anything leuk or govblock. The old account's audit (docs/briefs/aws-cost-audit.md) and its rulings are a separate track.
- The consensus-pages consolidation (four pages into one /consensus with Surveys | Questions | Results | Admin tabs) — recorded as the first development task AFTER the move; not part of the copy. Copy the app as it stands.
- Deleting or stopping anything, anywhere.

## Done means

The new Amplify URL serves the app end to end from new-account resources alone: /inbox-2 lists questions from the new bucket's index, opening one fetches its `q/` file, /audience renders, a clip plays through the new CloudFront, and a test POST writes to the new DynamoDB (then remove the test item). Old account byte-for-byte untouched except the copy-enabling additions, each named in the report. Report below: every new resource name/URL/hostname, the env var table, object/item count verifications, the domain repointing step, and rulings for the lead.

---

## Worker report

*(append here)*
