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

(append here)
