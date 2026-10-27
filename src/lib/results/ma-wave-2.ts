import type { ResultSet, SubgroupCell } from "./types"

// Massachusetts Message Testing, Wave 2, transcribed from docs/reports/report-2-ma-test-waves-1-2.pdf
// pages 17–26, plus the study-level executive summary (pages 1–5), which lives in the latest wave's
// stories. Levels are the source's rounded displayed percentages (published); every lift subtracts two
// of them (derived_from_rounded, printed with ≈). Subgroup cells are LEVELS; `significant` is the printed
// green outline and `smallSample` the printed hatching/italics (the PDF's bold and italic text runs agree
// with the drawing on every cell).

const ARMS = ["placebo", "pahlow", "dizoglio", "matt-wilson", "green"] as const
type ArmId = (typeof ARMS)[number]

type Row = {
  dim: string
  cat: string
  levels: readonly number[] // in ARMS order: placebo first
  marked: readonly ArmId[]
  small?: "all"
}

const ALL_FOUR: readonly ArmId[] = ["pahlow", "dizoglio", "matt-wilson", "green"]

function expand(rows: readonly Row[]): SubgroupCell[] {
  return rows.flatMap((r) =>
    ARMS.map((armId, i) => ({
      dimensionId: r.dim,
      categoryId: r.cat,
      armId,
      outcomeId: "ballot",
      levelPct: r.levels[i],
      significant: r.marked.includes(armId),
      smallSample: r.small === "all",
    })),
  )
}

// Page 22 (media trust), then pages 24–26. Levels read placebo, Pahlow, DiZoglio, Matt Wilson, Green.
const ROWS: readonly Row[] = [
  { dim: "media-trust", cat: "tv-broadcast", levels: [44, 56, 57, 55, 63], marked: ALL_FOUR },
  { dim: "media-trust", cat: "speaking-to-camera", levels: [46, 69, 56, 71, 63], marked: ["pahlow", "matt-wilson", "green"] },
  { dim: "media-trust", cat: "podcast-interview", levels: [54, 45, 60, 50, 53], marked: [] },
  { dim: "gender", cat: "men", levels: [43, 58, 59, 55, 59], marked: ALL_FOUR },
  { dim: "gender", cat: "women", levels: [50, 56, 57, 61, 63], marked: ["matt-wilson", "green"] },
  { dim: "age", cat: "18-34", levels: [48, 65, 66, 65, 67], marked: ALL_FOUR },
  { dim: "age", cat: "35-54", levels: [51, 65, 60, 65, 63], marked: ["pahlow", "matt-wilson", "green"] },
  { dim: "age", cat: "55-plus", levels: [41, 44, 49, 47, 54], marked: ["green"] },
  { dim: "race", cat: "black", levels: [52, 60, 64, 44, 66], marked: [], small: "all" },
  { dim: "race", cat: "latino", levels: [53, 59, 61, 75, 71], marked: ["matt-wilson", "green"] },
  { dim: "race", cat: "white", levels: [46, 57, 56, 55, 60], marked: ALL_FOUR },
  { dim: "race", cat: "other", levels: [41, 55, 64, 71, 51], marked: ["matt-wilson"], small: "all" },
  { dim: "education", cat: "hs-or-less", levels: [45, 56, 56, 55, 61], marked: ["green"] },
  { dim: "education", cat: "some-college", levels: [49, 51, 64, 63, 63], marked: ["dizoglio", "matt-wilson", "green"] },
  { dim: "education", cat: "bachelors-plus", levels: [46, 60, 54, 57, 59], marked: ["pahlow", "matt-wilson", "green"] },
  { dim: "income", cat: "0-49k", levels: [49, 52, 60, 57, 59], marked: ["dizoglio", "green"] },
  { dim: "income", cat: "50-99k", levels: [45, 61, 59, 63, 61], marked: ["pahlow", "matt-wilson", "green"] },
  { dim: "income", cat: "100k-plus", levels: [48, 56, 53, 56, 60], marked: ["green"] },
  { dim: "parent", cat: "parent", levels: [58, 62, 62, 60, 62], marked: [] },
  { dim: "parent", cat: "non-parent", levels: [43, 55, 56, 57, 60], marked: ALL_FOUR },
  { dim: "ideology", cat: "liberal", levels: [54, 58, 57, 57, 62], marked: [] },
  { dim: "ideology", cat: "moderate", levels: [48, 56, 65, 64, 64], marked: ["dizoglio", "matt-wilson", "green"] },
  { dim: "ideology", cat: "conservative", levels: [41, 57, 46, 48, 55], marked: ["pahlow", "green"] },
  { dim: "party", cat: "democrat", levels: [54, 61, 54, 55, 63], marked: [] },
  { dim: "party", cat: "independent-other", levels: [38, 55, 61, 63, 59], marked: ALL_FOUR },
  { dim: "party", cat: "republican", levels: [51, 55, 54, 43, 63], marked: [] },
  { dim: "community", cat: "urban", levels: [45, 55, 60, 57, 56], marked: ["dizoglio", "matt-wilson"] },
  { dim: "community", cat: "suburban", levels: [47, 58, 57, 59, 64], marked: ALL_FOUR },
  { dim: "community", cat: "rural", levels: [53, 52, 56, 58, 63], marked: [], small: "all" },
  { dim: "vote-2024", cat: "voted-dem", levels: [55, 58, 58, 56, 58], marked: [] },
  { dim: "vote-2024", cat: "voted-rep", levels: [53, 53, 59, 60, 63], marked: [] },
  { dim: "vote-2024", cat: "voted-other", levels: [41, 65, 82, 75, 57], marked: ["dizoglio"], small: "all" },
  { dim: "vote-2024", cat: "did-not-vote", levels: [31, 56, 49, 55, 65], marked: ["pahlow", "matt-wilson", "green"] },
  { dim: "turnout-2022", cat: "yes", levels: [53, 54, 60, 57, 60], marked: [] },
  { dim: "turnout-2022", cat: "no", levels: [40, 64, 54, 61, 62], marked: ["pahlow", "matt-wilson", "green"] },
  { dim: "turnout-2022", cat: "unsure", levels: [30, 37, 60, 52, 66], marked: ["dizoglio", "green"], small: "all" },
  { dim: "media-market", cat: "boston-manchester", levels: [47, 60, 58, 58, 62], marked: ALL_FOUR },
  { dim: "media-market", cat: "other", levels: [45, 47, 57, 57, 56], marked: [] },
]

const MP4 = "https://s3.amazonaws.com/condoropenskies.net/videos/"
const REVIEW = "https://next.frame.io/share/80e0f5ad-075b-44f7-8622-ca68ce99085b/view/"

const BREAKDOWN_FOOTER = (times: string) =>
  `Rebuilt on a common 0–100% scale from the supplied Grow Progress ballot-choice subgroup screenshots (${times}); the source’s “Percentage points” axis label is replaced with % selecting Yes. Significance compares one video with placebo inside one subgroup — not videos with each other, and not subgroups with each other. Weighted counts by cell are not reported.`

export const MA_WAVE_2: ResultSet = {
  id: "ma-wave-2",
  study: "Massachusetts Message Testing",
  wave: 2,
  title: "Massachusetts Wave 2: What the test found",
  population: "Massachusetts general adults — not verified likely voters",
  fielded: { start: "2026-10-12", end: "2026-10-15" },
  sample: { raw: 2400, weighted: 2371 },
  weightingFactors: ["age", "gender", "race", "education", "party", "2024 presidential vote choice"],
  threshold: { level: 90, label: "Source’s 90% statistical criterion" },
  sources: [
    "Grow Progress, “Rapid Message Test Results: Massachusetts nonpartisan primary round 2,” fielded October 12–15, 2026.",
    "Source record, unchanged: Grow Progress dashboard, key experiment details (screenshot 2026-10-15, 9.13.59 AM; labeled Wave 2 by the team).",
    "Sources: Grow Progress Wave 1 and Wave 2 reports; verified results register.",
  ],
  arms: [
    { id: "placebo", name: "Placebo", role: "placebo", nWeighted: 443 },
    {
      id: "pahlow",
      name: "Pahlow",
      sourceTitle: "Pahlow",
      role: "treatment",
      durationSeconds: 32.6,
      nWeighted: 482,
      clipId: "px-paul",
      watchUrl: MP4 + "435f181a420581798fd5d3f0fb00fc15.mp4",
      reviewUrl: REVIEW + "3571fae1-0ae1-425b-8c1d-8916032e199a",
      note: "Largest displayed comprehension estimate in Wave 2.",
    },
    {
      id: "dizoglio",
      name: "DiZoglio",
      sourceTitle: "Dizoglio",
      role: "treatment",
      durationSeconds: 30,
      nWeighted: 484,
      watchUrl: MP4 + "526c5d31f5ba126c1776c3cd098c5e9c.mp4",
      reviewUrl: REVIEW + "2aad8b8f-2577-4d80-b519-923aee0c5b90",
      note: "Detectable differences on both outcomes.",
    },
    {
      id: "matt-wilson",
      name: "Matt Wilson",
      sourceTitle: "Matt Wilson",
      role: "treatment",
      durationSeconds: 36.4,
      nWeighted: 506,
      watchUrl: MP4 + "6417d791d9411c2c168787b7e8d2008e.mp4",
      reviewUrl: REVIEW + "a25c42dd-5b13-40bc-b7dd-e6423ff7530a",
      note: "Detectable differences on both outcomes.",
    },
    {
      id: "green",
      name: "Green",
      sourceTitle: "Green",
      role: "treatment",
      durationSeconds: 34.6,
      nWeighted: 457,
      watchUrl: MP4 + "6ca5b15be2ca5c2ce9ea963e6b66fd35.mp4",
      reviewUrl: REVIEW + "3cdb9f3d-9eff-48a5-b965-e589e18e17d8",
      note: "Largest displayed ballot-support estimate in Wave 2; comprehension inconclusive.",
    },
  ],
  outcomes: [
    {
      id: "ballot",
      name: "Ballot support",
      question: "If the election were held today, how would you vote on Ballot Question 3?",
      options: ["Yes", "No", "Would not vote"],
      definition: "The difference in the percentage selecting Yes on Question 3, compared with the placebo video.",
    },
    {
      id: "comprehension",
      name: "Comprehension",
      question: "Which of the following best describes the main change Question 3 would make to Massachusetts state primary elections?",
      options: [
        "Create one primary with all candidates on the same ballot, with the top two vote-getters overall advancing to the general election",
        "Keep separate party primaries, but allow every voter to choose which party’s primary to vote in",
        "Create one primary ballot, with the top candidate from each political party advancing to the general election",
        "Eliminate primary elections and put all candidates directly on the general-election ballot",
      ],
      correct: "Create one primary with all candidates on the same ballot, with the top two vote-getters overall advancing to the general election",
      definition: "The difference in the percentage correctly identifying the single-primary, top-two change, compared with placebo.",
    },
  ],
  // Levels as published (rounded); a treatment row's lift subtracts the rounded placebo level, so the row
  // is derived_from_rounded. The placebo rows carry their level and nothing else.
  toplines: [
    { armId: "placebo", outcomeId: "ballot", levelPct: 47, derivation: "published" },
    { armId: "placebo", outcomeId: "comprehension", levelPct: 45, derivation: "published" },
    { armId: "pahlow", outcomeId: "ballot", levelPct: 57, liftPp: 10, derivation: "derived_from_rounded", verdict: "detectable" },
    { armId: "pahlow", outcomeId: "comprehension", levelPct: 56, liftPp: 11, derivation: "derived_from_rounded", verdict: "detectable" },
    { armId: "dizoglio", outcomeId: "ballot", levelPct: 58, liftPp: 11, derivation: "derived_from_rounded", verdict: "detectable" },
    { armId: "dizoglio", outcomeId: "comprehension", levelPct: 54, liftPp: 9, derivation: "derived_from_rounded", verdict: "detectable" },
    { armId: "matt-wilson", outcomeId: "ballot", levelPct: 58, liftPp: 11, derivation: "derived_from_rounded", verdict: "detectable" },
    { armId: "matt-wilson", outcomeId: "comprehension", levelPct: 51, liftPp: 6, derivation: "derived_from_rounded", verdict: "detectable" },
    { armId: "green", outcomeId: "ballot", levelPct: 61, liftPp: 14, derivation: "derived_from_rounded", verdict: "detectable" },
    { armId: "green", outcomeId: "comprehension", levelPct: 50, liftPp: 5, derivation: "derived_from_rounded", verdict: "inconclusive" },
  ],
  dimensions: [
    {
      id: "media-trust",
      name: "Media trust (source label: Media Influence)",
      group: "media-trust",
      selfSelected: true,
      askedBeforeExposure: true,
      markedOfCells: { marked: 7, of: 12 },
      shareDerivation: "derived_from_rounded",
      categories: [
        { id: "tv-broadcast", name: "A traditional TV or broadcast ad", sharePct: 54.4, nWeighted: 1290 },
        { id: "speaking-to-camera", name: "A short social media video, person speaking to camera", sharePct: 24.5, nWeighted: 581 },
        { id: "podcast-interview", name: "A clip of a podcast or interview", sharePct: 21.1, nWeighted: 501 },
      ],
    },
    {
      id: "gender",
      name: "Gender",
      group: "gender-age-race-education",
      markedOfCells: { marked: 6, of: 8 },
      categories: [
        { id: "men", name: "Men" },
        { id: "women", name: "Women" },
      ],
    },
    {
      id: "age",
      name: "Age",
      group: "gender-age-race-education",
      markedOfCells: { marked: 8, of: 12 },
      categories: [
        { id: "18-34", name: "18–34" },
        { id: "35-54", name: "35–54" },
        { id: "55-plus", name: "55+" },
      ],
    },
    {
      id: "race",
      name: "Race",
      group: "gender-age-race-education",
      markedOfCells: { marked: 7, of: 16 },
      categories: [
        { id: "black", name: "Black", smallSampleAllCells: true },
        { id: "latino", name: "Latino" },
        { id: "white", name: "White" },
        { id: "other", name: "Other", smallSampleAllCells: true },
      ],
    },
    {
      id: "education",
      name: "Education",
      group: "gender-age-race-education",
      markedOfCells: { marked: 7, of: 12 },
      categories: [
        { id: "hs-or-less", name: "High school or less" },
        { id: "some-college", name: "Some college" },
        { id: "bachelors-plus", name: "Bachelor’s degree+" },
      ],
    },
    {
      id: "income",
      name: "Household income",
      group: "income-parent-ideology-party",
      markedOfCells: { marked: 6, of: 12 },
      categories: [
        { id: "0-49k", name: "$0–$49K" },
        { id: "50-99k", name: "$50K–$99K" },
        { id: "100k-plus", name: "$100K+" },
      ],
    },
    {
      id: "parent",
      name: "Parental status (children under 18)",
      group: "income-parent-ideology-party",
      markedOfCells: { marked: 4, of: 8 },
      categories: [
        { id: "parent", name: "Parent" },
        { id: "non-parent", name: "Non-parent" },
      ],
    },
    {
      id: "ideology",
      name: "Political ideology",
      group: "income-parent-ideology-party",
      markedOfCells: { marked: 5, of: 12 },
      categories: [
        { id: "liberal", name: "Liberal" },
        { id: "moderate", name: "Moderate" },
        { id: "conservative", name: "Conservative" },
      ],
    },
    {
      id: "party",
      name: "Party ID",
      group: "income-parent-ideology-party",
      markedOfCells: { marked: 4, of: 12 },
      categories: [
        { id: "democrat", name: "Democrat" },
        { id: "independent-other", name: "Independent/Other" },
        { id: "republican", name: "Republican" },
      ],
    },
    {
      id: "community",
      name: "Urbanicity",
      group: "urbanicity-turnout-market",
      markedOfCells: { marked: 6, of: 12 },
      categories: [
        { id: "urban", name: "Urban" },
        { id: "suburban", name: "Suburban" },
        { id: "rural", name: "Rural", smallSampleAllCells: true },
      ],
    },
    {
      id: "vote-2024",
      name: "2024 presidential vote choice",
      group: "urbanicity-turnout-market",
      markedOfCells: { marked: 4, of: 16 },
      categories: [
        { id: "voted-dem", name: "Voted Dem" },
        { id: "voted-rep", name: "Voted Rep" },
        { id: "voted-other", name: "Voted Other", smallSampleAllCells: true },
        { id: "did-not-vote", name: "Did not vote" },
      ],
    },
    {
      id: "turnout-2022",
      name: "2022 midterm turnout",
      group: "urbanicity-turnout-market",
      // Printed on the Wave 1 chart; the stem is not printed in Wave 2 either.
      needsVerification: "Exact question stem not printed in the report",
      markedOfCells: { marked: 5, of: 12 },
      categories: [
        { id: "yes", name: "Yes" },
        { id: "no", name: "No" },
        { id: "unsure", name: "Unsure", smallSampleAllCells: true },
      ],
    },
    {
      id: "media-market",
      name: "Media market",
      group: "urbanicity-turnout-market",
      markedOfCells: { marked: 4, of: 8 },
      categories: [
        { id: "boston-manchester", name: "Boston MA (Manchester NH)" },
        { id: "other", name: "Other" },
      ],
    },
  ],
  cells: expand(ROWS),
  pairings: [
    {
      rank: 1,
      armIds: ["green"],
      audience: "Adults 55+ and high school or less",
      finding:
        "The only significant video in each: 54% vs 41% placebo among 55+ and 61% vs 45% among high school or less. Significant in 24 of 38 subgroups — the broadest in Wave 2.",
    },
    {
      rank: 2,
      armIds: ["green"],
      audience: "$100K+ households and 2024 non-voters",
      finding: "The only significant video among $100K+ (60% vs 48%); the highest level among 2024 non-voters (65% vs 31%).",
      caveat: "Pahlow (56%) and Matt Wilson (55%) are also significant with non-voters.",
    },
    {
      rank: 3,
      armIds: ["matt-wilson"],
      audience: "Latino respondents",
      finding: "75% vs 53% placebo — the highest level of any video in this group. Green (71%) is the only other significant video.",
      caveat: "Among Black respondents: 44% vs 52%, not significant (small sample).",
    },
    {
      rank: 4,
      armIds: ["matt-wilson", "green"],
      audience: "Women",
      finding: "The only two significant videos: 61% and 63% vs a 50% placebo.",
      caveat: "Pahlow (56%) and DiZoglio (57%) are not significant.",
    },
    {
      rank: 5,
      armIds: ["pahlow", "green"],
      audience: "Conservatives",
      finding: "57% and 55% vs a 41% placebo — the only two significant videos.",
      caveat: "DiZoglio (46%) and Matt Wilson (48%) sit near placebo.",
    },
    {
      rank: 6,
      armIds: ["pahlow", "matt-wilson"],
      audience: "Respondents who trust social video most",
      finding: "69% and 71% vs a 46% placebo — the highest levels in any media-trust group. Green (63%) is also significant.",
      caveat: "Self-selected group; describes stated trust, not a format effect.",
    },
    {
      rank: 7,
      armIds: ["dizoglio"],
      audience: "Moderates, some college and $0–$49K households",
      finding: "The highest level in each: 65% vs 48%, 64% vs 49% and 60% vs 49%.",
      caveat: "Leads by one point or less. Green is also significant in all three; Matt Wilson in the first two.",
    },
    {
      rank: 8,
      armIds: ["pahlow"],
      audience: "2022 midterm non-voters",
      finding: "64% vs 40% placebo — the highest level. Matt Wilson (61%) and Green (62%) are also significant.",
      caveat: "Turnout is self-reported.",
    },
    {
      rank: 9,
      armIds: ["pahlow", "dizoglio", "matt-wilson", "green"],
      audience: "Independent/Other party ID",
      finding: "Every video is significant: 55% to 63% vs a 38% placebo, the lowest party placebo level.",
      caveat: "Matt Wilson is highest (63%).",
    },
    {
      rank: 10,
      armIds: [],
      audience: "Democrats, Republicans, liberals and parents",
      finding:
        "No video is significant in any of these groups. Highest levels: Green at 63% among Democrats (vs 54%) and Republicans (vs 51%).",
      caveat: "Placebo levels start higher here (51%–58% Yes).",
    },
  ],
  stories: [
    // Study level (the latest wave carries the executive summary, pages 1–5).
    {
      id: "study-subtitle",
      title: "Ballot support, comprehension and media trust",
      body: "A retrospective readout of two randomized, placebo-controlled message tests on Massachusetts Ballot Question 3, fielded with Grow Progress in October 2026. Descriptive research findings and audience hypotheses to test — not a paid-media selection plan.",
    },
    {
      id: "caution-separate-studies",
      title: "Separate studies, own placebos",
      body: "Each wave had its own sample and placebo arm. This is one descriptive list across two studies — not a pooled experiment, and not evidence that any video outperforms another.",
    },
    {
      id: "caution-published-vs-approximate",
      title: "Published versus approximate",
      body: "Wave 1 lifts are as published, calculated before rounding. Wave 2 lifts (≈) subtract displayed rounded percentages; exact unrounded estimates were not supplied.",
    },
    {
      id: "caution-campaign-ad",
      title: "The campaign ad is a treatment",
      body: "The official campaign ad was an active treatment in Wave 1 only. It is not the placebo, and Wave 2 has no campaign-ad benchmark arm.",
    },
    {
      id: "seen-in-both",
      title: "Seen in both waves",
      body: "Adults 55+ responded to few videos (2 of 6, then 1 of 4), while Latino respondents had two significant videos each time. Different videos each wave — descriptive, not tested.",
    },
    { id: "flow-1", title: "01", body: "Answer background and media-trust questions" },
    { id: "flow-2", title: "02", body: "Randomly assigned to a group" },
    { id: "flow-3", title: "03", body: "Watch a test or comparison video" },
    { id: "flow-4", title: "04", body: "Read the ballot explanation" },
    { id: "flow-5", title: "05", body: "Answer support and understanding questions" },
    {
      id: "question-trust",
      title: "Which format do you trust?",
      body: "People chose the format they trust most for political or public information.\n\n· TV or broadcast ad\n· Someone speaking to camera\n· Podcast or interview clip\n\nThis tells us their preference before the test.",
    },
    {
      id: "question-vote",
      title: "Would you vote Yes?",
      body: "People said how they would vote on Question 3.\n\nYes · No · Would not vote\n\nWe compared the percentage choosing Yes across groups.",
    },
    {
      id: "question-understand",
      title: "Did you understand the change?",
      body: "People selected what Question 3 would change about primary elections.\n\nWe compared the percentage choosing the correct answer.\n\nAsked after everyone read the ballot explanation.",
    },
    // Wave 2 (pages 17–23). Page headlines that count verdicts are the renderer's to compute.
    {
      id: "overview-1",
      title: "All four videos showed detectable ballot-support differences.",
      body: "Four treatment videos were compared with one placebo (47% Yes). Each meets the source’s 90% criterion.",
    },
    {
      id: "overview-2",
      title: "Three of four showed detectable comprehension differences.",
      body: "Pahlow, DiZoglio and Matt Wilson meet the criterion. Green’s ≈ +5 pp is inconclusive — not evidence of no effect.",
    },
    {
      id: "overview-3",
      title: "The two outcomes order the videos differently.",
      body: "Green has the largest displayed ballot-support estimate; Pahlow the largest displayed comprehension estimate. Neither is shown to differ statistically from the other videos.",
    },
    {
      id: "overview-4",
      title: "Whole videos were tested.",
      body: "Each video bundles presenter, script, on-screen cards, format and length. Randomizing complete videos cannot isolate which element produced a difference.",
    },
    {
      id: "card-iteration",
      title: "The card iteration",
      body: "Following Wave 1’s strong support results but limited comprehension findings, the team added explanatory on-screen cards. Wave 2 subsequently showed detectable comprehension gains for three videos. This is consistent with the team’s learning objective, although the experiment tested complete videos rather than isolating the cards.",
    },
    {
      id: "reading-a-lift",
      title: "Reading a lift",
      body: "In Wave 2, 61% selected Yes after Green versus 47% after placebo: approximately 14 percentage points higher, using rounded values.",
    },
    {
      id: "between-videos",
      title: "Between videos",
      body: "Green has the largest displayed estimate; DiZoglio and Matt Wilson share 58%; Pahlow is 57%. The source does not establish that the four differ from one another.",
    },
    {
      id: "frames-supplied",
      title: "Frames supplied by the team",
      body: "Four unchanged frames from Wave 2 creative. The supplied package does not map frames to video names, so none is attributed to a card above.",
    },
    { id: "step-1", title: "Entry questions", body: "Ideology and partisanship, education and presidential vote, plus one custom media-trust question." },
    { id: "step-2", title: "Random assignment", body: "Each participant was randomly assigned to one of five arms." },
    {
      id: "step-3",
      title: "Exposure",
      body: "One of four treatment videos — Pahlow, Dizoglio, Matt Wilson or Green — or a placebo video. The placebo is the control, not a message.",
    },
    {
      id: "step-4",
      title: "Written explanation",
      body: "Every arm read the same written summary of Question 3, shown right, before either outcome question — so comprehension reflects recognition after reading, not video recall alone.",
    },
    {
      id: "step-5",
      title: "Two outcomes",
      body: "Ballot choice first, then comprehension. Yes and the correct description were the source’s desired outcomes; “Would not vote” was anchored last.",
    },
    {
      id: "written-explanation",
      title: "Shown to every arm after the video · as printed in the source",
      body: [
        "On November 3, the people of Massachusetts get to vote on Ballot Question 3.",
        "This proposed law would eliminate political party primaries for state elections and instead establish a system where there would be a single, all-party primary in which all candidates, regardless of their party affiliation, would be listed on one ballot, and voters could vote for any candidate on the ballot. The two candidates receiving the most votes in the primary would advance to the general election ballot.",
        "This proposed law would require candidates for governor and lieutenant governor to run and be listed jointly on the ballot in the primary.",
        "This proposed law would provide political party status to any group whose candidates for any statewide office received at least 3% of the ballots cast in the state primary.",
        "A YES VOTE would eliminate separate party primaries for state elections and require a single primary in which all candidates appear on one ballot, voters could vote for any candidate, and the top two candidates would advance to the general election.",
        "A NO VOTE would make no change to the laws governing primary elections.",
      ].join("\n\n"),
    },
    { id: "breakdowns-levels", title: "Levels, not lifts.", body: "Each bar is the % selecting Yes in one subgroup and arm." },
    { id: "breakdowns-comparisons", title: "Many comparisons.", body: "38 subgroups × 4 videos; no multiplicity adjustment is documented." },
    { id: "breakdowns-small-cells", title: "Small cells.", body: "Hatched, italic = source flag for fewer than 50 actual responses." },
    { id: "breakdowns-description", title: "Description only.", body: "No interaction tests; nothing here identifies audiences to target." },
    {
      id: "media-trust-self-selected",
      title: "Self-selected groups",
      body: "People chose their trust answer before exposure, so the groups differ in many ways besides format preference.",
    },
    {
      id: "media-trust-within-group",
      title: "Within-group tests only",
      body: "No interaction tests are reported. A marked cell in one group but not another does not establish a group difference.",
    },
    {
      id: "media-trust-not-targeting",
      title: "Not a targeting guide",
      body: "The source summary calls Pahlow “especially persuasive” in some subgroups; this report does not adopt subgroup-persuasion conclusions.",
    },
    // Page 22 blocks outside the story-id convention, held here for the lead to adopt or drop.
    {
      id: "media-trust-wording",
      title: "Exact wording · asked at entry",
      body: "“Which video format do you trust most for information about political or public issues?”\n\n· A traditional TV or broadcast ad\n· A short social media video with a person speaking directly to camera\n· A clip of a podcast or interview\n\nThe source calls this “Media Influence”; the wording measures stated trust.",
    },
    {
      id: "media-trust-stated",
      title: "Stated trust",
      body: "A self-report collected before exposure. Respondents chose their own group; it was not assigned.",
    },
    {
      id: "media-trust-experimental",
      title: "Experimental outcome",
      body: "Ballot choice and comprehension, measured after random assignment to a video or placebo.",
    },
  ],
  notes: {
    // Page 21's "What it can support" / "What it cannot".
    supported: ["Three complete videos produced detectable recognition gains versus placebo — consistent with the aim of the added cards."],
    notSupported: [
      "Attribute the gains to the cards rather than script, presenter, format or length. Green’s ≈ +5 pp is inconclusive, not evidence of no effect.",
    ],
    // The methods captions printed across pages 2–4 and 18–26, in page order.
    methodology: [
      "No confidence intervals are shown because exact intervals were not supplied. Comprehension lift is the same comparison for the share correctly identifying the change Question 3 would make. Wave 1 names link to the review copies embedded in the original Wave 1 report. Wave 2 names link to the tested MP4 listed in the Grow Progress report. Sources: Grow Progress Wave 1 and Wave 2 reports; verified results register.",
      "Levels are rounded displayed percentages from the Grow Progress Wave 2 comprehension topline; ≈ lifts are arithmetic differences between them. Detectable = meets the source’s 90% criterion versus placebo; inconclusive is not evidence of no effect. Wave 1 lifts are published values versus the Wave 1 placebo.",
      "Comparison video = study placebo. Source: Grow Progress original reports, W1 pp. 11/18, W2 pp. 10/17. Weighted counts: W1 1,919 / 855 / 790 (total 3,564); W2 1,290 / 581 / 501 (total 2,372; reported 2,371, a rounding difference). Stated trust is not a measure of persuasion effectiveness. Exact questions and detailed methods appear later in the report.",
      "Levels are rounded displayed percentages; ≈ lifts subtract the placebo level. Dashed tick = placebo. Shown in source order.",
      "Card notes are descriptive, not reasons to deploy a video. “Watch tested MP4” opens the file listed in the Grow Progress report (verified publicly playable on October 15, 2026). “Review copy” opens the current Frame.io copy; rounded durations match, but exact-cut identity is not established. Durations are from the tested MP4 metadata; all four are 1440 × 2560 vertical.",
      "General adult population, Massachusetts; in field Monday, October 12 to Thursday, October 15, 2026. Weighted on age, gender, race, education, party and 2024 presidential vote choice. Rounded arm counts sum to 2,372; the published weighted total is 2,371 — both shown as published. Weighted counts are not effective sample sizes.",
      "Share selecting Yes on Question 3 after each arm. Recreated from the source values; no intervals are drawn because their confidence level is not documented.",
      "The ballot topline chart in the Grow Progress PDF (page 3) renders visually collapsed and is not reproduced. Values are recovered from the dashboard screenshot above (2026-10-15, 9.08.50 AM). That crop is unlabeled; its attribution to Ballot Vote Choice is inferred from the surrounding supplied report context and because its values (47 / 57 / 58 / 58 / 61) differ from the comprehension toplines (45 / 56 / 54 / 51 / 50). All four treatment bars carry the source’s significance outline.",
      "Share choosing the correct description of the change, after the written explanation. Recreated from the source’s rounded values.",
      "Comprehension outlines in the source apply to Pahlow, DiZoglio and Matt Wilson only. The source’s “probability to be best” figures (70% for Pahlow on comprehension, 6% on ballot choice) use an undocumented calculation and are not used as findings. Comprehension subgroup charts (source PDF pages 11–17) were not supplied legibly and are not reproduced.",
      "Calculated approximations from rounded weighted counts (denominator 2,372). No Wave 1 distribution is available in the supplied report.",
      "Green bar with dark outline = significant versus placebo inside that group at the source’s 90% threshold; gray = not marked; lavender = placebo; dashed line = placebo level. Rebuilt on a 0–100% scale from the Grow Progress Media Influence breakout (screenshot 9.10.58 AM).",
      BREAKDOWN_FOOTER("9.09.04–9.09.27 AM"),
      BREAKDOWN_FOOTER("9.09.34–9.10.01 AM"),
      BREAKDOWN_FOOTER("9.10.17–9.10.41 and 9.11.04 AM"),
    ],
    // The cautions printed across pages 3–5 and 17–23, in page order.
    limitations: [
      "Different videos and separate samples; no cards-versus-no-cards randomized comparison.",
      "Unchanged frames from Wave 2 creative. Examples only — not proof that the cards caused the results, and not attributed to individual videos.",
      "These are shares of respondents choosing each answer — not ballot support or persuasion results.",
      "Hypotheses to test, not proven matches. Significant = video vs placebo within one subgroup (90% threshold), not video vs video; with no documented multiplicity adjustment, some patterns will be chance. Full pairings: pages 9 and 23.",
      "Green bar = detectable at the source’s 90% criterion. Gray = inconclusive. All lifts (≈) are differences between rounded displayed percentages; order is the source’s listing order, not a ranking.",
      "The 90% criterion is the source’s statistical decision rule. It does not mean there is a 90% chance any particular person changed their mind.",
      "Unchanged frames. Examples of the added cards — not proof of card causality, and not attributed to individual videos.",
      "It describes who respondents were at the start. It is not an outcome of the videos, and it is not an experimental test of which medium works best.",
      "These are % selecting Yes inside each self-selected group — not the share choosing each trust response.",
      "Hypotheses for further testing, not targeting recommendations. Significant = video vs placebo inside one subgroup at the source’s 90% threshold — not videos vs each other. 38 subgroups × 4 videos with no documented multiplicity adjustment, so some marks are likely chance. Ballot-choice levels only.",
    ],
    debriefQuestions: [],
    comprehensionCaveat:
      "Multiple-choice recognition, asked after respondents read a written explanation of Question 3 — not unaided recall, and not long-term retention.",
    noEffectMeaning: "Inconclusive — not detected; not proof of zero effect",
  },
}
