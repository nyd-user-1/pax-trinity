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

Three routes standing, each its own commit, each smoke-checked by curl against :3000 (200 with the marker) and looked at headless for console errors (none). Shared pieces in `src/app/_wire/` (new); no existing file touched.

- `ecec054` **/q/[source]/[id]** — marker `data-dossier="gss/confidence_congress"`. Live: bars by wave with MoE whiskers (latest dark), OBSERVED chip, "2008–2024: 37.6 to 51.9 (+14.3 pp)", series high/low, the headline sentence, the 2024 crosstab on the headline band (Total, age, education, party, race, sex: est ±moe, vs total, n, ▲/▼ since 2008), Related constructs (every family member in every source that asks it, latest value and year), Provenance, source and geo chips (a state chip switches the page to that state: CES party ID reads MA).
- `df629f8` **/constructs** — marker `data-constructs=""`. Live: all 17 families, US latest ±moe, MA (party ID 18.1 from CES), sparkline, Δ since 2008, Sources. Rows read their files only near the screen, six in flight.
- `8871efa` **/electorate** — marker `data-electorate="ACS"`. Live: rail counts from the index (8,028 · GSS 5,541 · ANES 1,518 · CES 943 · Polls 4 · ACS 6 · CVAP 2 · CPS 12 · Enrollment 1 · Results 2); attitude rows link `/audience?source=<KEY>` (confirmed with `surfaces`); every slice source's MA share, count, geography, vintage, and town/county rows with vs MA.

**[—] left standing:** none for good. Each [—] is a not-yet-read cell (a construct row before it scrolls near, a related construct before its file lands) and fills in when the read lands. A cell the rows can't fill shows "—" (no MA rows, no 2008 wave). Every [—] in the pictures was computable.

**Flags**
1. *Headline band is a hand seed.* The pictures name one for 14 attitude constructs and the 6 Census dimensions. I seeded those and check each against the question's options. Multi-option bands are summed within one wave and cell, with no margin (1–3 (should), Agree + strongly, BA or higher, Under $50K). Every other question, including the ~300 constructs R lands tonight, reads its largest option at the latest wave, which can flip between waves. A `headline` field on families in the export would retire the seed.
2. *Some of the picture's numbers don't match the data.* 2024's 51.9 is the **fourth**-highest of 33 waves (2022 = 53.2), not "the highest level", and the page says fourth-highest. The series low is 1973 at 15.2. The picture's 14.3 is the 18–29 cell.
3. *The headline sentence is generic:* "On confidence in Congress, 51.9% of Americans answer hardly any. That is up from 37.6% in 2008 and the fourth-highest of 33 waves in the 51-year series." The picture's "have hardly any confidence in the people running Congress" needs per-question phrasing the data doesn't carry.
4. *Data for Window R:* `nationalism` and `national_pride_domain` carry two rows in every cell (two items under one id: 340 and 272 cells). The pages read the first, which matches the picture's 37.8.
5. *Provenance is missing three things the picture shows.* The served data has no extraction date, loader version or codebook entry, so those are left out. The loader prints only where one module writes the source. ANES and CES have bulk tiers, and Polls/Results have two loaders, so for those it's left out too.
6. *Used by:* the only real link in the app's data is the browser's draft survey (Add to survey). The card renders only when the draft holds the question. Batteries, segment cards and weighting targets don't exist yet.
7. *Related constructs* values are each sibling's own headline band (hover shows the band). The siblings sit on different scales.
8. */constructs grouping:* subject once R's anchors land. Until then the rail's topic collapse (America & the world, Economy & inequality, Politics & government, …). The picture's headings (Institutional trust, …) aren't in the data. Its non-family rows (Trust in government, officials don't care, parties care, egalitarianism, presidential approval, media trust) don't appear until they're families.
9. */electorate:* B05001 counts every age, so Citizenship's band is "Citizen" (by birth + naturalized), not "Citizen, 18+". CVAP carries the 18+ share. The Map chip is disabled because no map surface exists. County/Town are plain toggles: I dropped the ▾, since no menu sits behind them. The checkboxes pick which dimensions the place rows read. The six towns are the largest by the dimension's own count, so Quincy appears, not Brockton. Results' open_primaries_support has no MA rows ("—").
10. *Shell header* reads "Q" on the dossier, taken from the path. A `["/q/", "Question"]` TITLES entry is `surfaces`' call.
11. *Load weight:* each route reads the 4.5 MB index.json in the browser, the same as /audience, cached per tab.

### Lead's rulings

1. **The headline-band seed stands** for the picture's constructs; the real fix is a `headline` field on `families` — queued for the store, not tonight.
2. **Data over picture, approved**: 2024 reading fourth-highest where the wireframe guessed "highest" is the product working.
3. **The double rows on nationalism / national_pride_domain are flagged to Window R** with the concordance in flight.
4. **Provenance gaps** (extraction date, loader version, codebook entry) are export follow-ons, recorded.
5–6. Citizenship's honest band and the disabled Map chip: approved as shipped.
