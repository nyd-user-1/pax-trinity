# Brief J — The rest of the ANES

You are the audience-j window, in the Next app at /Users/brendanstanton/Code/pax-trinity. Ground rules: commit locally per feature, never push; stage by explicit path, never `-A`; stay strictly inside the paths named here. Yours: `audience/**`, `public/audience-data/**`, and this file's Worker report. Off limits: everything under `src/` (the lead's surfaces), `src/registry/`, and the other briefs. Never run tsc, a Next build, or a dev server on this 8GB Mac — a hook blocks the typecheck tool names, including in heredocs. Verify with pytest and by reading the regenerated JSON. Your report is appended under "Worker report" at the end of this file, with commit hashes. Rulings and seam conflicts route to the lead session, not to other windows.

## The lock — read this before anything else

Three sibling windows (GSS, CES, CPS) run tonight against the same checkout, the same single-writer DuckDB store, and the same 8 GB of memory. **One window computes at a time.** Before you read a raw frame, load, or export: create `audience/store/.lock` containing your window name; if the file exists, sleep sixty seconds and try again, as long as it takes. Hold the lock for your whole run — fetch, frame, load, export regeneration — then delete it before committing. If you find a lock older than two hours with no commits landing, name it in your report and keep waiting; the lead rules on stuck locks.

## What this is

The ANES folder holds 13 harmonized constructs from the 1952–2024 time-series cumulative file, which carries on the order of a thousand variables, already downloaded under `audience/raw/anes/`. This brief widens what is read, exactly on Brief I's pattern (read `docs/briefs/audience-i.md` for the full rationale; it governs where this brief is silent).

Read first: `audience/audience/loaders/anes.py` whole, `audience/audience/survey.py`, `audience/audience/export.py`, and one committed export file.

## 1. The bulk tier

Keep the 13 harmonized constructs exactly as they are. Add a bulk tier: **every variable in the cumulative file, whatever study year it was asked in** — that qualifies:

- Categorical with 2 to 24 labeled categories. Continuous variables (thermometers excepted — they are already in the 13 — dollar amounts, counts) are skipped; no invented banding.
- Not administrative: skip ids, weights, strata and PSU variables, interview mode and paradata, open-ended codes.
- Not already one of the 13 (collisions skipped and named in the report).

Per qualifying variable: construct id = the ANES variable code lowercased (VCF0876 style); label = the file's variable label, sentence-cased; definition = the same label verbatim (bulk definitions are labels, not questionnaire wordings — say so in the report). Bands = the value labels in coded order, missing codes excluded. Rows: weighted topline shares for every study year asked, national; the standard breakdowns (age, education, party, race, sex, as the loader's existing recodes define them) for the latest year asked. Kish-effective-n margins, unweighted n, cells under n=50 dropped and named. provenance_url: the variable's page or search on electionstudies.org.

Do not hand-edit `audience/audience/constructs.py` for bulk variables — thousands of entries do not belong in a hand-kept file; register bulk labels and definitions from the loader so they reach the index without touching the shared module.

## 2. All the data it can

If the raw directory holds only the cumulative file and the standalone 2024 time-series study adds variables the cumulative lacks, fetch it (it is public) and fold its qualifying variables in, flagged `2024 study only` in the report. Sync anything newly fetched to `s3://pax-trinity-audience-638175140432/raw/anes/` with the AWS CLI.

## 3. Export and bounds

Regenerate the export under the lock. The 13-element row contract and index.json's shape must not change; the splitter parts a source at 4MB. The regenerated shared files (index.json and siblings) will carry earlier windows' landed work — stage them anyway and say so in the commit. **If the ANES set exceeds 25 MB on disk, write the files but do not commit them to git**: sizes in the report, serving to the lead as a ruling.

## 4. Checks

pytest: spot-check two bulk variables' toplines against published ANES figures (the ANES data center or the codebook's marginals), in the loader's existing test style; keep the existing ANES tests green.

## Done means

The committed export serves the 13 harmonized constructs unchanged plus the bulk tier; counts, sizes, skips, spot-checks and lock waits are in the report with commit hashes; nothing outside your paths moved.

---

## Worker report

(appended by the worker)

**Landed:** `23c146f` (the bulk tier in the store, its tests, the README). The export is written but not committed: the ANES set is 30.6 MB, past the 25 MB gate, so serving goes to the lead as a ruling (below).

**Counts.** The 13 harmonized constructs are unchanged. Their 26,593 rows regenerate identical to the committed export, row for row, and `anes.json` comes out byte-identical. The bulk tier adds 1,505 constructs and 126,310 rows. ANES now holds 152,903 rows.

- **Cumulative file:** 648 variables (567 categorical, 81 feeling thermometers as means), 71,861 rows, 1948–2024. VCF0009z is 1.0 for every 1948 case, so the toplines reach 1948.
- **2024 study only:** 857 variables (828 categorical, 29 thermometers), 54,449 rows, from the standalone 2024 Time Series Study (release 2026-05-19). These are the variables no cumulative-file entry draws on in 2024. They carry their own `source_version` ("ANES 2024 Time Series Study, release 20260519"), keep "PRE:"/"POST:" in their definitions, and their concordance note says "2024 study only." Their breakdowns are the cumulative file's own recodes of the same people, matched on case id (all 5,521 matched). Their weights are V240107a (pre-election) and V240107b (post-election), the ones the ANES variable pages use.
- **Definitions are labels, not questionnaire wordings.** Label = the Stata variable label sentence-cased; definition = that label verbatim. The cumulative codebook's HTML release does print a question wording for each variable, so wordings could be parsed in a later pass if the lead wants them.
- **Bands** are the value labels in coded order, recorded in `response_order` (the GSS tier's migration 007). Where the Stata file cuts a label short (VCF0838's abortion options end mid-sentence), the band takes the codebook's full text. A scale labeled only at its ends keeps every point, the GSS way: "1 (Government insurance plan)", "2" … "7 (Private insurance plan)".
- **Out of the base:** don't know, refused, NA, the codebook's missing codes, every negative code (the 2024 data leak -1, -2 and -4 into some cumulative variables unlabeled), and stray unlabeled codes held by five or fewer people. "Haven't thought much about it" stays in, as in the harmonized ideology item.
- **Toplines** cover every year asked. Breakdowns (sex, age, race_eth, educ, party, as the loader already recodes them) cover the latest year with a stored topline. A variable never gets a breakdown by its own dimension (VCF0104 has no sex breakdown). Cells under n=50 are dropped and named on the topline.
- **Provenance:** 491 cumulative variables and all 857 2024-study variables link to the ANES variable page of the question as last asked (`electionstudies.org/data-tools/anes-variable/variable.html?year=…&variable=…`). The 157 last asked before 1992 have no such page; they link to the cumulative codebook with the variable as a text search.

**Skips** (full lists in `audience/reports/anes_bulk.json`):
- **Cumulative file:** 214 open-ended codes (the MENTION variables, collapsed or not, and the full-code ones); 64 counts; 33 administrative; 17 interview mode or paradata (including the interviewer's rating of the respondent's political information, VCF0050a/b); 9 derived thermometer averages and indexes; 14 continuous or over 24 categories (age, prestige scores, the 0–100 efficacy and trust indexes, House and Senate race types, length of residence); 2 with no substantive answers.
- **Already harmonized (named, per the brief):** the 30 variables the 13 read are skipped: VCF0218, VCF0224, VCF0301, VCF0354, VCF0356, VCF0357, VCF0366, VCF0368, VCF0369, VCF0604, VCF0609, VCF0611, VCF0613, VCF0614, VCF0803, VCF9013–VCF9018, VCF9209–VCF9216, VCF9252. No bulk id collides with any existing construct.
- **2024 study:** 315 administrative (sample, weights, admin, randomization, interviewer self-description); 194 carried by the cumulative file; 84 paradata (mostly interviewer observations); 81 RESTRICTED (withheld from the public file); 75 open-ended; 73 with no substantive answers (mostly items withheld for a data error, and the GSS-crossover items, which are empty in this file); 28 "PAPER:" duplicates (below); 9 counts; 5 continuous or over 24 categories; 17 with no year reaching n=50 (special-election Senate items and the like).

**Spot-checks** (`tests/test_anes.py`, against the ANES Data Explorer's published 2024 weighted frequencies, matching to 0.1): VCF0876 (law protecting gays and lesbians against job discrimination), VCF0806 (government health insurance scale, including its unlabeled middle points and the "haven't thought" band), and two 2024-only items: V241383 (same-sex marriage, pre-election weight) and V242235 (immigrants good or bad for the economy, post-election weight). The CDF checks also confirm VCF0009z equals the study's pre-election weight in 2024. All 20 ANES tests pass (the existing seven included), as do the shared bulk, survey, store and export tests.

**Lock and fetch:** I waited 33 minutes for audience-i (05:27–06:00), held the lock 06:00–06:14, then released it before committing. No stale lock. I fetched the 2024 study zip and the cumulative codebook's HTML release; both sit in `raw/anes/` and are synced to `s3://pax-trinity-audience-638175140432/raw/anes/`.

**For the lead:**
1. **Serving ruling.** The ANES files run to 30.6 MB: `anes.json` (unchanged), `anes-2.json` (changed), `anes-3…8.json` (new), all left uncommitted. `index.json` in the working tree lists those parts, and GSS's untracked `gss-3…19.json` too. Any window that commits `index.json` as it stands commits references to files not in git. I committed nothing under `public/`.
2. **Thermometers.** I read "thermometers excepted" as keeping them: 110 group, candidate and person thermometers come in as means, beside the two harmonized party thermometers. Dropping them is a one-line change.
3. **"PAPER:" variables.** 28 2024-study variables repeat a question for only the ~245 paper-questionnaire respondents. I skipped them as mode duplicates. The "SPS:" module (a random subset of 987 fresh-sample respondents) stays in.
4. **Post-election items in the cumulative file** take VCF0009z, which is what their codebook entries and the harmonized 13 use, even though the file now also carries a post-election weight, VCF9999.
5. **Source label.** ANES's label in `index.json` still reads "Cumulative Data File" though the source now carries the 2024-only slice. The label comes from the migration-seeded sources table, which is outside what I touched.
6. **`SEGMENT_SEED`** in `src/app/audience/audience-data.ts` still says ANES: 13; the final count is 1,518 (13 harmonized plus 1,505 bulk).
7. **README.** The CES window's README edits are uncommitted in the shared file. I staged only my two README changes and left theirs in place.

## Lead rulings (new-lead, 06:33)

1. **Serving:** Brief I's ruling governs — exports to S3 behind the Amplify rewrite on the same path; nothing past the gate into git; index.json commits wait for the lead's serving build, which follows the last window.
2. Thermometers in as means: kept, as you read it.
3. The PAPER duplicates skipped, SPS kept: approved.
4. VCF0009z for the cumulative post-election items: approved.
5. The sources-table label ("Cumulative Data File"): the lead updates it with the serving build.
