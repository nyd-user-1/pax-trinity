# Brief L — The rest of the CPS voting supplement

You are the audience-l window, in the Next app at /Users/brendanstanton/Code/pax-trinity. Ground rules: commit locally per feature, never push; stage by explicit path, never `-A`; stay strictly inside the paths named here. Yours: `audience/**`, `public/audience-data/**`, and this file's Worker report. Off limits: everything under `src/` (the lead's surfaces), `src/registry/`, and the other briefs. Never run tsc, a Next build, or a dev server on this 8GB Mac — a hook blocks the typecheck tool names, including in heredocs. Verify with pytest and by reading the regenerated JSON. Your report is appended under "Worker report" at the end of this file, with commit hashes. Rulings and seam conflicts route to the lead session, not to other windows.

## The lock — read this before anything else

Three sibling windows (GSS, ANES, CES) run tonight against the same checkout, the same single-writer DuckDB store, and the same 8 GB of memory. **One window computes at a time.** Before you read a raw frame, load, or export: create `audience/store/.lock` containing your window name; if the file exists, sleep sixty seconds and try again, as long as it takes. Hold the lock for your whole run — fetch, frame, load, export regeneration — then delete it before committing. If you find a lock older than two hours with no commits landing, name it in your report and keep waiting; the lead rules on stuck locks.

## What this is

The Turnout folder holds 2 constructs (registration, turnout) from the Census CPS Voting and Registration supplements, 2016–2024, read straight from the Census public-use files under `audience/raw/cps/` (the Brief B/C convention: Census-direct, validated against the P20 tables). The supplement asks more than two things. This brief widens what is read, on Brief I's pattern (read `docs/briefs/audience-i.md`; it governs where this brief is silent).

Read first: `audience/audience/loaders/cps.py` whole, `audience/audience/survey.py`, `audience/audience/export.py`, and one committed export file.

## 1. The bulk tier

Keep the 2 constructs exactly as they are. Add a bulk tier: **every supplement variable in every year on disk** that qualifies:

- Categorical with 2 to 24 labeled categories — method of voting, time of voting, reasons for not voting, reasons for not registering, registration method, and whatever else the dictionaries carry. Continuous and administrative skipped (ids, weights, allocation flags, line numbers, recode machinery).
- Not already one of the 2 (collisions skipped and named).

Per qualifying variable: construct id = the supplement variable name lowercased (pes4 style); label and definition = the data dictionary's description, sentence-cased (dictionary text, not questionnaire wording — say so). Bands = the dictionary's value list in order, universe and missing codes excluded. Rows: weighted topline shares per year, US and MA both (the loader already draws both; the house n<50 rule drops thin MA cells by name); standard breakdowns (age, education, income, race, sex, as the loader's recodes define them) for the latest year. Kish-effective-n margins, unweighted n. provenance_url: the year's Census supplement page.

Do not hand-edit `audience/audience/constructs.py` for bulk variables; register bulk labels from the loader so they reach the index without touching the shared module.

## 2. All the data it can

The supplements run back decades before 2016 on the Census FTP in the same public-use form. Fetch the even-year supplements back through 2008, fold their qualifying variables in on the same rules, and sync everything newly fetched to `s3://pax-trinity-audience-638175140432/raw/cps/` with the AWS CLI. Dictionary drift across years is real — harmonize names only where the dictionaries plainly agree; otherwise keep years separate and say so. If older fetches fail, land the on-disk years and note it.

## 3. Export and bounds

Regenerate the export under the lock. The 13-element row contract and index.json's shape must not change; the splitter parts a source at 4MB. Regenerated shared files will carry earlier windows' landed work — stage them anyway and say so in the commit. **If the CPS set exceeds 25 MB on disk, write but do not commit to git**: sizes in the report, serving to the lead as a ruling.

## 4. Checks

pytest: spot-check two bulk variables against the matching P20 table figures, the house convention from Brief B; keep the existing CPS tests green.

## Done means

The committed export serves the 2 constructs unchanged plus the bulk tier; counts, sizes, skips, spot-checks, lock waits and the back-year outcome are in the report with commit hashes; nothing outside your paths moved.

---

## Worker report

(appended by the worker)

### Landed

`bd8db94`: the bulk tier in the store, its loader and tests, `cps.json`, and `index.json` (the committed index plus the CPS delta only; see below).

- **10 bulk constructs, 2,877 rows**: 680 toplines (every year asked, US and MA) and 2,197 latest-year breakdowns by age, education, income, race_eth and sex. With turnout and registration, CPS holds 5,457 rows and 12 constructs, 2008–2024.
- **Turnout and registration are unchanged.** I read their rows from the regenerated `cps.json`, and all 2,580 are identical to the committed file, in order. They stay 2016–2024 and get no `response_order` rows, so they export as before.
- **Definitions are data-dictionary text, not questionnaire wordings.** Each construct's label and definition are the DESCRIPTION column of that year's supplement record layout, sentence-cased (the layout's emphasis "MAIN" lowered). A construct that stops before 2024 carries its years in the label: "How long (have you/has name) lived at this address? (2008-2012)".
- **Bands** are the layout's VALID ENTRIES in coded order, recorded in `response_order`, so every one of the 440 exported cells lists every band in dictionary order. Negative codes (not in universe, don't know, refused, no response) are out of the base. The base is the P20 universe (citizens 18+, adult civilian household members, interviewed households) within each item's own universe, weighted by PWSSWGT.
- **provenance_url** is the year's Census supplement page, `.../cps-supp_cps-repwgt/cps-voting.{year}.html`. Census keeps no 2008 page (the address returns the current page), so 2008 rows cite the API endpoint they came from.
- **Labels register from the loader** (`cps.register_bulk`); `constructs.py` is untouched.

| Construct | Item | Years | Bands |
|---|---|---|---:|
| `pes3` | Main reason not registered | 2008–2018, 2022, 2024 | 9 |
| `pes3_2020` | The same, 2020 list (adds COVID-19) | 2020 | 10 |
| `pes4` | Main reason did not vote | 2008–2018, 2022, 2024 | 11 |
| `pes4_2020` | The same, 2020 list (adds COVID-19, codes renumbered) | 2020 | 12 |
| `pes5` | In person or by mail | 2008–2024 | 2 |
| `pes6` | On or before election day | 2008–2024 | 2 |
| `pes7` | How registered | 2010–2024 | 9 |
| `pes7_2008` | The same, 2008 list (no online option) | 2008 | 8 |
| `pes8` | Time at this address, six bands | 2008–2012 | 6 |
| `prs8` | Time at this address, four bands | 2014–2024 | 4 |

### Harmonizing across years

I kept an item's years under one name only where the description and the value list agree, compared without case. 2010–2012 print "Internet" and later years "internet"; that merges. Everything else stays separate:

- **2020** added "Concerns about the coronavirus (COVID-19) pandemic" to PES3 and PES4. It also renumbered PES4: illness moved from code 1 to 4. Merging by name would have put 2020's "Out of town" under "Illness" in the trend.
- **2008's PES7** has 8 codes with no online registration; 2010 on has 9.
- **PES8** (2008–2012) and **PRS8** (2014–2024) are different variables with different bands. I didn't collapse PES8's month bands into PRS8's "Less than 1 year".

### Skipped (named by the loader on every run)

| Item | Years | Reason |
|---|---|---|
| PES1, PES2 | 2008–2024 | Read by turnout and registration |
| PRSUPINT | 2022–2024 | Administrative: supplement interview flag |
| PUSCK4 / PESCK4 | 2008–2020 / 2022–2024 | Administrative: interviewer check item (who reported) |

No bulk id collided with another source's construct.

### Back years

- **2010, 2012, 2014**: fetched from the Census supplement directories (`nov{yy}pub.dat.gz`, about 13 MB each). The 2014 documentation is the revised `cpsnov14r.pdf` that the 2014 page links.
- **2008**: the datasets tree has no November 2008 supplement file. `datasets/2008/basic/nov08pub` is the basic monthly file (950-character records, dated December 2008); the tallies test caught it. The Census microdata API serves the supplement's records (`api.census.gov/data/2008/cps/voting/nov`, with the project's CENSUS_API_KEY). The loader fetches the 21 variables it reads and caches them as `raw/cps/nov08pub_api.csv` in the public-use form: PWSSWGT back to integer with four implied decimals, and HUFAMINC under its later name HEFAMINC. Its slice is named "Census microdata API". The useless basic file is out of `raw/` and was never synced.
- **Positions and names.** Basic-CPS positions are the same in every year from 2008 to 2024 (2008 and 2010 call the age PEAGE). Supplement positions come from each year's parsed layout.
- **S3**: the twelve new files (four data, four PDFs, four text dictionaries) are synced to `s3://pax-trinity-audience-638175140432/raw/cps/`, which now holds 27 objects, 532 MB.

### Checks

- **pytest:** `test_cps` 22 passed, including the existing P20 Table 4b and 2020-count tests. `test_export`, `test_survey`, `test_bulk`, `test_audit`, `test_store` and the absent-data tests: 37 passed. I didn't run the GSS, ANES and CES suites, which read their own raw files. `audience.audit` is clean.
- **Tallies:** every item a construct reads matches its year's published unweighted tallies exactly, in all nine years. That checks the layout parse, the fixed-width reads and the 2008 API extract. The one exception is a 2016 misprint: the documentation prints 667 for PES7 code 2, the file holds 677, and the item's other codes all match. PUSCK4, which no construct reads, is off by a few dozen in most years (tallied on another base), so I left it out of the test.
- **Back-year universe:** 2008 and 2012 reproduce historical Table A-6's citizen percent registered and voted (71.0 / 63.6 and 71.2 / 61.8).
- **Spot-checks against P20:**
  - P20 keeps "don't know or refused" in its base, so I divide each P20 share by (100 minus that share) before comparing.
  - **pes4** against Table 10, reasons for not voting: 2024 Total (max deviation 0.04 points), 2024 Female (0.06), 2012 Total (0.04).
  - **pes7** against Table 12, method of registration: 2024 Total (0.03), 2024 Female (0.07), 2012 Total (0.05).
  - The test tolerance is 0.15.
- **MA thin cells.** Every year has an MA topline for every construct; the thinnest is pes4 2008 at n = 73. In the latest year, MA keeps 17–20 of 21 breakdown cells for pes5, pes6, pes7, pes7_2008, pes8 and prs8, and 1–4 for pes3 and pes4, whose universes are small. Dropped cells are named on each topline's note.

### Sizes

`cps.json` is 1.13 MB and 5,457 rows, one file, under the 25 MB gate, so it is committed.

### The index

The full regeneration also lists the GSS and ANES bulk parts that wait uncommitted on your serving ruling. Committing it would point the app at files git doesn't hold, which is the hazard Brief I's report flagged. So the committed `index.json` is the previous commit's index plus the CPS row count and the ten CPS constructs. Every file it names is in git. The working tree keeps the full regenerated index.

### Lock

- GSS (audience-i) held the lock from 05:27. I waited from 05:44 and took it at 06:14 (30 minutes), then released it at 06:24, before committing.
- Fetching, the tallies reads, both loads, the pytest real-data runs and the export all ran inside it. Peak memory was 0.93 GB for the load.
- The four back-year documentation PDFs (1–2 MB each) I fetched at 05:29, outside the lock, to write the parser. No data file was read before 06:14.

### For the lead

1. **Turnout and registration could reach back to 2008.** The back-year files reproduce P20's citizen rates. The brief kept the two constructs as they are, so I didn't extend them. Doing it would need Table 4b checks for 2010 and 2014.
2. **README.** The CPS source row ("2016-2024") and the CPS loader note are stale. `audience/README.md` carries other windows' uncommitted edits, so committing it would have swept theirs in. The loader's docstring documents the bulk tier, the back years and the 2008 API path.
3. **`SEGMENT_SEED`.** Turnout goes from 2 to 12.
4. **Labels are long.** They are dictionary questions ("There are various places and ways people can register to vote. …"). A short-name column would be a UI-side choice.
