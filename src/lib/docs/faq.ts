import { doc, type Doc } from "./types"

export const FAQ: Doc[] = [
  {
    slug: "faq-accounts",
    title: "Accounts and sign-in",
    section: "FAQ",
    body: `## I'm on the staff. Should I sign up?

No. Your account already exists. Your first sign-in goes through **Forgot password**: see [Staff: your first sign-in](${doc("staff-sign-in")}).

## Sign-up says my email already has an account.

Sign in instead, or reset the password from the sign-in page with **Forgot password**.

## My code hasn't arrived.

It comes from no-reply@verificationemail.com, so check spam. A code expires after a while; if yours has, the form asks for a fresh one.

## What does a password need?

8 or more characters, with an uppercase letter, a lowercase letter, a number and a symbol.

## It says "Too many tries."

Wait a minute and try again.

## Can I sign in with Google?

No. Sign-in is your email and a password.

## How long do I stay signed in?

Up to 30 days in the same browser. After that, or after Log out, sign in again.

## How do I sign out?

The account menu at the foot of the sidebar, then **Log out**.

## Do my settings save?

Not yet. [Settings](/settings) lays out every option, and a change lasts until you leave the page.`,
  },
  {
    slug: "faq-partners",
    title: "Partners and channels",
    section: "FAQ",
    body: `## Which organizations are partners?

PAX, Voter Freedom, Unite America and Yes on 3. Each keeps a desk in [Clips](/clips), and every partner sees the whole library.

## How does my organization get a desk?

The staff open it. Ask your PAX contact.

## What do you see on my YouTube channel?

Read-only analytics. I read your public videos' numbers and retention curves, and a private or unlisted video only if you pick it. I can't post, edit or delete anything on the channel.

## Can I connect more than one channel?

Yes. On the Connect YouTube step, choose **Connect another channel**.

## I cancelled Google's consent screen.

Nothing was connected. Choose Connect YouTube again when you're ready.

## Who sees my recordings?

A take kept from Chat sits in **Your library** in Clips, seen by you alone, and the staff can choose it as an arm of a test. A clip recorded in Clips is private unless you made it public, which shows it to everyone in the library.

## How do I get a video tested?

Keep it in Clips. The staff pick a test's arms when they set it up; ask your PAX contact to include yours.

## Why don't I see my test's result yet?

A new result reaches Lift, Clips and Reports once it's published, a step run by hand today. Until then, the Pollster's readout mail carries it.`,
  },
  {
    slug: "faq-results",
    title: "Reading results",
    section: "FAQ",
    body: `## What a lift means

The difference, in percentage points, between how the people who saw a video answered and how the people who saw the placebo answered. The panel is randomized, so the gap is the video's effect alone. A lift of +4 on ballot support means 4 more points of support among the video's viewers than among the placebo's.

## Detectable and inconclusive

A lift is **detectable** when it meets the study's stated threshold against the placebo, a 90% threshold for the Massachusetts waves. **Inconclusive** means the test didn't detect an effect at that threshold; it isn't proof the effect is zero. A lift that doesn't clear its test reads gray.

## The margin

In Lift Analysis, a lift's margin is a 90% interval. A margin that crosses zero means the test couldn't tell the effect from none.

## The RCT badge

A green check and **RCT** on a clip mean it ran as an arm in a randomized controlled test and its result is on file. A clip without it hasn't been tested, and its panel's figures are illustrative.

## Resonance

A 0 to 100 score: where a video's lift on its main outcome ranks among every lift on file for that outcome. 90 means it beat nine in ten. It shows once at least five lifts are in the pool.

## Why Wave 3 says simulated

Massachusetts Wave 3 was fielded to a small test panel to prove the fielding end to end, and its results were simulated. The report says so.

## Are the numbers weighted?

A test's respondents are weighted to its population's targets; for Massachusetts adults, education, party and 2024 vote. The Open primaries survey's topline is self-selected and unweighted.`,
  },
  {
    slug: "faq-data",
    title: "Data and models",
    section: "FAQ",
    body: `## Where do America Thinks' numbers come from?

The General Social Survey, ANES, CES, public polls, official results, the census, and turnout, voting-age and enrollment records. Each question names its source and wording.

## What's in Lift's Archive?

1,583 effects of 618 ads from campaigns' own randomized persuasion experiments, published by Hewitt, Broockman, Coppock and colleagues (American Political Science Review, 2024). The ads are anonymized and described by their coded traits.

## Which model answers in Chat?

Claude Sonnet 4.6 by default. Pick another from the model picker in the chat box; [Models](/models) has a card for each.

## What are the PAX Series models?

Nine models trained by NYSgpt.com and sponsored by Unite America, each for one job, from picking the winning headline to spotting a breakout in its first hours. Their cards are under **Original** in [Models](/models).`,
  },
]
