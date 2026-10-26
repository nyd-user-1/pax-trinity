# Brief D — Audience database: the lift dataset and the query layer

Same ground rules as Briefs A/B (you wrote B): touch only `audience/` and this file; commit locally, never push; no fabricated values; `db.natural_key()`, slice-prune, concordance row before norm rows. The audience-c window may hold the DuckDB file at the same time — on a locked-database error, wait 30 seconds and retry, up to 20 tries. Lead rulings at the bottom of briefs A and B are binding — especially: **no commercial vendor name in any identifier, label, prose string, or filename**; the generic name is the lift dataset / `LIFT_ARCHIVE`. The academic citation (Hewitt, Broockman, Coppock et al., APSR 2024) is fine in provenance_note.

## 1. The lift dataset loader

`python -m audience.load lift_archive`:
- Download `https://dataverse.harvard.edu/api/access/datafile/7609590` (replication_archive.zip, 269MB, CC0, no login — verified 2026-10-25) into `audience/raw/lift_archive/` (gitignored), cached; unzip there.
- Explore the archive's structure first and say in your report what you found. Load the **ad-level effect estimates**: one norms row per ad × outcome — estimate = the effect in percentage points (`estimate_type=lift_pp`), se as published, geography US, geo_code US, period from the ad's cycle (e.g. 2018 cycle = 2018-01-01..2018-12-31), construct per outcome type (e.g. `lift_vote_choice`, `lift_favorability`, `lift_turnout` — name them from what the data actually contains), response_option the ad's identifier in the archive, item_text the outcome's description from the codebook, subgroup_dim `all`. Carry the archive's coded features (race type, cycle, etc.) compactly in provenance_note. provenance_url = the DOI landing page `https://doi.org/10.7910/DVN/LBPSSV`.
- If any of this structure doesn't match the files, follow the files and report the difference. Never invent an effect.
- Concordance rows for each lift construct, definition one line, notes stating these are forced-exposure survey-experiment estimates from campaigns' own tests, mostly 2018/2020 cycles.
- pytest: spot-check the loaded ad count and one effect value against the archive's own summary file or codebook (cite which file in the test).

## 2. The PAX waves fixture

`python -m audience.load pax_tests` reads `audience/seed/pax_waves.csv` if present (arm, outcome, subgroup, level, lift, sig flag, weighted n, placebo level → source `PAX_TEST`). The lead supplies the CSV later; write the loader and a 10-row fixture test now; exit 0 with a note when the seed is absent.

## 3. The query layer

`audience/api.py`, read-only, typed, with pytest over the real store:
- `get_norm(construct, geography, geo_code, subgroup_dim=None, year=None|"latest"|(a,b))` — rows as dicts.
- `get_population_targets(geo_code, dims=[...])` — raking targets: for each dim, `{category: share}` summing to 1, from the latest ACS/CVAP pcts.
- `get_topic_series(construct)` — polls and results ordered by period_end, each with estimate, response_option, n, provenance_url, provenance_note.
- `get_lift_benchmark(outcome_type)` — `{p10, p25, p50, p75, p90, n_ads, cycles}` over LIFT_ARCHIVE (+ PAX_TEST when present) for that construct.
- `place_lift(lift_pp, outcome_type)` — percentile of the lift within the benchmark, returned WITH a `caveat` string stating the benchmark set is mostly 2018/2020 campaign ads under forced exposure and placement is context, not a ranking.
- A FastAPI router (`audience/server.py`, `uvicorn audience.server:app`) exposing exactly those five, read-only, JSON. One pytest with FastAPI's TestClient.

## Done means

Lift dataset loaded for real with the audit clean; api.py + router tested green; no vendor name anywhere (grep yourself before committing); report appended below with what the archive turned out to contain.

---

## Worker report

(append here)
