# Brief I — The rest of the GSS

You are the audience-i window, in the Next app at /Users/brendanstanton/Code/pax-trinity. Ground rules: commit locally per feature, never push; stage by explicit path, never `-A`; stay strictly inside the paths named here. Yours: `audience/**`, `public/audience-data/**`, and this file's Worker report. Off limits: everything under `src/` (the lead's surfaces, including `src/app/inbox-2` and `src/app/audience`), `src/registry/`, and the other briefs. The dev server may or may not be running on 3000; this Mac has 8GB, so never run tsc, a Next build, or a dev server — a hook blocks the typecheck tool names, including in heredocs. Verify with pytest and by reading the regenerated JSON. Your report is appended under "Worker report" at the end of this file, with commit hashes. Rulings and seam conflicts route to the lead session, not to other windows.

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
