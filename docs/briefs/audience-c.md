# Brief C — Audience database: CPS for real, CES self-download, the poll seed loader, geographies, and the app export

Same ground rules as Briefs A/B (you wrote A): touch only `audience/`, `public/audience-data/`, and this file; commit locally, never push; no fabricated values; every row has `provenance_url`; use `db.natural_key()` and slice-prune. The audience-b window may hold the DuckDB file at the same time — on a locked-database error, wait 30 seconds and retry, up to 20 tries. Lead rulings at the bottom of briefs A and B are binding.

## 1. CPS, Census-direct (lead ruling B-2)

Build the Census-direct reader the B worker proposed: public November-supplement CSVs at `www2.census.gov/programs-surveys/cps/datasets/<year>/supp/nov<yy>pub.csv`, years 2016–2024 even, cached in `audience/raw/cps/`. Follow the P20 convention exactly as B's report describes (no-response in the denominator, stored as its own option). Turnout and registration by sex, age bucket, race/eth, education (4-cat), family income bucket, US and MA (GESTFIPS 25), per year. Reuse `audience/survey.py` and `audience/categories.py`. Un-skip the P20 2020 spot-check. Watch per-year variable-name drift; the B report says the math already reproduces P20 from this file.

## 2. CES self-download (lead ruling B-3)

Give the CES loader the same self-download GSS and ANES have — the three Dataverse files are CC0 and unwalled; the loader already prints their direct links when raw/ is empty.

## 3. Poll seed loader

`python -m audience.load polls` reads `audience/seed/open_primary_polls.csv` (already written by the lead — treat its values as given, do not re-derive). Columns map 1:1 onto norms; empty n/moe stay NULL; se = moe/1.645 when moe present. Insert sources rows for `POLL` and `ELECTION_RESULT` and concordance rows (label + one-line definition) for `open_primaries_support`, `closed_primaries_favorability`, `top_two_favorability`, `top_four_favorability`. Reject any CSV row missing provenance_url. Idempotent like everything else; pytest spot-checks one row per source against the CSV.

## 4. The topline poll's microdata

Download https://apnorc.org/wp-content/uploads/2020/02/AP-NORC-Campaign-and-Election-May-2016-PUF.zip into `audience/raw/apnorc/` (use `curl_cffi` if plain requests are refused). Find the fair-way-to-select-a-nominee item (Q8) in the codebook, compute its shares by sex, age bucket, and party with the provided weight, and store them as source `POLL`, source_version `AP-NORC 2016-05 PUF`, subgroup rows under the same construct and item_text as the seed's topline rows. If the zip is gone or the item can't be located, print that and exit 0.

## 5. Geographies lookup

`geographies` table (geo_code pk, name, level, parent_code) filled from the Census files already cached for ACS/CVAP — every code that appears in norms, named. Audit gains a check: norms geo_codes missing from geographies = 0.

## 6. Export for the app

`python -m audience.export` writes committed JSON for the Next app into `public/audience-data/`:
- `index.json`: `{ sources: [{source, label, rows, file}], constructs: [{construct, label, definition}], geographies: [{code, name, level, parent}] }` — geographies at US/STATE/COUNTY/TOWN only.
- one `<source-lowercase>.json` per source: an array of rows `[construct, geo_code, period_start, period_end, response_option, subgroup_dim, subgroup_value, estimate, estimate_type, moe, item_text]` — item_text only for POLL/ELECTION_RESULT rows (null elsewhere); estimates rounded to 1 decimal (counts to integers); **BLOCKGROUP rows excluded everywhere**. Keep each file under ~4MB; if one exceeds it, split `<source>-2.json` and list both in index.
The agentic-inbox window builds `/audience` against exactly this contract — do not vary it; if something in it is impossible, say so in your report instead of improvising.

## Done means

All loaders run for real; audit clean (including the new geographies check); pytest green; export files present and committed; report appended below.

---

## Worker report

**Done.** Commits `0751d28` (code and tests) and `c5527a5` (the export), local, not pushed. Every loader this brief touches ran for real: CPS, CES, polls, AP-NORC. The audit is clean, including the new geographies check. pytest: 123 passed, 3 skipped. The skips are the Postgres tests; I ran all three against a throwaway local Postgres 18 cluster and they passed, then removed it. `c5527a5`'s message says 116,022 exported rows; the right figure is 97,022 (9 files).

One slip to report: I ran `git commit --amend` to fix that number just as your rulings commit `64a7087` landed, so the amend hit your commit instead of mine. Nothing was staged, so the new commit had the same tree, parent, author and message. I moved main back to `64a7087` with `git reset --soft`, and your commit is at HEAD exactly as you made it.

### Audit

```
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

### 1. CPS, Census-direct

Every year matches P20 Table 4b exactly: percent voted and percent registered, among citizens, for the US and MA. 2020's published counts match to the thousand (231,593 thousand citizens, 154,628 thousand voters).

| Year | US voted / registered | MA voted / registered | Table |
|---|---|---|---|
| 2016 | 61.4 / 70.3 | 66.7 / 73.7 | p20/580/table04b.xlsx |
| 2018 | 53.4 / 66.9 | 55.5 / 68.0 | p20/583/table04b.xlsx |
| 2020 | 66.8 / 72.7 | 66.3 / 72.4 | p20/585/table04b.xlsx |
| 2022 | 52.2 / 69.1 | 56.7 / 74.0 | p20/586/vote04b_2022.xlsx |
| 2024 | 65.3 / 73.6 | 68.9 / 75.4 | p20/587/vote04b_2024.xlsx |

All twenty figures are in `tests/test_cps.py`, which runs when the files are cached.

- **2016 and 2018 have no CSV.** The brief's `nov<yy>pub.csv` path returns 404 for those years; Census publishes only fixed-width `nov16pub.dat.gz` and `nov18pub.dat.gz`. The loader reads both formats. Positions and codes come from each year's technical documentation (`techdocs/cpsnov<yy>.pdf`). The basic-CPS fields sit at the same positions every year; only PES1 and PES2 move (951–954 in 2016, 1001–1004 in 2018 and 2020, 1003–1006 in 2022 and 2024). A test checks that the two readers agree, and the loader refuses a file whose HRYEAR4 doesn't match its year.
- **Weight:** PWSSWGT, with 4 implied decimals. Every year's documentation says the supplement has no weight of its own and directs PWSSWGT.
- **Vintages:** each year is its own `source_version` and slice, so a missing year can't prune another year's rows. The IPUMS code and its fake-API tests are gone. The CPS fixture is regenerated with Census codes, and every other fixture regenerated byte-identical.
- **`item_text`:** each year's PES1 and PES2 wording as its documentation prints it. 2016 and 2018 print the date as "November X, XXXX", and I kept that as printed.
- **Size:** 2,580 rows, 516 per year. MA's Other or multiracial cell (n = 19 in 2020) falls under the 50-respondent rule.

### 2. CES self-download

Any missing year downloads from the Dataverse access URL into `raw/ces/`. A live download of 2020 into a scratch folder had the same sha256 as the cached file. Downloading defaults to on for the real `raw/` and off when a test passes its own `raw_dir`, so the fixture tests never fetch 190 MB files. CPS and AP-NORC use the same default.

### 3. Poll seed loader

53 rows loaded as given (POLL 40, ELECTION_RESULT 13), none rejected, and a rerun leaves the count unchanged. pytest checks UMass-WCVB 2026-08 "Yes" 51 and CO 2024 general "Yes" 46.5 (n 2,980,316) field by field against the CSV, and covers rejection and moe-to-se on a scratch seed. An empty `subgroup_value` on an `all` row becomes the store's `all`. Each poll or result is its own slice; one that leaves the seed is deleted, except the AP-NORC microdata slice. Migration 005 adds the POLL and ELECTION_RESULT sources rows and the four constructs.

Two things in the seed you may want to change (I loaded both as given):

- **Party subgroup values are lowercase** (`democrat`, `republican`, `independent`), while the survey loaders and my AP-NORC rows use `Democrat` / `Independent` / `Republican`. A filter on `party = 'Republican'` misses the seed's rows.
- **AK Ballot Measure 2's "Yes" is a vote to repeal top-four**, so under `open_primaries_support` its Yes runs against the construct. The concordance note for `open_primaries_support` says this; a consumer charting Yes over time will still get it backwards unless that row is flipped or moved.

### 4. AP-NORC microdata

The zip is still up (830 KB: codebook PDF plus CSV, Stata, SAS and SPSS copies). Q8 is the item: "With the process of primaries and caucuses, the Republican and Democratic Parties determine which candidate will be their party's nominee. Which do you think is more fair way to select a nominee?" Weighted by `finalwt`, the file reproduces the codebook's 68.59 / 29.26 / 2.15 (open / closed / skipped) exactly, and pytest checks that.

That gives 30 rows: 10 subgroup cells × 3 options, under the seed's construct, `item_text` and response labels (read from the seed at run time). Open-primary support:

| Group | Open primary | n |
|---|---|---|
| Male / Female | 67.9 / 69.3 | 533 / 527 |
| 18–29 / 30–39 / 40–49 / 50–64 / 65+ | 76.6 / 62.8 / 71.3 / 67.0 / 64.7 | 190 / 152 / 161 / 301 / 256 |
| Democrat / Independent / Republican | 73.0 / 74.0 / 61.5 | 513 / 148 / 386 |

- **Age is `age_5`, not `age`.** AGEGRP's five groups match the shared buckets only at 18–29 and 65+, so, following Brief B's practice for GSS race, they sit under their own dimension.
- **The base keeps skipped or refused as its own option**, as the topline does (69 + 29 + 2). The subgroup shares are then directly comparable to the seed's rows.
- **Party counts leaners with their party**, using PARTY and the INDEP follow-up.

### 5. Geographies

The `geographies` table (migration 005) has 5,454 rows, one for every geo_code in norms. Names are the Census strings from the cached CVAP files (which cover every state, county, town and block group in the country), with the ACS responses as fallback. The six non-MA states in the seed are named the same way. `parent_code`: state to `US`, county to state, town and block group to county. `load` rebuilds the table after every run, and `python -m audience.geographies` rebuilds it alone. The audit fails on any unnamed code.

### 6. Export

`python -m audience.export` writes nine source files plus `index.json` into `public/audience-data/`, 97,022 rows with block groups excluded, the largest 3.42 MB (`gss.json`), so nothing split. The index lists 47 constructs (those with exported rows) and 373 geographies (US, 7 states, 14 counties, 351 towns). The export replaced the page's synthetic fixture whole, as that commit asked, and `census_cvap.json` is gone.

Where the contract left a value open, I followed the page's own code (`src/app/audience/audience-block.tsx`), which I read but didn't touch:

- **Topline rows carry null `subgroup_dim` and `subgroup_value`**, not the store's `"all"`. The page shows "All" only for null; with `"all"` every topline would read "all: all".
- **Dates are ISO strings** (`"2020-01-01"`). The page takes the first four characters, so they render as years.
- **`level` values are the store's** (`US`, `STATE`, `COUNTY`, `TOWN`); the fixture used `nation`/`state`. The page never reads `level`.
- **Page-side note:** the page formats any type other than pct and lift_pp as a whole number, so ANES's 626 `mean` rows (0–100 thermometers, e.g. 60.1) display as 60. A one-line change there would give `mean` one decimal.

After any reload, rerun `python -m audience.export` and commit `public/audience-data/`. Brief D's window confirmed its LIFT_ARCHIVE rows and labels were final before I committed `lift_archive.json`.

### Notes

- **Shared checkout:** the Brief D window and I split the shared files by agreement. It took migration 004, I took 005, and each of us committed only our own hunks of `load.py`, the README and the tests. Its migrate run applied my 005 to the real store, so 005 is frozen; any later schema change from this side goes in 006.
- **Lock retry:** `db.connect` waits out another process's DuckDB lock, 20 tries 30 s apart, with a test. The other window's read-only query layer uses its own helper.
- **Fixes to Brief B's tests, needed by the new pieces:** the audit test used POLL as its "no loader" example and now uses a made-up source. One Postgres test expected `ces_var == ['CC22_423']`, but the CES crosswalk records every year's variables, so the value is `['CC22_423', 'CC24_423']`; that expectation was already stale before my changes. The test also needed `geographies` rows before auditing.
- **Sources rows:** POLL points at the AP-NORC zip, and its license says toplines stay their publishers' and the codebook states no license. ELECTION_RESULT points at usa.gov's state election office directory, because Ballotpedia serves bot challenges and I couldn't verify a URL there. Each row carries its own office's page in `provenance_url`.
- **Environment:** I installed `openpyxl` into the venv only to read the P20 xlsx tables. It is not a dependency, and the tests hard-code the figures with their URLs.
