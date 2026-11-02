import { LLM_CARDS, ORIGINAL_CARDS, VISUAL_CARDS } from "@/lib/model-cards"

import { shot, video } from "./media"
import { doc, type Doc } from "./types"

export const VIDEO: Doc[] = [
  {
    slug: "chat",
    title: "Ask PAX in Chat",
    category: "video",
    summary: "Ask in plain words, from any page. I answer from the record, and say so when a number isn't on file.",
    tags: ["Chat", "AI"],
    body: `Ask me in plain words. I answer from the record of scored takes, the scripts, the shorts on file and the metric definitions, and I say so when a number isn't on file instead of making one up.

${shot("chat", "Chat")}

## Ask from anywhere

- Open [Chat](/chat) from the sidebar for a full page.
- Open [Tools](${doc("tools")}) > **Chat** to ask beside whatever page you're on.
- On any block, **⋮ > Ask PAX** opens Chat with that block as context, so "what does this mean?" just works.

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

- **The camera** starts record mode. See [Record a video](${doc("recording")}).
- **The model picker** chooses which model answers. Sonnet 4.6 is the default, and [Models](${doc("models")}) has a card for each.
- Each chat is saved and listed under **Chats** in the sidebar.

> Signed out, your first five questions are free.`,
  },
  {
    slug: "videos-in-chat",
    title: "Make videos from templates in Chat",
    category: "video",
    summary: "Ask for a video and I fill a template with the real numbers. Make one, or a handful at once.",
    tags: ["Chat", "Video", "Studio"],
    body: `You don't need an editor to turn a result into a video. Ask me for one in [Chat](/chat), and I fill one of the video templates with the numbers on file. The page plays it right in the conversation.

${video("record-chat", "Making several videos at once in Chat")}

## Make one

1. Open [Chat](/chat).
2. Ask for what you want to show, in plain words: "Make a lift card for Dustin Cathcart."
3. The video plays in my reply. It's saved as your next version of that template, with its number (v1, v2) under it.

## Make a handful at once

Ask for several in one message: "Make lift cards for the three strongest Support results in the latest wave." Each comes back as its own video, each saved as its own version.

## Change one

Just say what to change: "Make the caption shorter," "Add callouts," "Make it shorter." I write the whole video again, changed only as you asked, and save it as a new version. The old one stays.

## The templates

| Template | What it shows |
|---|---|
| **Lift card** | One video's result, vertical: for each measure, the placebo's level and the lift over it. A lift that didn't clear its test is drawn hollow. |
| **Lift leaderboard** | Videos ranked on one measure's lift, wide: up to eight bars on a shared scale, the one you asked about ringed. |
| **Trend** | Up to four lines across waves, wide, with callouts as each line passes its point. |
| **Survey split** | One survey question's answers by group, wide, each bar with its margin of error. |
| **Yes on 3 card** | The Yes on 3 campaign's checklist card, for Yes on 3 work only. |

## Where the numbers come from

I fill a template only from figures in the conversation or on file: the published lift results, the page you asked from, the shorts. I never invent a number, a name or a date. When a figure the template needs is missing, I say which one and ask for it.

> Staff see **Open in Studio** under each video. It opens that exact version in [Studio](${doc("studio")}), where every frame can be checked and the version kept.`,
  },
  {
    slug: "studio",
    title: "Studio",
    category: "video",
    summary: "Every video template, every graphic, and every version you've made, in one place to play and check.",
    tags: ["Studio", "Video", "Staff"],
    admins: true,
    body: `[Studio](/studio) is where the video templates live. It holds the templates themselves, the Enhance flow's graphics, and every version anyone has made in Chat.

${video("record-studio", "Every template in Studio, played one after another")}

## Open it

- From the sidebar: **Admin > Studio**, full width.
- From [Tools](${doc("tools")}) > **Studio**, beside the page you're on.
- From a video in Chat: **Open in Studio** opens that version.

${shot("studio", "Studio")}

## Find a template or a version

The list on the left holds every composition: the five templates, then the versions made from each (v-lift-card-1, v-lift-card-2, and so on). Click one to open it.

## Play and check it

The canvas plays the composition. Scrub the timeline to check any frame, and read the props it was made from on the right: the same data Chat filled in.

## Make a new one

Versions are made in Chat. Ask for a video, or for a change to one, and the new version appears in Studio's list. See [Make videos from templates in Chat](${doc("videos-in-chat")}).

> A link to /studio?v= and a version's id opens Studio on that version, so you can share exactly what you're looking at.`,
  },
  {
    slug: "recording",
    title: "Record a video",
    category: "video",
    summary: "Write a script in your own words with me, then record it on camera with a teleprompter.",
    tags: ["Chat", "Video", "Clips"],
    body: `1. In [Chat](/chat), press the camera. I ask a few short questions, one at a time: who you are, your town, and why open primaries matter to you.
2. I draft a script in your words: a hook under 12 words, first person, one concrete number, 50 to 60 words (about 25 seconds), ending with what the viewer should do. Revise it with me until it sounds like you.
3. Each line that leans on evidence carries its citation: the Upworthy headline findings, the Swayable trait effects, the channel findings or the Wesleyan ad coding.
4. Press **Record** on the script card. The camera opens in the chat with a teleprompter that scrolls at your pace.
5. Watch it back, give it a title and send it.

The take is kept in [Clips](${doc("clips")}) as your own clip, in **Your library**. Only you see it there, and staff can choose it as an arm of a message test.

> Keeping a take needs you signed in. Signed out, sign-in opens in a new tab and the take waits in the chat.`,
  },
  {
    slug: "clips",
    title: "Clips",
    category: "video",
    summary: "Every partner's videos in one library, with the team's notes and each one's measured lift beside it.",
    tags: ["Clips", "Video"],
    body: `[Clips](/clips) puts every partner's videos in one library, each with its team thread and, where it's been tested, its measured lift. Choose what to run from evidence instead of memory.

${shot("clips", "Clips")}

## Browse

- The clips play in a column of tiles; the clip you pick wears a blue outline.
- The **Partners** menu narrows the library to one desk: PAX, Voter Freedom, Unite America or Yes on 3. **Bookmarks** keeps the clips you've saved.

## Edits and Reports

The clips' menu opens two views in the [Tools panel](${doc("tools")}), and both follow the clip that's playing:

- **Edits**: the team's thread on the clip. Leave a note, reply, or like a note.
- **Reports**: every tested clip as a tile. Pick one, or play a tested clip, to read its result.

## The RCT badge

A green check and **RCT** mean the clip ran as an arm in a randomized controlled test and its result is on file. Its report reads each measure's lift against that wave's own placebo, grey where the test was inconclusive, and each opens its cell in [Lift](${doc("lift")}). It also names the arm's respondents, the study and the clip's [Resonance](${doc("resonance")}).

A clip without the badge hasn't been tested.

## Record a clip

Signed in, record a clip: up to 60 seconds, then a review, a title and a visibility, private by default or public to everyone in the library. A kept recording comes back in **Your library**.

## Not built yet

- Deleting or republishing a kept recording.
- Sending a clip to a test from Clips. A test's arms are picked on its setup page.
- Likes, notes and saves are kept only in the browser that made them.`,
  },
  {
    slug: "models",
    title: "Models",
    category: "video",
    summary: "Every model I run, what it's good at, and the PAX models trained for this work.",
    tags: ["AI"],
    body: `[Models](/models) holds a card for every model I run in one list, A to Z, under a search that matches a name, a maker or any fact on a card.

${shot("models", "Models")}

- The ${LLM_CARDS.length} models in Chat's model picker, each with its release, context window, inputs, weights, size, model ID and, where it does more than answer in Chat, its job.
- The ${VISUAL_CARDS.length} video models. The four that make b-roll go in the order a failed generation falls back through them; Runway Aleph cleans up a recorded take.
- The PAX Series 1.0, ${ORIGINAL_CARDS.length} models trained by NYSgpt.com and sponsored by Unite America: ${ORIGINAL_CARDS.map((m) => m.name).join(", ")}. Each card gives its inputs and, where it's measured, how often it picks right.

Each card's ⋮ menu favorites it, adds it to [Blocks](${doc("blocks")}), or asks me about it.`,
  },
]
