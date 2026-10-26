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

**Done.** Commit `36c2462` on main, local, not pushed. The lift dataset is loaded for real (1,583 ad-level effects) and the audit is clean. The PAX waves loader is fixture-tested and waits for the seed. `api.py` and the router are green. No vendor name appears in any file, row, label, concordance or sources entry I wrote; I grepped all of them.

Tests, shared tree: 123 passed, 3 skipped. The skips are the Postgres tests, which need `AUDIENCE_TEST_DATABASE_URL`; all three passed against a throwaway Postgres 18 cluster, which I then removed. On that cluster I also loaded the lift dataset and confirmed the API's read-only session refuses writes. My commit alone, checked out in a clean worktree: 81 passed, 24 skipped (the real-data tests, with no raw files there), none failed.

### Audit

```
store: duckdb /Users/brendanstanton/Code/pax-trinity/audience/store/norms.duckdb

rows per source
  ACS               23,488 rows     367 geographies
  ANES              26,593 rows       1 geographies
  CES                3,151 rows       2 geographies
  CPS                2,580 rows       2 geographies
  CVAP              89,016 rows   5,448 geographies
  ELECTION_RESULT        13 rows       6 geographies
  GSS               31,824 rows       1 geographies
  LIFT_ARCHIVE       1,583 rows       1 geographies
  POLL                  70 rows       4 geographies
  total            178,318

rows missing provenance_url: 0
constructs in norms lacking a concordance row: none
norms geo_codes missing from geographies: 0
sources in the sources table with no rows loaded:
  awaiting raw file (loader exists, data absent): PAX_TEST (python -m audience.load pax_tests), VOTERFILE_MA (python -m audience.load voterfile_ma), WVS (python -m audience.load wvs)
  missing loader: none
```

### What the archive contains

`replication_archive.zip` (269 MB, CC0) is an R project: cleaning, regression, meta-regression, randomization-check and simulation scripts; plotting scripts; two appendix PDFs; and `output/processed_data/`. The raw survey exports are not posted, under the authors' agreement with the testing platform, so everything comes from the processed files.

| File | Contents |
|---|---|
| `regression_ates.RDS` | 1,583 rows, one per study × ad × outcome: the ad arm against its study's placebo from `lm_robust` with the study's pre-treatment covariates (estimate, std.error, 95% CI, p, df, n_obs for the ad arm) |
| `studies.RDS` | 146 studies: dataset (2018, 2020 Presidential, 2020 Downballot), cycle, race level, states, test date, election date, days to the election, n, number of ads, covariates used |
| `tagging_2018.RDS`, `tagging_2020.RDS` | coders' mean ratings of 148 and 494 ads on 60 and 119 features (tone, focus, messenger, emotion, issues) |
| `responses.RDS` | 607,450 response-level rows with the outcome indices |
| also | subgroup ATEs (men, women, Democrats, independents, Republicans), meta-regression and IPW fits, reliability, attrition, simulations |

I load `regression_ates.RDS`, joined to the study and tagging files for the notes.

### Where the files differ from the brief

1. **Three outcomes, no turnout.** The archive measures favorability, vote choice, and vote choice dichotomized, so the constructs are `lift_favorability`, `lift_vote_choice` and `lift_vote_choice_dichotomized`. There is no `lift_turnout`.
2. **Two of the three are index points, not percentage points.** Favorability and vote choice are indices: the weighted mean of a study's 0-10 questions times 10, so 0-100. Their lifts are points on that index. Only the dichotomized outcome (coded 0 / 50 / 100) is in percentage points. All three are stored as `lift_pp` as the brief asks; each construct's definition and each row's note state the unit.
3. **`response_option` is `<ad id> (study <study id>)`.** One ad was tested in two studies on the same day (2018-11-01), so the ad id alone would collide in the natural key. The archive identifies an effect by the pair.
4. **`item_text` describes the outcome index.** The archive has no codebook file. The outcome names come from `definitions.R` and the index construction from the cleaning script; the questionnaire wording isn't in the archive.
5. **Most tests were state-targeted, but every row is `US` as the brief says.** Each note carries the study's states ("national (50 states)" or e.g. "AZ").
6. **The 2018 dataset includes one study fielded 2019-03-15.** It stays in the 2018 cycle, as the archive files it, and its note gives the date.

### Spot-checks in pytest

- **Counts.** 617 distinct ads in 146 studies, as the Dataverse dataset description states (https://doi.org/10.7910/DVN/LBPSSV). There are 618 study × ad pairs, which equals the sum of the "N treatments" column across the 146 rows of Tables DA1-DA3 in `hewitt_etal_2023_dataverse_appendix.pdf`.
- **One effect.** Ad `X968edf32f1b4` in study `X495cbb4fe018` (2018, fit without covariates) is stored as 8.769841 favorability points. The test recomputes the same value exactly as the ad arm's mean minus the placebo arm's, from the archive's response-level file `output/processed_data/responses.RDS`.

### Benchmarks from the loaded data

| Outcome | p10 | p25 | p50 | p75 | p90 | n_ads |
|---|---:|---:|---:|---:|---:|---:|
| `lift_favorability` | -0.40 | 0.42 | 1.27 | 2.50 | 4.57 | 433 |
| `lift_vote_choice` | -0.75 | 0.16 | 1.02 | 2.11 | 3.43 | 575 |
| `lift_vote_choice_dichotomized` | -1.42 | 0.08 | 1.43 | 3.06 | 4.88 | 575 |

`place_lift(2.0, "vote_choice")` returns the 72.7th percentile with this caveat: "The benchmark is 575 ad-level estimates, mostly campaign ads from the 2018/2020 cycles, each measured under forced exposure in an online survey experiment against a placebo. The placement is context for the result, not a ranking of it."

### PAX waves

`load pax_tests` reads `seed/pax_waves.csv` with the brief's columns: arm, outcome, subgroup, level, lift, sig, weighted_n, placebo_level. Headers are matched loosely. It also takes optional wave, period_start / period_end (or date), geo_code, se, provenance_url and note columns. Each row writes a `lift_pp` row and a `pct` level row under `lift_<outcome>`, with `response_option` the arm. Each outcome × subgroup × wave also gets one `Placebo` level row. Outcomes named like the lift dataset's (favorability, vote_choice) share its constructs, so the benchmark pools them; others, such as support and comprehension, get their own. Without the seed it prints a note and exits 0. The 10-row synthetic fixture covers two waves, a party subgroup, the vote-choice alias and an explicit placebo arm.

### Query layer

- **`get_norm`:** `year` as an int matches periods overlapping that year (so a 2020-2024 five-year ACS row counts for 2022). `(a, b)` matches overlap with the span. `"latest"` returns each source's most recent period.
- **`get_population_targets`:** shares sum to 1, from the latest ACS pct rows. `race_eth` comes from CVAP (citizens 18+) and falls back to ACS. ACS race covers the whole population, children included, while its sex and age rows are 18+, so CVAP matches an adult, voter-eligible sample better.
- **`get_topic_series`:** POLL and ELECTION_RESULT rows ordered by `period_end`, toplines by default. 41 rows for `open_primaries_support` once the polls loaded.
- **`get_lift_benchmark`:** returns exactly the brief's keys. `n_ads` counts ad-level estimates, so the ad tested twice counts twice.
- **`place_lift`:** percent of estimates below the lift, ties counted half, returned with the benchmark and the caveat.
- **Read-only:** DuckDB is opened `read_only=True` and Postgres sessions are set read-only. A writer's lock is retried every 30 s, up to 20 times.
- **`server.py`:** `GET /norms`, `/population-targets`, `/topic-series/{construct}`, `/lift-benchmark/{outcome_type}`, `/place-lift/{outcome_type}?lift_pp=`. Lookup failures return 404 and bad input 422. One TestClient test calls all five over the real store and confirms a POST is refused.

### Rulings needed

1. **State-targeted lift rows.** Brief D puts every lift row at `US`. If the app should compare a test with same-state ads, the state-targeted studies could carry their state's `geo_code`; the states are already in each note. National is the simpler default.
2. **The PAX seed's columns.** The brief's column list has no fielding date, so without one each wave's period falls back to the file's modification date, and the note says so. Please include `period_start` / `period_end` (or `date`), and `wave` if there is more than one.
3. **Raking universe for race.** I take `race_eth` targets from CVAP (citizens 18+) rather than ACS (everyone). `get_population_targets` reads its source choice from one table, `TARGET_SOURCE`, so switching to ACS is a one-line change.

### Notes

- **Coordination with the audience-c window:**
  - I took migration 004 and it took 005.
  - Four files carry both windows' edits: `load.py`, `test_store.py`, `test_postgres.py` and the fixtures README. My commit holds HEAD plus only my hunks, built in a temporary index; its edits stay in the working tree for its own commit.
  - `test_store.py` now compares the migration list against the files on disk and checks sources as a subset, so neither window has to re-edit it for new migrations.
  - It exported `lift_archive.json` for the app after I confirmed the rows were final.
- **New dependencies:** pyreadr (the `.RDS` files), fastapi and uvicorn; httpx for the TestClient.
- **Raw files** (gitignored): `raw/lift_archive/`, 269 MB zip plus the unzipped archive.
