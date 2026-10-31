import { shot, video } from "./media"
import { doc, type Doc } from "./types"

export const GET_STARTED: Doc[] = [
  {
    slug: "welcome",
    title: "Welcome to PAX",
    category: "get-started",
    summary: "What PAX is for, and how a video becomes a measured result you can act on.",
    tags: ["Basics"],
    body: `PAX is where political video gets made, tested and read. You write a script with me, record it, test it on a randomized panel, and see exactly how much it moved people, side by side with every other result on file. No guessing which ad works: you see it.

${shot("lift", "Lift, with every tested video's lift side by side")}

## The loop

Everything here serves one loop. Each step has its own page.

1. **Make a video.** Write a script with me in [Chat](/chat) and record it on camera there, or record one in [Clips](/clips).
2. **Test it.** A message test shows a randomized panel either one video or a placebo, then asks how they would vote. Staff set tests up in [Tests](/survey?s=tests), in Survey.
3. **Field it.** The Pollster in the [Inbox](/inbox) mails each person in a contact group a link of their own, reminds whoever hasn't finished, and closes the test at its quota or its deadline.
4. **Compute the lift.** When a test closes, I weight the respondents to the population's targets and compute each video's lift against the placebo.
5. **Read it.** The result reads in [Lift](/lift), on the video's panel in Clips, and in [Reports](/reports).

> New here? Start with [Find your way around](${doc("find-your-way")}), then open [Lift](/lift) and click any number. [Lift Analysis](${doc("lift-analysis")}) explains it in plain words.

## A test and a survey

They sound alike, but they answer different questions.

- A **test** is a randomized experiment. Each respondent sees one arm, a video or the placebo. A video's lift is the difference between its viewers' answers and the placebo viewers' answers, in percentage points. Because the groups were assigned at random, that difference is the video's effect.
- A **survey** measures where people stand. Everyone answers the same questions, and the result is each option's share, with no video and no comparison group.

## What a result reads against

[America Thinks](/america-thinks) holds what America already thinks, in its own wording: the General Social Survey, ANES, CES, public polls, official results, the census, turnout and enrollment records. A new test's or survey's numbers read against that record, so you can tell a real shift from the noise.

## Where to go next

| If you want to | Start here |
|---|---|
| See which videos worked | [Lift](${doc("lift")}) |
| Understand one result | [Lift Analysis](${doc("lift-analysis")}) |
| Know what voters already believe | [America Thinks](${doc("america-thinks")}) |
| Find where people agree | [Answer a survey](${doc("answer-a-survey")}) |
| Make a video | [Make videos in Chat](${doc("videos-in-chat")}) |
| Watch it done | [Video guides](${doc("video-guides")}) |`,
  },
  {
    slug: "accounts",
    title: "Accounts and access",
    category: "get-started",
    summary: "What the public, partners and staff can each do, and how to get the access you need.",
    tags: ["Basics", "Accounts"],
    body: `Everyone can open every page. What changes with an account is what you can make, keep and send.

| | Public | Partners | Staff |
|---|---|---|---|
| Open every page in the sidebar | Yes | Yes | Yes |
| Ask in Chat | 5 questions | Yes | Yes |
| Write scripts, hear voice reads, generate video | A few | Yes | Yes |
| Record a video and keep it in Clips | | Yes | Yes |
| Connect a YouTube channel | | Yes | Yes |
| Answer a survey or test link | Yes | Yes | Yes |
| Set up, field and close tests | | | Yes |
| Send mail from the Inbox | | | Yes |
| Dashboard, Studio, Dev Tools, Schema and ERD | | | Yes |

## Staff

Staff accounts have admin access. They were made ahead of time, so your first sign-in sets a password: see [Your first sign-in](${doc("first-sign-in")}).

## Partners

Partners are the organizations whose videos are made, tested and reported here: PAX, Voter Freedom, Unite America and Yes on 3. Each keeps a desk in [Clips](/clips), and every partner sees the whole library. A new partner starts at [Create your account](${doc("partner-account")}).

## The public

Anyone can use the pages without an account, with a free allowance in Chat. See [Use PAX without an account](${doc("without-an-account")}).`,
  },
  {
    slug: "first-sign-in",
    title: "Your first sign-in",
    category: "get-started",
    summary: "Staff accounts already exist. Here's how to set your password and get in.",
    tags: ["Accounts", "Staff"],
    body: `Your account already exists, with your work email confirmed. It has no password yet, so the first sign-in sets one.

1. Open [Sign in](/signin) and choose **Forgot password**.
2. Enter your work email. A six-digit code arrives from no-reply@verificationemail.com. Check spam if it's slow.
3. Enter the code and a new password: 8 or more characters, with an uppercase letter, a lowercase letter, a number and a symbol.
4. Sign in. I open on [Chat](/chat), or on the page you were trying to reach.

> Skip **Sign up**. Your email already has an account, and sign-up will say so.

## What staff see

- **Admin** in the sidebar, holding [Dashboard](/dashboard) and [Studio](/studio).
- In [Survey](/survey), the message [Tests](/survey?s=tests) and Consensus's [Admin](/survey?s=admin).
- The **Schema** and **ERD** tabs in the [Data dictionary](/data-dictionary).
- Sending from the [Inbox](/inbox), including **New test** and **New survey**.
- [Dev Tools](${doc("dev-tools")}) in the Tools panel.`,
  },
  {
    slug: "without-an-account",
    title: "Use PAX without an account",
    category: "get-started",
    summary: "Every page opens without signing in. Here's what's free, and what needs an account.",
    tags: ["Accounts"],
    body: `Every page opens without signing in. A few things are free up to a limit, counted in this browser for 30 days:

- 5 questions in [Chat](/chat)
- 2 written scripts
- 6 voice reads
- 2 generated videos

Recording a video, keeping it in Clips, and connecting a YouTube channel need an account. [Sign up](/signup) takes a minute: an email, a password and a six-digit code.

## Answer a survey

A survey link, such as [/s/open-primaries](/s/open-primaries), opens a bare page with each question as a set of options. **Submit** unlocks once every question is answered. Nothing that identifies you is stored unless you came through a personal link from the Pollster.

## Take part in a test

A test link opens one card at a time: a few questions about you, then a video. **Continue** unlocks only after the video has actually played, so skipping ahead earns no credit. Then come a short explanation, the ballot question and a comprehension question. The last card gives you a completion code.`,
  },
  {
    slug: "find-your-way",
    title: "Find your way around",
    category: "get-started",
    summary: "The sidebar, the header, the Tools panel and the second panel: everything that frames every page.",
    tags: ["Basics", "Navigation"],
    body: `Every page sits in the same frame. Learn it once and the whole app opens up.

${shot("sidebar", "The sidebar open beside America Thinks")}

## The sidebar

The sidebar lists the pages A to Z: America Thinks, Chat, Clips, Data dictionary, Inbox, Lift, Reports and Survey. Staff also see the **Admin** group with Dashboard and Studio.

- The button at the top left of every page opens and shuts it.
- Hover a page to see its arrow: it opens that page in a [second panel](${doc("second-panel")}), beside the one you're on.
- The three dots beside a page copy its address, favorite it, or open it in the second panel.
- Your saved chats are listed under **Chats**.

## The header

- **The page's name** at the top left opens a list of every page, so you can jump without the sidebar.
- **Tools** at the top right opens the [Tools panel](${doc("tools")}): Blocks, Chat, Lift Analysis, Studio, Theme and more.

${shot("page-switcher", "The page's name opens a list of every page")}

## Pages with their own sidebar

America Thinks, Lift, Survey and the Inbox each have a sidebar of their own inside the page: its search, its folders, and its filters. The button in the page's toolbar opens and shuts it.

## Search

Press ⌘K anywhere. See [Search](${doc("search")}).

## The account menu

The account menu at the foot of the sidebar holds Profile, Account (Members and Permissions), Notifications, Settings (General and Integrations), Docs, [Models](/models), Theme and Log out.

${video("guide-second-panel", "Open a page in the second panel")}`,
  },
  {
    slug: "search",
    title: "Search",
    category: "get-started",
    summary: "Find any page, question, clip or report from anywhere, or turn a search into a question for me.",
    tags: ["Navigation"],
    body: `Press ⌘K anywhere, or choose the search field under the wordmark.

- Before you type, you see Suggestions, Pages and Commands.
- Type, and every kind of thing is searched by every word, grouped by kind: pages, commands, America Thinks questions, clips, reports, Lift, tests, surveys, the Inbox, chats, the glossary and the data dictionary.
- ⌘K again lists the picked row's actions: open, open in a new tab, copy link, add to Blocks, ask about it.
- **Tab**, or **Ask PAX**, turns the search into a question for me. Type @ to point it at a page.
- The arrows move, Enter runs, Escape steps back and closes.

> Pages with their own sidebar (Lift, America Thinks) also have a search box at the top of it, and a hidden search in their toolbar: click the toolbar's empty space to open it.

## Not built yet

Pages and reports open; every other kind of result is a preview for now.`,
  },
  {
    slug: "themes",
    title: "Themes and appearance",
    category: "get-started",
    summary: "Switch between six themes, light and dark, and fine-tune any colour.",
    tags: ["Settings"],
    body: `PAX comes in six themes: **PAX Light** (the default), **PAX Dark**, **Light**, **Dark**, **Vercel** and **VS Code**. Every page, chart and panel follows the one you pick.

${shot("tools-theme", "The Theme view in the Tools panel")}

## Change your theme

1. Open the account menu at the foot of the sidebar and turn on **Theme**.
2. Open [Tools](${doc("tools")}) and choose **Theme**.
3. Click a theme. It applies at once and stays in this browser.

## Fine-tune it

Below the themes, every colour the theme is made of is listed by role: Surfaces (Page, Sidebar, Main, Raised, Tint, Selected), Type (Ink, Secondary, Muted, Faint), and the accents. Click a swatch to change it. **Reset** puts the theme back, and **Copy as CSS** copies the whole theme.`,
  },
  {
    slug: "settings",
    title: "Settings",
    category: "get-started",
    summary: "Your profile, the workspace, members, permissions, notifications and integrations.",
    tags: ["Settings", "Accounts"],
    body: `The account menu opens [Settings](/settings) at the tab you pick: **Profile** and **Notifications** directly, **Members** and **Permissions** under Account, **General** and **Integrations** under Settings.

${shot("settings", "Settings")}

- **General**: the workspace's name, address, invite domains and accent colour; region and date format; editing preferences.
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
    slug: "keyboard-shortcuts",
    title: "Keyboard shortcuts",
    category: "get-started",
    summary: "The keys that save you a click, everywhere and on the pages that have their own.",
    tags: ["Navigation"],
    body: `## Everywhere

| Keys | What they do |
|---|---|
| ⌘K | Open search |
| ⌘K, on a result | List the result's actions |
| Tab, in search | Ask me instead |
| ↑ ↓, Enter | Move through search results, and open one |
| Esc | Step back, and close |

## Chat

| Keys | What they do |
|---|---|
| Enter | Send |
| Shift + Enter | A new line |

## Sonar (staff)

| Keys | What they do |
|---|---|
| ↑ ↓ | Walk up and down the page's tree |
| ⌘↑ ⌘↓ | Step through siblings |
| ⌥ | Point precisely |
| Enter | Send the comment |
| Esc | Leave |`,
  },
]
