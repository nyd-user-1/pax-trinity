# audience

## Sources

| Source | Name | URL | License | Registration | Raw files |
|---|---|---|---|---|---|
| `ACS` | American Community Survey 5-year estimates, 2020-2024 (U.S. Census Bureau) | https://www.census.gov/programs-surveys/acs (API: https://api.census.gov/data/2024/acs/acs5) | Public domain, 17 U.S.C. 105 | N (free API key by email: https://api.census.gov/data/key_signup.html, set `CENSUS_API_KEY`) | `raw/acs/<vintage>/`, API responses cached as JSON |
| `CVAP` | Citizen Voting Age Population by Race and Ethnicity, special tabulation from the ACS 2020-2024 5-year estimates (U.S. Census Bureau) | https://www.census.gov/programs-surveys/decennial-census/about/voting-rights/cvap.html | Public domain, 17 U.S.C. 105 | N | `raw/cvap/<prefix>/`, copied once from `s3://govblock-lake-638175140432/lake/v1/elections/cvap_{nation,state,county,mcd,blockgr}/` |
| `CPS` | Current Population Survey, November Voting and Registration Supplement 2016-2024 (U.S. Census Bureau), via IPUMS CPS | https://cps.ipums.org/cps/ | Census microdata public domain; IPUMS terms (cite IPUMS CPS, no redistribution) | Y (free IPUMS account; API key at https://account.ipums.org/api_keys, set `IPUMS_API_KEY`) | `raw/ipums/<definition hash>/`, the extract the loader submits, polls and downloads |
| `VOTERFILE_MA` | Massachusetts statewide voter list (Secretary of the Commonwealth, Elections Division) | https://www.sec.state.ma.us/divisions/elections/ | Not public; MGL c.51 s.47C limits who may get it and how it is used | Y (written request to the Elections Division, for eligible requesters) | `raw/ma_voterfile/*.csv` (statewide or per town; party and city/town columns) |
| `GSS` | General Social Survey cumulative cross-section 1972-2024, Release 3a (NORC) | https://gss.norc.org/get-the-data/stata.html | Free public use with citation | N | `raw/gss/`, `GSS_stata.zip` downloaded once and unzipped |
| `ANES` | ANES Time Series Cumulative Data File 1948-2024, release 2026-02-05 | https://electionstudies.org/data-center/anes-time-series-cumulative-data-file/ | ANES terms of use, with citation | N (the site refuses plain HTTP clients; the loader uses curl_cffi) | `raw/anes/`, the Stata zip downloaded once and unzipped |
| `CES` | Cooperative Election Study common content 2020, 2022, 2024 (Harvard) | https://doi.org/10.7910/DVN/E9N6PH, https://doi.org/10.7910/DVN/PR4L8P, https://doi.org/10.7910/DVN/X11EP6 | CC0 1.0 | N (Harvard Dataverse, no login) | `raw/ces/`, the common-content CSV or Stata files under their Dataverse names; the loader prints the links |
| `WVS` | World Values Survey wave 7 (2017-2022), United States (WVS Association) | https://www.worldvaluessurvey.org/WVSDocumentationWV7.jsp | WVSA conditions of use, non-commercial, with citation | Y (WVSA registration form) | `raw/wvs/`, the US file or the cross-national wave-7 file (Stata, SPSS or CSV) |

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
IPUMS_API_KEY=...                     # CPS loader
DATABASE_URL=postgresql://...         # optional: use Postgres instead of store/norms.duckdb
```

## Build order

```sh
.venv/bin/python -m audience.migrate          # numbered SQL in audience/migrations/
.venv/bin/python -m audience.load acs         # US, MA, 14 counties, 351 towns
.venv/bin/python -m audience.load cvap        # US, MA, counties, towns, block groups
.venv/bin/python -m audience.load gss         # US, 1972-2024; downloads once
.venv/bin/python -m audience.load anes        # US, 1952-2024; downloads once
.venv/bin/python -m audience.load ces         # US and MA, 2020/2022/2024, from raw/ces/
.venv/bin/python -m audience.load cps         # US and MA, 2016-2024; needs IPUMS_API_KEY
.venv/bin/python -m audience.load voterfile_ma  # MA and towns, from raw/ma_voterfile/; after acs
.venv/bin/python -m audience.load wvs         # US, wave 7, from raw/wvs/
.venv/bin/python -m audience.audit            # exits 1 on missing provenance or orphan constructs
.venv/bin/python -m pytest
```

`load` applies pending migrations itself. A loader whose raw data is absent prints how to get it and exits 0 without writing.

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
- CPS: the extract is defined once in `loaders/cps.py`; its hash names the cache directory, a submitted extract number is kept in `submitted.json` and resumed, never resubmitted. Rates follow the Census P20 convention: the base is citizens 18+ in the civilian population, and refused, don't know, no response and supplement non-interviews stay in it as "No response", so "Voted" is the P20 percent voted (citizen). Turnout among those who answered is Voted / (Voted + Did not vote). Voters count as registered. Each pct row has a count row of weighted persons.
- GSS: weight WTSSNRPS from 2004, WTSSPS before, as the 2024 codebook directs (WTSSALL is the historical weight these replace). Only the needed columns of the 7,000-column file are read. `race` is GSS RACE (White / Black / Other, Hispanic origin not separated).
- ANES: weight VCF0009z. `trust_gov` (VCF0604) and the agree/disagree internal-efficacy item (VCF0614) stop in 2012 in the CDF; VCF9252 carries internal efficacy from 2008. The CDF has no national-pride item.
- CES: weights per the CES guide (commonweight, commonpostweight for post-election items, vvweight for validated voters). Validated primary turnout is over all adults, with no voter-file record counted as not voting. The 2024 presidential primary is stored for Massachusetts only: states that held one combined primary record the vote under TS_p2024.
- WVS: wave 7 has no Schwartz value battery; importance of life domains (Q1-Q6) and freedom versus security (Q150) are stored instead. `item_text` is the codebook variable label.
- Voter file: towns match their GEOID through the ACS/CVAP TOWN rows, so load `acs` first. Party codes D, R, U and L; any other designation is pooled.
- Test fixtures under `tests/fixtures/` are synthetic and carry `SYNTHETIC` in their names; every loader refuses such a file unless a test passes `allow_synthetic=True`.
