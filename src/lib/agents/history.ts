import { nameOf, type Message, type Thread } from "@/lib/agents/inbox"

// Two weeks of the Inbox (Brendan, 2026-10-29: build it as if the platform has
// run live since mid-October). The threads follow the loop end to end, on the
// record PAX already holds: Massachusetts Wave 2 (fielded Oct 12–15, the
// results register's numbers) closes, is read and filed and joins Lift; a
// Consensus conversation on open primaries (the conversation /consensus holds:
// 412 voters, 7,911 votes, three groups) becomes a question card; the Open
// primaries survey builds the panels; the six Frame.io cuts are reviewed; and
// Massachusetts Wave 3 (open-primaries-1) is approved and in the field
// today. Authored, so a stored copy is refreshed to this text on load.

const at = (iso: string) => Date.parse(`${iso}:00-04:00`)
let n = 0
const msg = (from: string, when: string, body: string, unread = false): Message => ({ id: `pax-m${++n}`, from, at: at(when), body, unread })

function thread(id: string, agent: string, subject: string, messages: Message[], extra: Partial<Thread> = {}): Thread {
  return {
    id: `pax-${id}`,
    agent,
    agentName: nameOf(agent),
    to: [agent],
    cc: [],
    bcc: [],
    subject,
    createdAt: messages[0].at,
    updatedAt: messages[messages.length - 1].at,
    status: "delivered",
    messages,
    ...extra,
  }
}

const POLLSTER = "tracker"
const ANALYST = "bill-reader"
const ASSISTANT = "assistant"

export const HISTORY: Thread[] = [
  thread("wave-2-closed", POLLSTER, "Closed: Massachusetts Wave 2", [
    msg(POLLSTER, "2026-10-15T18:10", "Massachusetts Wave 2 reached its quota today: five arms (Pahlow, DiZoglio, Matt Wilson, Green and the placebo), **2,372 weighted completes** among Massachusetts adults, every arm over 440.\n\nThe Analyst has the data; the readout follows.\n\nPollster"),
  ]),
  thread("wave-2-results", ANALYST, "Results: Massachusetts Wave 2", [
    msg("you", "2026-10-16T08:05", "Wave 2 is closed. Write it up the way Wave 1 was, and flag anything that changes what we cut next."),
    msg(ANALYST, "2026-10-16T09:30", "Wave 2 closed with **2,372 weighted completes** among Massachusetts adults (fielded Oct 12–15). Every treatment moved Yes on Question 3 against the placebo (47% Yes):\n\n- **Green +14** (61% Yes)\n- **DiZoglio +11** (58%)\n- **Matt Wilson +11** (58%)\n- **Pahlow +10** (57%)\n\nAll four clear the 90% threshold. On comprehension, Pahlow leads at **+11**; Green's +5 is inconclusive, so the most persuasive cut is not the clearest one.\n\nWhat changes the next cut: asked which format they trust, 54% named a traditional TV ad, 25% a person speaking to camera and 21% a podcast clip. Wave 1's leader was a person speaking to camera (Danielle Allen, +18), so the messenger matters more than the format. I'd isolate the messenger next.\n\nThe full readout, with subgroups and pairings, is in the [report](/reports-2).\n\nAnalyst"),
  ], { starred: true, important: true }),
  thread("wave-2-filed", ASSISTANT, "Report filed: Massachusetts Wave 2", [
    msg(ASSISTANT, "2026-10-16T14:00", "Massachusetts Wave 2 is filed in [Reports](/reports-2) beside Wave 1 and attached to its four clips.\n\nSent to Garrett, Sajeela and Ted, and to Unite America and Yes on 3.\n\nAssistant"),
  ]),
  thread("wave-2-lift", ANALYST, "Lift updated: Massachusetts Wave 2", [
    msg(ANALYST, "2026-10-16T16:30", "[Lift](/lift) now holds both waves: ten treatments against their placebos. Danielle Allen still leads overall at **+18** (Wave 1); in Wave 2, Green leads at **+14**. Turn both waves on to compare them side by side.\n\nAnalyst"),
  ]),
  thread("onboard-unite-america", ASSISTANT, "Ted Delicath joined from Unite America", [
    msg(ASSISTANT, "2026-10-17T09:10", "Ted Delicath accepted the invitation and signed in with Google (ted@uniteamerica.org). His account sees Unite America's clips, surveys, tests, Lift and reports.\n\nI sent the invitation, his login and, an hour later, a password reset he asked for. All three went from the Onboarding templates.\n\nAssistant"),
  ]),
  thread("consensus-open", POLLSTER, "Consensus: open primaries in Massachusetts", [
    msg("you", "2026-10-17T10:00", "Before we cut the next round I want to know which arguments land. Open a Consensus conversation with MA adults on open primaries."),
    msg(POLLSTER, "2026-10-17T11:20", "Opened **Open primaries** on [Consensus](/consensus) with seed statements drawn from Report 2 and America Thinks wordings, and sent the Consensus invite to 1,200 Massachusetts adults. I'll remind Monday and close Tuesday night.\n\nPollster"),
    msg(POLLSTER, "2026-10-20T09:00", "Reminder sent. 214 have voted so far; the reminder went to the 986 who haven't.\n\nPollster"),
  ]),
  thread("survey-fielded", POLLSTER, "In the field: Open primaries survey", [
    msg("you", "2026-10-19T16:40", "Field the Open primaries survey to the full MA adults list. I want panels out of it: independents and the undecided on Question 3."),
    msg(POLLSTER, "2026-10-20T08:00", "The [Open primaries survey](/survey/open-primaries) went out this morning: four questions, each an America Thinks item, to 4,800 Massachusetts adults. I expect to close Thursday.\n\nPollster"),
    msg(POLLSTER, "2026-10-22T09:00", "Reminder sent to the 3,100 who haven't answered. 1,640 completes so far.\n\nPollster"),
  ]),
  thread("consensus-summary", ANALYST, "What MA voters agree on: open primaries", [
    msg(ANALYST, "2026-10-22T08:45", "**412 people** cast **7,911 votes** on 23 statements about open primaries and split into three opinion groups (171, 149 and 92 people).\n\nEvery group leaned toward: “Allowing unaffiliated voters to choose one party's ballot is a fair middle ground.” Most also agreed that “Most voters do not know their own state's primary rules, and that is the bigger problem.”\n\nThe sharpest divide: “Congress should require states to let unaffiliated voters vote in federal primaries.” Close behind: “Closing a primary to party members is a reasonable way to stop rival voters from meddling.”\n\n[See the groups](/consensus?tab=results)\n\nAnalyst"),
  ]),
  thread("question-card", ANALYST, "Question card: Massachusetts Wave 3", [
    msg(ANALYST, "2026-10-22T11:00", "From the conversation and the bank, six closed-ended questions for Massachusetts Wave 3, each matched to America Thinks wording so it reads against the norm:\n\n1. MA Question 3 (top-two open primary): how would you vote? Yes / No / Undecided\n2. Favorable or unfavorable view of top-two primaries\n3. Favorable or unfavorable view of closed primaries\n4. Allowing unaffiliated voters to choose one party's ballot is a fair middle ground. Agree / Disagree\n5. Congress should require states to let unaffiliated voters vote in federal primaries. Agree / Disagree\n6. Under Question 3, who could vote in the primary? (comprehension)\n\nItems 1–3 carry their norms from the bank; 4 and 5 are the shared ground and the divide from Consensus.\n\nAnalyst"),
    msg("you", "2026-10-22T12:15", "Approved. Hold it for the Wave 3 cuts."),
  ]),
  thread("survey-topline", ANALYST, "Topline: Open primaries survey", [
    msg(ANALYST, "2026-10-24T09:15", "The Open primaries survey closed with **2,410 completes** among Massachusetts adults.\n\n- **Question 3:** 46% Yes, 31% No, 23% undecided\n- **Top-two primaries:** 52% favorable\n- **Closed primaries:** 38% favorable\n\nThe answers are filed in [America Thinks](/america-thinks) under Responses, beside the norms for the same questions.\n\nAnalyst"),
  ]),
  thread("panels-built", POLLSTER, "Panels built from the Open primaries survey", [
    msg(POLLSTER, "2026-10-24T09:40", "Three groups are ready to draw from:\n\n- **MA adults panel:** 2,410\n- **MA independents:** 812\n- **MA undecided on Question 3:** 377\n\nEveryone who answered got the Survey thank-you with their panel. A test sent to a group still randomizes each person to a cut or the placebo when they open it.\n\nPollster"),
  ]),
  thread("cuts-review", "garrett", "New cuts for Voter Freedom", [
    msg("you", "2026-10-25T12:00", "Six new cuts for Voter Freedom are up on Frame.io: Danielle Allen, Dustin Cathcart, Jesse Littlewood, Paul Schilchtman, Alex Rodriguez and Ajayi Harris.\n\nLeave a note on any frame you want changed and I'll fold it into the next version before the test fields on Wednesday.\n\nBrendan"),
    msg("sajeela", "2026-10-25T15:20", "Swap frame 7 on the Allen cut; the lower third covers her name. Otherwise good to go."),
    msg("garrett", "2026-10-26T10:05", "Littlewood's open runs long. Trim the first two seconds and it's the strongest of the six."),
  ], { to: ["garrett", "sajeela", "ted"], cc: ["voterfreedom"] }),
  thread("review-reminder", ASSISTANT, "Reminder: review the Wave 3 cuts by Oct 27", [
    msg(ASSISTANT, "2026-10-26T09:00", "The six Wave 3 cuts are waiting on notes in Frame.io from Ted. The test fields Wednesday, so notes by Tuesday make the next cut.\n\nAssistant"),
  ]),
  thread("weekly-digest", ASSISTANT, "This week on PAX", [
    msg(ASSISTANT, "2026-10-26T18:00", "This week: **6 new clips**, one survey closed (2,410 completes), one Consensus conversation closed (412 voters), one question card approved and one report filed.\n\nThe biggest move: Green at **+14** on Question 3 in Wave 2.\n\nAssistant"),
  ]),
  thread("test-approved", ASSISTANT, "Approved to field: Massachusetts Wave 3", [
    msg(ASSISTANT, "2026-10-27T15:30", "Massachusetts Wave 3 is ready and waiting on your approval: the six cuts and a placebo, the six questions from the card, to MA independents and MA undecided.\n\nAssistant"),
    msg("you", "2026-10-27T16:02", "Approved."),
    msg(ASSISTANT, "2026-10-27T16:03", "Approved to field. The Pollster sends it tomorrow morning and expects to close Friday, Oct 30.\n\nAssistant"),
  ]),
  thread("test-fielded", POLLSTER, "In the field: Massachusetts Wave 3", [
    msg(POLLSTER, "2026-10-28T08:00", "Massachusetts Wave 3 (open-primaries-1) went into the field this morning: six cuts and a placebo, the six questions from the card, sent to MA independents (812) and MA undecided (377). Each respondent is randomized to one cut or the placebo when they open the study.\n\nI expect to close Friday, Oct 30. You can watch the sample fill in on the [monitor](/message-tests).\n\nPollster", true),
  ]),
  thread("test-reminder", POLLSTER, "Reminder sent: Massachusetts Wave 3", [
    msg(POLLSTER, "2026-10-29T07:30", "The Test reminder went this morning to everyone who hasn't opened the study. I'll send the last one Thursday at noon.\n\nPollster", true),
  ]),
]
