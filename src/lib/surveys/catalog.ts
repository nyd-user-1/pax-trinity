// The surveys a respondent can answer, each question one of America Thinks'
// own: its construct id, its source, and the item text and answer options as
// the library carries them (public/audience-data, poll.json), so an answer can
// be filed back against the same construct. No "server-only": the respondent
// page and the topline read the same list.

export type SurveyQuestion = {
  /** America Thinks' construct id, the key an answer is stored under. */
  id: string
  /** The America Thinks source the item comes from. */
  source: string
  /** The item text, verbatim from the library. */
  text: string
  options: string[]
}

export type Survey = { slug: string; title: string; fieldedBy: string; population: string; mode: string; questions: SurveyQuestion[] }

export const SURVEYS: Survey[] = [
  {
    slug: "open-primaries",
    title: "Open primaries",
    fieldedBy: "PAX",
    population: "Anyone with the survey's link",
    mode: "Online, self-administered, in English",
    questions: [
      { id: "open_primaries_support", source: "POLL", text: "MA Question 3 (top-two open primary): how would you vote?", options: ["Yes", "No", "Undecided"] },
      { id: "top_two_favorability", source: "POLL", text: "Favorable or unfavorable view of top-two primaries", options: ["Favorable", "Unfavorable"] },
      { id: "top_four_favorability", source: "POLL", text: "Favor or oppose an Alaska-style top-four primary", options: ["Favor", "Oppose"] },
      { id: "closed_primaries_favorability", source: "POLL", text: "Favorable or unfavorable view of closed primaries", options: ["Favorable", "Unfavorable"] },
    ],
  },
]

export const surveyBySlug = (slug: string) => SURVEYS.find((s) => s.slug === slug) ?? null
