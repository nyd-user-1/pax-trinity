# Brief — Wireframes: three new surfaces

You are the window named `wireframes`. Brendan drew three surfaces in Claude chat; the PNGs are checked in at `docs/wireframes/` and **the picture is the spec** — read all three before writing a line. Ground rules: commit locally per feature, never push; stage by explicit path; **check `git log -1` immediately before every commit — four windows share this checkout tonight** (`surfaces` is refactoring the existing UI, `moving-day` touches clips' catalog, Window R works in `audience/`). **New routes and new components only: you do not edit any existing file.** Shared components may be imported as-is; if one needs a change to fit, copy it into your route's folder instead and flag the divergence. Never run tsc, a Next build, or a dev server; smoke-test by `curl` against the lead's dev server on :3000 (never restart it). House rules: **no "→" in UI ever** — the wireframes' "2008 → 2024" ships as "2008–2024", "Δ 2008→" as "Δ since 2008"; no explainer paragraph under a title; "chip"/"badge", never the p-word; first-person app voice where a voice is needed. The wireframes' **[—] placeholders are deliberate**: ship [—] where the number isn't wired; never invent one.

Data: `/audience-data/index.json` (sources, constructs with `wording`/`topics`, geographies, `families`, `questions`) and per-question rows at `/audience-data/q/<source-lower>/<id>.json` (13-element rows; see `src/app/audience/audience-data.ts` for the contract and helpers — import them).

## W1 — `/q/[source]/[id]`, the question dossier (`question-dossier.png`)

The full page for one question. Top to bottom, per the picture:

- **Trend block**: bars by wave (latest dark), an OBSERVED chip, the line "2008–2024: 37.6 to 51.9 (+14.3 pp)" composed from the question's own rows, the series-high/low note, the MoE note. Reuse what `question-chart.tsx` exports by import if it fits; otherwise build local.
- **Headline sentence**: the big block — latest topline, direction since the first comparable wave, where the latest sits in the series ("highest level in the N-year series"), then "year, ±moe, n". Compose only from computable facts; a clause you can't compute is omitted, not guessed.
- **Crosstab block**: latest wave, lead band; rows Total then the subgroup rows the data carries (age bands, education…): est ±moe, vs total, n, direction mark.
- **Right rail cards**: Related constructs (the question's family siblings from `families` — Window R grows that array ~17 to ~300 tonight; build against the served shape and tolerate both); Used by (only what's real in the app's data — if nothing links, the card doesn't render); Provenance (source's institutional label, extraction/loader line, this question's row count, a link that opens the raw `q/<source>/<id>.json`, and the provenance_url where rows carry one); source and geo chips at the foot.

## W2 — `/constructs`, the construct table (`construct-table.png`)

One row per construct from the export's `families`, grouped under its subject-area heading (R's data carries it; until his upload lands, group the 17 under their existing families' labels). Columns per the picture: Construct / Headline band / US latest / MA / Trend (sparkline) / Δ since 2008 / Sources. The lead question's rows supply the numbers — fetch per-question lazily and windowed (hundreds of constructs; never fetch all at once); [—] until loaded or where absent; the MA cell only where MA rows exist; Sources lists the member questions' sources (GSS · ANES · CES style, middots not arrows). Row click opens `/q/<source>/<id>`.

## W3 — `/electorate`, the population & electorate slice (`electorate-slice.png`)

- **Rail**: SCOPE (All sources, bank count) · ATTITUDES (GSS, ANES, CES, Polls with counts) · POPULATION & ELECTORATE (Census (ACS), Voting age (CVAP), Turnout (CPS), Enrollment, Results with counts) — all from the index. An attitudes source routes to /audience (plain href; coordinate the exact target with `surfaces`, which is renaming /inbox-2 to /audience tonight).
- **Middle**: the open source's dimension cards — title, HARM chip (the harmonized badge), one-line subtitle, geo-span line, per the picture.
- **Main**: the BY STATE / BY TOWN table — Dimension with its table id under it, Headline band with its HEADLINE chip, Share, Count / vs MA, Geography ("MA · 14 counties · 351 towns"), Vintage, a Map chip in Views (disabled if no map surface exists — flag it). MA / County / Town toggles top right. Fill what ACS/CVAP/CPS/enrollment/results rows actually carry; [—] where the wireframe shows [—].

## Done means

Three routes standing, each a path-limited commit, each smoke-checked by curl with a marker string noted in the report. Then message `surfaces` with the three hrefs (it owns the entry points on existing surfaces — you add none) and ping the lead (`pax-trinity-1c`) with the report below: what each surface shows live, every [—] left standing and why, flags for anything the pictures show that the data can't yet carry.

---

## Worker report
