# Brief E — MA party enrollment replaces the voter-file stub

Same ground rules as C: touch only `audience/`, `public/audience-data/`, and this file; commit locally, never push; no fabricated values; `db.natural_key()`, slice-prune, concordance before norms, every row a real `provenance_url`.

## The swap

The MA voter file is not coming (lead ruling, 2026-10-25): what it was for — registration by party and unenrolled, by town and statewide — the Secretary of the Commonwealth publishes directly. Build `python -m audience.load ma_enrollment` on those published enrollment breakdowns and **retire `voterfile_ma` entirely** (loader, fixture, tests, README line, sources row) so the audit's "awaiting raw file" line for it disappears.

## The loader

- Find the published "registered voters and party enrollment" breakdowns by city/town on the Secretary's elections statistics pages (sec.state.ma.us). Take the most recent breakdown and as many prior statewide-election vintages as the published archive makes practical — each vintage is its own `source_version` and slice. Download into `audience/raw/ma_enrollment/`, cached; `curl_cffi` if the site refuses plain clients.
- Parse per town: total registered, Democrat, Republican, Unenrolled, and the published political designations. Keep the published categories; if you collapse small designations into one "Other designations" bucket, say so in the rows' notes and your report.
- Store count and pct (share of the town's registered voters) per category, town level and the statewide roll-up, source `MA_ENROLLMENT`, construct `registration_by_party` (concordance row with a one-line definition). `geo_code` is the town's GEOID via the geographies table — match on name; list any town that fails to match in your report rather than guessing (watch the usual suspects: Manchester-by-the-Sea, North Attleborough, villages that aren't towns).
- `item_text` is the published table's own title; provenance_url the actual file's URL; `n` the town's total registered where that's what the figure is based on.
- pytest: one statewide spot-check against a figure printed in the published document (cite the URL in the test), the idempotency rerun, and a fixture test of the name-to-GEOID matching.
- Rerun `python -m audience.export` so `/audience` picks the source up, and confirm the audit is clean with `VOTERFILE_MA` gone.

## Done means

Real data loaded for at least the latest vintage; voterfile_ma fully retired; export regenerated; audit clean; pytest green; report appended below.

---

## Worker report

**Done.** Commits `6f4329f` (loader, retirement, tests) and `6c0669f` (export), local, not pushed. `load ma_enrollment` ran for real over ten vintages, and a rerun leaves every count unchanged. The audit is clean, with VOTERFILE_MA gone from it. The export is regenerated, and pytest has 123 passed, 3 skipped. The skips are the Postgres tests, which pass on a throwaway local cluster (since removed).

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
  MA_ENROLLMENT     35,200 rows     352 geographies
  POLL                  70 rows       4 geographies
  total            213,518

rows missing provenance_url: 0
constructs in norms lacking a concordance row: none
norms geo_codes missing from geographies: 0
sources in the sources table with no rows loaded:
  awaiting raw file (loader exists, data absent): PAX_TEST (python -m audience.load pax_tests), WVS (python -m audience.load wvs)
  missing loader: none
```

### What the Secretary publishes

The Registration Statistics page (`/divisions/elections/research-and-statistics/registration-statistics.htm`; the old enrollment-statistics URL is now a 404) lists one PDF per state election, state primary, presidential primary and February 1 count, back to 2006. The newest is February 1, 2025, which the page labels "State Election Enrollment Statistics"; there is no 2026 file yet. The site sits behind a bot challenge that plain clients can't pass, so the loader downloads through `curl_cffi`. 2024 and 2025 also have accessible HTML versions.

Each PDF has two parts:

- **Page 1, "Enrollment Breakdown as of <date>":** a county table with percentages and a Statewide Totals row, including a Political Designations column.
- **The town pages, "Registered Voters and Party Enrollment as of <date>":** each county's aggregate row, then its towns. These pages print the total, the parties of that year and Unenrolled, but no Political Designations column.

I loaded the most recent breakdown and every prior state election back to 2008. The 2006 file and older use a different layout (counties numbered, percentages on every town row) and are not loaded.

| As of | Printed columns | Statewide registered | D / R / Unenrolled (%) |
|---|---|---|---|
| 2025-02-01 | D, R, U | 5,025,826 | 25.8 / 8.4 / 64.8 |
| 2024-10-26 | D, R, Libertarian, U | 5,142,343 | 26.3 / 8.5 / 64.2 |
| 2022-10-29 | D, R, U | 4,884,076 | 29.5 / 9.0 / 60.4 |
| 2020-10-24 | D, R, Green-Rainbow, Libertarian, U | 4,812,909 | 31.9 / 9.9 / 56.9 |
| 2018-10-17 | D, R, Libertarian, U | 4,574,967 | 33.1 / 10.3 / 55.3 |
| 2016-10-19 | D, R, Green-Rainbow, United Independent Party, U | 4,534,974 | 34.2 / 10.7 / 54.0 |
| 2014-10-15 | D, R, U | 4,301,118 | 35.3 / 10.9 / 53.3 |
| 2012-10-17 | D, R, Green-Rainbow, U | 4,342,841 | 35.7 / 11.1 / 52.6 |
| 2010-10-13 | D, R, Libertarian, U | 4,190,907 | 36.5 / 11.3 / 51.6 |
| 2008-10-15 | D, R, U, Green-Rainbow, Working Families | 4,220,488 | 36.9 / 11.6 / 50.7 |

### The loader

- **Rows:** source `MA_ENROLLMENT`, construct `registration_by_party`, one `source_version` and slice per as-of date (period = that date). For each of the 351 towns and the statewide totals, every printed column plus Political Designations is stored as a count and as a pct of registered voters. The pct rows carry `n` = registered voters. That is 35,200 rows.
- **Categories as published, no collapsing:** each vintage's own parties come from its header. The 2008 file prints "Green Rainbow" without the hyphen, and I store it as "Green-Rainbow".
- **Political Designations at town level is derived:** the town's registered voters less the printed columns, and each such row's note says so. On page 1 the published Political Designations column equals total minus the printed columns for every county in every vintage. For 2025, the Secretary's HTML table publishes it per town, and the derived figure matches it for all 351 towns.
- **`item_text`:** the published table's title, "Registered Voters and Party Enrollment as of October 26, 2024" for towns and "Enrollment Breakdown as of 10/26/2024" for the statewide rows. `provenance_url` is the PDF's URL.
- **Reading the PDFs:** they set each town's figures among dot leaders, and some digits are interleaved with the dots (Barnstable's total extracts as `3..7..,.6.1..1`). Plain text extraction also puts the total on a different line from the name, a different one in each layout generation. So the reader drops every `.` character from the town pages, which hold no decimals, and groups words into rows by their position on the page.
- **Checks before writing:** a file is refused unless it has 351 towns, its towns sum to each county row and to page 1, and page 1's counties sum to its statewide row. All ten pass.

### Name-to-GEOID matching

All 351 towns match the geographies table in every vintage, keyed by county and name after normalizing case and hyphens and stripping the Census suffix (" city", " town", " Town city"). No alias or guess was needed. Manchester-by-the-Sea and North Attleborough are printed under their full names in every vintage, and Census's 13 "Town city" places (North Attleborough, Barnstable, Weymouth, …) match once that suffix is stripped. The fixture test checks that the pre-1989 "MANCHESTER", "NORTH ATTLEBORO", a village (Hyannis) and a right name in the wrong county all stay unmatched and listed, never guessed.

### Retired

- The `voterfile_ma` loader, its test and its synthetic fixture.
- Its README row, build-order line and loader note, and its `constructs.py` entry (`party_registration`).
- Migration 006 deletes the VOTERFILE_MA sources row and the empty `party_registration` concordance row; the voter file never wrote norm rows.
- The fixture builder keeps the retired builder's random draws, so the GSS, ANES and CPS fixtures built after it from the same seed regenerate byte-identical.

### Tests

- The 2024 statewide row checked figure by figure against the printed Statewide Totals (URL cited in the test).
- The 2025 PDF checked against the accessible HTML table, all 351 towns, all five figures.
- The matching fixture.
- A file that doesn't add up is refused.
- A rerun leaves the count unchanged; every place's pct sums to 100; Boston's 2024 Democrats come to 174,046.
- No towns or no file: nothing written.

### Notes

- `ma_enrollment.json` is 3.98 MB, just under the 4 MB split threshold. One more vintage will split it automatically into `ma_enrollment-2.json`, which the index lists.
- New dependency: `pdfplumber` (pure Python), in `pyproject.toml`.
- `public/Reference Images/` is untracked and not mine; I left it alone.
