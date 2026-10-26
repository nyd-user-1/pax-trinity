# Brief I — The rest of the GSS

You are the audience-i window, in the Next app at /Users/brendanstanton/Code/pax-trinity. Ground rules: commit locally per feature, never push; stage by explicit path, never `-A`; stay strictly inside the paths named here. Yours: `audience/**`, `public/audience-data/**`, and this file's Worker report. Off limits: everything under `src/` (the lead's surfaces, including `src/app/inbox-2` and `src/app/audience`), `src/registry/`, and the other briefs. The dev server may or may not be running on 3000; this Mac has 8GB, so never run tsc, a Next build, or a dev server — a hook blocks the typecheck tool names, including in heredocs. Verify with pytest and by reading the regenerated JSON. Your report is appended under "Worker report" at the end of this file, with commit hashes. Rulings and seam conflicts route to the lead session, not to other windows.

## The lock — read this before anything else

Three sibling windows (ANES, CES, CPS — briefs J, K, L) run tonight against the same checkout, the same single-writer DuckDB store, and the same 8 GB of memory. **One window computes at a time.** Before you read a raw frame, load, or export: create `audience/store/.lock` containing your window name; if the file exists, sleep sixty seconds and try again, as long as it takes. Hold the lock for your whole run — fetch, frame, load, export regeneration — then delete it before committing. If you find a lock older than two hours with no commits landing, name it in your report and keep waiting; the lead rules on stuck locks. Regenerated shared export files will carry earlier windows' landed work — stage them anyway and say so in the commit. Sync anything newly fetched to `s3://pax-trinity-audience-638175140432/raw/gss/` with the AWS CLI. Do not hand-edit `audience/audience/constructs.py` for bulk variables — register bulk labels from the loader so they reach the index without touching the shared module.

## What this is

The GSS folder holds 15 harmonized constructs out of a cumulative file that carries roughly 6,700 variables. Brendan wants the rest. The cumulative Stata file is already the loader's source (`audience/audience/loaders/gss.py`: `fetch`, `locate`, `read_frame`, `prepare`, the weight and recode helpers) — every variable is on disk once fetched; this brief widens what is read, not where it comes from.

Read first: `audience/audience/loaders/gss.py` whole, `audience/audience/survey.py` (weighted shares, Kish-effective-n standard errors, the n<50 cell rule), `audience/audience/constructs.py`, `audience/audience/export.py` (the 13-element row contract, the 4MB split), and one committed export file to see the shape served.

## 1. The bulk tier

Keep the 15 harmonized constructs exactly as they are. Add a bulk tier: **every variable in the cumulative file, whatever wave it was asked in** — all of the GSS, 1972 to 2024 — that qualifies:

- Categorical with 2 to 24 labeled categories in the Stata value labels. Continuous variables (age in years, income in dollars, hours, counts) are skipped — no invented banding.
- Not administrative or technical: skip id, ballot, form, version, the weight variables (wt*, vstrat, vpsu, sampcode and kin), interview dates and paradata, and open-ended or verbatim-coded variables.
- Not already one of the 15 (a bulk mnemonic that collides with an existing construct id is skipped and named in the report).

Per qualifying variable:

- **Construct id**: the GSS mnemonic, lowercased. **Label**: the Stata variable label, sentence-cased. **Definition**: the same variable label verbatim (the questionnaire wording is not in the Stata file; the 15 keep their hand-entered wordings — say so in the report so nobody mistakes bulk definitions for wordings).
- **Bands**: the value labels in their coded order, missing codes (DK, NA, IAP, skipped) excluded the way the loader already excludes them.
- **Rows**: weighted topline shares for **every wave the variable was asked**, national; the five standard breakdowns (age, education_4, party_3, race, sex) for **the latest wave it was asked** — toplines carry the full history for the trend, the latest wave carries the banner. (Full breakdown history for every wave is a later phase if the lead calls for it.) Shares and margins from the survey.py machinery (Kish-effective-n), n the unweighted base, cells under n=50 dropped and the drop named on the topline, per house rule.
- **provenance_url**: the variable's GSS Data Explorer page (https://gssdataexplorer.norc.org/variables — resolve the per-variable URL pattern and use it).

## 2. Export and bounds

Regenerate the export. The 13-element row contract and index.json's shape are the app's and must not change; the splitter already parts a source at 4MB and the app concatenates the parts. At full-file scale the GSS set will likely run to thousands of variables and tens of megabytes — expect it. Report the bulk tier's variable count, row count, and the GSS files' total size. **If the GSS set exceeds 25 MB on disk, write the files but do not commit them to git**: leave them in place, put the sizes in your report, and bring serving to the lead as a ruling — at that weight the data belongs in S3 with the app fetching per question, which is the lead's side to build. Everything in the store (DuckDB) is committed work regardless; the ruling is only about the public/ export.

## 3. Checks

pytest: spot-check two bulk variables' 2024 toplines against GSS Data Explorer's published figures, in the loader's existing test style; keep the existing GSS tests green. Confirm by reading the regenerated gss files that bands order follows the value labels and that no construct lost rows against the committed export.

## For the lead, after landing

`SEGMENT_SEED` in `src/app/audience/audience-data.ts` still says GSS: 15 — the rail self-corrects once the folder is read, and the lead updates the seed to the final count. The middle panel holding hundreds of questions is intended; its search already filters.

## Done means

The committed export serves the 15 harmonized constructs unchanged plus the bulk tier; counts, sizes, skipped-variable notes and the two spot-checks are in the report with commit hashes; nothing outside your paths moved.

---

## Worker report

(appended by the worker)

### Landed

`48a2335`: the bulk tier in the store, its loader, tests and shared machinery. The export is not committed. The GSS set regenerates to 72.6 MB, so it waits on the serving ruling below.

- **5,526 bulk variables, 429,757 rows**: 85,247 toplines across every year asked, plus 344,510 latest-year breakdowns by age, education, party, race and sex. With the 15 harmonized constructs, GSS holds 461,581 rows and 5,541 constructs, 1972–2024.
- **Definitions are Stata variable labels, not questionnaire wordings.** Each bulk construct's label is the variable label sentence-cased, and its definition is the same label verbatim. The 15 keep their hand-entered wordings. The Data Explorer list I fetched carries wordings (`surveyQuestion`) for 6,937 variables, cached in `raw/gss/data_explorer_variables.json`, if you want them later.
- **Bands** are the value labels in coded order, with only the first letter capitalized. Codes labeled refused, don't know, no answer or uncodeable leave the base, alongside Stata's extended missing codes. A scale labeled only at its ends (CONBUSY 1–7, POLVIEWX 1–10, CLOSEBLK 1–9) keeps every point: "1 (Complete confidence)", "2", … "7 (No confidence)", the house EQWLTH style.
- **provenance_url** is the variable's Data Explorer page, `https://gssdataexplorer.norc.org/variables/{id}/vshow`. The id comes from the Explorer's public variable list (CLASS and UNION are listed as `class_` and `union_`). VOTE_TS and PRES_TS are R3a recodes the Explorer doesn't list yet, so their 357 rows link to the Explorer's variable search.
- **Shared changes, all inside `audience/**`:**
  - `audience/bulk.py` holds the qualifying rules, latest-year breakdowns, a prune for a slice written in several batches, and `write_response_order`.
  - Migration 007 adds `response_order`. The export's ORDER BY reads it, so a bulk construct's bands come out in coded order. Every construct without recorded order exports exactly as before.
  - `survey.shares` now clamps `p(1-p)` at zero. A lone option's share landed a hair over 1 and crashed the square root.
- **Store and S3.** The store is loaded (`python -m audience.load gss`, about 5 minutes, 1.07 GB peak). `data_explorer_variables.json` is synced to `s3://pax-trinity-audience-638175140432/raw/gss/`.
- **Lock.** I took it at 05:27 with no wait and released it at 05:59.

### Skipped: 1,417 variables, by reason (lists in `audience/reports/gss_bulk.json`)

| Variables | Reason |
|---:|---|
| 603 | No value labels: continuous, a count or an identifier |
| 292 | No year with an unweighted base of 50 or more |
| 137 | Administrative, technical or paradata: ids, ballot, form, version, weights, design and sampling variables, interview date, mode, length, fees, language, interviewer traits and observations, module and consent flags, household-roster bookkeeping, occupation and industry coding status, vignette-assignment flags |
| 125 | Continuous or partly labeled. Includes about 15 agree scales with one unlabeled code, left out rather than guessed (usually 5: BELTUP, EQINCOME, IMMCULT, IMMEDUC, MUSTRET, NOSMOKE, OPFAMILY, OPPROF, OPRICH, SHORTCOM; also EXJOBSAT 99, GVINFLU1/2 100, PRFMWHY8 9) |
| 109 | Over 24 labeled categories |
| 102 | One labeled code: a continuous variable's top code (AGE 89, CHILDS 8, HRS1 89) |
| 27 | The 15 harmonized constructs' own variables |
| 17 | No answers in the file |
| 6 | Open answers coded from verbatims (SCITEXT, EXPTEXT, STORMTXT, LITMSTXT, FISHEXP2, ADHDKNW) |
| 1 | Construct id already taken: SEX (the population construct `sex`) |

### Checks

- **pytest:** 42 passed (`test_bulk`, `test_gss`, `test_survey`, `test_store`, `test_export`, `test_audit`). `audience.audit` is clean.
- **Spot-checks against Data Explorer's published 2024 counts:**
  - ABANY: Yes 1,281, No 859 (59.9 / 40.1, n 2,140).
  - CAPPUN: Favor 1,243, Oppose 824 (60.1 / 39.9, n 2,067).
  - The store's toplines carry n 2,140 and 2,067, weight WTSSNRPS, and all five breakdowns.
- **No construct lost rows.** Read from the regenerated files, all 15 harmonized constructs are identical, row for row and in order, to the committed `gss.json` and `gss-2.json`.
- **Band order.** All 5,526 bulk constructs list their bands in value-label order; none is off.

### Not committed, and why

- **`gss.json` through `gss-19.json`: 72.6 MB**, 19 parts of at most 4.00 MB each. That is past the 25 MB gate.
- **`index.json`: 0.88 MB**, up from 0.06 MB with 5,577 constructs listed. It names `gss-3` through `gss-19`, which git won't carry. The app rejects a whole source when one part is missing, so committing it would break the GSS folder in any clean checkout or deploy.
- **`election_result.json`.** The store holds the MA 2024 presidential return (`presidential_vote`, 7,392 rows) that an earlier window loaded but never exported. It isn't mine to land, and it belongs with the index.
- The working tree keeps all of these, so locally the GSS folder now pulls 73 MB when opened.

### For the lead

1. **Serving ruling.** S3 with per-question fetches, as the brief foresees. One alternative: toplines alone come to **19.0 MB** for the whole GSS set (harmonized plus every bulk trend), under the gate. That could land in git now, with the latest-year breakdowns served from S3 later.
2. **Index hazard tonight.** The J, K and L windows will regenerate `index.json` from this store, so it will list `gss-3` through `gss-19`. Any commit of it before your ruling breaks GSS in clean checkouts. Their briefs tell them to stage regenerated shared files.
3. **Band order for J, K and L.** Their bulk loaders don't write `response_order` yet, so their bands will export alphabetically. One call to `bulk.write_response_order(store, SOURCE, {construct: labels_in_coded_order})` per load fixes it.
4. **Bare mnemonics collide across sources.** GSS registered `race`, `region`, `educ`, `degree`, `marital` and the like first. A CES or CPS variable with the same name is skipped as a collision under its brief. Prefixing bulk ids per source (`gss_race`) would avoid that, but it is your call, since it changes the id rule the briefs set.
5. **`SEGMENT_SEED`.** GSS goes from 15 to 5,541 once the folder is served.
