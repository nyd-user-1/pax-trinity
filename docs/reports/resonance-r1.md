# Resonance r1

## What the score assesses

Resonance r1 scores a creative 0–100 on how well it engaged the people its paid delivery reached. It combines four rates: how often they stopped for it, gave it fifteen seconds, finished it (judged against videos of the same length) and clicked.

The score is relative to this dataset only: the 20 creatives in `paid-content-through-set-4.csv` (SET_01–SET_04, reported 2026-09-28 and 2026-10-05).
- 50 is the middle of that reference set.
- A creative scoring 80 stood, on average across the four rates and the six delivery cells, at the 80th percentile of the creatives delivered to the same audiences.
- Adding creatives to the reference changes everyone's score. That is a re-scoring, not a performance change, and a new reference gets recorded as such.

r1 is retrospective. It is not a forecast for an unpublished video, not a measure of belief change, and not evidence of what caused a result.

## Inputs

All four rates are platform-recorded counts from each row, recomputed from the counts:

| Component | Rate | Denominator floor |
|---|---|---|
| Stop | video starts ÷ impressions | 1,000 impressions |
| 15-second hold | 15-second views ÷ video starts | 200 starts |
| Finish, for its length | (completions + 0.5) ÷ (starts + 1), divided by the completion rate expected at the video's length | 200 starts |
| Act | clicks ÷ impressions | 1,000 impressions |

A rate whose denominator falls below the floor is not used for that row, and the creative's flags say so.

What I do not use, and why:
- **The export's derived columns** (rates, CPM, CPC, cost-per). They are rounded, and 49 rows have a blank: CPC wherever clicks are 0, and every cost column on R091. Recomputing from counts gives one definition throughout.
- **30-second views.** The 19-second and 21-second videos (C015, C011) report 30-second views, so replays are counted. The measure isn't comparable across lengths.
- **The 25/50/75% quartiles.** They are reported only as rounded percentages, and the quartile points sit at different seconds for different lengths.
- **Spend, CPM and cost per view.** These describe what delivery cost, not how people responded. They are shown beside the score as context, never inside it, so a creative scores no higher for having been given more budget.

The CSV records no content characteristics: no AI-assessed signals, transcripts or visual features. r1 therefore has no content component, and every input is a platform measurement.

## Scaling

1. **Within-cell percentiles.** Each row is one creative in one delivery cell: audience (General, Republican, Independent) × age band (Under 35, 35+), six cells. In each cell, each creative's rate becomes a mid-rank percentile among the creatives with a usable rate in that cell: 0 lowest, 100 highest, ties sharing their average rank. A creative is therefore compared only with creatives shown to the same people, which handles differing audience mixes and makes rates from different scales comparable.
2. **Equal weight per cell.** A component's value is the mean of the creative's six cell percentiles. Each cell counts once however much was spent in it, so the budget split across audiences does not move the score. A cell with no usable rate is left out of the mean and flagged.
3. **Weighted sum.** The score is Σ weight × component value. If a component has no usable cell at all, its weight is spread over the others and flagged.

## Design choices and what the data taught

| | Kind | Value |
|---|---|---|
| Weights | design choice | Stop 30%, 15-second hold 35%, Finish 25%, Act 10%. Attention held carries the most weight. Clicks carry the least: they are sparse (49 of 120 rows have none) and not every creative asks for one. |
| Delivery cells | design choice | audience × age band |
| Floors | design choice | 1,000 impressions; 200 starts |
| Percentile scaling | design choice | mid-rank, 0–100, within cell |
| Length adjustment | learned from this dataset | ln(completion rate) = 1.6628 − 1.3855 × ln(seconds). Least squares over the 119 rows with at least 200 starts, r² 0.71: completion falls steeply with length. Finish is observed ÷ this expectation, so a 2m13s video is judged against what a 2m13s video completes. |

The 15-second hold is the length-neutral attention measure: fifteen seconds is the same span whatever the runtime, and every creative here runs at least 19 seconds. Finish adds whether people stayed to the end, once the curve has removed what length alone explains.

## Flags

Every creative gets a score; none is unscorable. One is partial:
- **C016** (Independents Are Locked Out – Edit, 40s) has a General · Under 35 row (R091) with no spend, no impressions and no starts. Each component rests on 5 of 6 cells, and its score is marked `partial`.
- **Act on little evidence:** eleven creatives' Act rests on fewer than 20 clicks, from C004 and C005 (0) and C003 (1) up to C002 (10), and each is flagged.
- **Reporting date:** the five SET_04 creatives were reported 2026-10-05, a week after the rest. Reporting windows are not supplied, so delivery conditions may differ, and their flags say so.

## A worked example: C001, from raw rows to 85.4

*Independents Are Locked Out (39s)*, SET_01, six rows, R001–R026. The General · Under 35 row (R001) as reported:

| impressions | starts | 15-second views | completions | clicks |
|---|---|---|---|---|
| 77,255 | 9,604 | 1,535 | 431 | 2 |

The four rates for R001:
- **Stop** = 9,604 ÷ 77,255 = 0.1243.
- **15-second hold** = 1,535 ÷ 9,604 = 0.1598.
- **Finish** = (431.5 ÷ 9,605) ÷ exp(1.6628 − 1.3855 × ln 39) = 0.04492 ÷ 0.03294 = 1.364. C001 finished 36% more often than a 39-second video is expected to.
- **Act** = 2 ÷ 77,255 = 0.0000259.

In General · Under 35, 19 creatives have usable rates (C016's R091 has none). The percentile is (mid-rank − 1) ÷ 18 × 100:
- Stop: 3rd highest, 88.89.
- 15-second hold: 83.33.
- Finish: 83.33.
- Act: 83.33.

The same is done in the other five cells. Each component's value is the mean of the six cell percentiles:

| Component | Six cell percentiles | Value | Weight | Contribution |
|---|---|---|---|---|
| Stop | 100, 88.89, 100, 94.74, 100, 100 | 97.27 | 0.30 | 29.18 |
| 15-second hold | 68.42, 83.33, 68.42, 73.68, 68.42, 78.95 | 73.54 | 0.35 | 25.74 |
| Finish, for its length | 78.95, 83.33, 89.47, 89.47, 89.47, 89.47 | 86.69 | 0.25 | 21.67 |
| Act | 94.74, 83.33, 100, 73.68, 78.95, 94.74 | 87.57 | 0.10 | 8.76 |

The score is 29.18 + 25.74 + 21.67 + 8.76 = **85.4**, the highest in the set. C001 stopped people more often than nearly any creative shown to the same audiences, and it held and finished well for its length.

`node scripts/results/resonance.mjs --trace C001` prints this path from the CSV. `src/lib/resonance/scores.ts` holds every creative's inputs, cell percentiles, values, weights, contributions and flags.

## Sensitivity

**One input changed.** R001's 15-second views go from 1,535 to 1,842 (+20%), and nothing else changes. C001's hold rate in that one cell moves up the ranking, and C001 goes from 85.4 to 86.3. Three other creatives move slightly, because percentiles are relative and one creative passing another shifts both.

**Assumptions changed.** In each case all 20 creatives are re-scored and compared with r1:

| Change | Rank agreement with r1 (Spearman) | Largest single move | Top five |
|---|---|---|---|
| Equal weights, 25% each | 0.938 | C009 +9.6 | unchanged |
| Act dropped (clicks weighted 0) | 0.971 | C009 −5.0 | C019 replaces C015 |
| Cells also split by creative set | 0.899 | C013 −22.7 | C019 replaces C015 |
| No length adjustment on Finish | 0.944 | C009 −18.5 | unchanged |

The ordering is robust to the weights. The two assumptions that matter are:
- **Comparing within set.** Sets ran on different budgets and SET_04 on a later report. That move puts each creative against only the four others in its set, a much smaller and coarser reference.
- **The length adjustment.** C009 (No Football For You, 2m13s) drops 18.5 without it, the size of the penalty a long video takes from a raw completion rate.

**Beyond a single measure.** Each measure is compared with r1 by Spearman rank agreement:

| Single measure | Agreement | Where it parts company |
|---|---|---|
| Completion rate | 0.80 | It ranks C015 (19s) 1st and C008 9th. r1 has them 5th and 20th once length is accounted for; C008 is the lowest on hold and second-lowest on stop and finish. |
| 15-second views per impression | 0.88 | It ranks C007 2nd; r1 has it 7th, because C007's finish rate is weak for its length. |
| Click-through rate | 0.49 | It ranks C009 4th on 42 clicks; r1 has it 16th, because C009 stops the fewest people of any creative. |
| Cost per 15-second view | 0.86 | It rewards cheap delivery as well as response. r1 keeps cost beside the score, not in it. |

No single measure reproduces the r1 ordering. Completion rate alone favours short videos, clicks alone rest on sparse counts, and cost measures mix the auction into the response.

## Limits

- **Relative, not absolute.** The score says where a creative stands among these 20. A new reference set re-scores everything, and that will be recorded as a new reference, not as changed performance.
- **Delivery windows are not supplied.** Sets differ in budget and report date. Comparing within cells handles audience mix, not timing.
- **Act is thin.** Clicks are sparse; 49 of 120 rows have none.
- **Context is not cause.** r1 summarizes observed response. Why a creative did better is a hypothesis to test, not a reading of the score.

The version is `FORMULA_VERSION = "r1"`, carried on every output. Changing the formula means a new version number.
