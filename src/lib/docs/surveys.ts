import { shot, video } from "./media"
import { doc, type Doc } from "./types"

export const SURVEYS: Doc[] = [
  {
    slug: "answer-a-survey",
    title: "Answer a consensus survey",
    category: "surveys",
    summary: "Agree, disagree or pass on short statements, then see where people agree.",
    tags: ["Survey", "Consensus"],
    body: `The loudest voice in the room is rarely its majority. A consensus survey asks people to agree, disagree or pass on short statements, one at a time. I find the opinion groups in the votes, so you see where a coalition already agrees, and where it splits, before you take a position.

${video("guide-survey", "Answer a survey")}

## Answer the questions

1. Open [Survey](/survey) and choose **Questions**, or open the survey's card under **Surveys**, which takes you to the survey on its own page. Its card at the top says who fields it and what it's for; **Begin** takes you to Question 1.
2. Each card is one statement. Pick **Agree**, **Disagree** or **Pass**.
3. The card holds a moment so you see your pick, then leaves, and every card after it moves up a place.

Answer in any order. The blue outline marks the next question you haven't answered, and the bar at the top counts your progress.

${shot("survey-questions", "The question cards")}

> Signed in, your answers are kept once you finish, and you can't take the survey again: it opens on your results from then on. Signed out, nothing is kept, and **Review my answers** brings every card back.

## Mark what matters

Under a statement's answers, mark it as important to you. It's a second signal, separate from your answer.

## Add a statement

**Add a statement of your own** sits under the cards the whole time. Write one stand-alone idea in your own words, up to 140 characters. It waits for moderation before others see it.

## See the results

When the last card leaves, your results open. Signed in, a card at the top sums up where you stood with the room, and under it every question, with those every opinion group agrees on first and, within each, the ones where you stood with the room. Signed out, the results are the questions consensus emerged on, each with your own answer beside the room's. See [How consensus is decided](${doc("consensus-rules")}).`,
  },
  {
    slug: "consensus-rules",
    title: "How consensus is decided",
    category: "surveys",
    summary: "Two rules for when a room agrees, and a switch to compare them on the same votes.",
    tags: ["Survey", "Consensus"],
    body: `"Most people agree" and "everyone agrees" aren't the same thing. The survey's results carry a switch so you can read the same votes under two rules, one after the other.

${shot("survey-results", "The results under the Trinity rule")}

## Trinity

Most of the room is on one side, and no opinion group has a majority on the other. A group that merely leans the other way, without a majority, doesn't stop it. It counts consensus either way: to agree, or to disagree.

The results list only the questions that pass, strongest first, each with your own answer.

## Walkthrough

The rule from the walkthrough on nysgpt's home page: every opinion group has to agree at 7 in 10 or more. The least agreeable group decides, so a big group can't carry a small one. It counts agreement only.

The results list every question, those every group agrees on first, marked **Every group agrees** (or **Both agree**, with two groups) or **Split**. Each group shows as ten people, filled for each who agrees.

${shot("survey-results-walkthrough", "The results under the Walkthrough rule")}

## Which to use

The Walkthrough rule is stricter, and stricter is more honest about what "consensus" means. It's also slower to find any: with few votes, or a divided room, it can come back empty. On Open Primaries today, no statement clears it; the closest one's least agreeable group is at 38%.

> The switch is remembered in this browser, so a reload keeps the rule you're testing.

## Small groups

A group counts once it has at least five votes on a statement, and a statement needs ten votes before it can show at all.`,
  },
  {
    slug: "consensus-results",
    title: "Survey results and question cards",
    category: "surveys",
    summary: "Where the groups agree, where they split, and how to turn that into a test.",
    tags: ["Survey", "Consensus"],
    body: `[Results](/survey?s=results) shows a whole conversation at once: where the groups agree, where they split, and every statement's shares.

${shot("survey-results-surface", "A conversation's results")}

## The surveys

- **Surveys** lists every conversation, each with its numbers and links to vote on it or read its results.
- **Admin** (staff) holds the conversation's numbers.

## Make a question card

On Results, **Make question card** sets the Open Primaries survey's questions beside the statements every group shared and the ones that split them, and hands the card to the [Inbox](/inbox) as a New test for the Pollster.

## Not built yet

Votes cast on the cards aren't recorded yet.`,
  },
  {
    slug: "survey-toplines",
    title: "Surveys and toplines",
    category: "surveys",
    summary: "Ask everyone the same questions and read each option's share.",
    tags: ["Survey"],
    body: `A survey asks everyone the same questions, with no video and no comparison group, and reads as each option's share.

${shot("survey", "Survey")}

- [Survey](/survey) holds Consensus (Questions, Surveys, Results), the pretrainings, the message tests and the Toplines group.
- The Open Primaries topline is at [/survey/open-primaries](/survey/open-primaries): its methodology (fielded by, population, mode, interview dates, sample size, margin of error) and each question's shares with its total once anyone has answered. Its questions are America Thinks' own four primaries items.
- The Pollster can mail it to a group: the link it sends answers these four questions. [/s/open-primaries](/s/open-primaries) without that link is the consensus survey.

The topline is self-selected and unweighted.`,
  },
  {
    slug: "message-tests",
    title: "Run a message test",
    category: "surveys",
    summary: "Measure a video's effect on a randomized panel before the airtime is bought.",
    tags: ["Tests", "Staff"],
    admins: true,
    body: `Most video budgets are spent on instinct. A message test measures a video's effect first: a randomized panel sees one video or a placebo, then says how they would vote.

${shot("survey-tests", "Tests in Survey")}

## Set one up

Open [Tests](/survey?s=tests) in Survey. A test carries:

- its id, and the title respondents see
- its status: draft, fielding or closed
- the target completes per arm
- the placebo video, and the arms: library clips with a video file, and every recording kept in Clips
- the entry questions, the explanation shown after the video, the ballot question and the comprehension question
- the panel vendor's redirects

## Field it

- **Field kit**: the entry link a panel vendor uses, with their respondent id in place of {PID}.
- **Monitor**: completes per arm against the target.

To field to your own contacts instead, ask the Pollster in the [Inbox](${doc("inbox")}): it mails personal links, reminds, and closes the test at its quota.

## Close it

**Close** weights the respondents and computes each arm's lift. The result reads in [Lift](${doc("lift")}).

## What respondents see

A bare page with nothing else around it. The arm is assigned before the first card shows; from a Pollster link, it was settled when the links were made, balanced within the group. Then one card at a time: the entry questions, the video (Continue unlocks only after it has played), the explanation, the ballot, the comprehension question and a completion code. A draft reads as closed to anyone but an admin, and only a fielding test records answers.`,
  },
]
