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

### Landed

`019af45`: `src/app/data-dictionary/` with three files. `page.tsx` and `dictionary-rows.tsx` are the glossary's two files duplicated with the content swapped. `dictionary-data.ts` builds the rows from the served index.

- **8,028 rows**, one per construct in `exports/index.json`, fetched on every request (`force-dynamic`). Term is the label, Definition the definition, Section the source's short name (SHORT_SOURCE copied in). The sort is A to Z by the glossary's letters-only collation, ties broken by construct id: 377 labels repeat across constructs.
- **The glossary's dress, line for line:** the same TableBlock, `fill`, the same column widths, header search, one-line rows that unfold on click, and the menu's Download. Title and metadata read "Data dictionary"; the search placeholder reads "Search the dictionary…". The glossary's "Shown as" line is gone, since the index carries no short name.
- **Section for constructs several sources carry** lists each source: `party_id_7` reads "ANES, CES, GSS", `trust_gov` "ANES, CES". Five constructs have more than one source.

### Seam: the index doesn't say which source holds a construct

`constructs` carries construct, label and definition; `sources` names files. Nothing links them, so Section can't come from the index. Every source file is sorted by construct with one row per line, so the page streams the 41 files and keeps only each line's first field. The resulting map is held per server process until the index's ETag changes. Checked in Node against the bucket:

- 8,028 rows, ids unique, every construct sectioned.
- Counts per source match the rail's seeds: GSS 5,541, ANES 1,518, CES 943, Turnout 12, U.S. Census 6, Polls 4, Lift 3, Voting Age 2, Tests 2, Results 2, Enrollment 1.
- First view after a restart or a re-export: 132 MB pulled from S3, about 4 seconds, 167 MB peak in a standalone Node process. After that, a 1.3 MB index fetch, about 0.1 seconds.

### Checks

- The dev server wasn't up on 3000, so I didn't load the route. I diffed both duplicated files against the glossary's: the differences are the content fields, the dropped "Shown as" line, and the comments.
- I ran `dictionary-data.ts` in Node against the live bucket (above). No tsc or build, per the rules. I used the repo's `TextDecoder` reader pattern and typed the map's tuples explicitly, to stay clear of the stream and tuple types that trip strict mode.
- Nothing outside `src/app/data-dictionary/` and this report moved.

### For the lead

1. **The scan is a stopgap worth replacing.** If the exporter wrote each construct's sources into its `constructs` entry (`"sources": ["ANES", "CES", "GSS"]`, about 100 KB on the index), the page would drop the scan and the 132 MB first view. It's additive, but earlier briefs fixed index.json's shape, so it's your call.
2. **Page weight.** 8,028 server-rendered rows: the row data is 1.15 MB of JSON in the payload, plus several MB of HTML. Search hides non-matching rows by text on each keystroke. I pass one array to both the rows and Download, so the data travels once instead of twice. As a side effect, Download carries the construct id as a column.
3. **Navigation** is yours, as the brief says.
