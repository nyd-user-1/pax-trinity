// Each Consensus survey's head on its page (Brendan, 2026-11-02): who fields it and what it is for, written as a
// pollster writes a study's abstract. Each states the survey's purpose in the platform's workflow. The figures are
// the platform's own: the Massachusetts groups the Open primaries survey built are the Pollster's contact groups
// (lib/agents/inbox.ts). The seed names no author, so each is the Pollster's: it fields the platform's surveys.

export type SurveyAbout = { author: string; about: string }

export const SURVEY_ABOUT: Record<string, SurveyAbout> = {
  "open-primaries": {
    author: "Pollster",
    about:
      "A Consensus instrument on who may vote in a party primary and who should bear its cost. Its results drew the Massachusetts panels the message tests are fielded to (2,410 Massachusetts adults; 812 independents; 377 undecided on Question 3) and produced the approved question cards for the wave tests. Its topline is the baseline against which each wave's results are read.",
  },
  "money-in-ballot-measures": {
    author: "Pollster",
    about:
      "Instrument development and baseline measurement for a planned randomized message test on the funding and disclosure of ballot-measure campaigns. Its responses identify the stratum indifferent to who funds a campaign, from which the test's control group is assigned.",
  },
  "reform-by-ballot-measure": {
    author: "Pollster",
    about:
      "Message development for a lift evaluation of reform framing: whether election rules should change by initiative or in the legislature, and what a defeat at the polls settles. The statements that divide respondents, and those that draw consensus, seed the treatment arms of a future wave.",
  },
  "ranked-choice-voting": {
    author: "Pollster",
    about:
      "A pretraining set built on America Thinks constructs. It benchmarks each respondent's views on ranked-choice voting against the national norm before assignment to a wave.",
  },
}

/** A survey's head: its own where written, else the Pollster's with the survey's own description. */
export const aboutOf = (slug: string, description: string): SurveyAbout => SURVEY_ABOUT[slug] ?? { author: "Pollster", about: description }
