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
