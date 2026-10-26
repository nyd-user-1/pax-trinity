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
