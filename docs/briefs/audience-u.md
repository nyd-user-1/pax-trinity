# Brief U — The concordance: anchored constructs from the canonical lists

You are the Opus window that built the construct layer (Brief R) and the per-question serving (Brief S), taking the concordance. Ground rules as before: commit locally per feature, never push; stage by explicit path, never `-A`; check `git log -1` immediately before any commit — several windows share this checkout. Never run tsc, a Next build, or a dev server on this 8GB Mac (a hook enforces it). The store is single-writer: take `audience/store/.lock` before any store computation, release it after. **Migration number 012 is yours** — claimed by this brief, frozen on disk. Window-Q holds 011 concurrently; your migration must not assume its contents. Exports regenerate and upload to the audience bucket's `exports/` prefix, served at `/audience-data/`. Yours: the two canonical-list fetches, the concordance build in `audience/`, the regenerated `index.json` upload, and this file's Worker report — nothing else anywhere.

## What this is

Brendan's ruling (2026-10-27): constructs seed **top-down from the field's own canonical lists**, not bottom-up clustering. A construct is a concept the field itself tracks — "Confidence in Congress", "Party identification, 7-point" — anchored to the publisher's own citation, with member questions across sources. This is the concordance: the layer that lets one row say *Sources: ANES · CES · GSS*, lets a question page show its related constructs across studies, and gives the construct table its grouped shape (INSTITUTIONAL TRUST, SOCIAL TRUST, ECONOMIC FAIRNESS…). Your Brief R machinery — migration 009's `construct`/`construct_member`, the export's `families` with relations core/version/mode and `anchor` — is the proven seed; this brief grows it from 17 to the full anchored set.

## The two lists

- **GSS Key Trends** — the Data Explorer's curated trends (gssdataexplorer.norc.org/trends): roughly 200 trend variables filed under ~14 subject areas. You know this host from Briefs P/Q; find the route behind the trends page.
- **ANES Guide to Public Opinion and Electoral Behavior** — electionstudies.org: the trend tables, roughly 150 items, 1948–present, grouped by topic.

Fetch both politely (delay, resumable, terms noted in the docstring), raw synced to `raw/gss/` and `raw/anes/` before loading.

## The build

- One construct per canonical trend item, `anchor` = the publisher's own citation (list name + item + URL). Expect ~300–350 total.
- The 17 existing families sit **inside** this set: where a canonical item matches one, the family absorbs the anchor — never a duplicate construct (the ablegal ruling stands).
- Where the same concept appears in both lists (trust in government, party identification…), that is **one construct** with members from both sources — the whole point of the concordance.
- Members map to our question ids (mnemonics for GSS; `anes.py` for the ANES scheme). Fold in the 112 exact-normalized-wording groups (293 questions) where they fall inside a construct's members. CES members attach only on a clear wording/label match to an anchored construct; uncertain ones go to the flag list, never forced.
- Each construct carries its list's own subject area, so the construct table can group without our editorializing.
- The long tail stays unconstructed — honest. No construct without an anchor.

## The contract

The export's `families` array grows to the full anchored set, same shape you designed (construct, label, relations, anchor, optional note/of); constructs/questions/sources/geographies entries otherwise byte-identical; row files unchanged.

## Done means

Raw lists synced; migration 012 + code committed (explicit paths); the regenerated `index.json` uploaded same key, same posture; verified in Node against the served file — construct count, member counts by source, how many constructs are cross-source, ten example constructs quoted with their anchors. The flag list of ambiguous mappings is a first-class deliverable for the lead's ruling, not a failure. The bucket is mid-copy to the new AWS account: list every bucket key you added or changed. Report below, then ping the lead (`pax-trinity-1c`) by SendMessage.

---

## Worker report

*Taken over by Window-Q after Window R's session ended mid-brief (the lead's assignment, 2026-10-27).*

### What R left and what I finished

R had written most of the work, uncommitted:
- `audience/canonical.py`, which fetches and reads both lists.
- The build in `construct_layer.py`: one construct per item, items sharing a question merged, seed families absorbing their anchors, exact-wording twins added, CES attached only on exact label words, everything else flagged.
- Migration 012 (`construct_anchor`), the export's `anchors`/`subject`/`subtopic` on families, and 29 passing tests.

What was left:
- **The ANES Guide's previous-edition tables**, read from the Internet Archive, had stopped at 40 of 123. I resumed the fetch to all 123.
- **A run-order bug.** `python -m audience.construct_layer` failed because `main()` called `build()` before it was defined: the `__main__` block sat above the appended functions. I moved it to the end.
- **The chart-to-table match left 132 of 225 Guide charts unmapped**, so I added two documented, reviewable rules:
  - *Span rule:* a chart with no table of its title takes the one ANES question that spans exactly the chart's years and whose label is nearest its title (similarity ≥ 0.5, no tie). 28 charts settled this way, listed below.
  - *Cross-list merge:* a Key Trends item and a Guide chart titled alike (≥ 0.8 of content words, each the other's only partner) are one construct. Three merged: death penalty, power of the federal government, and "people don't have a say".
- I added tests for both rules (35 pass) and a README note.

### Hashes

- **Code:** `cbba0d2` (path-limited; the surfaces window had already committed its deletions in `46c452b`).
- **`exports/index.json`:** ETag/md5 `2be2425c0d0d954a8250ec235e79227c`, 4,832,545 bytes, `application/json`, public read through the bucket policy. It replaced `ab69696b` (my Brief T upload), regenerated from the current store, so wording, topics and questions survive.
  - `sources`, `constructs`, `geographies` and `questions` are byte-identical, and so are all 41 row files and all 8,034 per-question files.
  - `families` grows from 17 to 270, keeping the original 17 with their members in order.
- **Store:** migration 012 applied under the lock; audit clean.

### Routes and terms

- **GSS Key Trends**, 181 items in 5 subject areas: `https://yyq2en1ci9.execute-api.us-east-1.amazonaws.com/prod/` (`get-trends`, `get-measures`, `get-trend-var-info`). These are the routes the Data Explorer's front end calls, found in its script bundle as the Internet Archive holds it. No key, Explorer Origin header.
- **ANES Guide**, 225 charts in 10 sections: its page through `curl_cffi`. The chart pages render client-side behind Cloudflare; per your word, I didn't fight it.
  - Variables come from the previous edition's 123 tables, read from Internet Archive captures (`top-tables/?id=1…123`, each naming its VCF source variables).
- One-second delay at NORC and ANES, five seconds at the Archive. Both publishers ask for citation and state no other terms.

### Counts (Node, against the served file)

| Measure | Count |
|---|---|
| Constructs | 270 (262 anchored to a list item; 8 ruled seed families anchored only by their citations) |
| Memberships | 351: GSS 239, ANES 111, CES 5 |
| Cross-source constructs | 9: `party_id_7`, `ideology_7`, `trust_fed_govt`, `cappun`, `govtpow`, `poleff11`, `sexornt`, `union_membership`, `martital_status` (the Guide's own key, typo included) |
| Anchored in both lists | 4: `ideology_7`, `cappun`, `govtpow`, `poleff11` |
| Subject areas | 15 (5 GSS, 10 ANES) |

The brief expected ~300–350. The gap is the 104 Guide charts no rule could map; they're on the flag list with candidates, not forced.

### Ten examples, with their anchors

| Construct | Subject / subtopic | Members | Anchors |
|---|---|---|---|
| `party_id_7` Party identification, 7-point | Partisanship and Evaluation of Political Parties / Partisanship | `party_id_7` (ANES, CES, GSS) | GSS replicating core; ANES Guide: Party Identification: 7-Point Scale |
| `ideology_7` Ideology, 7-point | Politics / Political Beliefs | `ideology_7` (ANES, GSS) | GSS replicating core; ANES time series; GSS Key Trends: Does respondent think of self as liberal or conservative*; ANES Guide: Liberal-Conservative Self-Identification, 7- and 3-Point |
| `govtpow` Power of federal government | Politics / Confidence & Power | `govtpow` (GSS), `vcf0829` (ANES) | GSS Key Trends: Power of federal government; ANES Guide: Power of the Federal Government |
| `cappun` Favor or oppose death penalty for murder* | Civil Liberties / Crime | `cappun`, `cappun2` (GSS), `vcf9236` (ANES) | GSS Key Trends; ANES Guide: Favor/oppose death penalty |
| `poleff11` People don't have any say… | Politics / Political Beliefs | `poleff11` (GSS), `efficacy_external` (ANES) | GSS Key Trends; ANES Guide: People Don't Have a Say…; ANES Guide: Public Officials Don't Care… (see ruling 2) |
| `trust_fed_govt` Trust the Federal Government (4-point Scale) | Evaluations of the Political System / Trust in Government | `trust_gov` (ANES, CES) | ANES Guide: 4-point and 5-point charts |
| `confidence_congress` Confidence in Congress | Politics / Confidence & Power | `confidence_congress`, `conlegiy`, `concong`, `trlegis`, `trcong` (GSS) | GSS replicating core: the confidence battery; GSS Key Trends: Confidence in congress |
| `fed_spending_child_care` Federal spending on child care | Public Opinion on Policy Issues / Social Welfare, Healthcare, and Education | `vcf0887` (ANES, by span) | ANES Guide: Federal spending on child care |
| `conarmy` Confidence in military | Politics / Confidence & Power | `conarmy` (GSS) | GSS Key Trends: Confidence in military |
| `abortion_rossi` Legal abortion: the Rossi conditions | Current Affairs / Social Issues | the six Rossi items and their six grid twins as mode members (GSS) | MR133; six GSS Key Trends items |

### Caution 3: doubled cells, wider than flagged

`nationalism` (2 rows per cell) and `national_pride_domain` (10) do serve indistinguishable rows: they pool several GSS items, and the export drops `item_text` for survey sources. The scan of every served question finds 12 with doubled cells:

- **GSS:** `nationalism`, `national_pride_domain`.
- **ANES:** `cand_trait_cares`, `cand_trait_honest`, `cand_trait_knowledgeable`, `cand_trait_strong_leader`, `efficacy_external`, `egalitarianism`.
- **CES:** `elections_fair`, `primary_party_validated`, `primary_turnout_validated`.
- **POLL:** `open_primaries_support`. Its item text is kept, so this one may be legitimate.

The row files are frozen in this brief, so I changed nothing. Recommended fix, a separate brief: split each pooled harmonized construct into its per-item questions, e.g. PRODDEM … PROUDGRP, AMCITIZN/AMBETTER, VCF0609/VCF0613. Then let the construct layer group them; that's exactly what families now do. The alternative of keeping `item_text` for these rows changes the row contract.

### Bucket keys added or changed (for the account copy; moving-day pinged at upload)

- `raw/gss/key_trends/key_trends.json` (added, md5 `244c386f1178734c442bb35554d94260`)
- `raw/anes/guide/guide.html` (added, md5 `18722e33fbe241362aea15bf9028d5b7`)
- `raw/anes/guide/top_tables/1.html` … `123.html` (123 added, each hash-verified)
- `exports/index.json` (changed)

### Rulings for the lead

1. **The 104 unmatched Guide charts** below, each with its nearest question by label. Rule which to map; most are rewordings of a harmonized or CDF item ("Strong Leadership" against `cand_trait_strong_leader`) or new charts the CDF covers under another label.
2. **Pooled ANES members bridge two Guide items.** `efficacy_external` pools VCF0609 and VCF0613, so `poleff11` (GSS's "have a say") also carries the Guide's "officials don't care" anchor. The `cand_trait_*` constructs are similar. Splitting the pooled constructs (caution 3) fixes both.
3. **The 28 span-rule mappings and 3 cross-list merges** are automatic but listed for review.
4. **The 13 CES look-alikes**, notably `cc22_pid7`/`cc24_pid7` against `party_id_7` and the Congress approval items, are left unattached. CES joins only on a construct's exact label words.

### Flag list (`audience/reports/construct_layer.json`, regenerated by `python -m audience.construct_layer`)

#### Accepted by the span rule (28): chart, years, question
- Timing of Respondent's Presidential Vote Decision (1948–2020): `vcf0712` Timing of respondent's presidential vote decision (1.0)
- Follow Information about Politics (2008–2024): `vcf9259` How often does R follow information about politics and government (0.6)
- Discussed politics with family and friends (1984–2020): `vcf0731` Respondent discuss politics with family and friends (0.6)
- Volunteer work in the last 12 months (1992–2024): `vcf9256` Was R able to devote any time to volunteer work in the last 12 months (0.5)
- Which party better at economy (1990–2024): `vcf9205` Which party would do a better job handling the nation's economy (0.57)
- Adjust view of morality to changes (1986–2024): `vcf0852` Should adjust view of moral behavior to changes (0.5)
- Federal spending on Social Security (1984–2024): `vcf9049` Federal spending- Social Security (1.0)
- Federal spending on public schools (1984–2024): `vcf0890` Federal spending- public schools (1.0)
- Federal spending on child care (1988–2016): `vcf0887` Federal spending- child care (1.0)
- Federal spending to aid the poor (1992–2024): `vcf0886` Federal spending- poor/poor people (0.6)
- Unemployment gotten better or worse (1986–2024): `vcf9225` Has unemployment in the country gotten better, stayed the same, or gotten worse (0.57)
- When should abortion be allowed (1972–1980): `vcf0837` When should abortion be allowed (1.0)
- By law, when should abortion be allowed (1980–2024): `vcf0838` By law, when should abortion be allowed (1.0)
- Allow gays & lesbians to adopt (1992–2024): `vcf0878` Should gays/lesbians be able to adopt children (0.5)
- Federal spending on crime (1984–2024): `vcf0888` Federal spending- dealing with crime (0.75)
- Favor/oppose death penalty (1988–2024): `vcf9236` Does R favor or oppose the death penalty for persons convicted of murder (0.57)
- US position grown weaker or stronger (1958–2024): `vcf9045` Position of the U.S. weaker/stronger in the past year (0.5)
- Favor/oppose limits on imports (1988–2024): `vcf9231` Does R favor or oppose placing limits on imports to protect american jobs (or ha (0.5)
- Affirmative action in hiring/promotion (1986–2024): `vcf0867a` Affirmative action in hiring/promotion [2 of 2] (0.8)
- Federal spending on the environment (1984–2024): `vcf9047` Federal spending- improve and protect the environment (0.6)
- How satisfied with way democracy works (2004–2024): `vcf9255` CSES: how satisfied is R with the way democracy works in the U.S. (4cat: very sa (0.57)
- Things in this country on Right track/wrong track (1992–2024): `vcf9222` Are things in this country on the right track or have things seriously gotten of (0.57)
- Average Feeling Thermometer Rating toward US Supreme Court (1980–2024): `vcf9005` Thermometer - Supreme Court (0.5)
- Conditions make it difficult for blacks to succeed (1986–2024): `vcf9039` Conditions make it difficult for Blacks to succeed (1.0)
- Blacks should not have special favors to succeed (1986–2024): `vcf9040` Blacks should not have special favors to succeed (1.0)
- Blacks must try harder to succeed (1986–2024): `vcf9041` Blacks must try harder to succeed (1.0)
- Blacks gotten less than they deserve over the past few years (1986–2024): `vcf9042` Blacks gotten less than they deserve over the past few years (1.0)
- Marital status (1952–2024): `vcf0147` Respondent - marital status (1.0)

#### Merged across the lists (3)
- `cappun`: GSS "Favor or oppose death penalty for murder*" + ANES "Favor/oppose death penalty" (0.8)
- `govtpow`: GSS "Power of federal government" + ANES "Power of the Federal Government" (1.0)
- `poleff11`: GSS "People don't have any say about what the government does (agree/disagree)" + ANES "People Don't Have a Say in What the Government Does" (0.8)

#### Near pairs left unmerged (2)
- GSS `natsoc` "National spending on social security" / ANES `fed_spending_social_security` "Federal spending on Social Security" (0.6)
- GSS `coneduc` "Confidence in education" / ANES `education` "Education" (0.5)

#### CES attached on exact label words (3)
- `marstat` "Marital status" to `martital_status`
- `sexuality` "Sexual orientation" to `sexornt`
- `union_hh` "Union membership in household" to `union_membership`

#### CES look-alikes left unattached (13)
- `cc22_320b` "Job approval institutions -- The U.S. Congress" near `approval_of_congress`: label near 'Approval of Congress' (0.50)
- `cc24_312b` "Job approval institutions -- The U.S. Congress" near `approval_of_congress`: label near 'Approval of Congress' (0.50)
- `cc20_364a` "President vote" near `fepres`: label near 'Would vote for woman president' (0.67)
- `faminc` "Family income" near `finrela`: label near 'Opinion of family income' (0.67)
- `faminc_new` "Family income" near `finrela`: label near 'Opinion of family income' (0.67)
- `cc22_443_4` "State legislature spending -- Law enforcement" near `natcrimy`: label near 'National spending on law enforcement' (0.50)
- `cc24_443_4` "State legislature spending -- Law enforcement" near `natcrimy`: label near 'National spending on law enforcement' (0.50)
- `cc22_pid7` "7 point party ID" near `party_id_7`: label near 'Party identification, 7-point' (0.67)
- `cc24_pid7` "7 point party ID" near `party_id_7`: label near 'Party identification, 7-point' (0.67)
- `cc22_433a` "3 pt party ID" near `party_identification_3_pt`: label near 'Party Identification: 3-Point Scale' (0.67)
- `cc24_433a` "3 pt party ID" near `party_identification_3_pt`: label near 'Party Identification: 3-Point Scale' (0.67)
- `relig_church` "Church attendance" near `religious_attendance_4_cat`: label near 'Church Attendance, 4 categories' (0.50)
- `relig_church` "Church attendance" near `religious_attendance_5_cat`: label near 'Church Attendance, 5 categories' (0.50)

#### List items with no question in the store (5)
- GSS Key Trends: Number of children* (childs)
- GSS Key Trends: Homosexuals should have right to marry (agree/disagree) (marhomo)
- ANES Guide: Trust in Government Index (VCF0656)
- ANES Guide: External Political Efficacy Index (VCF0648)
- ANES Guide: Government Responsiveness Index (VCF0649)

#### Wording twins already in another construct (3)
- `fund16` (twin of `fund`) sits in `fund16`, not beside it in `fund`
- `fund` (twin of `fund16`) sits in `fund`, not beside it in `fund16`
- `fund_next` (twin of `fund16`) sits in `fund`, not beside it in `fund16`

#### Guide charts unmatched (104): chart, years, nearest question by label among those starting the same year
- Democratic Presidential Candidate Provides Strong Leadership (4-Point Scale) (1980–2008): `cand_trait_strong_leader` Candidate trait: strong leadership 1980–2024 (0.38)
- Democratic Presidential Candidate Provides Strong Leadership (5-Point Scale) (2008–2024): `cand_trait_honest` Candidate trait: honest 2008–2024 (0.11)
- Democratic Presidential Candidate Provides Strong Leadership (1980–2024): `cand_trait_strong_leader` Candidate trait: strong leadership 1980–2024 (0.43)
- Democratic Presidential Candidate Really Cares About People Like You (4-Point Scale) (1984–2008): `cand_trait_cares` Candidate trait: cares 1984–2024 (0.22)
- Democratic Presidential Candidate Really Cares About People Like You (5-Point Scale) (2008–2024): `cand_trait_honest` Candidate trait: honest 2008–2024 (0.1)
- Democratic Presidential Candidate Really Cares About People Like You (1984–2024): `cand_trait_cares` Candidate trait: cares 1984–2024 (0.25)
- Democratic Presidential Candidate Is Honest (2008–2024): `cand_trait_honest` Candidate trait: honest 2008–2024 (0.4)
- Republican Presidential Candidate Provides Strong Leadership (4-Point Scale) (1980–2008): `cand_trait_strong_leader` Candidate trait: strong leadership 1980–2024 (0.38)
- Republican Presidential Candidate Provides Strong Leadership (5-Point Scale) (2008–2024): `cand_trait_honest` Candidate trait: honest 2008–2024 (0.11)
- Republican Presidential Candidate Provides Strong Leadership (1980–2024): `cand_trait_strong_leader` Candidate trait: strong leadership 1980–2024 (0.43)
- Republican Presidential Candidate Really Cares About People Like You (4-Point Scale) (1984–2008): `cand_trait_cares` Candidate trait: cares 1984–2024 (0.22)
- Republican Presidential Candidate Really Cares About People Like You (5-Point Scale) (2008–2024): `cand_trait_honest` Candidate trait: honest 2008–2024 (0.1)
- Republican Presidential Candidate Really Cares About People Like You (1984–2024): `cand_trait_cares` Candidate trait: cares 1984–2024 (0.25)
- Republican Presidential Candidate Is Honest (2008–2024): `cand_trait_honest` Candidate trait: honest 2008–2024 (0.4)
- Average Feeling Thermometer rating Toward House Candidates (1978–2024): `vcf0909` Thermometer - challenger House candidate 1978–2020 (0.25)
- Net Feeling Thermometer Rating Toward House Candidates (1978–2024): `vcf0909` Thermometer - challenger House candidate 1978–2020 (0.25)
- Average Feeling Thermometer Rating Toward House Incumbents and Challengers (1978–2024): `vcf0909` Thermometer - challenger House candidate 1978–2020 (0.22)
- Average Feeling Thermometer Rating Toward Senate candidates (1978–2024): `vcf9059` Thermometer - Senate challenger 1978–2016 (0.29)
- Net Feeling Thermometer Rating Toward Senate Candidates (1978–2024): `vcf9059` Thermometer - Senate challenger 1978–2016 (0.29)
- Split Ticket vs Straight Ticket (1952–2024): `vcf0715` State/local vote straight ticker or split 5-category 1952–1984 (0.22)
- Voted for Democrat or Republican for US Senate (1952–2024): `vcf0710` Vote ticket-splitting- president/senate 1952–2016 (0.12)
- Voted for Democrat or Republican for Governor (1952–2024): `vcf9025` Vote for governor- party 1952–2024 (0.17)
- How often in the last week did respondent discuss politics (1984–2024): `vcf0733` How often in the last week respondent discussed politics 1984–2020 (0.57)
- Vote registration (1952–2024): `vcf0708` Vote for senator 1952–2024 (0.33)
- Voter Turnout (without midterm years) (1948–2024): none
- Voted on election day or before (1994–2024): `vcf0748` Voted on election day or before 1994–2020 (1.0)
- Voting seen as duty or choice (2012–2024): none
- Contacted by someone other than the parties (1980–2024): `vcf9031` Contacted by anyone other than parties 1980–2020 (0.6)
- Worked with others in the community (2000–2020): `vcf9257` Has R worked with others to deal with issue in community during the past 12 mont 2000–2020 (0.33)
- Attended meeting about issue in community or schools (2000–2024): `vcf9258` Did R attend a meeting about an issue in community or schools during the past 12 2000–2024 (0.4)
- Participated in a protest or march (2000–2024): none
- Net Affect Toward Parties (1978–2024): none
- Affective Polarization of Parties: Own-party and rival-party feelings (1978–2024): `vcf0738` Party of registration post-election 1978–1986 (0.1)
- Which party better at environment (1990–2024): `vcf9205` Which party would do a better job handling the nation's economy 1990–2024 (0.38)
- Prefer split or unified government (1992–2024): none
- Ideological Extremity (1972–2024): none
- Net Affect Toward Liberals and Conservatives (1964–2024): `vcf0212` Thermometer - conservatives 1964–2024 (0.2)
- Affective Polarization of Ideologues: In-group and out-group feelings (1972–2024): none
- Less govt better or more things govt should do (1990–2024): `vcf9133` Govt too involved in things OR problems require 1990–2016 (0.29)
- Fewer problems if more emphasis on traditional family ties (1986–2024): `vcf0853` Should be more emphasis on traditional values 1986–2024 (0.29)
- Do what's necessary for equal opportunity (1984–2024): none
- Country would be better if we worried less about equality (1984–2024): `vcf0155` Respondent - worried about find/losing job 1984–2008 (0.14)
- Not a big problem if some people have more of a chance (1984–2024): `vcf9052` Are things in U.S. going well or not 1984–1988 (0.11)
- If people treated equally, we'd have fewer problems (1984–2024): none
- Government vs Private Health Care (7 point scale) (1970–2024): `vcf0806` Government health insurance scale 1970–2024 (0.33)
- Government vs Private Health Care (3 point scale) (1970–2024): `vcf0806` Government health insurance scale 1970–2024 (0.33)
- Government Guaranteed Job and Standard of Living (3 point scale) (1972–2024): `vcf9079` President on guaranteed jobs and living scale 1972–2012 (0.25)
- Retrospective Economic Evaluation (last year) (1980–2024): `vcf0872` Better or worse economy in next year 1980–2024 (0.11)
- Prospective Economic Evaluation (next year) (1980–2024): `vcf0872` Better or worse economy in next year 1980–2024 (0.25)
- Economy good or bad (2012–2020): none
- Retrospective Evaluation of Personal Finances (last year) (1962–2024): `vcf0880` Better or worse off in past year 1962–2024 (0.1)
- Prospective Evaluation of Personal Finances (next year) (1956–2024): `vcf0881` Better or worse off in next year 1956–2024 (0.22)
- How worried about personal finances? (2012–2024): none
- Inflation gotten better or worse (1986–2008): `vcf9226` Much or somewhat that the level of unemployment has gotten better/worse 1986–2020 (0.38)
- Gap between rich and poor getting wider? (2004–2024): `vcf9228` Much or somewhat larger/smaller gap in incomes between rich and poor in the U.S. 2004–2020 (0.36)
- Favor/oppose gov't trying to reduce income differences (2012–2020): none
- Favor/oppose increased taxes on millionaires (2012–2024): none
- Importance of reducing budget deficit (2012–2024): none
- Protect gays & lesbians from discrimination (1988–2024): `vcf0876` Law to protect homosexuals against discrimination 1988–2024 (0.29)
- Same-sex marriage views (2012–2024): none
- Make it easier/harder to buy a gun (2000–2024): `vcf9238` Should the government make it more difficult or easier to buy a gun, or should t 2000–2020 (0.57)
- Importance of gun control to respondent (2000–2020): `vcf9239` How important is gun control issue to R 2000–2020 (0.4)
- Increase/Decrease Military Spending (3 point scale) (1980–2024): `vcf0843` Defense spending scale 1980–2024 (0.17)
- Immigrants should be decreased/increased (1992–2024): `vcf0879a` Increase or decrease number of immigrants to U.S. 4-category 1992–2024 (0.12)
- Immigrants take away jobs (2004–2024): `vcf9223` How likely is it that recent immigration levels will take jobs away from people 2004–2024 (0.3)
- Average Feeling Thermometer Rating Toward Illegal Immigrants (1988–2024): `vcf0233` Thermometer - illegal aliens 1988–2024 (0.29)
- Federal spending on border security (1996–2024): none
- Tougher environmental regulations, or regulations a burden? (7 point scale) (1996–2024): `vcf0842` Environmental regulation scale 1996–2024 (0.17)
- Tougher environmental regulations, or regulations a burden? (3 point scale) (1996–2024): `vcf0842` Environmental regulation scale 1996–2024 (0.17)
- How many Government Officials are Corrupt (2012–2024): none
- Understand Political Issues (2008–2024): `vcf9251` How well does R understand the important political issues facing our country 2008–2024 (0.38)
- Makes a big difference who is in power (2008–2020): `vcf9253` CSES: make big difference who is in power (5pt) scale placement for R 2008–2024 (0.44)
- How often are votes counted fairly (2016–2024): none
- Approval of President (1972–2024): `vcf9080` President on liberal-conservative scale 1972–2012 (0.25)
- Approval of Presidential handling of economy (1984–2024): `vcf9009` Approve of president performance on economy 1984–2024 (0.14)
- Approval of Presidential handling of foreign affairs (1984–2024): `vcf0364` Republican presidential cand- decent 1984–1988 (0.12)
- Approval of Presidential handling of health care (1996–2020): `vcf9218` Does R approve or disapprove of the way current U.S. president is handling healt 1996–2020 (0.09)
- Average Feeling Thermometer Rating toward Congress (1980–2024): `vcf0228` Thermometer - Congress 1980–2024 (0.4)
- Approval of House incumbent (1980–2024): `vcf0991` Approve/disapprove of running U.S. House incumbent 1980–2024 (0.33)
- How well does House incumbent stay in touch with district (1986–2024): `vcf9072` Agree with running U.S. House incumbent vote on Bill 1986–1990 (0.22)
- Average Feeling Thermometer Rating toward Racial/Ethnic Groups (1964–2024): `vcf0213` Thermometer - military 1964–2012 (0.12)
- Average Feeling Thermometer Rating toward Religious Groups (1964–2024): `vcf0213` Thermometer - military 1964–2012 (0.14)
- Average Feeling Thermometer Rating toward Gender/Sex-related Groups (1984–2024): `vcf9007` Thermometer - Jesse Jackson 1984–2002 (0.1)
- Average Feeling Thermometer Rating toward Social Movements (1970–2024): `vcf0435` Thermometer - George McGovern 1970–1984 (0.12)
- Average Feeling Thermometer Rating toward Various Societal Groups (1964–2024): `vcf0213` Thermometer - military 1964–2012 (0.12)
- Importance of American identity (2012–2024): none
- How much discrimination against whites (2012–2024): none
- How much discrimination against blacks (2012–2024): none
- How much discrimination against hispanics (2012–2024): none
- How much discrimination against asians (2016–2024): none
- How much discrimination against women (2012–2024): none
- How much discrimination against gays and lesbians (2012–2024): none
- Religion, 5 categories (1960–2024): `vcf0128a` Respondent - religion 7-category 1960-1988 1960–1988 (0.14)
- Religion, 6 categories (1960–2024): `vcf0128a` Respondent - religion 7-category 1960-1988 1960–1988 (0.14)
- Attitudes about the Origin of the Bible, 2 categories (1964–2024): `vcf0845` Authority of the Bible 1964-1990 1964–1990 (0.12)
- How often does respondent trust other people (2008–2024): `vcf9244` How often can R trust people 2008–2020 (0.6)
- does respondent trust other people (1964–2008): `vcf0622` How much government pays attention to what people think 1964–2004 (0.14)
- Life satisfaction (2008–2024): `vcf9245` How satisfied is R with R's life 2008–2024 (0.33)
- How much racial or ethnic discrimination have you faced (2012–2024): none
- Which Party Had Most Members of Congress Before the Election (1958–2024): `vcf0729` Party with House majority before the election 1958–2020 (0.3)
- Which party had the most members in the Senate before election (1982–2024): `vcf9036` Party with Senate majority before the election 1982–2004 (0.44)
- Know Speaker of the House (1992–2024): `vcf9260` What job or office is held by named speaker of the U.S. House 1992–2024 (0.29)
- Know Vice President (1986–2020): `vcf9261` What job or office is held by named vice-president 1986–2020 (0.29)
- Know Chief Justice (1986–2024): `vcf9262` What job or office is held by named chief justice of the U.S. Supreme Court 1986–2024 (0.22)

### Lead's rulings

1. **The 28 span-rule mappings and 3 cross-list merges: accepted.** Reviewed as a list — most are exact label matches, the rest plausible rewordings, all reversible and recorded.
2. **The 104 unmatched Guide charts stay unforced** — right call. The mapping pass is morning work with Brendan; suggest ruling the famous trends first and letting the tail wait.
3. **CES exact-label restraint: approved**, with cc22_pid7/cc24_pid7 against party_id_7 and the Congress approval items queued for a quick ruling rather than attached tonight.
4. **The pooled-construct split is queued as its own brief** (per-item questions, families regrouping them; it also unwinds poleff11's double anchor) — it changes question identity, so Brendan's word first.
