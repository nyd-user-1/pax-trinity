# Brief F — Collection and analysis: the test→report spine

You are the audience-b window. Same ground rules: commit locally per feature, never push; no fabricated values; report appended below and a reply to lead-agent. New ground: this brief touches the Next app — stay strictly inside the paths named here; `/inbox` and `src/app/audience/` belong to another window.

## Part 1 — Collection (TypeScript + AWS)

The respondent flow at `src/app/t/[id]/flow.tsx` finishes a session by writing one JSON record to sessionStorage, with a marked TODO seam for the POST. Make it real:

1. **Storage:** DynamoDB table `pax-trinity-test-responses` (us-east-1, on-demand): pk `test` (string), sk `id` (string, a ULID or crypto id generated server-side). Create it with the AWS CLI. Grant the Amplify app's WEB_COMPUTE SSR role (app d7ae83v4rrcey) PutItem/Query on it — keys and IAM ship with the feature, live-parity from day one. Local dev uses the machine's credentials.
2. **Collector:** `POST /api/tests/[id]/responses` (`src/app/api/tests/[id]/responses/route.ts`): validates the record's shape against the flow's fields (arm, answers, watched, timestamps, code), rejects unknown test ids (the seeded test is `open-primaries-1` in `src/lib/tests/open-primaries.ts`), stamps server time, writes the item. No cookies, no IP stored. Payloads over ~20KB rejected.
3. **The seam:** in flow.tsx, POST the record at completion; keep the sessionStorage write; a failed POST must not break the respondent's completion screen (fire, retry once, then proceed — the code still shows).
4. **Monitor:** `GET /api/tests/[id]/monitor`, admin-gated with `requireAdmin` from `@/lib/auth`: per-arm counts of started (if derivable) and finished, and the entry-question distributions (party, vote2024) per arm so balance is visible. JSON only — a monitor page comes later with the Reports surface.
5. Verify end to end on the dev server (it is up on 3000): walk /t/open-primaries-1 with curl where possible, confirm an item lands in the table, confirm the monitor counts it.

## Part 2 — Analysis (Python, in `audience/`)

`audience/audience/analysis.py` + `python -m audience.analyze <test-id>`: reads every response for a test from the DynamoDB table (boto3), and produces one report JSON (`audience/reports/<test-id>.json`, gitignored artifact; the schema documented in the module docstring):

- Per arm × outcome: unweighted level and lift vs placebo; weighted level and lift with **raking weights from `get_population_targets`** (MA targets, the dims matching the entry questions); covariate-adjusted lift (Lin 2013 — regression with centered covariate interactions) with HC2 standard errors; p-value and the source's 90% criterion label (detectable / inconclusive).
- Holm correction across arms within an outcome, reported alongside the uncorrected flags.
- Subgroup lifts per entry-question dimension with cells under n=50 flagged, never dropped silently.
- Each lift placed with `place_lift` against the benchmark, caveat included.

**Validation before it's believed:** a simulator (`python -m audience.analyze --simulate`) that generates synthetic respondents with planted lifts (e.g. 6, 3, 0 pp) through the same analysis path, many runs; report the mean estimates against the planted truths and the 90%-interval coverage. The pax2 standard was ~40 simulated tests, estimates within ~0.1 of truth, coverage ≈ 89–90% — meet it or explain why not.

pytest for both parts where testable without AWS (shape validation, the Lin/HC2 math on a fixture, the simulator in miniature).

## Done means

A respondent walked on dev lands in DynamoDB and the monitor sees them; the analysis runs against whatever test responses exist (even a handful — and say so plainly in the report JSON's n fields); the simulator meets the bar; IAM live on the Amplify role; committed locally; report appended below.

---

## Worker report

**Done.** Commits `7d2a271` (collection), `e2ab0fc` (the fielding gate and catalog checks) and `8bdbf51` (analysis and simulator) on main, local, not pushed.

- **Collection:** a respondent walked on dev in headless Chrome lands in DynamoDB, and the monitor counts them.
- **IAM:** live on the Amplify app.
- **Analysis:** runs on the 3 real (dev) completes and says plainly that nothing can be estimated yet.
- **Simulator:** the headline estimator meets the pax2 bar (details below).
- **Tests:** pytest 148 passed, 3 Postgres skips.
- **TypeScript:** not type-checked locally. This machine's hook blocks `tsc` and `eslint` (memory), so the TypeScript was verified by the dev server compiling every route and the flow on request, plus the browser walks. The remote build is the type check.

### AWS (created with the CLI, account 638175140432)

| Resource | What |
|---|---|
| DynamoDB `pax-trinity-test-responses` (us-east-1) | on-demand; pk `test`, sk `id`; deletion protection on; tags project=pax-trinity |
| IAM role `pax-trinity-amplify-compute` | trust `amplify.amazonaws.com`; inline policy `pax-trinity-test-responses` = `dynamodb:PutItem` + `dynamodb:Query` on that table only (policy simulator: Scan, DeleteItem, UpdateItem and every other table denied) |
| Amplify app `d7ae83v4rrcey` | `computeRoleArn` set to that role (it had none before) |

audience-c later added its own inline policy `pax-trinity-tests` to the same role (GetItem, PutItem and Scan on its tests table). The role reaches the server on the next deploy; I deployed nothing.

To undo:
1. `aws amplify update-app --app-id d7ae83v4rrcey --compute-role-arn ""`
2. `aws iam delete-role-policy` for each inline policy, then `aws iam delete-role`.
3. Turn deletion protection off, then delete the table.

### Part 1: collection

- **`POST /api/tests/[id]/responses`** (`src/lib/tests/responses.ts` holds the validation and storage):
  - Resolves the test with `getTest(id)`: an unknown id gets 404 and a draft or closed test 409.
  - Bodies over 20 KB get 413 and non-JSON bodies 400.
  - Two body shapes: `{kind:"start", test, arm, pid, startedAt}`, and the record with `status` complete or screenout.
  - Every field is checked against the test's own record: the arm is in `test.arms`; a non-placebo arm is a playable clip in `@/components/clips/catalog`; `src` is exactly the video that arm plays; every answer is one of its question's choices (a screenout may stop early); `comprehensionCorrect` agrees with the answer; times are ISO and not in the future; `watched` is 0-1; `code` is 8 hex; `pid` is 1-128 characters without control characters.
  - Unknown fields are refused.
  - The server mints a ULID and receipt time and writes once (conditional put).
  - Stored: the answers, the pid and an `env` stamp (development | production). No cookie, IP or user agent.
- **`GET /api/tests/[id]/monitor`** (`requireAdmin`; others get 403): per arm, `started` / `finished` / `screenouts` / `target` / `completionRate`, and the party and 2024-vote balance (`{value: {n, share}}`) of those who finished; totals and items by env.
  - `started` is derivable because the flow now sends a start record when Start is pressed. Without it, attrition by arm, a basic validity check, would be invisible.
- **The seam in `flow.tsx`:**
  - Props are `{arm, pid, test: TestRecord}`: everything comes from the record, nothing from the static seed. The intro's question count follows the record too.
  - At completion: the sessionStorage copy is kept, the code shows at once, and the POST is sent with one retry 1.5 s later. A 4xx is not retried; `keepalive` is set. A `:delivered` yes/no flag goes into sessionStorage.
  - With `test.panel` and a pid, the respondent goes back to `panelRedirect(test.panel.completeUrl, pid)` once the post has had its try; otherwise the code screen shows as before.
  - `page.tsx` is audience-c's Brief G change, committed in `7d2a271` so the page and the Flow it renders landed together.
- **Amendments folded in:** the route rename (`/test/[id]`); `pid`; panel redirects; `status` complete | screenout; test-as-data with `getTest` validation; the fielding-only hard stop; catalog-checked arms.

#### Verified end to end on dev

- **curl:** the page draws an arm server-side and carries the pid. The start and the complete record both get 201, and both items are in the table. The rejections each return their own message:
  - unknown test 404; bad arm, unknown field, bad answer, future time, wrong src and not-JSON 400; oversize 413;
  - a draft and then a closed test 409, using a temporary item I put in the tests table and deleted.
- **Headless Chrome:** clicked Start, answered the entry questions, actually played the video at 16× until Continue unlocked, then answered the ballot and comprehension questions. Two walks, on the placebo and on `px-gaby`: start 201, complete 201, code shown, delivered "yes". A third walk with the collector blocked: each post tried twice, the code screen still shown, delivered "no", nothing written.
- **Table now:** 6 items, all `env: development`: 3 starts and 3 completes, pids `e2e-walk-1`, `browser-walk-1`, `browser-walk-2`.
- **Monitor:** started 3, finished 3, per arm placebo 1/1, px-gaby 1/1, px-msnow 1/1, the other two 0/0.

### Part 2: analysis (`audience/audience/analysis.py`, `python -m audience.analyze`)

The design (the report schema is in the module docstring):

- **Outcomes:** 0/100 per respondent, so lifts are percentage points against the placebo:
  - support = Yes on the ballot (No and Would not vote count as not Yes);
  - comprehension = the correct description.
- **Three estimators per arm and outcome:**
  - unweighted difference in means;
  - weighted: raked to Massachusetts ACS education from `get_population_targets` (BA and Grad pooled to the entry question's three categories; weights capped at 5× the mean, the design effect reported);
  - covariate-adjusted, the headline: Lin (2013), with centered dummies for all five entry questions and their interactions with the arm.
  - All with HC2 errors, normal p-values, and the 90% criterion (detectable when the 90% interval excludes 0).
- **Holm-adjusted p-values** and flags across arms within an outcome, per estimator, beside the unadjusted ones.
- **Subgroups:** lifts for every value of every entry question; every cell kept, those under 50 in either arm flagged.
- **Placements:** headline lifts are placed against PAX's own waves (`lift_support`, `lift_comprehension`) and, for support, the lift dataset's `lift_vote_choice_dichotomized`, each with its caveat.
- **Honest nulls:** anything the data can't support is null with the reason.
- **On today's data:** the report says "3 completed responses across 3 arms; 3 arm(s) have fewer than 50 completes, so their estimates are noise-dominated." Every lift is null with "needs at least 2 completes in the arm and the placebo (has 1 and 1)". `--env production` will drop the dev walks once real fielding starts.

#### Simulator

`python -m audience.analyze --simulate`:

- **Planted lifts:** 6, 3, 0 and −2 points on both outcomes.
- **Baselines:** depend on party, ideology, education and 2024 vote.
- **Skewed sample:** education is skewed off the targets (60% BA+ against a 46% target), so the weights move.
- **Same path:** every run goes through `analyze_items`, the code path a real test uses.

| Experiment | Runs × per arm | Estimator | Max \|bias\| | Mean \|bias\| | 90% coverage |
|---|---|---|---:|---:|---:|
| bias (pax2's ~40 tests) | 40 × 50,000 | adjusted (headline) | 0.099 pp | 0.065 pp | 91.2% ± 1.6 |
| | | unweighted | 0.109 | 0.067 | 90.9% ± 1.6 |
| | | weighted | 0.125 | 0.066 | 88.7% ± 1.8 |
| coverage (field size) | 1,000 × 500 | adjusted | 0.105 | 0.041 | 90.3% ± 0.3 |
| | | unweighted | 0.105 | 0.041 | 90.3% ± 0.3 |
| | | weighted | 0.140 | 0.067 | 90.4% ± 0.3 |

- **Bias:** the headline estimator meets the bar: every adjusted mean is within 0.1 pp of its planted lift after 40 tests. The unweighted and weighted maxima, 0.109 and 0.125, come from one simulated cell (comprehension, arm-b), shared by all three estimators because they analyze the same data. That cell is a 2.4-standard-error draw, consistent with eight cells' worth of Monte Carlo noise, not bias: in the 1,000-run experiment no cell is beyond 1.33 standard errors.
- **Coverage:** 90.3-90.4% ± 0.3 at a field-sized 500 per arm.
- **SE calibration:** reported SEs are 0.95-1.01× the actual spread of the estimates.
- **Bar caveat:** with 40 runs, "within ~0.1 pp" is only reachable at tens of thousands per arm, because one cell's mean moves by se/√40, about 0.5 pp at 500 per arm. I ran bias at 50,000 per arm and coverage at field size for that reason.

### Rulings needed

1. **Production AWS access beyond the test tables.**
   - Before this brief the Amplify app had no compute role, so in production every server-side AWS call had no credentials: the `pax2-ledger` table, S3 signed video links, and the rest.
   - The role I created covers only the two message-test tables.
   - Should those other grants join this role, or is a credential path I didn't see already handling them?
2. **Weighting targets for party and 2024 vote.**
   - Only education among the entry questions has an ACS/CVAP target, so the weighted estimate rakes to education alone. Party, ideology, 2024 vote and media trust are adjusted for (Lin) but not weighted to.
   - MA party enrollment counts registration, not self-identification. The 2024 presidential result plus CPS turnout could make a vote2024 target.
3. **The 6 dev items in the table.**
   - They are stamped `development`, and the analysis has `--env production`.
   - Deleting them needs my CLI user, since the app's role cannot delete. Keep them or delete them?
4. **YouTube-only clips can't be arms.**
   - The flow's video element can't play them, so the collector refuses such an arm rather than record a respondent stuck at "Keep watching".
   - No such clip is in the catalog today. The Brief G setup form should offer only clips with a playable `src`.
