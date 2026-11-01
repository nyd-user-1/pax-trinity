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
    "body": "**What do you think about {{TOPIC}}?**\n\nHi {{RECIPIENT_NAME}},\n\nI'm gathering views on {{TOPIC}}. Read a few statements other people wrote, mark each one agree, disagree or pass, and add your own if something's missing.\n\n**Topic:** {{TOPIC}}\n\n**Time:** about five minutes\n\n[Join the conversation]({{CONVERSATION_URL}})\n\nPollster"
  },
  {
    "id": "ca3a509f-4371-4100-8922-fce660cada4c",
    "kind": "Consensus",
    "name": "Consensus summary",
    "from": "bill-reader",
    "subject": "Where people agree on {{TOPIC}}",
    "body": "**Where people agree on {{TOPIC}}**\n\nThe conversation on {{TOPIC}} split into {{GROUP_COUNT}} opinion groups.\n\n**Participants:** {{VOTERS}}\n\n**Votes:** {{VOTES}}\n\n**Statements:** {{STATEMENTS}}\n\nEvery group agreed that “{{TOP_STATEMENT}}”. The sharpest divide was over “{{DIVISIVE_STATEMENT}}”.\n\n[See the groups]({{RESULTS_URL}})\n\nAnalyst"
  },
  {
    "id": "4251b473-cba9-44bc-bf29-bdbfe3a47f46",
    "kind": "Consensus",
    "name": "Question card ready",
    "from": "bill-reader",
    "subject": "Question card: {{CLIP_NAME}}",
    "body": "**Question card: {{CLIP_NAME}}**\n\nI turned the Consensus results into closed-ended questions, each matched to America Thinks wording so it reads against the norm.\n\n**Clip:** {{CLIP_NAME}}\n\n**Questions:** {{QUESTION_COUNT}}\n\n**Next:** your approval hands the test to the Pollster\n\n[Review the card]({{CARD_URL}})\n\nAnalyst"
  },
  {
    "id": "58307e18-6c0e-4040-88d1-a1e7debfef38",
    "kind": "Surveys",
    "name": "Survey invitation",
    "from": "tracker",
    "subject": "A few questions about {{TOPIC}}",
    "body": "**A few questions about {{TOPIC}}**\n\nHi {{RECIPIENT_NAME}},\n\nI'm asking a few short questions about {{TOPIC}}, and your answers stay anonymous.\n\n**Questions:** {{QUESTION_COUNT}}\n\n**Time:** about {{MINUTES}} minutes\n\n[Start the survey]({{SURVEY_URL}})\n\nPollster"
  },
  {
    "id": "b0372255-e04e-436f-8ac4-0657ccc4c345",
    "kind": "Surveys",
    "name": "Survey reminder",
    "from": "tracker",
    "subject": "Still time to answer: {{SURVEY_NAME}}",
    "body": "**Still time to answer: {{SURVEY_NAME}}**\n\nHi {{RECIPIENT_NAME}},\n\nThe survey on {{TOPIC}} I sent on {{SENT_DATE}} is still open. If you've started, your answers are saved.\n\n**Closes:** {{CLOSE_DATE}}\n\n**Time:** about {{MINUTES}} minutes\n\n[Pick up where you left off]({{SURVEY_URL}})\n\nPollster"
  },
  {
    "id": "4fb703cd-dab5-45f4-a1ce-63b17c4c27a1",
    "kind": "Surveys",
    "name": "Survey thank-you",
    "from": "tracker",
    "subject": "Thanks for answering, {{RECIPIENT_NAME}}",
    "body": "**Thanks for answering**\n\nHi {{RECIPIENT_NAME}},\n\nYour answers are in. I've added you to a panel, so I may ask you to watch a short video and answer a few questions in the coming weeks.\n\n**Panel:** {{GROUP_NAME}}\n\nYou can leave it any time from [your settings]({{SETTINGS_URL}}).\n\nPollster"
  },
  {
    "id": "00a24180-a1b3-46a7-ad53-5b1bc496964d",
    "kind": "Tests",
    "name": "Test invitation",
    "from": "tracker",
    "subject": "Watch a short video and answer {{QUESTION_COUNT}} questions",
    "body": "**Watch a short video and answer {{QUESTION_COUNT}} questions**\n\nHi {{RECIPIENT_NAME}},\n\nI have a short study for you: one video, then a few questions about it.\n\n**Video:** under a minute\n\n**Questions:** {{QUESTION_COUNT}}\n\n**Time:** about {{MINUTES}} minutes\n\n[Start the study]({{TEST_URL}})\n\nPollster"
  },
  {
    "id": "7ff83159-240a-46af-b3d7-5ecdb1641a8e",
    "kind": "Tests",
    "name": "Fielding started",
    "from": "tracker",
    "subject": "In the field: {{TEST_NAME}}",
    "body": "**In the field: {{TEST_NAME}}**\n\nHi {{RECIPIENT_NAME}},\n\n{{TEST_NAME}} went into the field today. I'll write again when it closes.\n\n**Sample:** {{SAMPLE_SIZE}} {{AUDIENCE}}\n\n**Arms:** {{ARMS}}\n\n**Expected close:** {{CLOSE_DATE}}\n\n[Watch the sample fill]({{MONITOR_URL}})\n\nPollster"
  },
  {
    "id": "b45af847-28fb-4972-b458-58dbc6e387e7",
    "kind": "Tests",
    "name": "Test reminder",
    "from": "tracker",
    "subject": "Your study closes {{CLOSE_DATE}}",
    "body": "**Your study closes {{CLOSE_DATE}}**\n\nHi {{RECIPIENT_NAME}},\n\nThe study I sent on {{SENT_DATE}} is still waiting for you: one short video, then a few questions.\n\n**Closes:** {{CLOSE_DATE}}\n\n**Time:** about {{MINUTES}} minutes\n\n[Start the study]({{TEST_URL}})\n\nPollster"
  },
  {
    "id": "3afa6c38-97b1-4877-8b0e-59703da5bdd9",
    "kind": "Tests",
    "name": "Quota closed",
    "from": "tracker",
    "subject": "Closed: {{TEST_NAME}}",
    "body": "**Closed: {{TEST_NAME}}**\n\n{{TEST_NAME}} reached its quota, and the Analyst has the data. The readout follows.\n\n**Completes:** {{COMPLETES}}\n\n**Arms:** {{ARMS}}, each with at least {{MIN_ARM}}\n\n**Closed:** {{CLOSE_DATE}}\n\nPollster"
  },
  {
    "id": "9e62b372-de7b-426e-8218-b3dff4c9031b",
    "kind": "Results",
    "name": "Results readout",
    "from": "bill-reader",
    "subject": "Results: {{TEST_NAME}}",
    "body": "**Results: {{TEST_NAME}}**\n\nHi {{RECIPIENT_NAME}},\n\n{{TEST_NAME}} closed, and the full readout, with the subgroups and pairings, is in the report.\n\n**Completes:** {{COMPLETES}}\n\n**Strongest treatment:** {{TOP_TREATMENT}}\n\n**Lift on support:** {{LIFT}} points (±{{MARGIN}})\n\n[Read the report]({{REPORT_URL}})\n\nAnalyst"
  },
  {
    "id": "28efeb7e-f9ec-4823-b6a6-cd67cd4f5c8a",
    "kind": "Results",
    "name": "Survey topline",
    "from": "bill-reader",
    "subject": "Topline: {{SURVEY_NAME}}",
    "body": "**Topline: {{SURVEY_NAME}}**\n\nOn {{HEADLINE_QUESTION}}, {{HEADLINE_RESULT}}.\n\n**Completes:** {{COMPLETES}}\n\n**Filed in:** America Thinks, under Responses, beside the norms for the same questions\n\n[Read the topline]({{TOPLINE_URL}})\n\nAnalyst"
  },
  {
    "id": "e873eb08-fa4f-434b-b4a4-e5ee0492f37b",
    "kind": "Results",
    "name": "Lift updated",
    "from": "bill-reader",
    "subject": "Lift updated: {{TEST_NAME}}",
    "body": "**Lift updated: {{TEST_NAME}}**\n\nLift now includes {{TEST_NAME}}.\n\n**Treatments:** {{ARM_COUNT}} against the placebo\n\n**Leading:** {{TOP_TREATMENT}}, {{LIFT}} points (±{{MARGIN}})\n\n[Open Lift]({{LIFT_URL}})\n\nAnalyst"
  },
  {
    "id": "8eaa95f3-af62-4470-8261-522ddcfe0c6d",
    "kind": "Notifications",
    "name": "Cuts ready for review",
    "from": "brendan",
    "subject": "New cuts for {{PARTNER}}",
    "body": "**New cuts for {{PARTNER}}**\n\nHi {{RECIPIENT_NAME}},\n\nNew cuts for {{PARTNER}} are up on Frame.io. Leave a note on any frame you want changed and I'll fold it into the next version.\n\n**Cuts:** {{CUT_COUNT}}\n\n**Test fields:** {{FIELD_DATE}}\n\n[Open them in Frame.io]({{FRAMEIO_URL}})\n\nBrendan"
  },
  {
    "id": "5f5654aa-b972-4440-8e4a-6eb55bc8d329",
    "kind": "Notifications",
    "name": "Clip ready to test",
    "from": "assistant",
    "subject": "{{CLIP_NAME}} is ready to test",
    "body": "**{{CLIP_NAME}} is ready to test**\n\nIt passed review and its question card is approved. Approve the test and the Pollster sends it.\n\n**Clip:** {{CLIP_NAME}}\n\n**Goes to:** {{GROUP_NAME}}\n\n[Approve the test]({{APPROVE_URL}})\n\nAssistant"
  },
  {
    "id": "60a17086-59b0-4d40-8b4a-225349dab33a",
    "kind": "Notifications",
    "name": "Test approved",
    "from": "assistant",
    "subject": "Approved to field: {{TEST_NAME}}",
    "body": "**Approved to field: {{TEST_NAME}}**\n\n{{APPROVER}} approved it, and the Pollster sends it today.\n\n**Goes to:** {{GROUP_NAME}}\n\n**Expected close:** {{CLOSE_DATE}}\n\nAssistant"
  },
  {
    "id": "c6467616-fc1b-4037-8c99-59b1e9e2b63e",
    "kind": "Notifications",
    "name": "Report filed",
    "from": "assistant",
    "subject": "Report filed: {{REPORT_NAME}}",
    "body": "**Report filed: {{REPORT_NAME}}**\n\nThe report is filed and attached to its clips.\n\n**Filed in:** Reports, and on each of its clips\n\n[Read the report]({{REPORT_URL}})\n\nAssistant"
  },
  {
    "id": "fd015258-0456-4999-9f12-2347c8d99a8b",
    "kind": "Reminders",
    "name": "Review reminder",
    "from": "assistant",
    "subject": "Reminder: review {{CLIP_NAME}} by {{DUE_DATE}}",
    "body": "**Reminder: review {{CLIP_NAME}} by {{DUE_DATE}}**\n\n{{CLIP_NAME}} is waiting on your notes in Frame.io. Notes in by the due date make the next cut.\n\n**Notes due:** {{DUE_DATE}}\n\n**Test fields:** {{FIELD_DATE}}\n\n[Open it in Frame.io]({{FRAMEIO_URL}})\n\nAssistant"
  },
  {
    "id": "d446ab11-70e0-42f2-9f70-d482913b1026",
    "kind": "Reminders",
    "name": "Approval reminder",
    "from": "assistant",
    "subject": "Waiting on your approval: {{TEST_NAME}}",
    "body": "**Waiting on your approval: {{TEST_NAME}}**\n\nThe test is ready and waiting on your approval.\n\n**Approve by:** {{DUE_DATE}}\n\n**Closes by:** {{CLOSE_DATE}}, if approved on time\n\n[Approve the test]({{APPROVE_URL}})\n\nAssistant"
  },
  {
    "id": "cc42f54e-014c-41cd-81fd-89cbbdbf92a7",
    "kind": "Reminders",
    "name": "Weekly digest",
    "from": "assistant",
    "subject": "This week on PAX",
    "body": "**This week on PAX**\n\n**New clips:** {{CLIP_COUNT}}\n\n**Tests in the field:** {{TESTS_IN_FIELD}}\n\n**Reports filed:** {{REPORTS_FILED}}\n\nThe biggest move: {{TOP_LINE}}.\n\n[See the week]({{DIGEST_URL}})\n\nAssistant"
  },
  {
    "id": "f2daf280-6886-41b3-8be7-b60670d42cac",
    "kind": "Onboarding",
    "name": "Invitation",
    "from": "assistant",
    "subject": "{{INVITER}} invited you to PAX",
    "body": "**{{INVITER}} invited you to PAX**\n\nHi {{RECIPIENT_NAME}},\n\nPAX is where {{ORG_NAME}} sees its clips, surveys, tests, Lift and reports in one place. Your account is ready under this address. To set your password:\n\n1. Open sign in\n2. Choose Forgot password\n3. Enter the code that arrives by email, then your new password\n\n[Sign in]({{SIGNIN_URL}})\n\nAssistant"
  },
  {
    "id": "f784b4c1-f68f-4778-ae9a-3c82eef70ec0",
    "kind": "Onboarding",
    "name": "Your login",
    "from": "assistant",
    "subject": "Your PAX login",
    "body": "**Your PAX login**\n\nHi {{RECIPIENT_NAME}},\n\nYour account is ready.\n\n**Username:** {{USERNAME}}\n\n**Password:** the one you set, or choose Forgot password on the sign-in page to set one\n\n[Sign in]({{SIGNIN_URL}})\n\nIf you didn't expect this, reply and I'll close the account.\n\nAssistant"
  },
  {
    "id": "b61002fc-f16c-468f-90e2-fcc80b521b17",
    "kind": "Onboarding",
    "name": "Password reset",
    "from": "assistant",
    "subject": "Reset your PAX password",
    "body": "**Reset your PAX password**\n\nSomeone asked to reset the password for this account. If it wasn't you, ignore this and nothing changes.\n\n**Username:** {{USERNAME}}\n\n**The link works for:** one hour\n\n[Choose a new password]({{RESET_URL}})\n\nAssistant"
  }
]
