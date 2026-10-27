# Brief T — Topics for ANES and CES

You are the Opus window that took Brief Q, taking its follow-on. Ground rules as before: commit locally per feature, never push; stage by explicit path, never `-A`; check `git log -1` immediately before any commit — several windows share this checkout. Never run tsc, a Next build, or a dev server on this 8GB Mac (a hook enforces it; there is no dev server running now and that stays true). The store is single-writer: take `audience/store/.lock` before any store computation, release it after. **Migration number 011 is yours** — claimed by this brief, frozen on disk whatever you name it. Exports never enter git: they regenerate and upload to the audience bucket's `exports/` prefix (`https://pax-trinity-audience-638175140432.s3.amazonaws.com/exports/`), served at `/audience-data/`. Yours: the ANES and CES topic fetches and loader steps in `audience/`, the regenerated `index.json` upload, and this file's Worker report — nothing else anywhere.

## What this is

Brief Q gave every GSS question its publisher's own subject tags — 4,526 of 5,541 carry `topics`, 155 tags after the module-name cleanup. ANES (1,518 questions) and CES (943) carry none, so the question library's topic grouping goes blank for a third of the bank. Same deal as Q: the subject the publisher itself files each question under, verbatim — never our invention.

## Sources

Work out the scriptable route the way Q did for NORC, and document it in the loader's docstring:

- **ANES** — electionstudies.org. The Time Series Cumulative Data File codebook groups every VCF variable under a subject heading, and the site's variable resources carry the same filing. Find the machine-readable form (codebook appendix, XLSX, or a JSON route behind the variable search). Map to our ANES question ids — `audience/audience/loaders/anes.py` shows the id scheme.
- **CES** — the cumulative CES (Kuriwaki, Harvard Dataverse) and the per-year codebooks file questions under sections (issue questions, demographics, validated vote…). Same: find the structured form, map to our ids per `ces.py`.

Fetch politely: delay between requests, resumable loop, raw results synced to `raw/anes/` and `raw/ces/` in the bucket before loading anything. Never re-scrape what the bucket already holds.

## The contract

`index.json` ANES and CES constructs gain the same optional field GSS already carries: `topics: string[]` — the publisher's tags, verbatim, in the source's order (first tag = primary). Every other field of every entry stays byte-identical; row files do not change. Apply Q's lesson: tags that name the fielding apparatus rather than a subject (module names, ballot/form bookkeeping) are stripped, with the skips recorded in `reports/`.

## Done means

Raw files synced; loader steps committed (explicit paths); the regenerated `index.json` uploaded to the same key with the same posture; verified in Node against the served file — per-source coverage counts, tag vocabulary size, the ten most common tags with counts, and two spot-checks per source quoted against the codebook. One more thing the earlier briefs didn't need: the bucket is mid-copy to the new AWS account, so list every bucket key you added or changed in the report. Report below, then ping the lead (`pax-trinity-1c`) by SendMessage. The UI collapse of raw tags into display topics is the lead's; deliver the publisher's tags faithfully.

---

## Worker report
