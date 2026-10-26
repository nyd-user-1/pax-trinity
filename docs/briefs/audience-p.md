# Brief P — Verbatim question wordings for the GSS tier

You are an Opus window taking Brief P. Ground rules as before: commit locally per feature, never push; stage by explicit path, never `-A`; check `git log -1` immediately before any commit — several windows share this checkout. Never run tsc, a Next build, or a second dev server on this 8GB Mac (a hook enforces it; the dev server already on :3000 is Brendan's — leave it alone). The store is single-writer: take `audience/store/.lock` before any store computation, release it after. Data exports never enter git — they regenerate and upload to the audience bucket's `exports/` prefix (`https://pax-trinity-audience-638175140432.s3.amazonaws.com/exports/`), which Amplify serves at `/audience-data/`. Yours: the `audience/` Python package's wording step, the regenerated `index.json` upload, and this file's Worker report — nothing else anywhere.

## What this is

Every GSS question in the audience store gains its verbatim codebook wording — the sentence the interviewer actually reads — served in the export, so the /audience question cards read as survey questions from data instead of the six seeds the app window planted today. The bank's product sentence is "what America thinks, **in what wording**, measured by whom"; this brief is the middle clause.

Read first: `audience/README.md` and the loaders in `audience/audience/` (how constructs register and how the export writes), `src/app/audience/audience-data.ts` (the client contract: `AudienceIndex.constructs` is `{ construct, label, definition }`), and `src/app/audience/bank-surface.tsx` (the `WORDING` seed map your export replaces — read-only, the lead rewires the UI after your report).

## The contract

`index.json` constructs gain **one optional field**: `wording: string` — the verbatim question text exactly as the GSS codebook gives it, including the battery stem where an item belongs to one (the confidence battery's "I am going to name some institutions in this country…" joined to its item), whitespace-normalized and otherwise untouched. No paraphrase, no casing cleanup, no editorializing. Where codebook text genuinely differs across waves, carry the current form. Every other field of every constructs entry, for every source, stays byte-identical; the 13-element row files do not change at all.

## Sources, in order of preference

**Addendum (lead, 18:20): read the cache first.** Brief I's worker already synced a Data Explorer wordings cache — **6,937 surveyQuestion entries** — to `s3://pax-trinity-audience-638175140432/raw/gss/data_explorer_variables.json`, and the lead approved it for exactly this pass. Start there: it likely covers most of the 5,541 outright. Fall to the routes below only for what the cache lacks, and report cache coverage vs. fetched coverage separately.

1. **NORC's own machine-readable metadata.** The GSS Data Explorer (gssdataexplorer.norc.org) exposes per-variable question text; NORC also publishes the cumulative codebook. Find the most scriptable route and document it with URLs in the loader's docstring.
2. **The gssr R package's `gss_dict`** (Kieran Healy) maps variable → question text if NORC's route resists scripting — verify its license and provenance before relying on it, and say which you used.
3. **GSS Methodological Report MR133** (Cowan, Hout & Perrett, 2021 — the abortion time-series paper) carries the verbatim Rossi battery stem and the 2018 module texts. Use it to **spot-check** the abortion battery (abany, abdefect, abrape, abhlth, abnomore, abpoor, absingle, the abhelp quartet, abmoral, abstate1/2, abinspay, abmedgov1/2, abfelegl, abmelegl), not as the bulk source.

## Scope

All 5,541 GSS questions where a codebook text exists — the raw tier keyed by GSS mnemonic and the 15 harmonized constructs both. For the harmonized pair the slice shows today: `confidence_congress` takes the CONLEGIS battery text; `party_id_7` takes PARTYID's ("Generally speaking, do you usually think of yourself as a Republican, Democrat, Independent, or what?") — verify both against the codebook rather than trusting this brief. Report the exact coverage count and a sample of what's missing and why; a grid-on-web twin that shares its parent's text should say so rather than go empty.

## Done means

The loader step committed (explicit paths); the regenerated `index.json` uploaded to the bucket at the same key with the same public-read posture; verified in Node against the served file — fetch `/audience-data/index.json` via the bucket URL, confirm `wording` present for the six slice ids (confidence_congress, concong, conlegiy, trcong, trlegis, party_id_7) and for two Data Explorer spot-checks of your choosing from the raw tier, quoted side by side with the source in the report. Report below with hashes, the coverage count, and rulings for the lead.

---

## Worker report

### Hashes

- Code: `94b0593`. New step `audience/audience/loaders/gss_wording.py` (`python -m audience.load gss_wording`, also run at the end of `load gss`), migration `008_gss_wording.sql` (`concordance.gss_wording`), the export's optional `wording` key, `Store.column_exists`, tests in `tests/test_gss_wording.py`, README notes.
- `exports/index.json`: ETag/md5 `ecbf634dfb4beab10a0a5a9ddaa16720`, 2,494,410 bytes, `application/json`, public read through the bucket policy as before (was `319b0f99…`, 1,305,998 bytes). Amplify's `/audience-data/index.json` serves the same ETag, brotli-compressed.
- Byte-identity: all 41 row files regenerated byte-identical to the served set. In `index.json`, `sources` and `geographies` are identical, and every constructs entry is identical except for the added `wording` key (key order `construct, label, definition, wording`). Only `index.json` was uploaded. Audit clean; 234 tests pass, 3 skip.

### Coverage

**5,481 of 5,541** GSS questions carry a wording:

- 5,479 from the cache (raw tier and harmonized).
- 0 from a live refetch of the Explorer list. It came back identical: 6,955 entries, 6,937 with text.
- 2 from NORC's printed codebooks, for entries the Explorer leaves blank: CLASS (cumulative codebook 1972-2018, question 201A) and UNION (2024 Codebook R3a).

The 60 without a wording:

| Count | Reason | Examples |
|---|---|---|
| 26 | a header or label in capitals, not a question | `degree` ("RESPONDENT'S DEGREE"), `padeg`, `maeduc`, `region`, `zodiac` |
| 21 | a derived variable whose text says how it was built | `adults`, `babies`, `childsinhh`, `migage` ("Constructed from variables AGE, YEARSUSA, and MNTHSUSA"), `reltrad`, `whovotets` |
| 7 | the Explorer entry is empty | `racdif1x`-`racdif4x` (the 2024 codebook prints their longer intro but cuts each label off mid-item: "Do you think these differences are…because most"); `cosector` (coded from college data); `neaeligible`, `nexteligible` (follow-on eligibility flags) |
| 3 | a harmonized construct that pools several questions | `national_pride_domain` (10), `gov_reduce_income_diff` (3), `nationalism` (2) |
| 2 | no Explorer entry | `pres_ts`, `vote_ts` (combined from PRES68-PRES20 and VOTE68-VOTE20) |
| 1 | withheld | `ethregion95` (Other Oceania): the Explorer repeats ETHREGION89's item, "Jamaica" |

The grid-on-web twins never fall back to their parent's text: all seven (`abanyg` … `absingleg`) carry their own web-form wording in the Explorer.

### Source route and license

The GSS Data Explorer's public variable list (NORC): `https://3ilfsaj2lj.execute-api.us-east-1.amazonaws.com/prod/guest-variable?page=<n>&limit=100`, one `surveyQuestion` per mnemonic. Each variable's page is `https://gssdataexplorer.norc.org/variables/<id>/vshow`. I used the cache Brief I synced, `raw/gss/data_explorer_variables.json`, whose md5 `2021bf22…` matches the bucket copy. The API has no per-variable or per-year endpoint.

The 2024 Codebook R3a prints question text for some variables but only the short label for most (973 entries), so I used it as a cross-check, not a source. GSS terms: free public use with citation (README sources table). I didn't need gssr.

The Explorer prints the codebook page, not just the question, so the step keeps what a respondent hears and removes what surrounds it. It never rewords or recases:

- Encoding repairs: cp1252-garbled punctuation decoded (`Iâ€™m` becomes "I'm"). Characters the list lost outright are restored from position: an apostrophe inside a word, quotation marks around a phrase, otherwise the ellipsis MR133 prints between a stem and its item. Doubled apostrophes (`woman''s`) become single, as the printed codebook has them.
- Layout: item letters dropped, so a battery item reads as its stem joined to its item, the way `gss.ITEMS` writes them.
- Interviewer directives removed, but only whole: a bracket that opens with a directive word, a capitals sentence carrying one. A directive that runs into lowercase stays. Analysts' notes cut.
- Kept: fills (`[NAME]`, `[CURRENT STATE]`, `(CURRENT MONTH)`) and respondent-facing instructions ("(Choose all that apply.)").

### Spot-checks, served file against source

Node `fetch` of `https://pax-trinity-audience-638175140432.s3.amazonaws.com/exports/index.json`: 200, `wording` present and non-empty for all eight ids below. Of 8,028 constructs, 5,481 carry `wording` and none carry an empty one.

| id | Source (Explorer `surveyQuestion` unless noted) | Served `wording` |
|---|---|---|
| `confidence_congress` | CONLEGIS: "I am going to name some institutions in this country. As far as the people running these institutions are concerned, would you say you have a great deal of confidence, only some confidence, or hardly any confidence at all in them?  \nREAD EACH ITEM; CODE ONE FOR EACH.\nL. Congress". The 2024 codebook: "(I am going to name … in them?) Congress" | "I am going to name some institutions in this country. As far as the people running these institutions are concerned, would you say you have a great deal of confidence, only some confidence, or hardly any confidence at all in them? Congress" |
| `concong` | "How much confidence do you have in. . . \nA. U.S. Congress" | "How much confidence do you have in. . . U.S. Congress" |
| `conlegiy` | "I am going to name some institutions in this country. Some people have complete confidence … Where would you place yourself on this scale for . . .\nREAD EACH ITEM, CODE ONE FOR EACH. REPEAT THE QUESTION AS NECESSARY.\nL. Congress" | "I am going to name some institutions in this country. Some people have complete confidence … Where would you place yourself on this scale for . . . Congress" |
| `trcong` | "On a scale of 0 to 10, how much do you personally trust each of the following institutions? 0 means you do not trust an institution at all, and 10 means you trust it completely….The U.S. Congress." | same text |
| `trlegis` | "How much do you trust the U.S. Congress?" | same text |
| `party_id_7` | PARTYID: "Generally speaking, do you usually think of yourself as a Republican, Democrat, Independent, or what?" (the 2024 codebook matches) | same text |
| `confinan` (raw tier, [Explorer 448](https://gssdataexplorer.norc.org/variables/448/vshow)) | "I am going to name … at all in them?  \nREAD EACH ITEM; CODE ONE FOR EACH.\nA. Banks and financial institutions" | "I am going to name some institutions in this country. As far as the people running these institutions are concerned, would you say you have a great deal of confidence, only some confidence, or hardly any confidence at all in them? Banks and financial institutions" |
| `trcourts` (raw tier, [Explorer 7257](https://gssdataexplorer.norc.org/variables/7257/vshow)) | "Using the following scale ranging from 0 to 10, where 0 means ï¿½No trust at allï¿½ and 10 means ï¿½Complete trustï¿½, please indicate how much trust you personally have in America's courts?" | "Using the following scale ranging from 0 to 10, where 0 means “No trust at all” and 10 means “Complete trust”, please indicate how much trust you personally have in America's courts?" |

MR133 abortion check (`tests/test_gss_wording.py`): the seven Rossi items, the abhelp quartet, abfelegl, abmelegl, abstate1/2 and abinspay match MR133 word for word. The comparison ignores case, curly marks and spacing. The one exception is ABMORAL: MR133 prints "Leaving aside whether you think…", but the Explorer and the printed 2024 codebook both read "whether **or not** you think…", so I carried the codebook. Two smaller differences:

- ABMELEGL lacks MR133's comma in "legally or not, or would" (punctuation only).
- The 2024 codebook gives ABRAPE "If she **becomes** pregnant…". The Explorer, MR133 and Berkeley's SDA 2024 codebook all read "became". The web twin ABRAPEG reads "becomes", which looks like where the codebook's label came from. I carried "became".

The harmonized cross-check matches too: for 11 of the 12 single-question harmonized constructs, the Explorer text equals the wording `gss.ITEMS` transcribed from the printed codebooks. NATIONAL_PRIDE adds its web form's "(Please, select one response)".

### Rulings for the lead

1. **The cards will change text.** Only 3 of the 30 seeds in `audience-data.ts` match the codebook verbatim (`party_id_7`, `abfelegl`, `abinspay`):
   - The Congress seeds are phrased from response bands. CONLEGIS is the battery stem plus "Congress", and TRLEGIS has no 0-10 preamble.
   - The Rossi seeds join stem and item as "…abortion if there is…", where the codebook reads "…abortion if. . . If there is…".
   - The grid twins carry the web stem, "(Please indicate whether or not … . . .) If…".
   - ABSTATE1/2 read "[CURRENT STATE]", not "your state". ABHELP uses "…", not " —".
   - ABMORAL reads "whether or not".
2. **One wording per construct, but two constructs are shared.** `party_id_7` (also ANES and CES) and `ideology_7` (also ANES) now carry GSS's text. The column is named `gss_wording` so ANES and CES can get their own later. Until the contract is per-source, I'd show `wording` for those two on the GSS surface only.
3. **Fills stay verbatim**: `[CURRENT STATE]`, `[NAME 1]`, `(John/Mary)`, `(CURRENT MONTH)`, `{#_spfill1}`. The UI decides how to render them.
4. **Stem joins are the codebook's own punctuation**: "if. . . If there is", "in. . . U.S. Congress", "completely….The U.S. Congress." If the cards should set stem and item on separate lines, the export would need separate `stem`/`item` fields. That's a contract change I didn't make.
5. **One erratum, one-line revert.** The seven grid twins' "Pleae indicate" reads "Please indicate". The printed codebook has no "Pleae" anywhere. Deleting the `ERRATA` entry restores the Explorer's spelling.
6. **Pooled harmonized constructs.** For `national_pride_domain` and `nationalism`, the battery stems are available if you want stem-only titles: "How proud are you of America in each of the following?" and "How much do you agree or disagree with the following statements?". `gov_reduce_income_diff` has no common text.
7. **Residue.** 6 long-tail wordings keep a partial directive the conservative rules won't cut: `bible`, `bibley`, `educ`, `numgiven`, `othlobby`, `othself` (e.g. "If LESS THAN 5 NAMES MENTIONED, PROBE, Anyone else?"). The Explorer also has broken line escapes in a few household-roster and composite entries (`close25` ends "… n7. Closeness of Second and Fifth Persons"). None of these are in the slice. `reports/gss_wording.json` has every construct's raw text next to its wording.
8. **Payload.** `index.json` grows from 1.31 MB to 2.49 MB (gzip 198 KB to 402 KB; Amplify serves brotli), and `/audience` loads it up front. If parse time shows, the wordings could move to their own `wordings.json` fetched on demand.
9. **Bucket store copy.** `s3://…/store/` predates migration 008. A window that syncs the store down from the bucket loses the wordings until `load gss_wording` reruns (seconds, no raw frame). I didn't sync the store: that's outside this brief.
10. **Lock.** I held `audience/store/.lock` for every store write and export, and released it. The full pytest run (temporary stores only, never the shared one) ran without it.
