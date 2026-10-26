# Brief B — Audience database: CPS turnout loader and the Tier-2 survey loaders

You are a worker window in `/Users/brendanstanton/Code/pax-trinity`. Another session (lead-agent) coordinates; append your report to the bottom of this file when done. Commit locally; **never push**. Touch only `audience/` and this file — never `src/`, never `/inbox`. **Run Brief A's worker first or confirm `audience/` exists with the schema applied** (check `docs/briefs/audience-a.md` for its report); this brief builds on that module and must not redefine the schema.

Ground rules carried over from Brief A: every row needs `provenance_url`; upsert on the sha256 natural key (source + source_version + geo_code + period_start + period_end + construct + item_text + response_option + subgroup_dim + subgroup_value); **never fabricate a value** — a loader whose raw data is absent prints download instructions and exits 0.

## Loader 3: `python -m audience.load cps`

CPS Voting & Registration Supplement, Nov 2016, 2018, 2020, 2022, 2024, via the **IPUMS CPS API** (`IPUMS_API_KEY` in `audience/.env`; free registration — if absent, print instructions and exit 0).

IPUMS is **asynchronous**: you POST an extract definition, poll until it is built (minutes), then download. Build the loader accordingly:
- Define the extract once in code (samples: the five November supplements; variables: VOSUPPWT, VOTED, VOREG, AGE, SEX, RACE, HISPAN, EDUC, FAMINC, STATEFIP).
- Cache the downloaded extract under `audience/raw/ipums/` keyed by a hash of the extract definition, so reruns use the cache and never resubmit.
- Compute turnout and registration rates (weighted by VOSUPPWT) by sex, age bucket (18-29/30-44/45-64/65+), race/eth, education (4-cat), family income bucket — for US and for MA (STATEFIP 25) — per year. Follow the Census convention: exclude refusals/no-response from the denominator and say so in `provenance_note`.
- pytest: spot-check the 2020 national citizen turnout figure against the published Census P20 table, URL cited. Also a fixture-based unit test of the rate computation so CI passes without the API key.

## Loader 4: `python -m audience.load voterfile_ma`

If `audience/raw/ma_voterfile/*.csv` exists, compute registration by party/unenrolled, by town and statewide. It will not exist yet: write the real parsing logic against a 50-row fixture you construct (party codes D/R/U/L and a town column), a test over the fixture, and a README line on obtaining the file from the MA Secretary of the Commonwealth. Exit 0 with instructions when absent.

## Loader 5: `python -m audience.load gss` (real data, end-to-end)

GSS needs no registration: the cumulative cross-sectional file (1972–2024) downloads directly from https://gss.norc.org/get-the-data.html in Stata format. The loader downloads it once into `audience/raw/gss/` (gitignored) and caches it. **The file has thousands of variables — read only the needed columns** (pyreadstat/pandas column selection), never the whole file; this machine has 8GB of RAM. Codebook: https://gss.norc.org/content/dam/gss/get-documentation/pdf/codebook/GSS%202024%20Codebook%20R3a.pdf (variable browser: https://gssdataexplorer.norc.org/variables/vfilter).

Constructs: CONFED, CONLEGIS, CONPRESS, TRUST, FAIR, HELPFUL, POLVIEWS, PARTYID, national-pride ISSP items, GETAHEAD, EQUALIZE-type items, ATTEND. Weights WTSSALL / WTSSNRPS as the codebook directs per era. Store yearly US toplines and by sex/age/race/educ/party where cell sizes allow (n ≥ 50, else skip the cell and say so in provenance_note). pytest: spot-check one published figure with the URL cited, plus a fixture-based unit test of the recode logic.

## Loaders 6–8: ANES (real data), CES + WVS (fixture-first)

CES and WVS raw files will not be present (registration walls); their loaders parse what they find in `audience/raw/<source>/`. For each, write the full loader against `audience/raw/<source>/`, a **50-row fixture constructed from the documented codebook** (real variable names, real response codes, invented respondents — fixtures live in `audience/tests/fixtures/`, clearly marked as synthetic), pytest over the fixture, and printed download instructions when the raw file is absent. Never load fixture rows into the real store.

- **ces**: CES common content 2020/2022/2024 (Harvard Dataverse, .dta or .csv). US and MA (`inputstate==25`). Constructs: party_id_7, ideology_5, pres_approval, trust_gov, efficacy, media_trust; search the codebook for "primar" and include any election-administration/primary items found.
- **anes** — REAL DATA, end-to-end, not fixture-first: the site 403s plain HTTP clients but serves `curl_cffi` (pip, `impersonate="chrome"`). Download https://electionstudies.org/anes_timeseries_cdf_stata_20260205/ (32.8MB zip, no login; verified 2026-10-25) once into `audience/raw/anes/`, cached. Keep the fixture unit test for the recode logic alongside the real run. Constructs 1952–2024: party_id_7, ideology_7, trust_gov (VCF0604), efficacy_external (VCF0609), efficacy_internal, parties_care (VCF0613), thermometer_dem, thermometer_rep, candidate traits (honest / cares / strong leader / knowledgeable), the egalitarianism battery, national pride if present. Weight VCF0009z.
- **wvs**: World Values Survey wave 7 US file. Schwartz-style value items (security, hedonism, tradition, universalism), democracy and institution-confidence items.

For every construct a loader touches, add the per-source variable names to the `concordance` row (create the row if missing, definition one line). Where wordings differ across sources, each verbatim wording goes in `norms.item_text`; note the difference in `concordance.notes`.

## Audit + README

Extend `python -m audience.audit` so "sources not loaded" distinguishes *awaiting raw file* (loader exists, data absent) from *missing loader*. Extend the README sources table with these five sources (registration Y, where to drop files).

## Done means

CPS runs end-to-end for real if the key is present (say in your report whether it did); all fixture loaders green under pytest; audit clean; committed locally (attribution per repo convention); report appended below with audit output.

---

## Worker report

**Done, except CPS's real run.** Commit `0a22827` on main, local, not pushed. GSS, ANES and CES ran end to end on real data; CPS, the MA voter file and WVS are built and green on fixtures, and print how to get their files. pytest: 81 passed, 3 skipped. Two skips are the Postgres tests, which need `AUDIENCE_TEST_DATABASE_URL`; I ran both against a throwaway local Postgres 18 cluster and they passed, then removed it. The third is the CPS P20 spot-check, which needs a real IPUMS extract.

**CPS did not run for real: there is no `IPUMS_API_KEY`** in `audience/.env` or anywhere else on this machine. The loader prints the registration steps and exits 0.

### Audit

```
store: duckdb /Users/brendanstanton/Code/pax-trinity/audience/store/norms.duckdb

rows per source
  ACS               23,488 rows     367 geographies
  ANES              26,593 rows       1 geographies
  CES                3,151 rows       2 geographies
  CVAP              89,016 rows   5,448 geographies
  GSS               31,824 rows       1 geographies
  total            174,072

rows missing provenance_url: 0
constructs in norms lacking a concordance row: none
sources in the sources table with no rows loaded:
  awaiting raw file (loader exists, data absent): CPS (python -m audience.load cps), VOTERFILE_MA (python -m audience.load voterfile_ma), WVS (python -m audience.load wvs)
  missing loader: none
```

Rerunning `gss`, `anes` and `ces` left every count unchanged.

| Loader | Data | Periods | Places | Rows |
|---|---|---|---|---:|
| `gss` | real: cumulative R3a, 36 of 6,943 columns read, 775 MB peak memory | 35 survey years, 1972-2024 | US | 31,824 |
| `anes` | real: CDF release 2026-02-05, 37 of 1,030 columns read | 32 study years, 1952-2024 | US | 26,593 |
| `ces` | real: 2020, 2022, 2024 common content | 3 | US, MA | 3,151 |
| `cps` | fixture; no IPUMS key | 2016-2024 | US, MA | 0 |
| `voterfile_ma` | fixture; the file is restricted | snapshot date | MA, 351 towns | 0 |
| `wvs` | fixture; registration form | 2017 | US | 0 |

### Spot-checks

- **GSS, in pytest on the real file.** The 2024 codebook (R3a, CONFED, p. 220) prints unweighted 2024 shares of 12.4 / 40.8 / 46.8% with n = 2,145. The loader's read and recode reproduce all four exactly, and the stored weighted row has n = 2,145 with weight WTSSNRPS. https://gss.norc.org/content/dam/gss/get-documentation/pdf/codebook/GSS%202024%20Codebook%20R3a.pdf
- **CPS, outside pytest.** With no IPUMS extract available, I mapped Census's own 2020 public-use file (`nov20pub.csv`, no registration) onto IPUMS codes and ran the loader's `build_rows` on it. It matches P20 Table 4b to the decimal: US citizen turnout 66.8%, did not vote 17.5%, no response 15.7%; registered 72.7%; men 65.0%, women 68.4%; MA 66.3%; voters 154,627,740 against the published 154,628 thousand. https://www2.census.gov/programs-surveys/cps/tables/p20/585/table04b.xlsx. The same 66.8 / 66.3 check is in `tests/test_cps.py` and runs when an extract is cached.
- **Fixture unit tests** check every loader's recodes row by row, compare each stored share against an independent weighted calculation, confirm every cell's options total 100, and prove reruns idempotent. The CPS test fakes the IPUMS API to show one submit, polling, the download, and a resume that never resubmits.

### Rulings needed

1. **The brief has the Census turnout convention backwards.** P20 keeps refused, don't know and no response in the citizen denominator and counts them as not voting: 2020's 66.8% is 154,628 thousand voters over all 231,593 thousand citizens, with 15.7% no response inside that base. Excluding them gives 79.2%, which would fail the P20 spot-check the brief also asks for. I followed P20 and stored "No response" as its own option, so turnout among those who answered is Voted / (Voted + Did not vote) from the same rows. Each turnout row's note says this.
2. **CPS can load real data today without IPUMS.** Census publishes each November supplement as a free public-use CSV (`www2.census.gov/programs-surveys/cps/datasets/<year>/supp/nov<yy>pub.csv`), and the check above shows the loader's math reproduces P20 from it. A Census-direct reader is about 80 lines (the variable names change a little by year). I didn't build it because the brief specifies IPUMS. Your call: build it, or register for an IPUMS key.
3. **CES is not walled.** All three common-content files are CC0 on Harvard Dataverse with no login and no guestbook, so I downloaded them (about 190 MB each) and loaded them for real. As the brief asks, the loader parses what is in `raw/ces/` and prints the direct links when it is empty; it could download on its own like GSS and ANES.
4. **GSS weights follow the codebook, not the brief's names.** The 2024 codebook recommends WTSSNRPS where it exists (2004-2024) and WTSSPS before that, and calls WTSSALL a historical weight that WTSSPS replaces, with the form, ballot and oversample corrections built in. Every row records which weight it used.
5. **ANES variables differ from the brief in four places.** VCF0613 is "People like me don't have any say about what the government does", the second half of ANES's own external-efficacy index, so it sits under `efficacy_external`. `parties_care` is VCF0611, "Parties are only interested in people's votes but not in their opinions", which ran 1968-1980 only. The CDF has no national-pride item. VCF0604 (trust in government) and VCF0614 (politics too complicated) stop in 2012 in the CDF; VCF9252, the how-often version of the complexity item, carries internal efficacy from 2008 to 2024.
6. **WVS wave 7 has no Schwartz value battery**; the "important to this person" portraits ran in waves 5 and 6 (US 2011, V70-V79). I stored the nearest wave-7 items under their own names, not Schwartz labels: importance of family, friends, leisure, politics, work and religion (Q1-Q6, `life_importance`) and freedom versus security (Q150). If the Schwartz items are what's needed, the wave-6 US file has them.
7. **WVS `item_text` holds the codebook's variable labels, not the questionnaire wording.** The master questionnaire, like the data, sits behind the WVS form. Each WVS row's note says so. The other loaders carry the fielded wording from their codebooks and questionnaires.

### What the data forced

- **CES 2024 presidential primary is stored for Massachusetts only.** Where a state held its presidential and state primaries on one day, TargetSmart records the vote under `TS_p2024` and codes `TS_pp2024` as did-not-vote (California: 48% and 0%), so a national figure came out at 10% of adults. MA held a separate presidential primary on March 5 and reads 38%.
- **CES's primary items** are validated-vote fields, not survey questions: state/federal primary turnout for all three years, the 2024 presidential primary, and which party's ballot. Turnout is over all adults with commonweight, counting anyone with no voter-file record as not voting. Party of ballot is among validated primary voters, with vvweight. The vendor changed from Catalist (2020) to TargetSmart (2022 on).
- **CES has no efficacy or media-trust items in 2020-2024.** It does have trust in the federal government (2022, 2024), but "when it comes to handling the nation's problems", a different item from ANES VCF0604; the concordance note says so. 2024 adds two election-fairness items, stored as `elections_fair`.
- **The CPS extract adds CITIZEN and POPSTAT** to the brief's ten variables. The P20 base is civilian citizens 18+, and since 2022 VOTED alone can't tell a non-citizen from a supplement non-interview. Voters count as registered because the supplement doesn't ask them.
- **A source's subgroups only align with A's labels where they mean the same thing.** CES and CPS use A's five race_eth groups. ANES's VCF0105b has four, with "Asian, other or multiracial". GSS's RACE has three and doesn't separate Hispanic origin, so it is stored as `race`, not `race_eth`. CES Middle Eastern goes with White, as the Census codes it.

### Notes

- **Concordance:** 48 constructs, each with a label and one-line definition from `audience/constructs.py`, every source's variable names, and a note where wordings differ (for example, `party_id_7` lists GSS PARTYID, ANES VCF0301 and CES pid7). Each loader writes its crosswalk even when its data is absent, so CPS, WVS and voter-file variables are already recorded. Each verbatim wording is its own `item_text`.
- **Response options:** a questionnaire's offered answers stay in the base: CES "Not sure", ANES's "haven't thought much about it", GSS's volunteered "depends". Don't know, refused, skipped and not asked are left out. Party-ID labels are harmonized across GSS, ANES and CES.
- **Errors:** `se` uses the Kish effective n and ignores clustering, so it understates design-based error. `moe` = 1.645 × se, following A's 90% convention.
- **Cells:** a subgroup cell with an unweighted base under 50 is not stored, and the topline row for that period names it in its note (for example, `race_eth=Asian or Pacific Islander (n=37)` for MA trust in 2022).
- **Fixtures:** six 50-row synthetic files in `tests/fixtures/`, built by a seeded script from each codebook's real variable names and codes. File names carry `SYNTHETIC`, and every loader refuses such a file unless a test passes `allow_synthetic=True`, so one copied into `raw/` can't reach the real store.
- **MA party enrollment by town is also public.** The Elections Division publishes town-level enrollment statistics (https://www.sec.state.ma.us/divisions/elections/research-and-statistics/enrollment-statistics.htm), a real source for this construct that doesn't need the restricted voter list.
- **Edits to A's files:** `load.py` (six subcommands; `MODULES` now maps each subcommand to its source for the audit), `audit.py`, the README, `pyproject.toml` (pandas, pyreadstat, curl_cffi), and the migration-list assertions in `test_store.py` and `test_postgres.py`, which now expect `003_survey_sources`.
- **Raw files** (gitignored), documentation included: GSS 652 MB, ANES 630 MB, CES 567 MB.
