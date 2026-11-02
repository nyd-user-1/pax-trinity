// The seed pretrainings (Brendan via the lead, 2026-11-02): two question sets in the survey draft's own
// shape (./draft.ts), so Survey's Pretrainings open with something in them. Each question is an America
// Thinks item, its construct id and source kept, with the answer options the library carries; where the
// library has only a label, the wording is the standard question it labels. Seed-grade: a stand-in until
// pretrainings are built and kept for real. No "server-only": the inbox reads them in the browser.

import type { DraftQuestion, SurveyDraft } from "./draft"

export type PretrainingQuestion = DraftQuestion & {
  /** America Thinks' construct id. */
  id: string
  source: string
}
export type Pretraining = SurveyDraft & { seed: true; questions: PretrainingQuestion[] }

const AGREE_5 = ["Strongly agree", "Agree", "Neither agree nor disagree", "Disagree", "Strongly disagree"]
const SATISFIED_4 = ["Very satisfied", "Fairly satisfied", "Not very satisfied", "Not at all satisfied"]

export const PRETRAININGS: Pretraining[] = [
  {
    slug: "trust-and-attention",
    title: "Trust and attention",
    description: "Seed: how much a respondent trusts people and government, and how closely they follow politics, before a test shows them anything.",
    seed: true,
    questions: [
      {
        id: "cantrust",
        source: "GSS",
        text: "Generally speaking, would you say that people can be trusted or that you can't be too careful in dealing with people?",
        options: ["People can almost always be trusted", "People can usually be trusted", "You usually can't be too careful in dealing with people", "You almost always can't be too careful in dealing with people"],
      },
      { id: "polint", source: "GSS", text: "How interested would you say you personally are in politics?", options: ["Very interested", "Fairly interested", "Somewhat interested", "Not very interested", "Not at all interested"] },
      {
        id: "choices",
        source: "GSS",
        text: "Thinking now about politics in America, to what extent do you agree or disagree with the following statements? Political parties do not give voters real policy choices",
        options: AGREE_5,
      },
      {
        id: "v241726",
        source: "ANES",
        text: "How much do you agree or disagree with the following statement? Public officials don't care much what people like me think.",
        options: ["Agree strongly", "Agree somewhat", "Neither agree nor disagree", "Disagree somewhat", "Disagree strongly"],
      },
      { id: "v241711", source: "ANES", text: "On the whole, how satisfied are you with the way democracy works in the United States?", options: SATISFIED_4 },
    ],
  },
  {
    slug: "primaries-and-fair-elections",
    title: "Primaries and fair elections",
    description: "Seed: party, primary turnout and faith in the count, the baseline an open-primaries test reads its arms against.",
    seed: true,
    questions: [
      {
        id: "party_id_7",
        source: "ANES",
        text: "Generally speaking, do you usually think of yourself as a Republican, Democrat, Independent, or what?",
        options: ["Strong Democrat", "Weak Democrat", "Lean Democrat", "Independent", "Lean Republican", "Weak Republican", "Strong Republican"],
      },
      { id: "v241031", source: "ANES", text: "Did you vote in a presidential primary or caucus this year?", options: ["Yes, voted in Democratic primary or caucus", "Yes, voted in Republican primary or caucus", "No, didn't vote in a primary or caucus"] },
      { id: "top_two_favorability", source: "POLL", text: "Favorable or unfavorable view of top-two primaries", options: ["Favorable", "Unfavorable"] },
      { id: "elections_fair", source: "CES", text: "Elections in this country are fair. Do you agree or disagree?", options: ["Strongly agree", "Somewhat agree", "Neither agree nor disagree", "Somewhat disagree", "Strongly disagree"] },
      { id: "v242207", source: "ANES", text: "How often do you think votes are counted fairly?", options: ["All of the time", "Most of the time", "About half of the time", "Some of the time", "Never"] },
    ],
  },
]
