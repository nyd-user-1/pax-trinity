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

(append here)
