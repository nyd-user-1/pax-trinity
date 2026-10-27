import type { ResultSet, SubgroupCell } from "./types"

// Massachusetts Message Testing, Wave 1, transcribed from docs/reports/report-2-ma-test-waves-1-2.pdf:
// the original Wave 1 report reproduced unchanged on pages 7–16 (its own pages 1/10–10/10), plus the
// Wave 1 links on page 2. Every lift is Grow Progress's published, pre-rounding figure. The subgroup
// cells are LEVELS (% selecting Yes), never lifts; `significant` is the printed outline (vs placebo inside
// that subgroup at the 90% threshold) and `smallSample` the printed hatching/italics.

const ARMS = ["placebo", "danielle-allen", "littlewood", "donut", "official-campaign-ad", "dustin", "rodriguez"] as const
type ArmId = (typeof ARMS)[number]

type Row = {
  dim: string
  cat: string
  levels: readonly number[] // in ARMS order: placebo first
  marked: readonly ArmId[]
  small?: readonly ArmId[] | "all"
}

const ALL_SIX: readonly ArmId[] = ["danielle-allen", "littlewood", "donut", "official-campaign-ad", "dustin", "rodriguez"]
const FIVE: readonly ArmId[] = ["danielle-allen", "littlewood", "donut", "official-campaign-ad", "dustin"]

function expand(rows: readonly Row[]): SubgroupCell[] {
  return rows.flatMap((r) =>
    ARMS.map((armId, i) => ({
      dimensionId: r.dim,
      categoryId: r.cat,
      armId,
      outcomeId: "ballot",
      levelPct: r.levels[i],
      significant: r.marked.includes(armId),
      smallSample: r.small === "all" || (r.small?.includes(armId) ?? false),
    })),
  )
}

// Pages 10–15 (Wave 1 pages 4/10–9/10). Levels read placebo, Danielle, Littlewood, Donut, Official
// campaign ad, Dustin, Rodriguez.
const ROWS: readonly Row[] = [
  { dim: "gender", cat: "men", levels: [48, 67, 65, 60, 59, 58, 48], marked: FIVE },
  { dim: "gender", cat: "women", levels: [47, 64, 61, 58, 59, 58, 50], marked: FIVE },
  { dim: "age", cat: "18-34", levels: [46, 75, 59, 62, 66, 60, 53], marked: FIVE },
  { dim: "age", cat: "35-54", levels: [51, 65, 69, 65, 65, 65, 56], marked: FIVE },
  { dim: "age", cat: "55-plus", levels: [46, 60, 62, 52, 47, 51, 41], marked: ["danielle-allen", "littlewood"] },
  { dim: "race", cat: "black", levels: [45, 61, 53, 64, 45, 61, 55], marked: [], small: ["placebo", "danielle-allen", "littlewood", "donut", "official-campaign-ad", "rodriguez"] },
  { dim: "race", cat: "latino", levels: [54, 68, 66, 72, 72, 59, 53], marked: ["donut", "official-campaign-ad"] },
  { dim: "race", cat: "white", levels: [48, 66, 63, 58, 58, 57, 48], marked: FIVE },
  { dim: "race", cat: "other", levels: [38, 67, 66, 52, 60, 60, 51], marked: ["danielle-allen", "littlewood"], small: "all" },
  { dim: "education", cat: "hs-or-less", levels: [51, 72, 56, 59, 60, 46, 44], marked: ["danielle-allen"] },
  { dim: "education", cat: "some-college", levels: [42, 63, 68, 62, 61, 59, 46], marked: FIVE },
  { dim: "education", cat: "bachelors-plus", levels: [51, 65, 64, 57, 57, 65, 55], marked: ["danielle-allen", "littlewood", "dustin"] },
  { dim: "income", cat: "0-49k", levels: [42, 70, 60, 62, 59, 58, 38], marked: FIVE },
  { dim: "income", cat: "50-99k", levels: [50, 69, 58, 54, 62, 55, 52], marked: ["danielle-allen", "official-campaign-ad"] },
  { dim: "income", cat: "100k-plus", levels: [50, 59, 70, 62, 55, 63, 62], marked: ["littlewood", "donut", "dustin", "rodriguez"] },
  { dim: "parent", cat: "parent", levels: [50, 67, 64, 65, 68, 72, 66], marked: ALL_SIX },
  { dim: "parent", cat: "non-parent", levels: [46, 66, 63, 57, 55, 54, 43], marked: ["danielle-allen", "littlewood", "donut", "official-campaign-ad"] },
  { dim: "ideology", cat: "liberal", levels: [36, 68, 66, 57, 62, 62, 50], marked: ALL_SIX },
  { dim: "ideology", cat: "moderate", levels: [53, 68, 68, 68, 63, 63, 53], marked: FIVE },
  { dim: "ideology", cat: "conservative", levels: [50, 61, 48, 54, 51, 58, 50], marked: [] },
  { dim: "party", cat: "democrat", levels: [48, 69, 62, 62, 62, 58, 60], marked: ["danielle-allen", "littlewood", "donut", "official-campaign-ad", "rodriguez"] },
  { dim: "party", cat: "independent-other", levels: [45, 65, 67, 58, 58, 57, 40], marked: FIVE },
  { dim: "party", cat: "republican", levels: [51, 60, 50, 53, 53, 63, 48], marked: [] },
  { dim: "community", cat: "urban", levels: [44, 67, 65, 63, 53, 56, 48], marked: ["danielle-allen", "littlewood", "donut", "dustin"] },
  { dim: "community", cat: "suburban", levels: [51, 64, 62, 57, 62, 60, 51], marked: ["danielle-allen", "littlewood", "official-campaign-ad", "dustin"] },
  { dim: "community", cat: "rural", levels: [36, 88, 58, 50, 64, 50, 41], marked: ["danielle-allen"], small: "all" },
  { dim: "vote-2024", cat: "voted-dem", levels: [50, 65, 66, 60, 58, 61, 55], marked: ["danielle-allen", "littlewood", "dustin"] },
  { dim: "vote-2024", cat: "voted-rep", levels: [53, 67, 64, 60, 57, 69, 55], marked: ["danielle-allen", "dustin"] },
  { dim: "vote-2024", cat: "voted-other", levels: [42, 65, 67, 64, 64, 67, 32], marked: [], small: "all" },
  { dim: "vote-2024", cat: "did-not-vote", levels: [41, 67, 57, 56, 60, 43, 42], marked: ["danielle-allen", "littlewood", "donut", "official-campaign-ad"] },
  { dim: "turnout-2022", cat: "yes", levels: [54, 63, 66, 60, 57, 65, 53], marked: ["danielle-allen", "littlewood", "dustin"] },
  { dim: "turnout-2022", cat: "no", levels: [41, 73, 62, 57, 63, 54, 51], marked: FIVE },
  { dim: "turnout-2022", cat: "unsure", levels: [41, 53, 46, 62, 50, 31, 24], marked: [], small: "all" },
  { dim: "media-trust", cat: "tv-broadcast", levels: [45, 67, 67, 58, 59, 57, 49], marked: FIVE },
  { dim: "media-trust", cat: "speaking-to-camera", levels: [52, 65, 60, 63, 64, 63, 52], marked: ["danielle-allen", "donut", "official-campaign-ad"] },
  { dim: "media-trust", cat: "podcast-interview", levels: [47, 64, 56, 56, 52, 57, 47], marked: ["danielle-allen"] },
]

const FRAME_IO = "https://next.frame.io/share/ed42d6ec-f4eb-4e9d-b4af-83173df40de8/view/"

export const MA_WAVE_1: ResultSet = {
  id: "ma-wave-1",
  study: "Massachusetts Message Testing",
  wave: 1,
  title: "Massachusetts Wave 1: What the test found",
  population: "Massachusetts general adults — not a verified likely-voter sample",
  fielded: { start: "2026-10-02", end: "2026-10-07" },
  sample: { raw: 3600, weighted: 3564 },
  weightingFactors: ["age", "gender", "race", "education", "party", "2024 presidential vote"],
  threshold: { level: 90, label: "90% statistical threshold" },
  sources: [
    "Grow Progress Wave 1 report, fielded October 2–7, 2026.",
    "Grow Progress subgroup views, “Overall Percentage” · Moving people toward Yes. Rebuilt from supplied screenshots; the source’s “Percentage points” axis label is replaced with % selecting Yes.",
  ],
  arms: [
    { id: "placebo", name: "Placebo", role: "placebo", nWeighted: 494 },
    {
      id: "danielle-allen",
      name: "Danielle Allen",
      role: "treatment",
      producer: "Parallax-produced",
      durationSeconds: 35,
      nWeighted: 512,
      clipId: "px-danielle",
      watchUrl: FRAME_IO + "a00551fa-04cd-4718-b210-f6b16f8bca78",
      note: "Largest reported lift estimate · 35s street interview",
    },
    {
      id: "littlewood",
      name: "Littlewood",
      role: "treatment",
      producer: "Parallax-produced",
      nWeighted: 484,
      clipId: "px-jesse",
      watchUrl: FRAME_IO + "fd9f7400-be31-4ab8-ac90-05186b576a90",
      note: "Only negative comprehension estimate — not detectable",
    },
    {
      id: "donut",
      name: "Donut",
      role: "treatment",
      producer: "Parallax-produced",
      nWeighted: 518,
      watchUrl: FRAME_IO + "5a5daad0-422f-4a67-8897-686dc781f85e",
      note: "Positive support result; no detectable comprehension difference",
    },
    {
      id: "official-campaign-ad",
      name: "Official campaign ad",
      role: "treatment",
      producer: "Campaign-produced",
      nWeighted: 491,
      watchUrl: "https://www.dropbox.com/scl/fi/jateupa882uhqcqlhro6u/CFHD_HTA30_1026.mp4?rlkey=v58jz7ynw5derpf80b89803su&st=lm527e95&e=1&dl=0",
      note: "Tied at +11 with Dustin",
    },
    {
      id: "dustin",
      name: "Dustin",
      role: "treatment",
      producer: "Parallax-produced",
      nWeighted: 520,
      clipId: "px-dustin",
      watchUrl: FRAME_IO + "cee18145-b226-43e2-bc9d-ea869c6c702c",
      note: "Tied at +11 with the official ad",
    },
    {
      id: "rodriguez",
      name: "Rodriguez",
      role: "treatment",
      producer: "Parallax-produced",
      nWeighted: 546,
      clipId: "px-alex",
      watchUrl: FRAME_IO + "21e136f4-f9ed-4fe1-af41-18677b03b988",
      note: "Only video without a detectable support difference",
    },
  ],
  outcomes: [
    {
      id: "ballot",
      name: "Ballot choice",
      definition:
        "A difference in the percentage saying they would vote Yes on Question 3, compared with the placebo video. Grow Progress’s positive “Persuasive” label uses its 90% statistical threshold.",
    },
    {
      id: "comprehension",
      name: "Comprehension",
      definition:
        "A difference in the percentage correctly identifying the single-primary, top-two change proposed by Question 3, compared with placebo.",
    },
  ],
  toplines: [
    { armId: "placebo", outcomeId: "ballot", derivation: "published" },
    { armId: "placebo", outcomeId: "comprehension", derivation: "published" },
    { armId: "danielle-allen", outcomeId: "ballot", liftPp: 18, derivation: "published", verdict: "detectable" },
    { armId: "danielle-allen", outcomeId: "comprehension", liftPp: 3, derivation: "published", verdict: "inconclusive" },
    { armId: "littlewood", outcomeId: "ballot", liftPp: 15, derivation: "published", verdict: "detectable" },
    { armId: "littlewood", outcomeId: "comprehension", liftPp: -3, derivation: "published", verdict: "inconclusive" },
    { armId: "donut", outcomeId: "ballot", liftPp: 12, derivation: "published", verdict: "detectable" },
    { armId: "donut", outcomeId: "comprehension", liftPp: 0, derivation: "published", verdict: "inconclusive" },
    { armId: "official-campaign-ad", outcomeId: "ballot", liftPp: 11, derivation: "published", verdict: "detectable" },
    { armId: "official-campaign-ad", outcomeId: "comprehension", liftPp: 3, derivation: "published", verdict: "inconclusive" },
    { armId: "dustin", outcomeId: "ballot", liftPp: 11, derivation: "published", verdict: "detectable" },
    { armId: "dustin", outcomeId: "comprehension", liftPp: 0, derivation: "published", verdict: "inconclusive" },
    { armId: "rodriguez", outcomeId: "ballot", liftPp: 2, derivation: "published", verdict: "inconclusive" },
    { armId: "rodriguez", outcomeId: "comprehension", liftPp: 0, derivation: "published", verdict: "inconclusive" },
  ],
  dimensions: [
    {
      id: "gender",
      name: "Gender",
      group: "gender-age",
      whatItShows:
        "Placebo Yes levels are nearly identical for men (48%) and women (47%). The same five videos carry the significance marker in both groups; Rodriguez is unmarked in both (48% and 50%).",
      howToRead:
        "Only two categories are reported, so this does not represent every gender identity — and matching marker patterns do not establish equal effects.",
      categories: [
        { id: "men", name: "Men" },
        { id: "women", name: "Women" },
      ],
    },
    {
      id: "age",
      name: "Age",
      group: "gender-age",
      whatItShows:
        "In the 18–34 and 35–54 bands, five of six videos are marked versus placebo. Among 55+, only Danielle (60%) and Littlewood (62%) are marked against a 46% placebo; the official ad sits at 47%.",
      howToRead:
        "These are three broad bands, not a continuous trend; fewer markers among 55+ does not by itself show that effects differ by age.",
      categories: [
        { id: "18-34", name: "18–34" },
        { id: "35-54", name: "35–54" },
        { id: "55-plus", name: "55+" },
      ],
    },
    {
      id: "race",
      name: "Race/ethnicity",
      group: "race-education",
      whatItShows:
        "White respondents mirror the overall pattern (48% placebo; five videos marked). Among Latino respondents, only the official ad and Donut (both 72%) are marked against a 54% placebo. No Black cell is marked.",
      howToRead:
        "Six of seven Black cells and every Other cell carry the small-sample flag; “Other” combines distinct groups and is not one homogeneous population.",
      categories: [
        { id: "black", name: "Black" },
        { id: "latino", name: "Latino" },
        { id: "white", name: "White" },
        { id: "other", name: "Other", smallSampleAllCells: true },
      ],
    },
    {
      id: "education",
      name: "Education",
      group: "race-education",
      whatItShows:
        "Some college has the lowest placebo level (42%), with five videos marked. In high school or less, only Danielle is marked (72% vs 51%); in bachelor’s+, Danielle, Dustin and Littlewood are marked.",
      howToRead:
        "These are formal qualifications exactly as shown — not proxies for class — and marker differences across levels are not tested differences in effect.",
      categories: [
        { id: "hs-or-less", name: "High school or less" },
        { id: "some-college", name: "Some college" },
        { id: "bachelors-plus", name: "Bachelor’s degree+" },
      ],
    },
    {
      id: "income",
      name: "Household income",
      group: "income-parenthood",
      whatItShows:
        "In $0–$49K, five videos are marked against a 42% placebo; Rodriguez is 38%, unmarked. $100K+ is the only bracket where Rodriguez is marked (62% vs 50%), while Danielle (59%) is not.",
      howToRead:
        "Household-income brackets are kept as published and are not a proxy for education or class; one isolated marker among many comparisons, like Rodriguez in $100K+, may reflect chance.",
      categories: [
        { id: "0-49k", name: "$0–$49K" },
        { id: "50-99k", name: "$50K–$99K" },
        { id: "100k-plus", name: "$100K+" },
      ],
    },
    {
      id: "parent",
      name: "Parental status (children under 18)",
      group: "income-parenthood",
      whatItShows:
        "Among parents, all six videos are marked, including Rodriguez (66% vs 50% placebo). Among non-parents, four are marked; Rodriguez (43%) and Dustin (54%) are not.",
      howToRead:
        "Parent and Non-Parent are the source’s labels for having children under 18; exact ages, household composition and cell counts are not reported.",
      categories: [
        { id: "parent", name: "Parent" },
        { id: "non-parent", name: "Non-Parent" },
      ],
    },
    {
      id: "ideology",
      name: "Ideology",
      group: "ideology-party",
      whatItShows:
        "Liberal respondents have the lowest placebo level (36%), and all six videos are marked. Among conservatives no video is marked; levels range from 48% to 61% against a 50% placebo.",
      howToRead:
        "Ideology is self-identified and distinct from party ID; a marked group beside an unmarked one does not establish that effects differ between them.",
      categories: [
        { id: "liberal", name: "Liberal" },
        { id: "moderate", name: "Moderate" },
        { id: "conservative", name: "Conservative" },
      ],
    },
    {
      id: "party",
      name: "Party identification",
      group: "ideology-party",
      whatItShows:
        "Among Democrats and among Independent/Other, five videos are marked in each. No Republican cell is marked; the highest Republican level is Dustin at 63% against a 51% placebo.",
      howToRead:
        "“Independent/Other” is a combined category; Republican cells carry no small-sample flag, but an absent flag does not guarantee adequate power.",
      categories: [
        { id: "democrat", name: "Democrat" },
        { id: "independent-other", name: "Independent/Other" },
        { id: "republican", name: "Republican" },
      ],
    },
    {
      id: "community",
      name: "Community type",
      group: "community-vote",
      whatItShows:
        "Urban and suburban results broadly resemble the overall pattern. The Rural panel shows the widest spread (36% placebo; Danielle 88%), but every Rural cell carries the small-sample flag.",
      howToRead:
        "The 88% Rural figure rests on a small cell — treat it as noise-prone, not as evidence of a larger rural effect.",
      categories: [
        { id: "urban", name: "Urban" },
        { id: "suburban", name: "Suburban" },
        { id: "rural", name: "Rural", smallSampleAllCells: true },
      ],
    },
    {
      id: "vote-2024",
      name: "2024 presidential vote choice",
      group: "community-vote",
      whatItShows:
        "Did-not-vote respondents have the lowest placebo level (41%), with four videos marked. Among Voted Rep, Danielle (67%) and Dustin (69%) are marked against 53%. No Voted Other cell is marked.",
      howToRead:
        "Reported 2024 vote is self-reported, not checked against voter files; every Voted Other cell is flagged small-sample.",
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
      group: "turnout-media",
      needsVerification: "Exact question stem not printed in the report",
      whatItShows:
        "Respondents answering “No” (did not vote in 2022, per the report’s section label) start lower — 41% placebo — with five videos marked; “Yes” starts at 54% with three marked. All Unsure cells are small-sample.",
      howToRead:
        "Turnout is self-reported and the stem is not printed, so confirm the wording before relying on the Yes/No/Unsure groupings.",
      categories: [
        { id: "yes", name: "Yes" },
        { id: "no", name: "No" },
        { id: "unsure", name: "Unsure", smallSampleAllCells: true },
      ],
    },
    {
      id: "media-trust",
      name: "Media influence",
      group: "turnout-media",
      selfSelected: true,
      askedBeforeExposure: true,
      shareDerivation: "derived_from_rounded",
      whatItShows:
        "Among respondents choosing a TV or broadcast ad, five videos are marked against a 45% placebo. Among those choosing a podcast or interview clip, only Danielle is marked (64% vs 47%).",
      howToRead:
        "These are self-selected answer groups, not randomly assigned formats, so the chart cannot show that any format caused an outcome.",
      // Shares and weighted counts from the executive summary (page 4): ≈54% / ≈24% / ≈22%, 1,919 / 855 / 790.
      categories: [
        { id: "tv-broadcast", name: "A traditional TV or broadcast ad", sharePct: 54, nWeighted: 1919 },
        { id: "speaking-to-camera", name: "A short social media video with a person speaking directly to camera", sharePct: 24, nWeighted: 855 },
        { id: "podcast-interview", name: "A clip of a podcast or interview", sharePct: 22, nWeighted: 790 },
      ],
    },
  ],
  cells: expand(ROWS),
  pairings: [
    {
      rank: 1,
      armIds: ["danielle-allen"],
      audience: "Adults 18–34 and 2022 midterm non-voters",
      finding:
        "Her highest levels: 75% vs 46% placebo among 18–34s and 73% vs 41% among 2022 non-voters. Significant in 29 of 36 subgroups — the safest broad default.",
    },
    {
      rank: 2,
      armIds: ["danielle-allen"],
      audience: "High school or less and $0–$49K households",
      finding: "The only significant video among high school or less (72% vs 51%); 70% vs 42% in $0–$49K households.",
      caveat: "Dustin (46%) and Rodriguez (44%) trail placebo with the high-school-or-less group.",
    },
    {
      rank: 3,
      armIds: ["littlewood"],
      audience: "$100K+ households, 35–54s and Independent/Other",
      finding: "Highest level of any video in each: 70% vs 50%, 69% vs 51% and 67% vs 45%.",
    },
    {
      rank: 4,
      armIds: ["littlewood", "danielle-allen"],
      audience: "Adults 55+",
      finding: "The only two significant videos with 55+: Littlewood 62% and Danielle 60% vs a 46% placebo.",
      caveat: "The official ad does nothing here (47%).",
    },
    {
      rank: 5,
      armIds: ["dustin"],
      audience: "Parents of children under 18",
      finding: "72% vs 50% placebo — the highest level of any video among parents.",
      caveat: "Flat with non-parents (54% vs 46%, not significant).",
    },
    {
      rank: 6,
      armIds: ["dustin", "danielle-allen"],
      audience: "2024 Republican voters",
      finding: "Dustin 69% and Danielle 67% vs a 53% placebo — the only two significant videos in that group.",
    },
    {
      rank: 7,
      armIds: ["donut"],
      audience: "Urban and $0–$49K audiences",
      finding: "63% vs 44% among urban respondents and 62% vs 42% in $0–$49K households.",
      caveat: "Not significant with suburban (57% vs 51%) or $50K–$99K (54% vs 50%).",
    },
    {
      rank: 8,
      armIds: ["donut", "official-campaign-ad"],
      audience: "Latino respondents",
      finding: "Donut and the official ad are the only significant videos here, both 72% vs a 54% placebo.",
    },
    {
      rank: 9,
      armIds: ["official-campaign-ad"],
      audience: "Low-turnout audiences",
      finding: "60% vs 41% among 2024 non-voters, 63% vs 41% among 2022 non-voters and 66% vs 46% among 18–34s.",
      caveat: "Keep away from 55+ (47% vs 46%).",
    },
    {
      rank: 10,
      armIds: [],
      audience: "Conservatives and registered Republicans",
      finding:
        "No video is significant with either group. Best untested bets: Dustin (63% among Republicans) and Danielle (61% among conservatives).",
      caveat: "Hold Rodriguez out of rotation — no measurable effect overall.",
    },
  ],
  // Page 7's four numbered findings. The page headline counts verdicts and is the renderer's to compute.
  stories: [
    {
      id: "overview-1",
      title: "Support and understanding are different outcomes.",
      body: "Five videos received the positive persuasion classification. All six overall comprehension results were “no measurable effect.” This study does not show why the two outcomes diverged.",
    },
    {
      id: "overview-2",
      title: "Danielle has the largest reported overall lift estimate.",
      body: "Her +18–point estimate is higher than the other displayed estimates. The supplied results do not establish that every difference between videos is statistically significant.",
    },
    {
      id: "overview-3",
      title: "No format is shown to perform better in general.",
      body: "Each video bundles its speaker, wording, duration, production and format. Comparing individual videos cannot isolate a format effect.",
    },
    {
      id: "overview-4",
      title: "Four of five Parallax-produced videos showed measurable positive lift.",
      body: "Danielle, Littlewood, Donut and Dustin received Grow Progress’s positive persuasion classification versus placebo. Rodriguez did not show a measurable effect. Three Parallax videos had higher reported lift estimates than the official campaign ad; Dustin matched its rounded +11 estimate.\n\nDescriptive comparisons of reported estimates: statistical superiority over the official campaign ad has not been established.",
    },
  ],
  notes: {
    // Page 16 (Wave 1 page 10/10).
    supported: [
      "Randomized comparisons of the tested videos with a placebo.",
      "Immediate stated Yes vote choice and correct-answer comprehension outcomes.",
      "Five positive overall vote-choice classifications under the platform’s 90% threshold.",
      "No statistically detectable overall comprehension difference for the six videos.",
    ],
    // Wave 1 prints its limits inside the methodology notes and the page captions, not as a separate list.
    notSupported: [],
    methodology: [
      "Usual significance threshold: 90%. “Directional” classifications sit above 80% but below 90%.",
      "Exact interval endpoints and the error-bar confidence level are not supplied, so no numerical confidence intervals are shown.",
      "The weighted total is not an effective sample size.",
      "These are immediate survey responses. They do not establish actual election results, lasting opinion change or the outcome of the separate MA paid-flight precinct RCT.",
      "Weighted on age, gender, race, education, party and 2024 presidential vote.",
      "The report’s “82% probability Danielle is best” is a platform-reported ranking statistic with an unspecified calculation; it is not used as a headline here.",
      "Rounded arm counts sum to 3,565; the reported weighted total is 3,564. Both are shown as published.",
    ],
    // The captions and boxes printed on pages 7–10, in page order.
    limitations: [
      "Green = Grow Progress “Persuasive” (positive at its 90% threshold). Gray = “No measurable effect.” Ordered by reported ballot-choice lift; numbers show display order, not six statistically distinct ranks. Higher bars do not establish statistically significant head-to-head differences.",
      "The 90% threshold is a statistical decision rule. It does not mean there is a 90% chance any particular person was persuaded. The official campaign ad is a tested video; the placebo video is the experimental control.",
      "Reported lifts in percentage points versus placebo, as published by Grow Progress. Lifts are calculated before rounding, so differences between displayed whole numbers can be off by a point.",
      "Ordered by reported ballot-choice lift; numbering is display order, not six statistically distinct ranks. Card notes are descriptive observations, not reasons to deploy a particular video. Production source is bundled with speaker, message and format — this test does not isolate the effect of who produced a video. Placebo arm: n = 494 weighted. Danielle is the confirmed 35-second person-on-the-street clip; the official campaign ad replaced Harris, who is not part of this lineup.",
      "Results are versus placebo. A difference between two point estimates does not establish a statistically significant head-to-head difference.",
      "Hypotheses to test, not proven matches. Significance compares each video with placebo inside one subgroup — it does not show one video beats another for that audience. With 36 subgroups × 6 videos, some patterns will be chance. Validate in market: rotate two videos per audience against a holdout.",
      "These bars are levels, not lifts. Each shows the % selecting Yes in one subgroup and arm. Significance markers compare one video with placebo inside that subgroup — not videos with each other, and not subgroups with each other. Lifts are not derived by subtracting these rounded levels.",
      "Starting levels differ. A high Yes level is not automatically a large effect.",
      "Many comparisons. 36 subgroup panels × 6 videos invite chance findings; the report warns about this but documents no adjustment.",
      "Small cells. The flag marks actual cell counts below 50; displayed sample counts are weighted. An absent flag does not guarantee power.",
      "Description only. Nothing here identifies audiences to target or creative to serve to a group.",
    ],
    debriefQuestions: [
      "Can Grow Progress provide exact intervals and direct video-to-video comparisons?",
      "Which subgroup differences were prespecified and supported by adequate samples?",
      "How should the questionnaire’s written explanation affect interpretation of comprehension?",
    ],
    comprehensionCaveat:
      "The questionnaire shows a detailed written explanation of Question 3 before the comprehension item. The result therefore reflects that survey context, not video recall alone.",
    noEffectMeaning: "The study did not detect a difference at its stated threshold. This does not prove the effect is zero.",
  },
}
