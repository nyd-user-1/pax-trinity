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

*(append here: hashes, the route used, coverage, vocabulary size, top tags, spot-checks, rulings)*
