# Brief M — /data-dictionary, the glossary's dress over the bank

You are the audience-k window, taking Brief M. Ground rules as before: commit locally per feature, never push; stage by explicit path, never `-A`. Yours this time: `src/app/data-dictionary/**` (new) and this file's Worker report — nothing else under `src/`, nothing under `audience/`, no shell or sidebar edits (the lead wires navigation). Never run tsc, a Next build, or a second dev server on this 8GB Mac; verify by loading the route on 3000 if the dev server is up, otherwise by reading your code against the glossary's. Report appended below with commit hashes; rulings to the lead session.

## What this is

/glossary (src/app/glossary/page.tsx and glossary-rows.tsx, 71 lines together) is a TableBlock filling the shell's fixed-height column: Term, Definition, Section, with the header search. /data-dictionary is **that page duplicated — no new components, no new dress, only new content**: one row per construct in the audience bank, all 8,028.

- Content comes from the served index: fetch `https://pax-trinity-audience-638175140432.s3.amazonaws.com/exports/index.json` server-side with `force-dynamic` (the file left git for S3 on 2026-10-26; nothing under public/audience-data can be imported). Its `constructs` array carries construct, label and definition; its `sources` array names each source.
- Columns map: Term = the construct's label; Definition = its definition; Section = the source's short display name (copy the SHORT_SOURCE values into your page rather than importing from the lead's audience-data.ts). Sort A to Z by label, the glossary's own letters-only collation.
- The bulk tiers' definitions are variable labels, not wordings — the page states nothing about that; it prints what the index says.
- metadata title "Data dictionary"; the TableBlock title the same; search placeholder "Search the dictionary…".

## Done means

/data-dictionary renders the glossary's exact dress with every construct, searchable; nothing outside your paths moved; report with hashes below.

---

## Worker report

(appended by the worker)
