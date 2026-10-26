# audience

## Sources

| Source | Name | URL | License | Registration | Raw files |
|---|---|---|---|---|---|
| `ACS` | American Community Survey 5-year estimates, 2020-2024 (U.S. Census Bureau) | https://www.census.gov/programs-surveys/acs (API: https://api.census.gov/data/2024/acs/acs5) | Public domain, 17 U.S.C. 105 | N (free API key by email: https://api.census.gov/data/key_signup.html, set `CENSUS_API_KEY`) | `raw/acs/<vintage>/`, API responses cached as JSON |
| `CVAP` | Citizen Voting Age Population by Race and Ethnicity, special tabulation from the ACS 2020-2024 5-year estimates (U.S. Census Bureau) | https://www.census.gov/programs-surveys/decennial-census/about/voting-rights/cvap.html | Public domain, 17 U.S.C. 105 | N | `raw/cvap/<prefix>/`, copied once from `s3://govblock-lake-638175140432/lake/v1/elections/cvap_{nation,state,county,mcd,blockgr}/` |

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
.venv/bin/python -m audience.migrate      # numbered SQL in audience/migrations/
.venv/bin/python -m audience.load acs     # US, MA, 14 counties, 351 towns
.venv/bin/python -m audience.load cvap    # US, MA, counties, towns, block groups
.venv/bin/python -m audience.audit        # exits 1 on missing provenance or orphan constructs
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
