# Brief L — The rest of the CPS voting supplement

You are the audience-l window, in the Next app at /Users/brendanstanton/Code/pax-trinity. Ground rules: commit locally per feature, never push; stage by explicit path, never `-A`; stay strictly inside the paths named here. Yours: `audience/**`, `public/audience-data/**`, and this file's Worker report. Off limits: everything under `src/` (the lead's surfaces), `src/registry/`, and the other briefs. Never run tsc, a Next build, or a dev server on this 8GB Mac — a hook blocks the typecheck tool names, including in heredocs. Verify with pytest and by reading the regenerated JSON. Your report is appended under "Worker report" at the end of this file, with commit hashes. Rulings and seam conflicts route to the lead session, not to other windows.

## The lock — read this before anything else

Three sibling windows (GSS, ANES, CES) run tonight against the same checkout, the same single-writer DuckDB store, and the same 8 GB of memory. **One window computes at a time.** Before you read a raw frame, load, or export: create `audience/store/.lock` containing your window name; if the file exists, sleep sixty seconds and try again, as long as it takes. Hold the lock for your whole run — fetch, frame, load, export regeneration — then delete it before committing. If you find a lock older than two hours with no commits landing, name it in your report and keep waiting; the lead rules on stuck locks.

## What this is

The Turnout folder holds 2 constructs (registration, turnout) from the Census CPS Voting and Registration supplements, 2016–2024, read straight from the Census public-use files under `audience/raw/cps/` (the Brief B/C convention: Census-direct, validated against the P20 tables). The supplement asks more than two things. This brief widens what is read, on Brief I's pattern (read `docs/briefs/audience-i.md`; it governs where this brief is silent).

Read first: `audience/audience/loaders/cps.py` whole, `audience/audience/survey.py`, `audience/audience/export.py`, and one committed export file.

## 1. The bulk tier

Keep the 2 constructs exactly as they are. Add a bulk tier: **every supplement variable in every year on disk** that qualifies:

- Categorical with 2 to 24 labeled categories — method of voting, time of voting, reasons for not voting, reasons for not registering, registration method, and whatever else the dictionaries carry. Continuous and administrative skipped (ids, weights, allocation flags, line numbers, recode machinery).
- Not already one of the 2 (collisions skipped and named).

Per qualifying variable: construct id = the supplement variable name lowercased (pes4 style); label and definition = the data dictionary's description, sentence-cased (dictionary text, not questionnaire wording — say so). Bands = the dictionary's value list in order, universe and missing codes excluded. Rows: weighted topline shares per year, US and MA both (the loader already draws both; the house n<50 rule drops thin MA cells by name); standard breakdowns (age, education, income, race, sex, as the loader's recodes define them) for the latest year. Kish-effective-n margins, unweighted n. provenance_url: the year's Census supplement page.

Do not hand-edit `audience/audience/constructs.py` for bulk variables; register bulk labels from the loader so they reach the index without touching the shared module.

## 2. All the data it can

The supplements run back decades before 2016 on the Census FTP in the same public-use form. Fetch the even-year supplements back through 2008, fold their qualifying variables in on the same rules, and sync everything newly fetched to `s3://pax-trinity-audience-638175140432/raw/cps/` with the AWS CLI. Dictionary drift across years is real — harmonize names only where the dictionaries plainly agree; otherwise keep years separate and say so. If older fetches fail, land the on-disk years and note it.

## 3. Export and bounds

Regenerate the export under the lock. The 13-element row contract and index.json's shape must not change; the splitter parts a source at 4MB. Regenerated shared files will carry earlier windows' landed work — stage them anyway and say so in the commit. **If the CPS set exceeds 25 MB on disk, write but do not commit to git**: sizes in the report, serving to the lead as a ruling.

## 4. Checks

pytest: spot-check two bulk variables against the matching P20 table figures, the house convention from Brief B; keep the existing CPS tests green.

## Done means

The committed export serves the 2 constructs unchanged plus the bulk tier; counts, sizes, skips, spot-checks, lock waits and the back-year outcome are in the report with commit hashes; nothing outside your paths moved.

---

## Worker report

(appended by the worker)
