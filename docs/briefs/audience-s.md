# Brief S — Per-question serving

Window R takes Brief S on Brendan's word, relayed by the lead (pax-trinity-1c) on 2026-10-26 after Brief R's report. Ground rules as P/Q/R: commit locally per feature with `git commit <paths>`, never push; take `audience/store/.lock` before any store computation; never run tsc, a Next build, or a second dev server (the dev server on :3000 is Brendan's); exports go to the bucket only, never git.

Rulings carried over from Brief R: `note` and `of` on the families shape are approved; ablegal under abortion_any_reason stands as a lead ruling, its note saying so rather than MR133.

## Mission

The GSS folder costs a fresh visitor about 73 MB, because the app downloads a whole source to show anything. Reshape the export so the list renders from the index alone and opening a question fetches only that question's rows.

## The work

1. **Index summaries.** Per question, computed at export: `first` (first wave year), `last` (last wave year), `waves` (count) and `options` (the band labels in coded order; the UI derives its scale family and band count from them). Everything existing stays byte-identical. Report the index's new size; it should land in single-digit MB.
2. **Per-question files.** One rows file per (source, question): `exports/q/<SOURCE_KEY>/<construct>.json`, a bare array of the existing 13-field rows, same contract, same public posture. Upload with a sync and the right content type. Leave the whole-source part files in place untouched: surfaces migrate off them, and nothing breaks meanwhile.
3. **The app.** In `src/app/audience/audience-data.ts`, add `fetchQuestionRows(source, id)` hitting `/audience-data/q/<SOURCE>/<id>.json`. Swap /inbox-2 (`audience-inbox.tsx`, `segment-list.tsx`) to render the list from the index summaries, with no source download, and to fetch a question's rows on open. The crosstab, Trend and Data views and the About panel consume the same `SourceRow[]` they do now. Cache fetched questions in state. /audience stays on its current path; the lead swaps it later. GSS first paint must drop from about 73 MB to roughly the index; give the measured numbers.
4. **Sequencing with Window-Q.** Q uploads index.json with topics next. Agree the order with Q, and regenerate the index only after Q's loader commit is in the tree, so the upload carries wording, topics, families and summaries together. Quote the final field list.

## Done means

Verified in Node against the served files: confidence_congress (1,629 rows) and two raw questions fetched per question and compared row for row with the old parts; the index summaries spot-checked against computed values. Report below with hashes, measured first-paint numbers and rulings for the lead.

---

## Worker report

Done. /inbox-2 renders a folder from the index alone and fetches a question only when it's on screen. The served index carries wording, topics, families and the new per-question summaries together.

### Hashes

- **2397d9b**: the export (per-question files, the `questions` array, tests, README).
- **89c7d5a**: the app (`audience-data.ts`, `audience-inbox.tsx`, `segment-list.tsx`).
- **This commit**: the brief and this report.

All three were path-limited commits. Window-Q's code is af6cbd1 and 7811d20; I regenerated after both.

### Measured first paint, GSS folder

| | raw | gzip -6 |
|---|---|---|
| Before: the old index (2.49 MB) plus 19 GSS part files (72.6 MB) | 75.1 MB | 5.1 MB |
| After: index.json alone | 4.54 MB | 0.60 MB |

Measured headless (Playwright) against the dev server: GSS selected and the list painted in about 3.2 s, with index.json the only data fetched. It is fetched twice in dev, a pre-existing double run of the fetch effect that dev mode causes; production fetches it once.

Opening a question then reads one file:

| file | raw | gzip |
|---|---|---|
| abany | 12.5 KB | 1.2 KB |
| confidence_congress | 311 KB | 16.6 KB |
| GSS party_id_7, plus its ANES and CES files for the About panel's comparison | 703 KB | 33 KB |

Production /audience-data/ answers 401 (the site is password-protected), so I couldn't measure what it compresses. S3 itself serves uncompressed.

### index.json as uploaded (the shape the reshape starts from)

- **Upload:** 4,535,473 bytes, sha256 `d119b5ca88b2d8478bcdc629c8b0109683f30159c141a5316c7f57749e1ce148`, 2026-10-27 01:55:18 UTC, application/json, AES256.
- **Unchanged part:** everything but `questions` is byte-identical to Window-Q's 01:52 upload (sha256 `65217db6…39a4`).
- **Replaced at 01:59 UTC** by Window-Q, on the lead's ruling: 4,518,792 bytes, sha256 `9af55701…7d7e`. I checked it: `sources`, `geographies`, `families` and `questions` are byte-identical to mine. The only change is 399 questions losing a module-name-only `topics` ("GSS Next"), leaving 4,526 with topics. The field list below still holds. My local dev copy now matches it.
- **Fields:**
  - `sources` ×41: `{source, label, rows, file}`
  - `constructs` ×8,028: `{construct, label, definition, wording?, topics?}`, 5,481 with wording and 4,925 with topics
  - `geographies` ×373: `{code, name, level, parent}`
  - `families` ×17: `{id, label, definition, anchor, note?, members: [{question, relation, of?}]}`
  - `questions` ×8,034: `{source, question, first, last, waves, options}`, one per (source, question) in export order, 1.70 MB of the index
- **Placement:** the lead approved this shape over fields on `constructs` entries. Five constructs span sources with a different span in each (party_id_7, ideology_7, trust_gov, race_eth, open_primaries_support), and the index had no source-to-question mapping.

### Per-question files

- **Where:** `exports/q/<source lowercased>/<construct>.json`, 8,034 files, 136.8 MB, application/json, synced before the index went up.
- **Contents:** each is the question's slice of `<source>.json`, same order, same 13 fields: 806,729 rows in total, matching the part files exactly.
- **Part files:** untouched. All 41 match the bucket's ETags.
- **Dev copy:** the local `public/audience-data/` (gitignored) now matches the bucket, so Brendan's dev server serves the new index and q/.

### Verification (Node, against the served S3 objects)

| question | rows | summary |
|---|---|---|
| GSS/confidence_congress | 1,629 | 1973–2024 · 33 waves · 3 options |
| GSS/abany | 90 | 1977–2024 · 29 · 2 |
| ANES/vcf0876 | 54 | 1988–2024 · 10 · 2 |
| GSS/party_id_7 | 3,816 | 1972–2024 · 35 · 8 |
| ANES/party_id_7 | 3,010 | 1952–2024 · 32 · 7 |
| CES/party_id_7 | 728 | 2020–2024 · 3 · 8 |

Each file matches the old part files row for row, and each summary matches the values computed from its served rows.

Headless on the dev server, with no page errors:
- the list renders from the index;
- opening ABANYG fills the Data table;
- party_id_7's Data, Crosstab and Trend views render, and its About panel compares CES and ANES;
- two checked boxes in vertical split build the grid.

Tests: 36 pass (export, layer, audit, store), including new checks of every per-question file and summary against its rows, and of stale-file cleanup. I didn't run the full suite, for the same memory reason as Brief R.

### Questions whose list numbers change (the lead's ruling: the index is the truth)

The old list counted only the lead option's rows, so it undercounted where that option skipped years:

| question | old | index |
|---|---|---|
| ANES/efficacy_internal | 1952–2012 · 22 | 1952–2024 · 25 |
| CES/multrace_97 | 2022 · 1 | 2022–2024 · 2 |
| ELECTION_RESULT/open_primaries_support | 2024 · 1 | 2022–2024 · 2 |
| GSS/gov_reduce_income_diff | 27 waves | 28 |
| LIFT_ARCHIVE/lift_favorability, lift_vote_choice, lift_vote_choice_dichotomized | 2018 · 1 | 2018–2020 · 2 |
| POLL/open_primaries_support | 2023–2026 · 3 | 2014–2026 · 5 |

### Flags and rulings for the lead

1. **Deploy order.** 89c7d5a needs `questions` in the served index. It is there now, so the batch is safe to push. Any future export must keep `questions`, or /inbox-2 lists nothing.
2. **One heavy file.** `q/ma_enrollment/registration_by_party.json` is a 7.96 MB single fetch (258 KB gzipped): every town in every vintage. It is the one outlier worth splitting later, by vintage or by town.
3. **/audience paid for this.** /audience still downloads whole sources (it swaps later, by your ruling), and its index grew from 2.49 to 4.54 MB (0.6 MB gzipped), almost all of it `questions`. /lift reads the same index.
4. **Rail counts.** The rail still shows `SEGMENT_SEED`, per your ruling; `questions` can replace it whenever you say. The seeds match today's export.
5. **Grid header.** The "N rows" count now counts the rows of the questions shown, not the whole source.
6. **Fixed during the work.** The stray comment printing above Crosstab and Trend (question-table.tsx) is fixed in your 0757a13.
