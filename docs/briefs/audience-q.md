# Brief Q — Topics for every GSS question

You are an Opus window taking Brief Q. Ground rules as before: commit locally per feature, never push; stage by explicit path, never `-A`; check `git log -1` immediately before any commit — several windows share this checkout. Never run tsc, a Next build, or a second dev server on this 8GB Mac (a hook enforces it; the dev server on :3000 is Brendan's — leave it alone). The store is single-writer: take `audience/store/.lock` before any store computation, release it after. Exports never enter git: they regenerate and upload to the audience bucket's `exports/` prefix (`https://pax-trinity-audience-638175140432.s3.amazonaws.com/exports/`), served at `/audience-data/`. Yours: the topics fetch and loader step in `audience/`, the regenerated `index.json` upload, and this file's Worker report — nothing else anywhere.

## What this is

Every GSS question gains its topic — the subject the GSS itself files it under — so the question library can group and filter by topic (INSTITUTIONAL TRUST, abortion, religion…) instead of raw alphabetical order, and /data-dictionary can carry a Topic column. The tags exist at NORC; our ingest never captured them: the cache at `s3://pax-trinity-audience-638175140432/raw/gss/data_explorer_variables.json` (6,955 entries) carries id, name, description and surveyQuestion only.

## Source

The GSS Data Explorer (gssdataexplorer.norc.org) files every variable under one or more **subjects** (and a module). The cache's numeric `id` resolves each variable's page (work out the URL pattern — variable pages and/or a bulk metadata route; their earlier per-variable JSON served the cache, so a scriptable route exists). Fetch politely: a delay between requests, a resumable loop, and sync the raw result to `raw/gss/` beside the wordings cache before loading anything — the fetch is the expensive part; never re-scrape what the bucket already holds. Document the exact route and its terms in the loader's docstring.

## The contract

`index.json` constructs gain one optional field: `topics: string[]` — the GSS's own subject tags, verbatim, in the source's order (first tag = primary). Every other field of every entry stays byte-identical; row files do not change. GSS only this pass; a question with no tag ships without the field, honestly.

## Done means

The raw subjects file synced to `raw/gss/`; the loader step committed (explicit paths); the regenerated `index.json` uploaded to the same key with the same posture; verified in Node against the served file — coverage count (target: the overwhelming majority of 5,541), tag vocabulary size, the ten most common tags with counts, and two spot-checks quoted against the Data Explorer pages (suggest: abany, othrel1). Report below with hashes and rulings for the lead; the UI side (middle-pane topic grouping, the dictionary's Topic column) is the lead's to wire after your report.

---

## Worker report

### Hashes

- Code: `af6cbd1` and `7811d20`.
  - `af6cbd1` is the step, `audience/audience/loaders/gss_topics.py`: `python -m audience.load gss_topics`, also run at the end of `load gss`. It also adds migration `010_gss_topics.sql` (`concordance.gss_topics`), the export's optional `topics` key, `Store.array_value`, `tests/test_gss_topics.py` and the README notes.
  - `7811d20` makes the report record where each construct's tags came from.
  - Both commits are HEAD plus my hunks only. Window R's Brief S lines in the shared files stayed out.
- `exports/index.json`: ETag/md5 `e88179fa226cd963e55a9cdb99ee6c9c`, 2,725,509 bytes, `application/json`, public read through the bucket policy. The previous file was Window R's: `bb8bc209…`, 2,504,924 bytes, families and no topics. Amplify's `/audience-data/index.json` serves the new ETag.
- Byte-identity against Window R's upload:
  - All 41 row files are identical.
  - `sources`, `geographies` and `families` are identical.
  - Every constructs entry is identical apart from the added `topics` (key order `construct, label, definition, wording?, topics?`).
  - I exported from a checkout of the commit (`git checkout-index` with `raw/` and `store/` linked in), so Window R's unfinished Brief S code didn't run. 82 tests pass in that checkout and the audit is clean.
- Raw files, both synced to `s3://pax-trinity-audience-638175140432/raw/gss/` and checked by downloading and comparing md5:
  - `data_explorer_subjects.json`: md5 `8c34d962e192ae7d5f7f3edf72d53138`, 20.6 MB, 6,955 records.
  - `data_explorer_details.json`: md5 `6bcd1f34cddd860c90c27c4181e03a54`, 8.5 MB, 1,305 page records.

### Route

The variable list the wordings cache came from already carries `subject`, `module` and `tag_info`; the cache simply dropped them. The route is `https://3ilfsaj2lj.execute-api.us-east-1.amazonaws.com/prod/guest-variable?page=<n>&limit=100`, with no key and the Explorer's `Origin` header.

- A page returns about 30 variables whatever the limit, and pages overlap. The fetch reads until three empty pages and keeps one record per id. I saved each record verbatim.
- The fetch matches the wordings cache exactly: the same 6,955 ids, with name and question text identical for every one.
- `tag_info` is empty for all 6,955.

For the 1,305 records the list leaves without a subject, I fetched each variable's own record. That's the endpoint the `vshow` page renders, found in the Explorer's JS bundle: `…/prod/variables/guest-details/<id>?workspace_id=NaN` (`NaN` is what the page sends for a guest). Where the list does have a subject, the page shows the same: 15 of 15 in a sample.

Both fetches are polite and resumable: half a second between requests, three retries, a checkpoint file, and no refetch without `--refresh`. Terms: GSS data and documentation are free for public use with citation (NORC). The Explorer states nothing else for these routes.

### Coverage, vocabulary, top tags

Node `fetch` of the served file (bucket URL): 200. **4,925 of 5,541 GSS questions carry `topics` (88.9%)**, and no non-GSS entry does. Where those tags come from:

| Count | Source of tags |
|---|---|
| 4,525 | the list |
| 399 | the variable's page, where the subject is just the name of the module that asked it |
| 1 | the page with a real subject (CODEN: `Religion`) |

The 616 untagged: 610 were first asked in 2010 or later (198 in the 2010s, 412 in the 2020s). PRES_TS and VOTE_TS have no Explorer record, and 4 are older. NORC hasn't filed its newest variables.

**Vocabulary: 184 tags.** Top ten across GSS questions:

| Rank | Tag | Count |
|---|---|---|
| 1 | Job | 360 |
| 2 | Religion | 290 |
| 3 | Split Ballots | 280 |
| 4 | Social Networks | 278 |
| 5 | Children | 235 |
| 6 | United States | 225 |
| 7 | Mental Health | 223 |
| 8 | Work | 205 |
| 9 | Computers And Internet | 177 |
| 10 | Science | 168 |

### Spot-checks, served file against the Data Explorer page

The page column is fetched live from the endpoint each page renders.

| Question | Page `subject` | Served `topics` |
|---|---|---|
| ABANY, [607](https://gssdataexplorer.norc.org/variables/607/vshow) | `["Abortion","Split Ballots"]` (module `["Core"]`) | `["Abortion","Split Ballots"]` |
| OTHREL1, [5321](https://gssdataexplorer.norc.org/variables/5321/vshow) | `["Religion"]` (module `["Religious Attendance and Identity"]`) | `["Religion"]` |

ABHELP1 ([7177](https://gssdataexplorer.norc.org/variables/7177/vshow), `["GSS Next"]`) and CONLEGIS are also pinned in the tests.

### Rulings for the lead

1. **Topic grouping alone scatters the review slice.**
   - The Rossi items read `Abortion` (ABRAPE adds `Rape`).
   - ABHELP1-4 and ABMORAL read only `GSS Next`.
   - The grid twins, ABFELEGL, ABMELEGL, ABINSPAY, ABSTATE1/2 and ABMEDGOV1/2 have no tag.
   - In the Congress set, TRCONG reads `ISSP Digital Societies` and TRLEGIS has none.

   Grouping by topic will need the construct layer, or a fallback, for the newer questions.
2. **The source order is alphabetical, not a priority.** 5,647 of the 5,650 tagged list records are alphabetical, and the other three only repeat their tags. So "first tag = primary" doesn't hold. I shipped the source order as the contract says, but the middle pane needs another rule for a question's home group, or multi-membership.
3. **399 questions are tagged only by a module name**: ISSP Digital Societies 69, Arts and Culture 55, Core 49, GSS Next 45, Work Orientation 31, NEA 26, and more. That's verbatim, and it's what their pages show, but it isn't a topic. `reports/gss_topics.json` lists them under `tagged_by_module_name`. If the UI shouldn't group by them, the cleaner fix is in the step: skip page subjects that equal the module, a one-line change, and coverage drops to about 82%. Say the word and I'll make it.
4. **Methodological tags**: `Split Ballots` (280) and `Interview` (4) describe how a question was fielded, not what it's about. They're candidates to hide in grouping and filtering.
5. **Shared constructs, same issue as wordings:** `party_id_7` (`Political`) and `ideology_7` (`Political`, `Split Ballots`) carry GSS's tags but are also served under ANES and CES.
6. **Pooled harmonized constructs take the union of their variables' tags**, e.g. `gov_reduce_income_diff`: `Inequality, Income`, `Split Ballots`, `Economy`, `Federal Government`, `Social Class`.
7. **Unused but available:** the page's `category` (ABANY: "Current Affairs") is coarser but sparse, 3 of 30 sampled, so I didn't fetch it for every variable. `module` (97 values) is in the raw list file for every record, so a module grouping needs no refetch.
8. **Payload:** `index.json` grows from 2.50 MB to 2.73 MB (gzip 426 KB).
9. **Process:**
   - Window R applied my 010 to the shared store during their own run, which was harmless.
   - Window R's Brief S regeneration will replace this `index.json` with a superset that keeps `topics`.
   - I held `audience/store/.lock` for the topics write and the export. Regenerating the report once opened the shared store without it, to read the concordance only, with nothing written.


### Follow-up: ruling 3 applied

The lead ruled that a module isn't a topic, and `fa8e26a` applies it. A page subject that is only the name of the module that asked the question is now skipped, and that question ships without `topics`. The raw files keep every module for a module grouping later.

- **Coverage: 4,526 of 5,541 GSS questions (81.7%)**: 4,525 from the list, plus CODEN from its page. The 399 skipped are named under `skipped_as_module_names` in `reports/gss_topics.json`.
- **Vocabulary: 155 tags.** The top ten are unchanged except that Mental Health falls from 223 to 203 and drops below Work, which keeps 205.
- **Served file:** `exports/index.json`, ETag/md5 `c35510ae6dbac0c0f25152096a437b37`, 4,518,792 bytes, regenerated from the current store. Against Window R's live superset (`8ffcb0f0…`) it drops the topics of those 399 entries and changes nothing else:
  - `questions`, `families`, `sources` and `geographies` are identical.
  - Every other constructs field is identical.
  - All 41 row files and all 8,034 per-question files are byte-identical, and only `index.json` was uploaded.
- **Checks:** verified in Node against the bucket URL; Amplify serves the same ETag. ABANY and OTHREL1 still match their pages, and ABHELP1, now untagged, is pinned in the tests.
