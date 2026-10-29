import { doc, type Doc } from "./types"

export const GETTING_STARTED: Doc[] = [
  {
    slug: "the-loop",
    title: "The loop",
    section: "Getting started",
    body: `1. **Make a video.** Write a script with me in [Chat](/chat) and record it on camera there, or record one in [Clips](/clips).
2. **Test it.** A message test shows a randomized panel either one video or a placebo, then asks how they would vote. The staff set tests up in [Tests](/message-tests).
3. **Field it.** The Pollster in the [Inbox](/inbox) mails each person in a contact group a link of their own, reminds whoever hasn't finished, and closes the test at its quota or its deadline.
4. **Compute the lift.** When a test closes, I weight the respondents to the population's targets and compute each video's lift against the placebo.
5. **Read it.** The result reads in [Lift](/lift), on the video's panel in Clips, and in [Reports](/reports). A new result reaches those pages once it's published, a step run by hand today; until then the Pollster's readout mail carries it.

## A test and a survey

A **test** is a randomized experiment. Each respondent is assigned one arm, a video or the placebo, and a video's lift is the difference between its viewers' answers and the placebo viewers' answers, in percentage points. Because the groups differ only in what they watched, the gap is the video's effect alone.

A **survey** measures where people stand. Everyone answers the same questions and the result is each option's share, with no video and no comparison group.

## What a result reads against

[America Thinks](/america-thinks) holds what America already thinks, in whose wording: the General Social Survey, ANES, CES, public polls, official results, the census, turnout and enrollment records. A new test's or survey's numbers read against it, and a test's respondents are weighted to its population's targets (for Massachusetts adults: education, party and 2024 vote).`,
  },
  {
    slug: "who-uses-pax",
    title: "Staff, partners and the public",
    section: "Getting started",
    body: `| | Public | Partners | Staff |
|---|---|---|---|
| Open every page in the sidebar | Yes | Yes | Yes |
| Ask in Chat | 5 questions | Yes | Yes |
| Write scripts, hear voice reads, generate video | A few | Yes | Yes |
| Record a video and keep it in Clips | | Yes | Yes |
| Connect a YouTube channel | | Yes | Yes |
| Answer a survey or test link | Yes | Yes | Yes |
| Set up, field and close tests | | | Yes |
| Send mail from the Inbox | | | Yes |
| Dashboard, Consensus Admin, Schema and ERD | | | Yes |

## Staff

Three staff accounts, each with admin access. They were made ahead of time, so the first sign-in sets a password: see [Staff: your first sign-in](${doc("staff-sign-in")}).

## Partners

The organizations whose videos are made, tested and reported here: PAX, Voter Freedom, Unite America and Yes on 3. Each keeps a desk in [Clips](/clips), and every partner sees the whole library. A new partner starts at [Partner onboarding](${doc("partner-account")}).

## The public

Anyone can open the pages without an account, with a free allowance in Chat. See [Using PAX without an account](${doc("without-an-account")}).`,
  },
  {
    slug: "staff-sign-in",
    title: "Staff: your first sign-in",
    section: "Getting started",
    body: `Your account already exists, with your work email confirmed. It has no password yet, so the first sign-in sets one.

1. Open [Sign in](/signin) and choose **Forgot password**.
2. Enter your work email. A six-digit code arrives from no-reply@verificationemail.com; check spam if it's slow.
3. Enter the code and a new password: 8 or more characters, with an uppercase letter, a lowercase letter, a number and a symbol.
4. Sign in with it. I open on [Chat](/chat), or on the page you were trying to reach.

Skip **Sign up**: your email already has an account, and sign-up will say so.

## What staff see

- **Admin** in the sidebar, holding [Dashboard](/dashboard) and [Tests](/message-tests).
- The **Admin** tab in [Consensus](/consensus), and the **Schema** and **ERD** tabs in the [Data dictionary](/data-dictionary).
- Sending from the [Inbox](/inbox), including **New test** and **New survey**, the requests that start the Pollster on a fielding.`,
  },
  {
    slug: "without-an-account",
    title: "Using PAX without an account",
    section: "Getting started",
    body: `Every page opens without signing in. A few things are free up to a limit, counted in this browser for 30 days:

- 5 questions in [Chat](/chat)
- 2 written scripts
- 6 voice reads
- 2 generated videos

Recording a video, keeping it in Clips, and connecting a YouTube channel need an account. [Sign up](/signup) takes a minute: an email, a password, and a six-digit code.

## Answering a survey

A survey link, such as [/s/open-primaries](/s/open-primaries), opens a bare page with each question as a set of options. **Submit** unlocks once every question is answered. Nothing that identifies you is stored unless you came through a personal link from the Pollster.

## Taking part in a test

A test link opens one card at a time: a few questions about you, then a video. **Continue** unlocks only after the video has actually played; skipping ahead earns no credit. Then come a short explanation, the ballot question and a comprehension question, and the last card gives you a completion code.`,
  },
  {
    slug: "finding-your-way",
    title: "Finding your way",
    section: "Getting started",
    body: `- **The sidebar** lists the pages A to Z: America Thinks, Chat, Clips, Consensus, Data dictionary, Inbox, Lift, Reports and Survey. Admins also see the **Admin** group, which opens and shuts from its chevron. The button at the top left of each page hides and shows the sidebar.
- **Search** opens from ⌘K anywhere, or from the field under the wordmark. See [Search](${doc("search")}).
- **The page's name** at the top of each page opens a list of the other pages.
- **The chat button** at the top right opens a chat beside whatever page you're on. Saved chats are listed under **Chats** in the sidebar.
- **The account menu** at the foot of the sidebar holds Profile, Account (Members and Permissions), Notifications, Settings (General and Integrations), Docs, [Models](/models) and Log out.`,
  },
]
