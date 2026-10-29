import { LLM_CARDS, ORIGINAL_CARDS, VISUAL_CARDS } from "@/lib/model-cards"

import { doc, type Doc } from "./types"

// One overview per surface: what it's for, what you can do there, and what isn't built yet, said plainly.
// Written from src/lib/platform-guide.ts and the pages; keep the two in step.

export const FEATURES: Doc[] = [
  {
    slug: "chat",
    title: "Chat",
    section: "Features",
    body: `Ask me in plain words. I answer from the record of scored takes, the scripts, the shorts on file and the metric definitions, and say so when a number isn't on file instead of making one up.

## The + menu

- **Skills** set how I work for the rest of the chat: Script doctor, Read a test, Pick the audience, Draft a survey question and Brief a partner. A skill rides the chat as a chip in the box.
- **Onboarding** holds twenty questions that teach each page and the loop.
- **Scripts**: pick a script to make your own.
- **Videos** and **Shorts**: pick one to ask how it performed.
- **Voices**: hear a studio voice read a line, or have a script written for it.
- **Generate video**: a script's shots, or one b-roll shot.
- **Graphics**: the cards drawn from a script.
- **Attach**: a PDF up to 3.5 MB, read with your question.

## Around the box

- **The camera** starts record mode. See [Recording a video](${doc("recording")}).
- **The model picker** chooses which model answers; Claude Sonnet 4.6 is the default, and [Models](/models) has a card for each.
- Each chat is saved and listed under **Chats** in the sidebar.

Signed out, the first five questions are free.`,
  },
  {
    slug: "recording",
    title: "Recording a video",
    section: "Features",
    body: `1. In [Chat](/chat), press the camera. I ask a few short questions, one at a time: who you are, your town, and why open primaries matter to you.
2. I draft a script in your words: a hook under 12 words, first person, one concrete number, 50 to 60 words (about 25 seconds), ending with what the viewer should do. Revise it with me until it sounds like you.
3. Each line that leans on evidence carries its citation: the Upworthy headline findings, the Swayable trait effects, the channel findings or the Wesleyan ad coding.
4. Press **Record** on the script card. The camera opens in the chat with a teleprompter that scrolls at your pace.
5. Watch it back, give it a title and send it.

The take is kept in Clips as your own clip, in **Your library**. Only you see it there, and the staff can choose it as an arm of a message test. Keeping a take needs you signed in; signed out, sign-in opens in a new tab and the take waits in the chat.`,
  },
  {
    slug: "clips",
    title: "Clips",
    section: "Features",
    body: `Every partner's videos in one library, each with its review thread beside it and, where it has been tested, its measured lift, so you choose what to run from evidence instead of memory.

## What you can do

- Switch between the feed and the grid at the top, and narrow to one desk (PAX, Voter Freedom, Unite America or Yes on 3) from the Partners menu.
- Play a clip with its review thread and its test panel beside it.
- Signed in, record a clip: up to 60 seconds, then a review, a title and a visibility, private by default or public to everyone in the library. A kept recording comes back in **Your library**.

## The RCT badge

A green check and **RCT** mean the clip ran as an arm in a randomized controlled test and its result is on file. Its panel reads each outcome's lift against that wave's own placebo, gray where the test was inconclusive, and each outcome opens its cell in [Lift](/lift). The panel also names the arm's respondents, the study (linked to its report) and the clip's [Resonance](${doc("lift")}).

A clip without the badge hasn't been tested. Its panel's figures are drawn within the tested range rather than measured, and carry no links.

## Not built yet

- Deleting or republishing a kept recording.
- Sending a clip to a test from Clips. A test's arms are picked on its setup page.
- Likes, comments and saves are kept only in the browser that made them.`,
  },
  {
    slug: "tests",
    title: "Tests",
    section: "Features",
    admins: true,
    body: `Most video budgets are spent on instinct. A message test measures a video's effect before the airtime is bought: a randomized panel sees one video or a placebo and then says how they would vote.

## Set one up

A test carries its id, the title respondents see, its status (draft, fielding or closed), the target completes per arm, the placebo video, the arms (library clips that have a video file, and every recording kept in Clips), the entry questions, the explanation shown after the video, the ballot question, the comprehension question, and the panel vendor's redirects.

## Field and close

- **Field kit**: the entry link a panel vendor uses, with their respondent id in place of {PID}.
- **Monitor**: completes per arm against the target.
- **Close**: weights the respondents and computes each arm's lift.

To field to your own contacts instead, ask the Pollster in the [Inbox](/inbox): it mails personal links, reminds, and closes the test at its quota.

## What respondents see

A bare page at /test/ and the test's id, with nothing else around it. The arm is assigned before the first card shows; from a Pollster link it was settled when the links were made, balanced within the group. Then one card at a time: the entry questions, the video (Continue unlocks only after it has played), the explanation, the ballot, the comprehension question and a completion code. A draft reads as closed to anyone but an admin, and only a fielding test records answers.`,
  },
  {
    slug: "survey",
    title: "Survey",
    section: "Features",
    body: `A survey asks everyone the same questions, with no video and no comparison group, and reads as each option's share.

- [Survey](/survey) holds the Consensus conversations as folders (their statements as cards, each with its results beside it), the Toplines group, and the pretraining draft.
- The Open primaries topline is at [/survey/open-primaries](/survey/open-primaries): its methodology (fielded by, population, mode, interview dates, sample size, margin of error) and each question's shares with its total N once anyone has answered. Its questions are America Thinks' own four primaries items.
- People answer at [/s/open-primaries](/s/open-primaries). **Copy link** and **Open survey** on the topline carry that link, and the Pollster can mail it to a group.

The topline is self-selected and unweighted.

## Not built yet

America Thinks doesn't show survey responses yet.`,
  },
  {
    slug: "inbox",
    title: "Inbox",
    section: "Features",
    body: `Mail between you and three agents, each with its own inbox. Send a task; the work arrives as replies on the thread.

- **The Pollster** fields Consensus conversations, surveys and tests. It mails each member of a contact group a link of their own, tracks who opened, started and finished, sends reminders, and closes at the quota or the deadline.
- **The Analyst** writes the question cards, toplines and readouts.
- **The Assistant** sends staff and partners their notices, reminders, digests and onboarding mail.

Each fielding is one live thread that rewrites itself: the send, the reminders, the count, the close and the readout.

## Starting work

- **New test** and **New survey** in the rail open a request to the Pollster.
- **Groups** in the address book are the audiences a fielding goes to.
- Templates start the common messages.

Sending needs a staff account. While mail is being proved out, it reaches only approved addresses; mail to anyone else is held and counted.`,
  },
  {
    slug: "america-thinks",
    title: "America Thinks",
    section: "Features",
    body: `Every message rests on a guess about what voters already believe. I replace the guess with the record: the General Social Survey, ANES and CES beside public polls, official results, the census, turnout, voting-age and enrollment records, so you write to where opinion actually stands.

## Reading a question

- Pick a topic under **Index** in the rail. Each row is one question, its headline after the dash; questions you haven't opened read bold, and a row can be pinned to the top.
- Open a question beside the list and switch its view: **Data**, **Crosstab**, **Trend**, **Topline**, or the globe for its full dossier.
- Mark a question with its box (add it as a column to compare), its arrow (Important) or its star (Favorites).
- The search icon in the question's title row filters the list.
- The **Data** group at the rail's foot browses one source at a time.

## Constructs

A construct is one idea measured across sources, such as confidence in Congress, gathered as one family of questions however each survey worded it, and anchored to the GSS Key Trends and the ANES Guide. [Constructs](/constructs) lists them by subject with every source each is asked in, its latest figures and its trend; each links to its lead question's dossier.

These are the benchmarks a new survey's or test's numbers read against.`,
  },
  {
    slug: "consensus",
    title: "Consensus",
    section: "Features",
    body: `The loudest voice in the room is rarely its majority. People agree, disagree or pass on short statements one at a time, and I find the opinion groups in the votes, so you see where a coalition already agrees and where it splits before you take a position.

- **Surveys** lists the conversations.
- **Questions** is where one is voted on, every statement on screen at once.
- **Results** shows where the groups agree, where they split, and every statement's shares.
- **Admin**, for staff, holds the conversation's numbers.

On Results, **Make question card** sets the Open primaries survey's questions beside the statements every group shared and the ones that split them, and hands the card to the [Inbox](/inbox) as a New test for the Pollster.

## Not built yet

Votes cast on the voting card aren't recorded yet.`,
  },
  {
    slug: "lift",
    title: "Lift",
    section: "Features",
    body: `A lift means little until you know what ads usually do. Lift sets every result on file side by side, so you can tell a strong result from an ordinary one before you scale it.

## The two folders

- **Tests**: the message-test waves run here.
- **Archive**: 1,583 effects of 618 ads from campaigns' own randomized persuasion experiments (Hewitt, Broockman, Coppock et al., APSR 2024). The ads are anonymized, and each is described by its coded traits.

## Reading a lift

Rows are treatments and columns their outcomes: Support, Comprehension and Emotional Response for the tests, favorability and vote choice for the Archive. The placebo's level sits at zero, a bar runs from it to the lift in percentage points, its tip points the way the treatment moved, and the number sits past the tip. A lift that doesn't clear its test is gray. Its margin, a 90% interval, reads in About Result; a margin that crosses zero means the test couldn't tell the effect from none.

**Bars** or **Heatmap** switch the view. Treatments, Metrics, Segments and Filter choose what shows, a column head sorts by it, **Share** copies a link to the exact view, and the CSV downloads it.

## About Result

Click a lift to open it beside the table: the lift, its margin, the respondents and the study, then the lift on three benchmarks for the same outcome and segment (every test on file, the folder's own, and this test), with a density chart showing where it falls. A Tests lift also shows what's on file about the arm: its producer, length, note, and the wave's pairings that name it.

## Resonance

A 0 to 100 score for a video: the percentile of its primary-outcome lift among every lift on file for that outcome, ties counted half. 50 means it moved its outcome as much as the middle lift on file; 90 means it beat nine in ten. It needs at least five lifts in the pool before it shows, and reads at the head of a tested clip's panel in Clips. Reports don't show it yet.`,
  },
  {
    slug: "reports",
    title: "Reports",
    section: "Features",
    body: `A test is only worth what you can read and defend from it. I turn a finished study into its readout: every video's lift against its own placebo, every subgroup, and what the result can and cannot establish.

- [Reports](/reports) gives a card for each report. A study of several waves, such as Massachusetts Message Testing, has a card for its executive summary and one for each wave; a study of one wave has one card. The methodology has its own.
- A wave's page reads its executive summary (each video's lift in ballot support against that wave's placebo), the video cards (lift in ballot choice and in comprehension, with Watch video) and the subgroup results.
- The up and down arrows on a block move it within its run; the order is kept for that page in your browser.

Massachusetts Wave 3 was fielded to a small test panel to prove the fielding end to end. Its results are simulated, and its report says so.

## Report 2

[Report 2](/reports-2) opens the same studies section by section, with a contents rail that tracks the page: Summary, The videos, Outcomes, Subgroups, Pairings, How the test worked, and What it can and cannot establish. Each section sets every wave side by side, and the page prints as a document.

## Detectable and inconclusive

A lift is **detectable** when it meets the study's stated threshold against the placebo, a 90% threshold for the Massachusetts waves. **Inconclusive** means the test didn't detect an effect at that threshold; it isn't proof the effect is zero. A small subgroup is marked as a small sample.`,
  },
  {
    slug: "data-dictionary",
    title: "Data dictionary",
    section: "Features",
    body: `- **Dictionary**: the question bank's constructs as terms.
- **Glossary**: every term used across the pages, with its definition and section, and a search.
- **Schema**, for staff: the audience store's tables.
- **ERD**, for staff: the whole pipeline's entity diagram.`,
  },
  {
    slug: "models",
    title: "Models",
    section: "Features",
    body: `[Models](/models) holds a card for every model I run, under three tabs.

- **LLM**: the ${LLM_CARDS.length} models in Chat's model picker, each with its release, context window, inputs, weights, size, model ID and, where it does more than answer in Chat, its job.
- **Visual**: the ${VISUAL_CARDS.length} video models. The four that make b-roll are listed in the order a failed generation falls back through them; Runway Aleph cleans up a recorded take.
- **Original**: the PAX Series 1.0, ${ORIGINAL_CARDS.length} models trained by NYSgpt.com and sponsored by Unite America: ${ORIGINAL_CARDS.map((m) => m.name).join(", ")}. Each card says what it does, who it's for, the proof and its use cases.`,
  },
  {
    slug: "settings",
    title: "Settings",
    section: "Features",
    body: `The account menu opens [Settings](/settings) at the tab you pick: **Profile** and **Notifications** directly, **Members** and **Permissions** under Account, **General** and **Integrations** under Settings.

- **General**: the workspace's name, address, invite domains and accent color; region and date format; editing preferences.
- **Profile**: your photo, name, email, phone and username; your public profile; where sign-in lands.
- **Members**: invite defaults, and the roster with search, a status filter, sorting, role changes and Invite member.
- **Permissions**: each capability against Super admin, Admin, Staff and Partner; security; approvals.
- **Notifications**: digests, channels and alerts.
- **Integrations**: the connected tools, storage and sign-in, and sync defaults.

**Cancel** and **Update** wake once you change something.

## Not built yet

Settings don't save yet: a change lasts until you leave the page, and Invite member sends no mail.`,
  },
  {
    slug: "search",
    title: "Search",
    section: "Features",
    body: `Press ⌘K anywhere, or choose the search field under the wordmark.

- Before you type: Suggestions, Pages and Commands.
- Type, and every kind of thing is searched by every word, grouped by kind: pages, commands, America Thinks questions, clips, reports, Lift, tests, surveys, Consensus, the Inbox, chats, the glossary and the data dictionary.
- ⌘K again lists the picked row's actions: open, open in a new tab, copy link, add to Blocks, ask about it.
- **Tab**, or **Ask PAX**, turns the search into a question for me; type @ to point it at a page.
- The arrows move, Enter runs, Escape steps back and closes.

## Not built yet

Pages and reports open; every other kind of result is a preview for now.`,
  },
  {
    slug: "dashboard",
    title: "Dashboard",
    section: "Features",
    admins: true,
    body: `The Delivery Board: the account's four headline facts, the week's worklogs, and the apps, workflows and checks under them. It runs on sample data for now.`,
  },
]
