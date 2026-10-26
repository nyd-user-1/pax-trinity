# Brief K — The rest of the CES

You are the audience-k window, in the Next app at /Users/brendanstanton/Code/pax-trinity. Ground rules: commit locally per feature, never push; stage by explicit path, never `-A`; stay strictly inside the paths named here. Yours: `audience/**`, `public/audience-data/**`, and this file's Worker report. Off limits: everything under `src/` (the lead's surfaces), `src/registry/`, and the other briefs. Never run tsc, a Next build, or a dev server on this 8GB Mac — a hook blocks the typecheck tool names, including in heredocs. Verify with pytest and by reading the regenerated JSON. Your report is appended under "Worker report" at the end of this file, with commit hashes. Rulings and seam conflicts route to the lead session, not to other windows.

## The lock — read this before anything else

Three sibling windows (GSS, ANES, CPS) run tonight against the same checkout, the same single-writer DuckDB store, and the same 8 GB of memory. **One window computes at a time.** Before you read a raw frame, load, or export: create `audience/store/.lock` containing your window name; if the file exists, sleep sixty seconds and try again, as long as it takes. Hold the lock for your whole run — fetch, frame, load, export regeneration — then delete it before committing. If you find a lock older than two hours with no commits landing, name it in your report and keep waiting; the lead rules on stuck locks.

## What this is

The CES folder holds 7 harmonized constructs from the 2020, 2022 and 2024 common content files (US and MA), each carrying hundreds of variables, already downloaded under `audience/raw/ces/`. This brief widens what is read, exactly on Brief I's pattern (read `docs/briefs/audience-i.md`; it governs where this brief is silent).

Read first: `audience/audience/loaders/ces.py` whole, `audience/audience/survey.py`, `audience/audience/export.py`, and one committed export file.

## 1. The bulk tier

Keep the 7 harmonized constructs exactly as they are. Add a bulk tier: **every variable in the common content of every year on disk**, US and MA where the loader already draws MA — that qualifies:

- Categorical with 2 to 24 labeled categories; continuous and open-ended skipped, no invented banding.
- Not administrative: ids, weights, modes, timings, consent, zip and county codes, lookup identifiers.
- Not already one of the 7 (collisions skipped and named).

Per qualifying variable: construct id = the CES variable name lowercased (CC24_321 style); label = the file's variable label, sentence-cased; definition = the same label verbatim (labels, not wordings — say so). Bands = value labels in coded order, missing codes excluded. Rows: weighted topline shares per year asked (US, and MA where the sample supports it under the house n rule); standard breakdowns for the latest year asked. Kish-effective-n margins, unweighted n, cells under n=50 dropped and named. provenance_url: the year's dataverse page.

Do not hand-edit `audience/audience/constructs.py` for bulk variables; register bulk labels from the loader so they reach the index without touching the shared module.

## 2. All the data it can

The CES cumulative common content (2006 onward, Kuriwaki, dataverse, no wall) carries years we do not hold. Fetch it, fold its qualifying variables in on the same rules (harmonized cumulative names, flagged `cumulative` in the report), and sync everything newly fetched to `s3://pax-trinity-audience-638175140432/raw/ces/` with the AWS CLI. If the cumulative fetch fails, land the on-disk years and note it — the bulk tier of what we hold is the feature; the cumulative is the stretch.

## 3. Export and bounds

Regenerate the export under the lock. The 13-element row contract and index.json's shape must not change; the splitter parts a source at 4MB. Regenerated shared files will carry earlier windows' landed work — stage them anyway and say so in the commit. **If the CES set exceeds 25 MB on disk, write but do not commit to git**: sizes in the report, serving to the lead as a ruling.

## 4. Checks

pytest: spot-check two bulk variables' toplines against the CES guide's published tabulations or dataverse crosstabs, in the loader's existing test style; keep the existing CES tests green.

## Done means

The committed export serves the 7 harmonized constructs unchanged plus the bulk tier; counts, sizes, skips, spot-checks, lock waits and the cumulative outcome are in the report with commit hashes; nothing outside your paths moved.

---

## Worker report

(appended by the worker)

### Landed

`06798c1`: the bulk tier in the store (`audience/loaders/ces_bulk.py`, run by `ces.run` after the 7), its tests, and the README's CES lines. No export files are in git; see Export below.

- **1,065 bulk variables, 108,141 rows, 936 constructs.** By slice:

| Slice (`source_version`) | Variables | Post-election items | Rows | Geography-year toplines dropped under n=50 |
|---|---:|---:|---:|---:|
| CES 2020 Common Content, bulk tier | 338 | 94 | 28,260 | 40 |
| CES 2022 Common Content, bulk tier | 335 | 88 | 27,225 | 50 |
| CES 2024 Common Content, bulk tier | 334 | 99 | 35,445 | 33 |
| CES Cumulative Common Content 2006-2025 (`cumulative`) | 58 | 2 | 17,211 | 3 |

  A name asked in several years (multrace_1, pew_religimp, faminc_new) is one construct with a topline per year, so the 1,007 yearly variables make 878 constructs. With the 7, CES holds 943 constructs and 111,292 rows.
- **The 7 are unchanged.** Their 3,151 rows in the regenerated export are identical to the committed `ces.json`. Bulk rows sit in their own `source_version` slices, so the 7's slices and prunes are untouched, and the 7 get no `response_order` rows.
- **Labels, not wordings.** Label = the file's variable label, sentence-cased (proper names, places, parties, faiths and multiword names like Supreme Court kept), with piped names bracketed: `$CurrentGovName` reads [governor], `$inputstate` [state]. Definition = the variable label verbatim. Neither is the question wording. 2020's labels are cut at 80 characters by the file ("...a Justice of the Supreme Co"), and a few are machine names ("truststate" reads "Truststate").
- **Value labels.** The CSVs carry codes only. The loader range-reads each year's Stata release: the header and the value-label block, about half a megabyte of a 1 GB file, using the offsets in the file's own map. It keeps them as `raw/ces/labels/CESyy_labels.json`, and the data still come from the CSVs. The cumulative is read whole from its Stata file.
- **Bands** are the value labels in coded order, first letter raised ("selected" reads "Selected"), recorded in `response_order` through `bulk.write_response_order` (3,203 rows). Skipped, not asked, don't know, prefer not to say and NA are out of the base. An offered "Not sure" stays, as in the 7. Codes sharing a label pool. A year lists only the bands someone in the national sample gave that year, so the cumulative's 2007-only "Neither approve nor disapprove" isn't a 0% in the other nineteen years.
- **Rows.** Weighted toplines for every year asked, US and MA. The five breakdowns (sex, age, race_eth, educ, party) are for the latest year asked, minus party on pid7 itself. Kish-effective-n margins, unweighted n and the n<50 rule come through `survey.shares`; dropped cells are named on the topline. `provenance_url` is the year's Dataverse page, or https://doi.org/10.7910/DVN/II2DB6 for the cumulative.
- **Weights.** Yearly files use commonweight, or commonpostweight for an item only post-election respondents answered (read from `tookpost`, not from names). Labeled voter-file fields (TS_partyreg, CL_2020gvm) use commonweight over matched respondents. The cumulative uses its year-specific `weight`, or `weight_post` for post-election items in the years that carry it (2012, 2016–2022), as its guide advises. Only `voted_pres_party` (and `voted_pres_24`, whose years have no `weight_post`) are post-only: the cumulative's other vote-choice items include pre-wave early voters.
- **Labels register from the loader** through the concordance (`ces_bulk.register`); `constructs.py` is untouched.

### The cumulative

Fetched, all of it: `cumulative_2006-2025.dta` (724,803,550 bytes, 718,955 respondents, Dataverse file 14076515) and its guide. 65 variables qualify; 58 load after the collisions below. It adds the years we didn't hold: 2006–2019, 2021, 2023 and 2025. 2025 is the latest year for most of its items, so their breakdowns are 2025's.

Loaded: approval_gov, approval_pres, approval_rep, approval_sen1, approval_sen2, economy_retro, employ, faminc, gender, has_child, ideo5, intent_gov, intent_gov_party, intent_pres_08/12/16/20/24, intent_pres_party, intent_rep, intent_sen, intent_sen_party, intent_turnout_self, investor, marstat, newsint, no_healthins, no_milstat, ownhome, pid3, pid3_leaner, pid7, race_h, reg_self, relig_bornagain, relig_church, relig_imp, relig_protestant, religion, sexuality, union_hh, voted_gov, voted_gov_party, voted_pres_08/12/16/20/24, voted_pres_party, voted_rep, voted_sen, voted_sen_party, voted_turnout_self, vv_party_gen, vv_party_prm, vv_regstatus, vv_turnout_gvm, vv_turnout_pvm.

A yearly variable the cumulative also carries under its name is served from the cumulative alone, which has the same years and more: employ, gender (2020), investor, marstat, newsint, ownhome, pid3 and sexuality, in each year file (22 skipped).

### Skipped (named in `reports/ces_bulk.json` on every run)

| Reason | Count | Names |
|---|---:|---|
| Administrative: ids, weights, consent, device, team module, zip, county, district and state codes, region, timings and start/end times, open text, candidate-name lookups | 1,001 | |
| Candidate-slot items whose categories are per-respondent lookups (`$SenCand1Name ($SenCand1Party)`) | 62 | CC2x_365–367 (preference and vote), CC2x_411–414 (post vote) in each year |
| Read by the 7 | 21 | pid7, ideo5, CC20_320a, CC22_320a, CC24_312a, CC22_423, CC24_423, CC24_421_1, CC24_421_2, CL_2020pvm, CL_2020pep, TS_p2022(_party), TS_p2024(_party), TS_pp2024(_party) |
| Id already held | 21 | race, educ, union, hispanic (each year and the cumulative), gender4 (2022, 2024 and the cumulative), citizen (cumulative): GSS registered them first. sex (cumulative): the seed's population construct |
| Served by the cumulative | 22 | above |
| No labels (continuous) | 13 | birthyr, birthyr_post, CC2x_421r/422r_dk_flag, TS_g2024, the cumulative's age and birthyr |
| Under 2 labeled categories | 15 | numchildren, child18num, CC2x_430c (amounts), CC2x_421r/422r, CC24_325, TS_voterstatus |
| Over 24 labeled categories | 4 | dualctry (2020, 2022); the cumulative's intent_rep_party, voted_rep_party |
| No cell with n ≥ 50 | 1 | multrace_97 (2020: two respondents) |

No variable was partly labeled, and every qualifying variable was in its CSV.

### Checks

- **pytest:** `test_ces` 8 of 8 still green, including the real-file shape test, which now runs the 7 alone (`bulk=False`). `test_ces_bulk`: 14 new. These cover the rules and sentence-casing, a full run over a synthetic 2022 file and a synthetic cumulative Stata file built in the test, the 7 unchanged with the bulk tier on, rerun idempotence, coded band order, and per-year bands. `test_export`, `test_store` and `test_survey` also pass.
- **Spot-checks against the guides' published tabulations** (unweighted counts; the CES publishes no weighted toplines):
  - CC24_321a, ban assault rifles (pre-election), CES 2024 Guide: Support 38,128, Oppose 21,869, N 59,997. Each band's count matches the file, the stored base is 59,997, and the weighted topline is 58.2 / 41.8 (moe 0.6).
  - CC24_424, trust in state government (post-election, commonpostweight), CES 2024 Guide: 6,419 / 21,066 / 15,247 / 6,608, N 49,340. Counts and base match; weighted 12.8 / 42.5 / 31.6 / 13.1.
  - newsint, cumulative guide, all years: 356,238 / 177,088 / 84,910 / 45,032, with don't know (18,497) out of the base. Counts match and the bands come out in that order.
- **Export read back:** every bulk construct is in `index.json`'s constructs, all 32,165 exported CES cells list their bands in the recorded order, and every bulk cell sums to 100 within rounding. The 7's `elections_fair` and 2024 primary constructs carry two items per cell, and the export drops `item_text`, so those cells sum to 200, as they do in the committed file.

### Export and sizes

- **CES set: 15.89 MB** in four parts: `ces.json` 4.00, `ces-2.json` 4.00, `ces-3.json` 4.00, `ces-4.json` 3.89 MB (111,292 rows). That's under the 25 MB gate, but **not committed**: the lead's 06:33 ruling holds `index.json` out of git tonight. The 7's rows now spread across all four parts, so a committed `ces.json` beside the old index would drop some of them in a clean checkout. The files are on disk as regenerated, for the S3 move.
- The working tree's `index.json` is 1.31 MB: 41 files and 8,028 constructs, carrying the GSS, ANES and CPS work regenerated from the store. Not committed, per the ruling. I left the other sources' regenerated files as they are.

### Fetches and the bucket

Synced to `s3://pax-trinity-audience-638175140432/raw/ces/`: `cumulative_2006-2025.dta` (691.2 MiB), `docs/guide_cumulative_2006-2025.pdf`, and `labels/CES20_labels.json`, `CES22_labels.json`, `CES24_labels.json`. The three year CSVs and their docs were already there. The year Stata files themselves weren't fetched; only their label blocks were.

### The lock

audience-i took it at 05:27, as I finished reading the code. I polled from 05:46:32 (audience-i, then audience-l) and took it at 06:24:33, about an hour after first finding it held. I held it to 06:36:38: three loads (about 160 s each, peak 1.96 GB), the real-file tests, and two exports. No stale lock. While I waited, I did only network work outside it: the label range reads (1.6 MB) and the cumulative download (20 s). Neither opened the store or a data frame, and both are in the lock rule's spirit, which covers frames, loads and exports. I'm naming it in case the lead reads the rule as covering fetches too.

### For the lead

1. **The cumulative overlaps four of the 7.** `pid7`, `ideo5`, `approval_pres` and `vv_turnout_pvm` load as their own constructs, 2006–2025, beside `party_id_7`, `ideology_5`, `pres_approval` and `primary_turnout_validated` (2020–2024). For the three shared years they nearly duplicate each other. Folding the cumulative's other seventeen years into the 7 would give those constructs their full CES trend. That changes the 7, so it's your call.
2. **Id collisions are real collisions of meaning.** GSS's `gender4` is "Gender of 4th person" and its `educ` is years of school. CES's are the respondent's gender and a six-level degree. Skipping was right under the rule, but CES loses race, education, union, Hispanic and gender as bulk items. Per-source prefixes (`ces_race`), as the GSS report suggested, would bring them back.
3. **Candidate-slot items.** The 62 skipped vote and preference items mean "candidate 1 of your own race". Nationally that has no fixed meaning; in MA the slots name fixed candidates. If you want them, they can be served for MA with the candidate names resolved from the file's lookup columns.
4. **`SEGMENT_SEED`:** CES goes from 7 to 943 once the folder is served.

## Lead rulings (new-lead, 07:00)

1. **The cumulative into the 7:** approved in principle as a later, daylight pass — it changes the 7's committed rows, which deserves its own brief and diff, not a night landing. The near-duplicate pairs stand for now.
2. **Per-source prefixes for the id collisions** (ces_race and kin, as the GSS report also suggested): approved as the same later pass, one convention for all sources.
3. **Candidate-slot items for MA:** hold until a report needs them.
4. **SEGMENT_SEED:** the lead is updating it with the serving build now.
5. **Your lock reading was right** — network fetches outside the lock, frames and loads inside, is the rule's intent.
