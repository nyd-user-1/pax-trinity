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

### Hashes

- **Code:** `c5f314b`. It adds `audience/audience/loaders/anes_topics.py` and `ces_topics.py` (`python -m audience.load anes_topics` / `ces_topics`, also run at the end of `load anes` / `load ces`), and migration `011_anes_ces_topics.sql` (`concordance.anes_topics`, `ces_topics`). The export's `topics` now merges GSS, ANES and CES tags in that order, each tag once. `gss_topics.write` takes the column. Tests are in `tests/test_anes_ces_topics.py`. I staged by explicit path and checked the index first; Window R's 012 and `canonical.py` stayed out.
- **`exports/index.json`:** ETag/md5 `ab69696b77fdf6f762312920103bd3b7`, 4,564,482 bytes, `application/json`, public read through the bucket policy. It replaced `c35510ae…`, the file live right before upload. Amplify's `/audience-data/index.json` serves the new ETag.
  - Against the replaced file: 711 questions gain `topics`, and `party_id_7` and `ideology_7` add ANES and CES tags after GSS's.
  - `sources`, `geographies`, `families`, `questions` and every other constructs field are identical, and so are all 41 row files and all 8,034 per-question files.
  - I exported from a checkout of `c5f314b`, with 56 tests passing there, including a full ANES load through the new hook. The audit is clean.
- **Store:** I applied 011 alone under the lock. Window R's 012 is theirs to apply.

### Routes

**ANES** — the Time Series CDF's variable list by subject. The CDF page links it as "Varlist": `https://electionstudies.org/anes_timeseries_cdf_codebook_Varlist`, which redirects to `wp-content/uploads/2019/09/anes_timeseries_cdf_codebook_Varlist.pdf`. The site refuses plain clients, so I fetched it once with `curl_cffi`.
- It files all 1,029 VCF variables under a Roman-numeral section and, for most, a lettered subsection, set in Calibri-Bold. All 648 of our CDF questions are in it.
- The 2026 variable codebook itself (HTML and PDF) carries no subject headings.

**CES** — the Guide to the Cumulative Common Content (Kuriwaki 2026, CC0), already in the bucket at `raw/ces/docs/`. Its bookmark outline files each of the cumulative's 75 variables under one section of "Variables". The step reads the outline (pdfminer, no scraping) and matches by variable name, which the CES keeps across years.

**Terms:** ANES data and documentation are free to use with citation. The CES guide is CC0 on Harvard Dataverse.

### Coverage, vocabulary, top tags

Node `fetch` of the served file (bucket URL): 200. Counts are by each source's own tags.

| Source | Questions with topics | Share | Own tags |
|---|---|---|---|
| ANES | 657 of 1,518 | 43.3% | 26 |
| CES | 57 of 943 | 6.0% | 10 |
| GSS | 4,526 of 5,541 | 81.7% | 155 (unchanged) |

Counted by question membership, the served file shows 29 ANES tags and 13 CES. The extra tags come from the shared `party_id_7`, `ideology_7` and `trust_gov`; `trust_gov`, served by both ANES and CES, carries ANES's `SYSTEM SUPPORT`.

ANES top ten:

| Rank | Tag | Count |
|---|---|---|
| 1 | CANDIDATE AND INCUMBENT EVALUATIONS | 143 |
| 2 | ISSUES | 100 |
| 3 | ENGAGEMENT AND INFORMATION | 93 |
| 4 | PERSONAL AND DEMOGRAPHIC | 65 |
| 5 | PARTISANSHIP AND ATTITUDES TOWARDS PARTIES | 56 |
| 6 | SYSTEM SUPPORT | 45 |
| 7 | PERCEIVED POSITIONS OF CANDIDATES/INCUMBENTS | 44 |
| 8 | IDEOLOGY AND VALUES | 40 |
| 9 | SOCIAL GROUPS | 40 |
| 10 | VALUES AND PREDISPOSITIONS | 31 |

CES, all ten of its own tags:

| Rank | Tag | Count |
|---|---|---|
| 1 | Presidential Vote | 12 |
| 2 | Demographics | 8 |
| 3 | House, Senate and Governor Vote | 8 |
| 4 | Economics and Income | 6 |
| 5 | Partisan Identity | 6 |
| 6 | Approval | 5 |
| 7 | Family Status | 4 |
| 8 | Turnout | 4 |
| 9 | Validated Turnout and Registration | 3 |
| 10 | News Interest | 1 |

Untagged, with reasons in `reports/anes_topics.json` and `ces_topics.json`:

- **ANES, 857:** the 2024 Time Series Study's own variables. The study's variable list, user guide and codebook group them only by interview phase (`PRE-ELECTION SURVEY VARIABLES`, `WEIGHTING VARIABLES`…). Its questionnaire item ids carry module codes (`CAMPINT_`, `GEND_`) the documentation never names.
- **ANES, 4** (VCF0019, VCF0111-0113): filed only under `X. IDs, Weights, and samples`.
- **CES, 886:** the yearly Common Content, which files nothing by subject anywhere:
  - The yearly guides tabulate it flat, and their "five parts" are fielding phases.
  - The questionnaires' modules are flow blocks (`commoncore`, `implicit_module_1`, `alreadyvoted`).
  - The 2020 and 2022 questionnaires name only programming pages.
  - The Dataverse files aren't ingested as tabular, so they carry no variable groups.

### Spot-checks, served file against the publisher's document

| Question | Document | Served `topics` |
|---|---|---|
| `party_id_7` (ANES VCF0301) | Varlist `I.   PARTISANSHIP AND ATTITUDES TOWARDS PARTIES` › `VCF0301    Party Identification of Respondent- 7-point Scale` | `["Political","PARTISANSHIP AND ATTITUDES TOWARDS PARTIES","Partisan Identity"]` (GSS, ANES, CES) |
| `vcf0876` | Varlist `III.   ISSUES` › `III.E.   ISSUES NONRACIAL CIVIL RIGHTS, RULES AND REGULATIONS` › `VCF0876    Law to Protect Homosexuals Against Discrimination` | `["ISSUES","ISSUES NONRACIAL CIVIL RIGHTS, RULES AND REGULATIONS"]` |
| `newsint` | guide outline `News Interest` › `newsint: News Interest` | `["News Interest"]` |
| `voted_pres_24` | guide outline `Presidential Vote` › `voted_pres_24: 2024 President vote choice (after voting)` | `["Presidential Vote"]` |

### Bucket keys added or changed (for the account copy)

- `raw/anes/topics/anes_timeseries_cdf_codebook_varlist.pdf` (added; md5 `b7c30cbb62e68a4bcc189a5f469c5bfa`, the list the step reads)
- `raw/anes/topics/anes_timeseries_2024_varlist_20260519.pdf` (added; md5 `ef4421f2fcfa420dd063f01ea4048018`, the 2024 list that groups by phase only)
- `exports/index.json` (changed)

If the copy began before Brief Q's keys landed, it also needs `raw/gss/data_explorer_subjects.json` and `raw/gss/data_explorer_details.json`.

### Rulings for the lead

1. **CES is thin, honestly.** Only the cumulative tier and the same-named yearly variables have a publisher filing, 57 of 943. The one CES-side filing I didn't reach is the CES team's Crunch dataset, linked from the CES homepage. It organizes variables into folders but needs an account; that's your call.
2. **ANES subsections repeat their section's word.** For example `ISSUES` › `ISSUES SOCIAL WELFARE`, verbatim as printed. Sections VI and XII print no heading of their own, so their subsections stand alone: `CIVIC PARTICIPATION`, `ENGAGEMENT AND INFORMATION`, `CAMPAIGN ACTIVITY`, `REGISTRATION, TURNOUT, AND VOTE CHOICE`, `Contextual - Election`, `Contextual - Vote Validation`. I didn't invent a parent for them.
3. **Order means something for ANES**: section, then subsection, so the first tag is the primary. CES has one tag per question. GSS stays alphabetical, per Q.
4. **Casing differs by publisher**: ANES headings are capitals, CES and GSS title case. They're delivered verbatim; display collapse is yours.
5. **Shared constructs merge across sources in GSS, ANES, CES order**, so `party_id_7` reads `Political`, `PARTISANSHIP AND ATTITUDES TOWARDS PARTIES`, `Partisan Identity`. If you'd rather each source's surface show only its own tags, the per-source columns are in the store, and an export split would be a contract change.
6. **What I counted as apparatus and left out:** ANES section X and section XI with its subsections (screener, interviewer observation, interviewer demographics), and CES Administration and Weights. I kept `Contextual - Election` and `Contextual - Vote Validation` (the election context and the validated vote) and CES `Geography` as subjects.

### Lead's rulings

1. **Crunch: skip.** An account-gated filing isn't worth standing up for 886 questions; CES stays thin and honest until a better source appears.
2. **Standalone subsections approved** — no invented parents.
3. **Order noted**; the collapse reads the first mappable tag, so the ANES section is the primary and an ISSUES subsection rides along unread.
4. **Casing stays verbatim**; the display collapse absorbs it (ANES MEDIA and GSS Media both land in Media & leisure).
5. **Merged cross-source tags stay as shipped** — no export split; the collapse makes them one topic anyway.
6. **Apparatus exclusions approved**, including keeping the Contextual pair and CES Geography as subjects.

The collapse landed in `audience-data.ts` the same night: two topics joined the rail (Elections & voting, Demographics), all 36 new tags mapped, bank-wide untagged down from 3,533 to 2,816.
