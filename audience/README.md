# audience

## Sources

| Source | Name | URL | License | Registration | Raw files |
|---|---|---|---|---|---|
| `ACS` | American Community Survey 5-year estimates, 2020-2024 (U.S. Census Bureau) | https://www.census.gov/programs-surveys/acs (API: https://api.census.gov/data/2024/acs/acs5) | Public domain, 17 U.S.C. 105 | N (free API key by email: https://api.census.gov/data/key_signup.html, set `CENSUS_API_KEY`) | `raw/acs/<vintage>/`, API responses cached as JSON |
| `CVAP` | Citizen Voting Age Population by Race and Ethnicity, special tabulation from the ACS 2020-2024 5-year estimates (U.S. Census Bureau) | https://www.census.gov/programs-surveys/decennial-census/about/voting-rights/cvap.html | Public domain, 17 U.S.C. 105 | N | `raw/cvap/<prefix>/`, copied once from `s3://govblock-lake-638175140432/lake/v1/elections/cvap_{nation,state,county,mcd,blockgr}/` |
| `CPS` | Current Population Survey, November Voting and Registration Supplement 2016-2024 (U.S. Census Bureau), public-use files | https://www.census.gov/data/datasets/time-series/demo/cps/cps-supp_cps-repwgt/cps-voting.html | Public domain, 17 U.S.C. 105 | N | `raw/cps/`, `nov<yy>pub.csv` (2020-2024) and fixed-width `nov<yy>pub.dat.gz` (2016, 2018), downloaded once |
| `MA_ENROLLMENT` | Massachusetts registered voters and party enrollment by city and town, 2008-2025 (Secretary of the Commonwealth, Elections Division) | https://www.sec.state.ma.us/divisions/elections/research-and-statistics/registration-statistics.htm | Public records | N (the site refuses plain HTTP clients; the loader uses curl_cffi) | `raw/ma_enrollment/`, one enrollment-breakdown PDF per vintage, downloaded once |
| `GSS` | General Social Survey cumulative cross-section 1972-2024, Release 3a (NORC) | https://gss.norc.org/get-the-data/stata.html | Free public use with citation | N | `raw/gss/`, `GSS_stata.zip` downloaded once and unzipped |
| `ANES` | ANES Time Series Cumulative Data File 1948-2024, release 2026-02-05 | https://electionstudies.org/data-center/anes-time-series-cumulative-data-file/ | ANES terms of use, with citation | N (the site refuses plain HTTP clients; the loader uses curl_cffi) | `raw/anes/`, the Stata zip downloaded once and unzipped |
| `CES` | Cooperative Election Study common content 2020, 2022, 2024 (Harvard) | https://doi.org/10.7910/DVN/E9N6PH, https://doi.org/10.7910/DVN/PR4L8P, https://doi.org/10.7910/DVN/X11EP6 | CC0 1.0 | N (Harvard Dataverse, no login) | `raw/ces/`, the common-content CSV files under their Dataverse names, downloaded once (about 190 MB each) |
| `WVS` | World Values Survey wave 7 (2017-2022), United States (WVS Association) | https://www.worldvaluessurvey.org/WVSDocumentationWV7.jsp | WVSA conditions of use, non-commercial, with citation | Y (WVSA registration form) | `raw/wvs/`, the US file or the cross-national wave-7 file (Stata, SPSS or CSV) |
| `POLL` | Published polls on primary systems: toplines from each release, and the AP-NORC May 2016 public-use file | each row's `provenance_url`; https://apnorc.org/wp-content/uploads/2020/02/AP-NORC-Campaign-and-Election-May-2016-PUF.zip | Toplines quoted from the publisher, whose rights they stay; the AP-NORC codebook states no license | N | `seed/open_primary_polls.csv`; `raw/apnorc/`, the AP-NORC zip downloaded once |
| `ELECTION_RESULT` | Official results of ballot measures on primary systems (state election offices) | each row's `provenance_url` | Public records | N | `seed/open_primary_polls.csv` |
| `LIFT_ARCHIVE` | Ad-level persuasion effects from campaigns' own experiments, 2018 and 2020 cycles (replication archive of Hewitt, Broockman, Coppock et al., APSR 2024) | https://doi.org/10.7910/DVN/LBPSSV | CC0 1.0 | N (Harvard Dataverse, no login) | `raw/lift_archive/`, `replication_archive.zip` downloaded once and unzipped |
| `PAX_TEST` | PAX message-test waves | https://github.com/nyd-user-1/pax-trinity/blob/main/audience/seed/pax_waves.csv | Internal | N (supplied by the lead) | `seed/pax_waves.csv` |

`raw/`, `store/`, `.venv/` and `.env` are gitignored.

## Setup

```sh
cd audience
uv venv --python 3.14 .venv          # any Python 3.11+
uv pip install --python .venv/bin/python -e ".[dev]"
```

`audience/.env`:

```sh
CENSUS_API_KEY=...                    # ACS loader
DATABASE_URL=postgresql://...         # optional: use Postgres instead of store/norms.duckdb
```

## Build order

```sh
.venv/bin/python -m audience.migrate          # numbered SQL in audience/migrations/
.venv/bin/python -m audience.load acs         # US, MA, 14 counties, 351 towns
.venv/bin/python -m audience.load cvap        # US, MA, counties, towns, block groups
.venv/bin/python -m audience.load gss         # US, 1972-2024; downloads once
.venv/bin/python -m audience.load anes        # US, 1952-2024; downloads once
.venv/bin/python -m audience.load ces         # US and MA, 2020/2022/2024; downloads once
.venv/bin/python -m audience.load cps         # US and MA, 2016-2024; downloads once
.venv/bin/python -m audience.load ma_enrollment  # MA and its 351 towns, 2008-2025; after acs; downloads once
.venv/bin/python -m audience.load wvs         # US, wave 7, from raw/wvs/
.venv/bin/python -m audience.load lift_archive  # US, 2018 and 2020 ad-level effects; downloads once
.venv/bin/python -m audience.load pax_tests  # from seed/pax_waves.csv when present
.venv/bin/python -m audience.load polls       # seed/open_primary_polls.csv
.venv/bin/python -m audience.load apnorc      # AP-NORC May 2016 subgroups; after polls; downloads once
.venv/bin/python -m audience.audit            # exits 1 on missing provenance, orphan constructs or unnamed geo_codes
.venv/bin/python -m audience.export           # the app's JSON, into ../public/audience-data/
.venv/bin/python -m pytest
```

`load` applies pending migrations itself and rebuilds the `geographies` table afterwards (`python -m audience.geographies` does it alone). A loader whose raw data is absent prints how to get it and exits 0 without writing. A DuckDB file another process holds is retried every 30 s, up to 20 times.

Set `AUDIENCE_TEST_DATABASE_URL` to also run the Postgres test; it works in a throwaway schema.

## Reruns

- Rows upsert on `natural_key`, the sha256 of source, source_version, geo_code, period_start, period_end, construct, item_text, response_option, subgroup_dim, subgroup_value and estimate_type. A rerun updates rows in place and the count does not change. `norm_id` is uuid5 of the key, so ids survive reruns.
- Each loader owns its `source` + `source_version` slice: rows an earlier run wrote that the current run no longer produces are deleted in the same transaction.
- Raw files are cached. `--refresh` refetches them. `load acs --vintage 2023` adds ACS 2019-2023 as a separate slice.

## Conventions

- `geography`: `US`, `STATE`, `COUNTY`, `TOWN` (MA county subdivision) or `BLOCKGROUP`. `geo_code` is the Census GEOID without its summary-level prefix: `US`, `25` (MA), `25025` (Suffolk County), `2502507000` (Boston), `250250108011` (a block group). The place name is the first sentence of `provenance_note`.
- `pct` is 0-100. `moe` is the Census 90% margin, `se = moe / 1.645`, and a pct row's moe is in percentage points. Sums and shares use the Census approximations in `audience/moe.py`.
- Response options come from `audience/categories.py`, so a construct lines up across sources.
- A construct needs its `concordance` row before any norm row uses it: `upsert_norms` refuses unknown constructs and rows without `provenance_url`.
- `Store` (`audience/db.py`) is the only way to the database. Array columns take Python lists on both backends.

## Loader notes

- ACS: each cell is stored as a count and as a pct of its table's universe: sex and age over the 18+ population (B01001 adult cells), race_eth and citizenship over total population, education over 25+, income over households. Places with no population (the six water-only "County subdivisions not defined") are skipped.
- CVAP: `cvap` is citizens 18+, overall and by race_eth, with pct = share of that group's 18+ population who are citizens. `race_eth` from this source is the composition of CVAP. The release estimates each of its 13 lines separately, so above block-group level the lines need not add to the line-1 total; composition shares divide by the sum of the five groups so they total 100. Where a small town's CVAP exceeds its separately estimated 18+ count, the citizen-share pct is left out and both counts stay. Block groups publish no 18+ count, so they carry counts and composition only. The six "County subdivisions not defined" (county subdivision 00000) are skipped here too: the release gives them noise-level values.
- Survey loaders (CPS, GSS, ANES, CES, WVS) share `audience/survey.py`. pct is the weighted share of respondents giving a substantive answer: don't know, no answer, refused, skipped and not asked are out of the base, while answers the questionnaire offers ("Not sure", "haven't thought much about it", a volunteered "depends") stay in. `n` is the unweighted base. `se` uses the Kish effective n and ignores clustering, so it understates the design-based error; `moe` is 1.645 x se. Subgroup cells with an unweighted base under 50 are not stored, and the topline row of that period names them in its `provenance_note`.
- Attitude constructs get their concordance row from the loader that writes them: the label and one-line definition from `audience/constructs.py`, the loader's own variable names added to `anes_var` / `gss_var` / `ces_var` / `wvs_var`, and a note on how its wording differs. Each wording is its own `item_text`.
- CPS: the Census public-use files, one `source_version` per year. Variable positions and codes come from each year's technical documentation (`techdocs/cpsnov<yy>.pdf`); only the supplement items PES1 and PES2 move between years. Weight PWSSWGT (4 implied decimals): no year publishes a supplement weight. Every year reproduces P20 Table 4b's percent voted and registered (citizen) for the US and MA. Rates follow the Census P20 convention: the base is citizens 18+ in the civilian population, and refused, don't know, no response and supplement non-interviews stay in it as "No response", so "Voted" is the P20 percent voted (citizen). Turnout among those who answered is Voted / (Voted + Did not vote). Voters count as registered. Each pct row has a count row of weighted persons.
- GSS: weight WTSSNRPS from 2004, WTSSPS before, as the 2024 codebook directs (WTSSALL is the historical weight these replace). Only the needed columns of the 7,000-column file are read. `race` is GSS RACE (White / Black / Other, Hispanic origin not separated).
- ANES: weight VCF0009z. `trust_gov` (VCF0604) and the agree/disagree internal-efficacy item (VCF0614) stop in 2012 in the CDF; VCF9252 carries internal efficacy from 2008. The CDF has no national-pride item.
- CES: weights per the CES guide (commonweight, commonpostweight for post-election items, vvweight for validated voters). Validated primary turnout is over all adults, with no voter-file record counted as not voting. The 2024 presidential primary is stored for Massachusetts only: states that held one combined primary record the vote under TS_p2024.
- WVS: wave 7 has no Schwartz value battery; importance of life domains (Q1-Q6) and freedom versus security (Q150) are stored instead. `item_text` is the codebook variable label.
- MA enrollment: the Secretary of the Commonwealth's enrollment breakdowns, one `source_version` per as-of date: the state elections of 2008-2024 and February 1, 2025. `registration_by_party` stores a count and a pct (share of the town's registered voters, `n`) for each column the vintage prints (Democrat, Republican, Unenrolled, and whichever of Libertarian, Green-Rainbow, United Independent Party or Working Families had party status) plus Political Designations, which the town tables omit: it is the town's registered voters less the printed columns, an identity that holds exactly for every county on page 1. The PDFs set figures among dot leaders, so the reader drops the dots and groups words by position, and it checks each file (351 towns, county and statewide sums) before writing. Towns take their GEOID from the geographies table by county and name. The 2006 and older breakdowns use other layouts and are not loaded.
- Lift dataset: one row per study x ad x outcome from the archive's `output/processed_data/regression_ates.RDS`, the ad arm against its study's placebo (lm_robust with the study's pre-treatment covariates). Constructs `lift_favorability`, `lift_vote_choice` and `lift_vote_choice_dichotomized`; `estimate_type` `lift_pp`; `se` as published, `moe` 1.645 x se; period the cycle year. Favorability and vote choice are 0-100 indices, so their lifts are index points; the dichotomized outcome's are percentage points. `response_option` is `<ad id> (study <study id>)`, because one ad was tested in two studies. Each `provenance_note` carries the study's cycle, race level, states, test date, days to the election, n, the published 95% CI and p, and the coders' tone and focus. The archive has no turnout outcome.
- PAX tests: `seed/pax_waves.csv` rows become a `lift_pp` row and a `pct` level row under `lift_<outcome>` (response_option the arm), plus one `Placebo` level row per outcome x subgroup x wave. Outcomes named like the lift dataset's (favorability, vote_choice) share its constructs, so the benchmark pools them.
- Polls: `seed/open_primary_polls.csv` maps 1:1 onto norms, values as given; an empty `n` or `moe` stays NULL, `se = moe / 1.645`, and a row missing `provenance_url` is rejected and named. Each poll or result is its own slice; one that leaves the seed is deleted.
- AP-NORC: Q8 of the May 2016 public-use file, by sex, age group and party, weight finalwt, under the seed topline's construct and `item_text`. The base keeps skipped or refused as its own option, as the topline does. Age is `age_5`, the file's five groups (18-29, 30-39, 40-49, 50-64, 65+), which don't match `age`'s buckets; party counts leaners with their party.
- Geographies: `geo_code`, the Census name, level and `parent_code` (state to US, county to state, town and block group to county) for every code in norms, from the cached CVAP and ACS files.
- Test fixtures under `tests/fixtures/` are synthetic and carry `SYNTHETIC` in their names; every loader refuses such a file unless a test passes `allow_synthetic=True`.

## Query layer

`audience/api.py`, read-only (DuckDB opened `read_only=True`, Postgres sessions set read-only; a held write lock is retried every 30 s, up to 20 times):

- `get_norm(construct, geography, geo_code, subgroup_dim=None, year=None)`: rows as dicts. `year` is an int (periods overlapping that year), `(a, b)`, or `"latest"` (each source's most recent period).
- `get_population_targets(geo_code, dims=...)`: `{dim: {category: share}}`, shares summing to 1, from the latest ACS pct rows; `race_eth` from CVAP (citizens 18+), falling back to ACS.
- `get_topic_series(construct)`: POLL and ELECTION_RESULT rows ordered by `period_end`, toplines by default.
- `get_lift_benchmark(outcome_type)`: `{p10, p25, p50, p75, p90, n_ads, cycles}` over LIFT_ARCHIVE and PAX_TEST lifts; `n_ads` counts ad-level estimates.
- `place_lift(lift_pp, outcome_type)`: the percentile of a lift among them (ties count half), with the benchmark and a `caveat`.

```sh
.venv/bin/uvicorn audience.server:app   # GET /norms, /population-targets, /topic-series/{construct},
                                        #     /lift-benchmark/{outcome_type}, /place-lift/{outcome_type}?lift_pp=
```

## Export

`python -m audience.export` writes `public/audience-data/` at the repo root for the `/audience` page: `index.json` (`sources` with label, row count and file; `constructs` with label and definition; `geographies` at US, STATE, COUNTY and TOWN level) and one `<source>.json` per source, an array of `[construct, geo_code, period_start, period_end, response_option, subgroup_dim, subgroup_value, estimate, estimate_type, moe, item_text, n, provenance_url]`. Block groups are left out; estimates and moe round to 1 decimal and counts to whole numbers; `item_text` is kept for POLL and ELECTION_RESULT only; `n` is null where the store has none; a topline's subgroup fields are null; dates are ISO. A file over 4 MB splits into `<source>-2.json`, each part listed in the index.

## Message-test analysis

```sh
.venv/bin/python -m audience.load ma_results            # the MA 2024 presidential return, statewide and 351 towns
.venv/bin/python -m audience.analyze open-primaries-1   # report to reports/open-primaries-1.json
.venv/bin/python -m audience.analyze --simulate         # validation to reports/simulation.json
```

- Reads every item for the test from the DynamoDB table `pax-trinity-test-responses` (machine credentials), written by the app's collector at `/api/tests/<id>/responses`. `--env production` drops dev walks, which the collector stamps `development`.
- Outcomes are 0/100 per respondent: `support` (Yes on the ballot question) and `comprehension` (the correct description), so lifts are percentage points against the placebo.
- Three estimators per arm: unweighted difference in means; weighted, raked to Massachusetts targets on education (ACS), party (the latest CES party ID, leaners with independents as the entry question asks it) and 2024 vote (the official return over CVAP adults), weights capped at 5x the mean; and covariate-adjusted (Lin 2013, centered entry-question dummies and their interactions with the arm), the headline. Standard errors are HC2. The 90% criterion calls a lift detectable when its 90% interval excludes 0; Holm-adjusted p-values across arms sit beside the unadjusted ones.
- Subgroup lifts per entry question keep every cell and flag those under 50 in either arm. Headline lifts are placed with `api.place_lift` against PAX's own earlier waves and, for support, the lift dataset's dichotomized vote choice.
- The report schema is in the `audience/analysis.py` docstring. A quantity the data cannot support is null with a note saying why.
- The simulator plants lifts of 6, 3, 0 and -2 points, skews education away from the targets so the weights move, and runs the same analysis path many times: 40 runs at 50,000 per arm for bias, 1,000 runs at 500 per arm for 90% coverage.
