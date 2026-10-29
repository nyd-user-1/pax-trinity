import type { Doc } from "./types"

// Release notes from the commit history (git log since 2026-10-24, the first commit), written for the people
// who use the pages: what changed that they would see, newest first. Internal work (briefs, migrations,
// builds) stays out. Add the day's notes when its work lands.

export const RELEASE_NOTES: Doc[] = [
  {
    slug: "release-2026-10-29",
    title: "October 29, 2026",
    section: "Release notes",
    body: `## New

- **Docs.** These pages, in the account menu where Help was: getting started, partner onboarding, every feature, FAQs and these notes.
- **Settings and Models.** The account menu opens Settings, six tabs from Profile to Integrations, and Models, a card for every model I run across LLM, Visual and the PAX Series 1.0. Settings don't save yet.
- **Search.** ⌘K opens a palette over every page. Pages and reports open from it; the other results are previews for now.
- **Dashboard.** Admins get the Delivery Board under Admin in the sidebar, on sample data.
- **Fielding for real.** The Pollster mails personal links, tracks who opened, started and finished, sends reminders, closes at the quota and mails the readout. A closed test computes its own result.
- **The Inbox's three agents.** The Pollster, the Analyst and the Assistant, with two weeks of history, 23 templates, an address book, groups and a pop-out composer. Mail reaches only approved addresses while it's being proved out.
- **Recording, end to end.** A take recorded in Chat or in Clips is kept as a real clip, plays in Clips, and can be an arm of a message test.
- **An Open primaries survey.** Its topline at /survey/open-primaries, answerable at /s/open-primaries.
- **Skills in Chat.** Script doctor, Read a test, Pick the audience, Draft a survey question and Brief a partner, first in the + menu. Onboarding there holds twenty questions that teach the pages.
- **Resonance** on every tested clip's panel in Clips: where a video's lift ranks among every lift on file.

## Improved

- **America Thinks.** A Topline view joins Data, Crosstab, Trend and the globe; the Crosstab runs vertical; the views are icons; the list's search sits in the question's title row; unopened questions read bold; a row can be pinned to the top.
- **Clips.** Tested clips wear the green RCT badge with their test panel filled, each outcome opening its cell in Lift. All ten Massachusetts test videos are in the library, joined to their results. The grid plays from a hover button.
- **Lift.** A Heatmap view, an Emotional Response column, a working Filter, columns that resize from their divider, and the Archive's ads described trait by trait. About Result opens as a side panel.
- **Reports.** The reports are cards, with a methodology card; every chart redraws cleanly and none scrolls; each wave has its fingerprint and line chart; blocks reorder with up and down arrows. Report 2 opens the studies section by section. Massachusetts Wave 3 has its results, simulated and labeled so.
- **Consensus.** Questions shows every statement at once.
- **The sidebar** reads A to Z, and Message tests is now Tests.
- **Chat** speaks as I, and the box grows to five lines as you write.

## Fixed

- Staff sign-in: the three staff accounts exist, and a first sign-in goes through Forgot password.
- The Data dictionary and Clips load fast again.`,
  },
  {
    slug: "release-2026-10-28",
    title: "October 28, 2026",
    section: "Release notes",
    body: `## Improved

- **Lift** takes the results view campaigns know from Swayable: one toolbar and one table, rows as treatments and columns as outcomes.
- **America Thinks** keeps one bar on each side of the page, and the compare grid reads two ways, Compare beside the new Banner.`,
  },
  {
    slug: "release-2026-10-27",
    title: "October 27, 2026",
    section: "Release notes",
    body: `## New

- **America Thinks** is the new name and address for the audience database, /america-thinks.
- **The question dossier**: one question's full record on its own page, its trend by wave, its crosstab and related questions. The globe opens it from the question pane.
- **Constructs**: the construct table, one row per idea with every source it's asked in.
- **Reports** read from the finished studies: one card per study, and the Massachusetts waves read wave by wave, every figure from the result on file.
- **Data dictionary**: Dictionary, Glossary, Schema and ERD as tabs on one page.
- **Survey**: the consensus surveys as folders, each statement's results beside it.

## Improved

- **Topics**: the rail leads with eighteen topics, A to Z, filed from the publishers' own tags.
- **Constructs**: 270 constructs, anchored to the GSS Key Trends and the ANES Guide.
- **Consensus** is one page with four tabs: Surveys, Questions, Results and Admin.
- **The front door's ten boxes** each carry a guide and a real screen.`,
  },
  {
    slug: "release-2026-10-26",
    title: "October 26, 2026",
    section: "Release notes",
    body: `## New

- **The construct layer**: one idea measured across sources, gathered as one family of questions.

## Improved

- **The question list** takes a mail inbox's anatomy, one line per question, with its box, star and source badge.
- **Topics** for most General Social Survey questions, from its own variable list.
- **Weighting** gains party and 2024-vote targets.
- **Message tests** accept only playable clips as arms.`,
  },
  {
    slug: "release-2026-10-25",
    title: "October 25, 2026",
    section: "Release notes",
    body: `## New

- **Clips becomes the partners' library.** The rail is headed Partners, with a desk for each: 100 Voter Freedom cuts, 48 Yes on 3, 36 Unite America shorts and the PAX review cuts, served fast from a CDN.
- **The Inbox** arrives, with a mail client's manners: the thread list, the reading pane, Reply and Forward.
- **Roles**: a super admin, admins, staff and partners.
- **Consensus**: the conversations, voting, results and admin.
- **Message tests**: set one up, field it, watch completes per arm, and close it, with every response stored.
- **The respondent's test page**, one card at a time, modeled on randomized message tests.
- **The glossary**, every row a single line that unfolds on click.`,
  },
  {
    slug: "release-2026-10-24",
    title: "October 24, 2026",
    section: "Release notes",
    body: `## New

- **Trinity opens**: the front door's boxes, the app's frame and sidebar, Chat, and sign-in and sign-up.
- **Attach** moves into Chat's + menu.`,
  },
]
