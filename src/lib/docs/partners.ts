import { doc, type Doc } from "./types"

// The partner's path in order: /signup, the welcome steps at /signup/welcome (components/onboarding/stepper.tsx),
// the YouTube connect and its ingest (lib/channel-ingest.ts), then Clips and the first test.

export const PARTNERS: Doc[] = [
  {
    slug: "partner-account",
    title: "1. Create your account",
    category: "partners",
    summary: "Make your partner account in a minute.",
    tags: ["Partners"],
    body: `1. Open [Sign up](/signup) and choose **Partner**.
2. Enter your email and a password: 8 or more characters, with an uppercase letter, a lowercase letter, a number and a symbol. Choose **Create account**.
3. A six-digit code arrives by email. Enter it to confirm the address.
4. I sign you in and open the welcome steps.

If you began a sign-up earlier and didn't finish, entering the code completes it, and your password is the one you chose the first time.

## If your login was made for you

Some partner logins are set up by the staff ahead of time. If yours was, skip Sign up: open [Sign in](/signin), choose **Forgot password**, and set your password with the code mailed to you.`,
  },
  {
    slug: "partner-welcome",
    title: "2. Tell me about your work",
    category: "partners",
    summary: "Tell me about your work, so everything I make fits it.",
    tags: ["Partners"],
    body: `The welcome steps come one at a time. The dots at the foot show where you are, and the back chevron returns a step. **Skip** turns into **Continue** once you've picked something, and each Continue saves your answers, so you can stop and come back.

1. **About you**: your first and last name, your role, where you're based and, if you like, how you heard about PAX. A first name is the one thing required.
2. **What content do you produce?** Shorts and Reels, longer videos, or scripts without a camera. Pick any.
3. **What would you like to do?** Content Generation, Studio Effects, Video Analysis, Publishing Reach, Performance Tracking or Script Writing. Pick any.

Your name, role and town carry into recording, so a script I draft for you already knows who's speaking.`,
  },
  {
    slug: "partner-youtube",
    title: "3. Connect YouTube and upload",
    category: "partners",
    summary: "Connect your YouTube channel and bring your videos in.",
    tags: ["Partners"],
    body: `## Connect YouTube

1. Choose **Connect YouTube** and approve Google's consent screen. The access is read-only analytics: I can read your channel's numbers, never post, edit or delete.
2. Back on the step, your channel appears with its progress while I bring it in. You don't have to wait; the work carries on after you move to the next step.
3. If you run more than one channel, choose **Connect another channel**.

What comes in:

- **Every public video** on the channel. A private or unlisted video stores nothing, not even its title, unless you pick it from the list under the channel. Un-pick one and its data is gone on the next run.
- **Each video's lifetime analytics**: views, watch time, average view duration, likes, shares, comments, subscribers gained and lost, and card and thumbnail impressions with their click-through.
- **Each video's audience-retention curve.**

If you cancel Google's screen, nothing is connected and the step says so; choose Connect YouTube again when you're ready.

## Upload your videos

Drop video files on the step, or skip it. A file named for one of your videos' titles, as a Google Takeout export names them, is matched to that video from the start, and you can change the match from the file's row.

## Finish

The last step lists each channel I'm analyzing. Choose **View analysis** to finish, or **Go to PAX** if you didn't connect one.`,
  },
  {
    slug: "partner-desk",
    title: "4. Your desk and your first test",
    category: "partners",
    summary: "Your desk in Clips, and how to run your first test.",
    tags: ["Partners"],
    body: `## Your desk in Clips

[Clips](/clips) is one library shared by every partner: PAX, Voter Freedom, Unite America and Yes on 3 each keep a desk of their videos and review threads, so no one pays to shoot what another desk has already made or tested. Narrow to one desk from the Partners menu, and switch between the feed and the grid at the top. A new organization's desk is opened by the staff; ask your PAX contact.

## Make a video

- **In Chat**: press the camera and I interview you, draft a 25-second script in your words, and record it with a teleprompter. See [Recording a video](${doc("recording")}).
- **In Clips**: record up to 60 seconds, watch it back, give it a title, and choose who sees it: private, the default, or public to everyone in the library.

A kept video plays in **Your library** on Clips.

## Your first test

The staff set up tests, and any video kept in Clips can be one of a test's arms. A randomized panel sees it or a placebo, then answers the ballot question, so the gap between the two groups is your video's effect. Once the result is published, the video wears a green **RCT** badge in Clips and its panel shows each outcome's lift. The full result reads in [Lift](/lift), and the study's readout in [Reports](/reports).

New to reading a result? Start with [What a lift means](${doc("faq-results")}).`,
  },
]
