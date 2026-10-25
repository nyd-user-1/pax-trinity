// The one seeded message test the respondent flow (/t/<id>) runs, modeled on
// the Grow Progress randomized design: background questions, one video drawn
// at random on the server, a shared explanation, then the outcomes. The four
// treatment arms are the messenger-isolation cuts, named by their clip-store
// ids so the sources stay in one place (src/components/clips/store.ts); the
// placebo is a neutral stock clip with no messenger at all.

export type Choice = { value: string; label: string }

export type EntryQuestion = {
  key: "ideology" | "party" | "education" | "vote2024" | "mediaTrust"
  prompt: string
  choices: Choice[]
}

export const ARMS = ["placebo", "px-gaby", "px-msnow", "px-no-newscaster", "px-locked-out"] as const
export type Arm = (typeof ARMS)[number]

export const PLACEBO_SRC = "https://assets.mixkit.co/videos/40700/40700-720.mp4"

/** The coin flip, run on the server: one arm per page load, settled before the first card renders. */
export const drawArm = (): Arm => ARMS[Math.floor(Math.random() * ARMS.length)]

export const TEST = {
  id: "open-primaries-1",
  title: "A short survey",
  entry: [
    {
      key: "ideology",
      prompt: "Generally speaking, how would you describe your political views?",
      choices: [
        { value: "liberal", label: "Liberal" },
        { value: "moderate", label: "Moderate" },
        { value: "conservative", label: "Conservative" },
      ],
    },
    {
      key: "party",
      prompt: "Generally speaking, do you think of yourself as a Democrat, a Republican, or something else?",
      choices: [
        { value: "democrat", label: "Democrat" },
        { value: "independent-other", label: "Independent or other" },
        { value: "republican", label: "Republican" },
      ],
    },
    {
      key: "education",
      prompt: "What is the highest level of education you have completed?",
      choices: [
        { value: "hs-or-less", label: "High school or less" },
        { value: "some-college", label: "Some college" },
        { value: "bachelors-plus", label: "Bachelor's degree or higher" },
      ],
    },
    {
      key: "vote2024",
      prompt: "In the 2024 presidential election, who did you vote for?",
      choices: [
        { value: "democrat", label: "The Democratic candidate" },
        { value: "republican", label: "The Republican candidate" },
        { value: "other", label: "Another candidate" },
        { value: "did-not-vote", label: "I did not vote" },
      ],
    },
    {
      key: "mediaTrust",
      prompt: "Which video format do you trust most for information about political or public issues?",
      choices: [
        { value: "tv-broadcast", label: "A traditional TV or broadcast ad" },
        { value: "direct-to-camera", label: "A short social video with a person speaking directly to camera" },
        { value: "podcast-clip", label: "A clip of a podcast or interview" },
      ],
    },
  ] satisfies EntryQuestion[],
  explanationTitle: "About the measure",
  explanation:
    "The measure would replace separate party primaries with a single primary open to every registered voter. All candidates for an office would appear on one ballot, whatever their party. The two candidates with the most votes would advance to the general election.",
  ballot: {
    prompt: "If the election were held today, how would you vote on the measure?",
    // "Would not vote" is anchored last.
    choices: [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
      { value: "would-not-vote", label: "Would not vote" },
    ],
  },
  comprehension: {
    prompt: "Which of the following best describes the main change the measure would make?",
    choices: [
      { value: "party-primaries-open", label: "Each party would keep its own primary, but independent voters could choose one to vote in" },
      { value: "one-primary-top-two", label: "All candidates would run in one primary, and the two with the most votes overall would advance" },
      { value: "no-primaries", label: "Primaries would be eliminated, and every candidate would go straight to the general election" },
      { value: "ranked-choice", label: "General elections would be decided by ranked choice voting" },
    ],
    correct: "one-primary-top-two",
  },
}
