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

(append here)
