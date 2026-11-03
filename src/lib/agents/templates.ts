// The inbox's templates (Brendan, 2026-10-29): the messages a person or an agent
// sends again and again, by kind. Each lives in Resend, published, under the id
// kept here; the copy below is the same text as markdown, so picking one fills
// the composer. Agents send from their AgentMail inboxes (pax-pollster,
// pax-analyst, pax-assistant), a person from their own address. {{NAME}} marks
// what the sender fills in. Written by a script from the Resend side; edit both.
// Flows (Brendan, 2026-11-01) are the mail a page visit enrolls a signed-in reader
// in, each teaching that page (lib/flows/defs.ts). They carry local- ids until
// they are published to Resend; a rewrite from the Resend side must keep them.

export type TemplateKind = "Consensus" | "Surveys" | "Tests" | "Results" | "Notifications" | "Reminders" | "Onboarding" | "Flows"

export const TEMPLATE_KINDS: TemplateKind[] = ["Consensus", "Surveys", "Tests", "Results", "Notifications", "Reminders", "Onboarding", "Flows"]

export type Template = {
  /** The template's id in Resend. */
  id: string
  kind: TemplateKind
  name: string
  /** Who sends it: a roster agent's slug or a staff handle (lib/agents/inbox.ts). */
  from: string
  subject: string
  body: string
}

export const TEMPLATES: Template[] = [
  {
    "id": "3e46d507-a2c2-4274-88c8-60613bead96b",
    "kind": "Consensus",
    "name": "Consensus invite",
    "from": "tracker",
    "subject": "What do you think about {{TOPIC}}?",
    "body": "**What do you think about {{TOPIC}}?**\n\nHi {{RECIPIENT_NAME}},\n\nI'm gathering views on {{TOPIC}}. Read a few statements other people wrote, mark each one agree, disagree or pass, and add your own if something's missing.\n\n![The conversation's statements, answered one at a time](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/survey-questions.jpg)\n\n**Topic:** {{TOPIC}}\n\n**Time:** about five minutes\n\n[Join the conversation]({{CONVERSATION_URL}})\n\nPollster"
  },
  {
    "id": "ca3a509f-4371-4100-8922-fce660cada4c",
    "kind": "Consensus",
    "name": "Consensus summary",
    "from": "bill-reader",
    "subject": "Where people agree on {{TOPIC}}",
    "body": "**Where people agree on {{TOPIC}}**\n\nThe conversation on {{TOPIC}} split into {{GROUP_COUNT}} opinion groups.\n\n![Where the opinion groups agree, and where they split](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/survey-results-surface.jpg)\n\n**Participants:** {{VOTERS}}\n\n**Votes:** {{VOTES}}\n\n**Statements:** {{STATEMENTS}}\n\nEvery group agreed that “{{TOP_STATEMENT}}”. The sharpest divide was over “{{DIVISIVE_STATEMENT}}”.\n\n[See the groups]({{RESULTS_URL}})\n\nAnalyst"
  },
  {
    "id": "4251b473-cba9-44bc-bf29-bdbfe3a47f46",
    "kind": "Consensus",
    "name": "Question card ready",
    "from": "bill-reader",
    "subject": "Question card: {{CLIP_NAME}}",
    "body": "**Question card: {{CLIP_NAME}}**\n\nI turned the Consensus results into closed-ended questions, each matched to America Thinks wording so it reads against the norm.\n\n![The question card, as a test request to the Pollster](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/inbox.jpg)\n\n**Clip:** {{CLIP_NAME}}\n\n**Questions:** {{QUESTION_COUNT}}\n\n**Next:** your approval hands the test to the Pollster\n\n[Review the card]({{CARD_URL}})\n\nAnalyst"
  },
  {
    "id": "58307e18-6c0e-4040-88d1-a1e7debfef38",
    "kind": "Surveys",
    "name": "Survey invitation",
    "from": "tracker",
    "subject": "A few questions about {{TOPIC}}",
    "body": "**A few questions about {{TOPIC}}**\n\nHi {{RECIPIENT_NAME}},\n\nI'm asking a few short questions about {{TOPIC}}, and your answers stay anonymous.\n\n![The survey's questions](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/survey.jpg)\n\n**Questions:** {{QUESTION_COUNT}}\n\n**Time:** about {{MINUTES}} minutes\n\n[Start the survey]({{SURVEY_URL}})\n\nPollster"
  },
  {
    "id": "b0372255-e04e-436f-8ac4-0657ccc4c345",
    "kind": "Surveys",
    "name": "Survey reminder",
    "from": "tracker",
    "subject": "Still time to answer: {{SURVEY_NAME}}",
    "body": "**Still time to answer: {{SURVEY_NAME}}**\n\nHi {{RECIPIENT_NAME}},\n\nThe survey on {{TOPIC}} I sent on {{SENT_DATE}} is still open. If you've started, your answers are saved.\n\n![The survey's questions](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/survey.jpg)\n\n**Closes:** {{CLOSE_DATE}}\n\n**Time:** about {{MINUTES}} minutes\n\n[Pick up where you left off]({{SURVEY_URL}})\n\nPollster"
  },
  {
    "id": "4fb703cd-dab5-45f4-a1ce-63b17c4c27a1",
    "kind": "Surveys",
    "name": "Survey thank-you",
    "from": "tracker",
    "subject": "Thanks for answering, {{RECIPIENT_NAME}}",
    "body": "**Thanks for answering**\n\nHi {{RECIPIENT_NAME}},\n\nYour answers are in. I've added you to a panel, so I may ask you to watch a short video and answer a few questions in the coming weeks.\n\n![A study: one video, then its questions](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/survey-tests.jpg)\n\n**Panel:** {{GROUP_NAME}}\n\nYou can leave it any time from [your settings]({{SETTINGS_URL}}).\n\nPollster"
  },
  {
    "id": "00a24180-a1b3-46a7-ad53-5b1bc496964d",
    "kind": "Tests",
    "name": "Test invitation",
    "from": "tracker",
    "subject": "Watch a short video and answer {{QUESTION_COUNT}} questions",
    "body": "**Watch a short video and answer {{QUESTION_COUNT}} questions**\n\nHi {{RECIPIENT_NAME}},\n\nI have a short study for you: one video, then a few questions about it.\n\n![The study: one video, then its questions](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/survey-tests.jpg)\n\n**Video:** under a minute\n\n**Questions:** {{QUESTION_COUNT}}\n\n**Time:** about {{MINUTES}} minutes\n\n[Start the study]({{TEST_URL}})\n\nPollster"
  },
  {
    "id": "7ff83159-240a-46af-b3d7-5ecdb1641a8e",
    "kind": "Tests",
    "name": "Test opened",
    "from": "tracker",
    "subject": "In the field: {{TEST_NAME}}",
    "body": "**In the field: {{TEST_NAME}}**\n\nHi {{RECIPIENT_NAME}},\n\n{{TEST_NAME}} went into the field today. I'll write again when it closes.\n\n![The test in Survey, its sample filling](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/survey-tests.jpg)\n\n**Sample:** {{SAMPLE_SIZE}} {{AUDIENCE}}\n\n**Arms:** {{ARMS}}\n\n**Expected close:** {{CLOSE_DATE}}\n\n[Watch the sample fill]({{MONITOR_URL}})\n\nPollster"
  },
  {
    "id": "b45af847-28fb-4972-b458-58dbc6e387e7",
    "kind": "Tests",
    "name": "Test reminder",
    "from": "tracker",
    "subject": "Your study closes {{CLOSE_DATE}}",
    "body": "**Your study closes {{CLOSE_DATE}}**\n\nHi {{RECIPIENT_NAME}},\n\nThe study I sent on {{SENT_DATE}} is still waiting for you: one short video, then a few questions.\n\n![The study: one video, then its questions](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/survey-tests.jpg)\n\n**Closes:** {{CLOSE_DATE}}\n\n**Time:** about {{MINUTES}} minutes\n\n[Start the study]({{TEST_URL}})\n\nPollster"
  },
  {
    "id": "3afa6c38-97b1-4877-8b0e-59703da5bdd9",
    "kind": "Tests",
    "name": "Quota closed",
    "from": "tracker",
    "subject": "Closed: {{TEST_NAME}}",
    "body": "**Closed: {{TEST_NAME}}**\n\n{{TEST_NAME}} reached its quota, and the Analyst has the data. The readout follows.\n\n![The test in Survey, closed](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/survey-tests.jpg)\n\n**Completes:** {{COMPLETES}}\n\n**Arms:** {{ARMS}}, each with at least {{MIN_ARM}}\n\n**Closed:** {{CLOSE_DATE}}\n\nPollster"
  },
  {
    "id": "9e62b372-de7b-426e-8218-b3dff4c9031b",
    "kind": "Results",
    "name": "Results readout",
    "from": "bill-reader",
    "subject": "Results: {{TEST_NAME}}",
    "body": "**Results: {{TEST_NAME}}**\n\nHi {{RECIPIENT_NAME}},\n\n{{TEST_NAME}} closed, and the full readout, with the subgroups and pairings, is in the report.\n\n![The report, in Reports](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/reports.jpg)\n\n**Completes:** {{COMPLETES}}\n\n**Strongest treatment:** {{TOP_TREATMENT}}\n\n**Lift on support:** {{LIFT}} points (±{{MARGIN}})\n\n[Read the report]({{REPORT_URL}})\n\nAnalyst"
  },
  {
    "id": "28efeb7e-f9ec-4823-b6a6-cd67cd4f5c8a",
    "kind": "Results",
    "name": "Survey topline",
    "from": "bill-reader",
    "subject": "Topline: {{SURVEY_NAME}}",
    "body": "**Topline: {{SURVEY_NAME}}**\n\nOn {{HEADLINE_QUESTION}}, {{HEADLINE_RESULT}}.\n\n![Survey, with its toplines](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/survey.jpg)\n\n**Completes:** {{COMPLETES}}\n\n**Filed in:** America Thinks, under Responses, beside the norms for the same questions\n\n[Read the topline]({{TOPLINE_URL}})\n\nAnalyst"
  },
  {
    "id": "e873eb08-fa4f-434b-b4a4-e5ee0492f37b",
    "kind": "Results",
    "name": "Lift updated",
    "from": "bill-reader",
    "subject": "Lift updated: {{TEST_NAME}}",
    "body": "**Lift updated: {{TEST_NAME}}**\n\nLift now includes {{TEST_NAME}}.\n\n![Lift: every tested video's lift side by side](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/lift.jpg)\n\n**Treatments:** {{ARM_COUNT}} against the placebo\n\n**Leading:** {{TOP_TREATMENT}}, {{LIFT}} points (±{{MARGIN}})\n\n[Open Lift]({{LIFT_URL}})\n\nAnalyst"
  },
  {
    "id": "8eaa95f3-af62-4470-8261-522ddcfe0c6d",
    "kind": "Notifications",
    "name": "Cuts ready for review",
    "from": "brendan",
    "subject": "New cuts for {{PARTNER}}",
    "body": "**New cuts for {{PARTNER}}**\n\nHi {{RECIPIENT_NAME}},\n\nNew cuts for {{PARTNER}} are up on Frame.io. Leave a note on any frame you want changed and I'll fold it into the next version.\n\n![Clips](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/clips.jpg)\n\n**Cuts:** {{CUT_COUNT}}\n\n**Test fields:** {{FIELD_DATE}}\n\n[Open them in Frame.io]({{FRAMEIO_URL}})\n\nBrendan"
  },
  {
    "id": "5f5654aa-b972-4440-8e4a-6eb55bc8d329",
    "kind": "Notifications",
    "name": "Clip ready to test",
    "from": "assistant",
    "subject": "{{CLIP_NAME}} is ready to test",
    "body": "**{{CLIP_NAME}} is ready to test**\n\nIt passed review and its question card is approved. Approve the test and the Pollster sends it.\n\n![The clip, open in Clips](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/clips.jpg)\n\n**Clip:** {{CLIP_NAME}}\n\n**Goes to:** {{GROUP_NAME}}\n\n[Approve the test]({{APPROVE_URL}})\n\nAssistant"
  },
  {
    "id": "60a17086-59b0-4d40-8b4a-225349dab33a",
    "kind": "Notifications",
    "name": "Test approved",
    "from": "assistant",
    "subject": "Approved to field: {{TEST_NAME}}",
    "body": "**Approved to field: {{TEST_NAME}}**\n\n{{APPROVER}} approved it, and the Pollster sends it today.\n\n![The test in Survey](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/survey-tests.jpg)\n\n**Goes to:** {{GROUP_NAME}}\n\n**Expected close:** {{CLOSE_DATE}}\n\nAssistant"
  },
  {
    "id": "c6467616-fc1b-4037-8c99-59b1e9e2b63e",
    "kind": "Notifications",
    "name": "Report filed",
    "from": "assistant",
    "subject": "Report filed: {{REPORT_NAME}}",
    "body": "**Report filed: {{REPORT_NAME}}**\n\nThe report is filed and attached to its clips.\n\n![Reports](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/reports.jpg)\n\n**Filed in:** Reports, and on each of its clips\n\n[Read the report]({{REPORT_URL}})\n\nAssistant"
  },
  {
    "id": "fd015258-0456-4999-9f12-2347c8d99a8b",
    "kind": "Reminders",
    "name": "Review reminder",
    "from": "assistant",
    "subject": "Reminder: review {{CLIP_NAME}} by {{DUE_DATE}}",
    "body": "**Reminder: review {{CLIP_NAME}} by {{DUE_DATE}}**\n\n{{CLIP_NAME}} is waiting on your notes in Frame.io. Notes in by the due date make the next cut.\n\n![Clips](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/clips.jpg)\n\n**Notes due:** {{DUE_DATE}}\n\n**Test fields:** {{FIELD_DATE}}\n\n[Open it in Frame.io]({{FRAMEIO_URL}})\n\nAssistant"
  },
  {
    "id": "d446ab11-70e0-42f2-9f70-d482913b1026",
    "kind": "Reminders",
    "name": "Approval reminder",
    "from": "assistant",
    "subject": "Waiting on your approval: {{TEST_NAME}}",
    "body": "**Waiting on your approval: {{TEST_NAME}}**\n\nThe test is ready and waiting on your approval.\n\n![The Agentic Inbox](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/inbox.jpg)\n\n**Approve by:** {{DUE_DATE}}\n\n**Closes by:** {{CLOSE_DATE}}, if approved on time\n\n[Approve the test]({{APPROVE_URL}})\n\nAssistant"
  },
  {
    "id": "cc42f54e-014c-41cd-81fd-89cbbdbf92a7",
    "kind": "Reminders",
    "name": "Weekly digest",
    "from": "assistant",
    "subject": "This week on PAX",
    "body": "**This week on PAX**\n\n![PAX](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/home.jpg)\n\n**New clips:** {{CLIP_COUNT}}\n\n**Tests in the field:** {{TESTS_IN_FIELD}}\n\n**Reports filed:** {{REPORTS_FILED}}\n\nThe biggest move: {{TOP_LINE}}.\n\n[See the week]({{DIGEST_URL}})\n\nAssistant"
  },
  {
    "id": "f2daf280-6886-41b3-8be7-b60670d42cac",
    "kind": "Onboarding",
    "name": "Invitation",
    "from": "assistant",
    "subject": "{{INVITER}} invited you to PAX",
    "body": "**{{INVITER}} invited you to PAX**\n\nHi {{RECIPIENT_NAME}},\n\nPAX is where {{ORG_NAME}} sees its clips, surveys, tests, Lift and reports in one place. Your account is ready under this address. To set your password:\n\n![PAX](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/home.jpg)\n\n1. Open sign in\n2. Choose Forgot password\n3. Enter the code that arrives by email, then your new password\n\n[Sign in]({{SIGNIN_URL}})\n\nAssistant"
  },
  {
    "id": "f784b4c1-f68f-4778-ae9a-3c82eef70ec0",
    "kind": "Onboarding",
    "name": "Your login",
    "from": "assistant",
    "subject": "Your PAX login",
    "body": "**Your PAX login**\n\nHi {{RECIPIENT_NAME}},\n\nYour account is ready.\n\n![The sign-in page](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/home.jpg)\n\n**Username:** {{USERNAME}}\n\n**Password:** the one you set, or choose Forgot password on the sign-in page to set one\n\n[Sign in]({{SIGNIN_URL}})\n\nIf you didn't expect this, reply and I'll close the account.\n\nAssistant"
  },
  {
    "id": "b61002fc-f16c-468f-90e2-fcc80b521b17",
    "kind": "Onboarding",
    "name": "Password reset",
    "from": "assistant",
    "subject": "Reset your PAX password",
    "body": "**Reset your PAX password**\n\nSomeone asked to reset the password for this account. If it wasn't you, ignore this and nothing changes.\n\n![The sign-in page](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/home.jpg)\n\n**Username:** {{USERNAME}}\n\n**The link works for:** one hour\n\n[Choose a new password]({{RESET_URL}})\n\nAssistant"
  },
  {
    "id": "local-chat-flow-1-ask-in-plain-words",
    "kind": "Flows",
    "name": "Chat flow 1: Ask in plain words",
    "from": "assistant",
    "subject": "Ask me anything in Chat",
    "body": "**Ask me anything in Chat**\n\nHi {{RECIPIENT_NAME}},\n\nChat is where you ask me in plain words, from how a short performed to what a lift means. I answer from the record: the scored takes, the scripts, the shorts on file and the metric definitions. When a number isn't on file, I say so rather than make one up.\n\n![Chat](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/chat.jpg)\n\nNot sure where to start? The + menu's **Onboarding** holds twenty questions, each one teaching a page or the loop that joins them.\n\nEvery chat is saved under **Chats** in the sidebar, so you can pick one up where you left off.\n\n[Open Chat]({{PAGE_URL}})\n\nAssistant"
  },
  {
    "id": "local-chat-flow-2-write-and-record-a-video",
    "kind": "Flows",
    "name": "Chat flow 2: Write and record a video",
    "from": "assistant",
    "subject": "Write and record a video in Chat",
    "body": "**Write and record a video in Chat**\n\nHi {{RECIPIENT_NAME}},\n\nThe road from an idea to a video on file runs through one chat:\n\n1. Press the camera beside the box. I ask a few short questions, one at a time: who you are, your town, and why open primaries matter to you.\n2. I draft a script in your words: a hook under 12 words, one concrete number, about 25 seconds spoken, ending with what the viewer should do. Each line that leans on evidence carries its source.\n3. Revise it with me until it sounds like you.\n4. Press **Record** on the script card. The camera opens in the chat with a teleprompter that scrolls at your pace.\n5. Watch it back, give it a title and send it.\n\n![Recording in Chat](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/chat.jpg)\n\nThe take is kept in Clips, in Your library, where only you see it. Once it's kept, I show it inside two Yes on 3 templates; pick one to play your take in it.\n\n[Record a video]({{PAGE_URL}}?record=1)\n\nAssistant"
  },
  {
    "id": "local-chat-flow-3-skills",
    "kind": "Flows",
    "name": "Chat flow 3: Skills",
    "from": "assistant",
    "subject": "Set how I work for a whole chat",
    "body": "**Set how I work for a whole chat**\n\nHi {{RECIPIENT_NAME}},\n\nThe top of the + menu holds **Skills**. Pick one and it rides the chat as a chip in the box, shaping every answer after it until you drop it.\n\n![The + menu, Skills at its top](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/chat.jpg)\n\n- **Script doctor** tightens a script to the house rules and lists each change.\n- **Read a test** explains a message test's result to someone who has never read one.\n- **Pick the audience** proposes video and audience pairings to test next.\n- **Draft a survey question** writes a neutral question, matched to America Thinks.\n- **Brief a partner** turns what the chat found into a short update.\n- **Make a video** turns a result into a video from a template.\n\nTry **Read a test** and name a report, then ask your follow-ups in the same chat.\n\n[Pick a skill]({{PAGE_URL}})\n\nAssistant"
  },
  {
    "id": "local-chat-flow-4-ask-about-the-page-on-screen",
    "kind": "Flows",
    "name": "Chat flow 4: Ask about the page on screen",
    "from": "assistant",
    "subject": "Ask about the page in front of you",
    "body": "**Ask about the page in front of you**\n\nHi {{RECIPIENT_NAME}},\n\nHold Shift and drag across a blank part of any page, and a note opens where you drew it, as large as you drew it. Switch it from **Note** to **Chat** in its header, type your question, and press Shift Enter.\n\n![A note drawn on America Thinks](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/block-menu.jpg)\n\nEach question carries the page you have open, and the one beside it in the second panel, so I answer from the numbers on show: a question's Crosstab in America Thinks, a row in Lift, a report. The chat stays with the note, and the note keeps itself under **My notes** in the Inbox.\n\nThe rest of Chat, from the + menu to recording, is in the guide.\n\n[Read the Chat guide]({{SITE_URL}}/docs/chat)\n\nAssistant"
  },
  {
    "id": "local-lift-flow-1-read-a-lift",
    "kind": "Flows",
    "name": "Lift flow 1: Read a lift",
    "from": "assistant",
    "subject": "Read Lift in a minute",
    "body": "**Read Lift in a minute**\n\nHi {{RECIPIENT_NAME}},\n\nLift sets every tested video's effect side by side, so a strong result stands out from an ordinary one before you scale it.\n\n[![Read a result in Lift](https://d19bx9wfmnrb34.cloudfront.net/docs/videos/guide-lift-analysis.play.jpg)]({{SITE_URL}}/docs/lift-analysis)\n\nEach row is a video and each column one measure: Support and Comprehension for the message tests. In each cell:\n\n- The small number at the left is the placebo group's level.\n- The bar runs from it by the lift, in percentage points, and the number past its tip is the lift.\n- A lift drawn in grey didn't clear its test: the test couldn't tell it from no effect.\n\n[Open Lift]({{PAGE_URL}})\n\nAssistant"
  },
  {
    "id": "local-lift-flow-2-what-one-lift-means",
    "kind": "Flows",
    "name": "Lift flow 2: What one lift means",
    "from": "assistant",
    "subject": "What one lift means",
    "body": "**What one lift means**\n\nHi {{RECIPIENT_NAME}},\n\nClick any lift in the table and Lift Analysis opens beside it:\n\n1. **Result**: each group's level and sample size, the lift with four bars for its strength, and its 90% interval. An interval that crosses zero means the test couldn't tell the effect from none.\n2. **Benchmarks**: where the lift falls among every other on the same measure and segment, across all tests, the folder's own and this test, by fifths.\n3. **Compare Rank**: every video in the same test, ranked on this measure.\n4. **Explainer**, the second tab: all of it in plain sentences.\n\n![Lift Analysis beside the table, at half the page](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/lift-analysis.jpg)\n\nThe ‹ › arrows in the toolbar step to the row before or after, and the panel follows.\n\n[Open Lift]({{PAGE_URL}})\n\nAssistant"
  },
  {
    "id": "local-lift-flow-3-every-segment-at-once",
    "kind": "Flows",
    "name": "Lift flow 3: Every segment at once",
    "from": "assistant",
    "subject": "See every segment at once",
    "body": "**See every segment at once**\n\nHi {{RECIPIENT_NAME}},\n\nBelow Everyone, each video's lift breaks down by age, education, gender, party and more. The heatmap lays every segment out at once.\n\n![The heatmap view](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/lift-heatmap.jpg)\n\nIn the toolbar's ⋮ menu, choose **View**, then **Heatmap**. Each cell is coloured by how far it sits from the benchmark, and **Benchmark** in the same menu sets what that is: the median of every lift on file, or zero. The key on the toolbar reads the colours.\n\n[Open Lift]({{PAGE_URL}})\n\nAssistant"
  },
  {
    "id": "local-lift-flow-4-filter-share-and-the-archive",
    "kind": "Flows",
    "name": "Lift flow 4: Filter, share and the Archive",
    "from": "assistant",
    "subject": "Filter Lift down, then share exactly that",
    "body": "**Filter Lift down, then share exactly that**\n\nHi {{RECIPIENT_NAME}},\n\nThe toolbar's ⋮ **Filter** keeps only what you need: which waves the table reads and, for each measure, only the results that clear their test. The sidebar's Treatments, Metrics and Segments checklists take rows and columns out.\n\n[![Filter Lift and keep favorites](https://d19bx9wfmnrb34.cloudfront.net/docs/videos/guide-lift-filters.play.jpg)]({{SITE_URL}}/docs/lift-sidebar)\n\nThen **Share** in the same menu copies a link to exactly what you're looking at, and **Download** saves the table as a CSV.\n\nTo set a result against what campaigns' own experiments found, switch the sidebar's folder to the **Archive**: 1,583 effects from randomized persuasion experiments campaigns ran on their own ads.\n\n[Read the Lift guide]({{SITE_URL}}/docs/lift)\n\nAssistant"
  },
  {
    "id": "local-america-thinks-flow-1-where-opinion-stands",
    "kind": "Flows",
    "name": "America Thinks flow 1: Where opinion stands",
    "from": "assistant",
    "subject": "Start from where opinion stands",
    "body": "**Start from where opinion stands**\n\nHi {{RECIPIENT_NAME}},\n\nEvery message rests on a guess about what voters already believe. America Thinks swaps the guess for the record: the General Social Survey, ANES and CES beside public polls, official results, the census, and turnout, voting-age and enrollment records.\n\n![America Thinks](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/america-thinks.jpg)\n\nPick a topic under **Index** in the sidebar. Each row is one question, its headline after the dash. Click one and it opens beside the list.\n\n[Open America Thinks]({{PAGE_URL}})\n\nAssistant"
  },
  {
    "id": "local-america-thinks-flow-2-one-question-five-views",
    "kind": "Flows",
    "name": "America Thinks flow 2: One question, five views",
    "from": "assistant",
    "subject": "One question, five ways to read it",
    "body": "**One question, five ways to read it**\n\nHi {{RECIPIENT_NAME}},\n\nOpen a question and the toggle in its bar switches the view:\n\n- **Data**: every figure, newest wave first, the total before its groups.\n- **Crosstab**: the answers broken down by group, each share with its margin.\n- **Trend**: how it moved across the years it was asked.\n- **Topline**: the wording as asked, and every answer at the latest wave with the earlier waves beside it.\n- **Global view**: all of them in one column.\n\n![A question open beside the list](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/america-thinks-question.jpg)\n\nRead the wording before the numbers: two surveys can ask the same thing differently.\n\n[Pick a question]({{PAGE_URL}})\n\nAssistant"
  },
  {
    "id": "local-america-thinks-flow-3-marks-and-sources",
    "kind": "Flows",
    "name": "America Thinks flow 3: Marks and sources",
    "from": "assistant",
    "subject": "Keep the questions you come back to",
    "body": "**Keep the questions you come back to**\n\nHi {{RECIPIENT_NAME}},\n\nEach row in America Thinks carries three marks:\n\n- **The box** adds the question as a column, so several read side by side.\n- **The arrow** marks it Important.\n- **The star** adds it to Favorites.\n\n![The sidebar open beside America Thinks](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/sidebar.jpg)\n\n**Favorites** and **Important** in the sidebar then list just those, and the **Data** group at the sidebar's foot browses one source at a time.\n\n[Open America Thinks]({{PAGE_URL}})\n\nAssistant"
  },
  {
    "id": "local-america-thinks-flow-4-results-against-the-norm",
    "kind": "Flows",
    "name": "America Thinks flow 4: Results against the norm",
    "from": "assistant",
    "subject": "Read a result against where opinion stands",
    "body": "**Read a result against where opinion stands**\n\nHi {{RECIPIENT_NAME}},\n\nA lift says how far a video moved people; America Thinks says where opinion stood to begin with. Open the two side by side: on Lift, hover **America Thinks** in the sidebar and click its arrow, and it opens in a second panel. Drag the line between them to resize.\n\n[![Open a second panel](https://d19bx9wfmnrb34.cloudfront.net/docs/videos/guide-second-panel.play.jpg)]({{SITE_URL}}/docs/second-panel)\n\nFor one idea measured across every survey that asked it, however each one worded it, open **Constructs**: each with every source it's asked in, its latest figures and its trend.\n\n[Read the America Thinks guide]({{SITE_URL}}/docs/america-thinks)\n\nAssistant"
  },
  {
    "id": "local-studio-flow-1-templates-and-versions",
    "kind": "Flows",
    "name": "Studio flow 1: Templates and versions",
    "from": "assistant",
    "subject": "Every video template, in one place",
    "body": "**Every video template, in one place**\n\nHi {{RECIPIENT_NAME}},\n\nStudio is where the video templates live: the templates themselves, the graphics the Enhance flow draws, and every version you've made in Chat.\n\n[![Every template in Studio](https://d19bx9wfmnrb34.cloudfront.net/docs/videos/record-studio.play.jpg)]({{SITE_URL}}/docs/studio)\n\nPick a composition in the list at the left. The canvas plays it, the timeline scrubs to any frame, and the panel at the right shows the props it was made from: the same data Chat filled in.\n\n[Open Studio]({{PAGE_URL}})\n\nAssistant"
  },
  {
    "id": "local-studio-flow-2-from-chat-to-studio",
    "kind": "Flows",
    "name": "Studio flow 2: From Chat to Studio",
    "from": "assistant",
    "subject": "Make a video in Chat, check it in Studio",
    "body": "**Make a video in Chat, check it in Studio**\n\nHi {{RECIPIENT_NAME}},\n\nVersions are made in Chat and checked here:\n\n1. In Chat, ask for a video in plain words: “Make a lift card for the best-tested video.”\n2. I fill a template from the figures on file. The video plays in my reply, saved as your next version of that template.\n3. Ask for a change and I write it again as a new version. The old one stays.\n4. **Open in Studio** under the video opens that exact version here, every frame and every prop.\n\n[![Make videos in Chat](https://d19bx9wfmnrb34.cloudfront.net/docs/videos/record-chat.play.jpg)]({{SITE_URL}}/docs/videos-in-chat)\n\n[How Chat makes videos]({{SITE_URL}}/docs/videos-in-chat)\n\nAssistant"
  },
  {
    "id": "local-studio-flow-3-graphics",
    "kind": "Flows",
    "name": "Studio flow 3: Graphics",
    "from": "assistant",
    "subject": "The graphics beside the templates",
    "body": "**The graphics beside the templates**\n\nHi {{RECIPIENT_NAME}},\n\nBelow the templates, Studio's **Graphics** folder holds the cards the Enhance flow draws: a checklist, a callout, a stat, a quote, an intro and an end card. Each takes an optional backdrop, a recorded take that plays under it.\n\n![Studio](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/studio.jpg)\n\nIn Chat, the + menu's **Graphics** draws a script's cards; here you check each one frame by frame.\n\n[Open Studio]({{PAGE_URL}})\n\nAssistant"
  },
  {
    "id": "local-studio-flow-4-studio-beside-chat",
    "kind": "Flows",
    "name": "Studio flow 4: Studio beside Chat",
    "from": "assistant",
    "subject": "Keep Studio open beside Chat",
    "body": "**Keep Studio open beside Chat**\n\nHi {{RECIPIENT_NAME}},\n\nOpen **Tools** at the top right of any page and choose **Studio**: it sits beside the page you're on. Keep it there while you work in Chat, and every version Chat saves loads into it as it lands, so each change is checked the moment it's made.\n\n![Studio beside Chat](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/studio.jpg)\n\nWhen a version is right, **Get MP4** under the video in Chat renders the file.\n\n[Read the Studio guide]({{SITE_URL}}/docs/studio)\n\nAssistant"
  },
  {
    "id": "local-inbox-flow-1-three-agents",
    "kind": "Flows",
    "name": "Inbox flow 1: Three agents",
    "from": "assistant",
    "subject": "Mail between you and three agents",
    "body": "**Mail between you and three agents**\n\nHi {{RECIPIENT_NAME}},\n\nThe Agentic Inbox is mail between you and three agents, each with an address of its own. Send a task and the work comes back as replies on the same thread.\n\n![The Agentic Inbox](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/inbox.jpg)\n\n- **The Pollster** sends consensus conversations, surveys and tests to a contact group.\n- **The Analyst** writes the question cards, toplines and readouts.\n- **The Assistant** sends the notices, reminders, digests and onboarding mail, this one included.\n\n[Open the Agentic Inbox]({{PAGE_URL}})\n\nAssistant"
  },
  {
    "id": "local-inbox-flow-2-field-a-survey-or-a-test",
    "kind": "Flows",
    "name": "Inbox flow 2: Field a survey or a test",
    "from": "assistant",
    "subject": "Run a survey or a test",
    "body": "**Run a survey or a test**\n\nHi {{RECIPIENT_NAME}},\n\nA survey or test runs end to end on one thread:\n\n1. Under **Templates** in the Agentic Inbox's sidebar, **New test** or **New survey** opens a request to the Pollster.\n2. Fill in the test or survey, a quota and a close date, and add a group from the address book as a recipient.\n3. The Pollster mails each member a link of their own, tracks who opened, started and finished, and reminds whoever hasn't.\n4. It closes at the quota or the deadline, and the Analyst's readout lands on the same thread.\n\n![A test request to the Pollster](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/inbox.jpg)\n\nSending a task needs a staff account.\n\n[Open the Agentic Inbox]({{PAGE_URL}})\n\nAssistant"
  },
  {
    "id": "local-inbox-flow-3-templates",
    "kind": "Flows",
    "name": "Inbox flow 3: Templates",
    "from": "assistant",
    "subject": "Start from a template",
    "body": "**Start from a template**\n\nHi {{RECIPIENT_NAME}},\n\nEvery message that goes out more than once has a template: invitations, reminders, updates, results and account mail. Open **Templates** in the Agentic Inbox's sidebar and pick one, and the composer fills with it. The parts in capitals between double braces are the ones you fill in.\n\n![Templates in the Agentic Inbox](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/inbox.jpg)\n\nEach goes out in the same design: the mark, a white card headed by the message's first line, and its details in a pale panel. This mail started as one.\n\n[Open the Agentic Inbox]({{PAGE_URL}})\n\nAssistant"
  },
  {
    "id": "local-inbox-flow-4-from-a-conversation-to-a-test",
    "kind": "Flows",
    "name": "Inbox flow 4: From a conversation to a test",
    "from": "assistant",
    "subject": "From a conversation to a test",
    "body": "**From a conversation to a test**\n\nHi {{RECIPIENT_NAME}},\n\nThe Agentic Inbox is where the loop meets. On a consensus survey's **Results** in Survey, **Make question card** sets the Open Primaries survey's questions beside the statements every group shared and the ones that split them, and hands the card to the Agentic Inbox as a New test for the Pollster.\n\n![A conversation's results](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/survey-results-surface.jpg)\n\nFrom there the send runs on one thread, and the readout comes back to it when the test closes. Your notes live here too, under **My notes** in the sidebar.\n\n[Read the Agentic Inbox guide]({{SITE_URL}}/docs/inbox)\n\nAssistant"
  },
  {
    "id": "local-survey-flow-1-agree-disagree-or-pass",
    "kind": "Flows",
    "name": "Survey flow 1: Agree, disagree or pass",
    "from": "assistant",
    "subject": "Where does the room agree?",
    "body": "**Where does the room agree?**\n\nHi {{RECIPIENT_NAME}},\n\nSurvey holds the consensus conversations. Each is a set of short statements, answered one at a time: **Agree**, **Disagree** or **Pass**. I find the opinion groups in the votes, so you see where a coalition already agrees, and where it splits, before you take a position.\n\n[![Answer a survey](https://d19bx9wfmnrb34.cloudfront.net/docs/videos/guide-survey.play.jpg)]({{SITE_URL}}/docs/answer-a-survey)\n\nOpen **Questions** under Consensus in the sidebar to answer a conversation's cards.\n\n[Answer the questions]({{PAGE_URL}}?s=questions)\n\nAssistant"
  },
  {
    "id": "local-survey-flow-2-from-answers-to-results",
    "kind": "Flows",
    "name": "Survey flow 2: From answers to results",
    "from": "assistant",
    "subject": "From your answers to where people agree",
    "body": "**From your answers to where people agree**\n\nHi {{RECIPIENT_NAME}},\n\n1. Answer each card: Agree, Disagree or Pass. The blue outline marks the next one you haven't answered, and the bar at the top counts your progress.\n2. When the last card leaves, the results open: the statements consensus emerged on, each with your own answer beside the room's.\n3. **Results** in the sidebar shows the whole conversation: where the groups agree, where they split, and every statement's shares.\n\n![The results under the Trinity rule](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/survey-results.jpg)\n\nChanged your mind? Once you finish, **Review my answers** brings every card back.\n\n[See the results]({{PAGE_URL}}?s=results)\n\nAssistant"
  },
  {
    "id": "local-survey-flow-3-two-rules-for-consensus",
    "kind": "Flows",
    "name": "Survey flow 3: Two rules for consensus",
    "from": "assistant",
    "subject": "Most agree, or every group agrees?",
    "body": "**Most agree, or every group agrees?**\n\nHi {{RECIPIENT_NAME}},\n\n“Most people agree” and “everyone agrees” aren't the same thing, and the results carry a switch so you can read the same votes both ways.\n\n![The results under the Walkthrough rule](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/survey-results-walkthrough.jpg)\n\n- **Trinity**: most of the room is on one side, and no opinion group has a majority on the other.\n- **Walkthrough**: every opinion group agrees at 7 in 10 or more. The least agreeable group decides, so a big group can't carry a small one.\n\nThe Walkthrough rule is stricter and slower to find anything; with few votes or a divided room it can come back empty. The switch is remembered in your browser.\n\n[Compare the rules]({{PAGE_URL}}?s=results)\n\nAssistant"
  },
  {
    "id": "local-survey-flow-4-toplines",
    "kind": "Flows",
    "name": "Survey flow 4: Toplines",
    "from": "assistant",
    "subject": "Ask everyone the same questions",
    "body": "**Ask everyone the same questions**\n\nHi {{RECIPIENT_NAME}},\n\nBeside the conversations, Survey keeps **Toplines**: surveys that ask everyone the same questions, with no video and no comparison group. The Open Primaries topline sets out its methodology and each question's shares, and its questions are America Thinks' own primaries items, worded the same way.\n\n![The topline's answer page](https://d19bx9wfmnrb34.cloudfront.net/docs/shots/survey.jpg)\n\n**Copy link** on the topline carries its answer page. Share it yourself, or ask the Pollster in the Agentic Inbox to mail it to a group, a link for each member.\n\n[Read about toplines]({{SITE_URL}}/docs/survey-toplines)\n\nAssistant"
  }
]
