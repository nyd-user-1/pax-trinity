// The inbox's templates (Brendan, 2026-10-29): the messages a person or an agent
// sends again and again, by kind. Each lives in Resend, published, under the id
// kept here; the copy below is the same text as markdown, so picking one fills
// the composer. Agents send from their AgentMail inboxes (pax-pollster,
// pax-analyst, pax-assistant), a person from their own address. {{NAME}} marks
// what the sender fills in. Written by a script from the Resend side; edit both.

export type TemplateKind = "Consensus" | "Surveys" | "Tests" | "Results" | "Notifications" | "Reminders" | "Onboarding"

export const TEMPLATE_KINDS: TemplateKind[] = ["Consensus", "Surveys", "Tests", "Results", "Notifications", "Reminders", "Onboarding"]

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
    "body": "Hi {{RECIPIENT_NAME}},\n\nI'm gathering views on {{TOPIC}}. Read a few statements other people wrote, mark each one agree, disagree or pass, and add your own if something's missing. It takes about five minutes.\n\n[Join the conversation]({{CONVERSATION_URL}})\n\nPollster"
  },
  {
    "id": "ca3a509f-4371-4100-8922-fce660cada4c",
    "kind": "Consensus",
    "name": "Consensus summary",
    "from": "bill-reader",
    "subject": "What {{GROUP_NAME}} agree on",
    "body": "{{VOTERS}} people cast {{VOTES}} votes on {{STATEMENTS}} statements about {{TOPIC}}, and split into {{GROUP_COUNT}} opinion groups.\n\nEvery group agreed that “{{TOP_STATEMENT}}”. The sharpest divide was over “{{DIVISIVE_STATEMENT}}”.\n\n[See the groups]({{RESULTS_URL}})\n\nAnalyst"
  },
  {
    "id": "4251b473-cba9-44bc-bf29-bdbfe3a47f46",
    "kind": "Consensus",
    "name": "Question card ready",
    "from": "bill-reader",
    "subject": "Question card: {{CLIP_NAME}}",
    "body": "I turned the Consensus results into {{QUESTION_COUNT}} closed-ended questions for {{CLIP_NAME}}, each matched to America Thinks wording so it reads against the norm.\n\n[Review the card]({{CARD_URL}}) and approve it to hand the test to the Pollster.\n\nAnalyst"
  },
  {
    "id": "58307e18-6c0e-4040-88d1-a1e7debfef38",
    "kind": "Surveys",
    "name": "Survey invitation",
    "from": "tracker",
    "subject": "A few questions about {{TOPIC}}",
    "body": "Hi {{RECIPIENT_NAME}},\n\nI'm asking {{QUESTION_COUNT}} short questions about {{TOPIC}}. It takes about {{MINUTES}} minutes, and your answers stay anonymous.\n\n[Start the survey]({{SURVEY_URL}})\n\nPollster"
  },
  {
    "id": "b0372255-e04e-436f-8ac4-0657ccc4c345",
    "kind": "Surveys",
    "name": "Survey reminder",
    "from": "tracker",
    "subject": "Still time to answer: {{SURVEY_NAME}}",
    "body": "Hi {{RECIPIENT_NAME}},\n\nThe survey on {{TOPIC}} closes on {{CLOSE_DATE}}. If you've started, your answers are saved.\n\n[Pick up where you left off]({{SURVEY_URL}})\n\nPollster"
  },
  {
    "id": "4fb703cd-dab5-45f4-a1ce-63b17c4c27a1",
    "kind": "Surveys",
    "name": "Survey thank-you",
    "from": "tracker",
    "subject": "Thanks, you're on the {{GROUP_NAME}} panel",
    "body": "Hi {{RECIPIENT_NAME}},\n\nThanks for answering. I've added you to the {{GROUP_NAME}} panel, so I may ask you to watch a short video and answer a few questions in the coming weeks.\n\nYou can leave the panel any time from [your settings]({{SETTINGS_URL}}).\n\nPollster"
  },
  {
    "id": "00a24180-a1b3-46a7-ad53-5b1bc496964d",
    "kind": "Tests",
    "name": "Test invitation",
    "from": "tracker",
    "subject": "Watch a short video and answer {{QUESTION_COUNT}} questions",
    "body": "Hi {{RECIPIENT_NAME}},\n\nI have a short study for you: one video under a minute, then {{QUESTION_COUNT}} questions. It takes about {{MINUTES}} minutes.\n\n[Start the study]({{TEST_URL}})\n\nPollster"
  },
  {
    "id": "7ff83159-240a-46af-b3d7-5ecdb1641a8e",
    "kind": "Tests",
    "name": "Fielding started",
    "from": "tracker",
    "subject": "In the field: {{TEST_NAME}}",
    "body": "Hi {{RECIPIENT_NAME}},\n\n{{TEST_NAME}} went into the field today. I'm reaching {{SAMPLE_SIZE}} {{AUDIENCE}} across {{ARMS}} arms, and I expect to close on {{CLOSE_DATE}}.\n\nYou can watch the sample fill in on the [monitor]({{MONITOR_URL}}). I'll write again when it closes.\n\nPollster"
  },
  {
    "id": "b45af847-28fb-4972-b458-58dbc6e387e7",
    "kind": "Tests",
    "name": "Test reminder",
    "from": "tracker",
    "subject": "Your study closes in 48 hours",
    "body": "Hi {{RECIPIENT_NAME}},\n\nThe study I sent on {{SENT_DATE}} closes in 48 hours. It takes about {{MINUTES}} minutes.\n\n[Start the study]({{TEST_URL}})\n\nPollster"
  },
  {
    "id": "3afa6c38-97b1-4877-8b0e-59703da5bdd9",
    "kind": "Tests",
    "name": "Quota closed",
    "from": "tracker",
    "subject": "Closed: {{TEST_NAME}}",
    "body": "{{TEST_NAME}} reached its quota of {{COMPLETES}} completes on {{CLOSE_DATE}}: {{ARMS}} arms, each with at least {{MIN_ARM}}.\n\nThe Analyst has the data; the readout follows.\n\nPollster"
  },
  {
    "id": "9e62b372-de7b-426e-8218-b3dff4c9031b",
    "kind": "Results",
    "name": "Results readout",
    "from": "bill-reader",
    "subject": "Results: {{TEST_NAME}}",
    "body": "Hi {{RECIPIENT_NAME}},\n\n{{TEST_NAME}} closed with {{COMPLETES}} completes. The strongest treatment was {{TOP_TREATMENT}}, which moved support {{LIFT}} points (±{{MARGIN}}).\n\nThe full readout, with the subgroups and pairings, is in the [report]({{REPORT_URL}}).\n\nAnalyst"
  },
  {
    "id": "28efeb7e-f9ec-4823-b6a6-cd67cd4f5c8a",
    "kind": "Results",
    "name": "Survey topline",
    "from": "bill-reader",
    "subject": "Topline: {{SURVEY_NAME}}",
    "body": "{{SURVEY_NAME}} closed with {{COMPLETES}} completes. On {{HEADLINE_QUESTION}}, {{HEADLINE_RESULT}}.\n\nThe answers are filed in America Thinks under Responses, beside the norms for the same questions.\n\n[Read the topline]({{TOPLINE_URL}})\n\nAnalyst"
  },
  {
    "id": "e873eb08-fa4f-434b-b4a4-e5ee0492f37b",
    "kind": "Results",
    "name": "Lift updated",
    "from": "bill-reader",
    "subject": "Lift updated: {{TEST_NAME}}",
    "body": "Lift now includes {{TEST_NAME}}: {{ARM_COUNT}} treatments against the placebo, {{TOP_TREATMENT}} leading at {{LIFT}} points (±{{MARGIN}}).\n\n[Open Lift]({{LIFT_URL}})\n\nAnalyst"
  },
  {
    "id": "8eaa95f3-af62-4470-8261-522ddcfe0c6d",
    "kind": "Notifications",
    "name": "Cuts ready for review",
    "from": "brendan",
    "subject": "New cuts for {{PARTNER}}",
    "body": "Hi {{RECIPIENT_NAME}},\n\n{{CUT_COUNT}} new cuts for {{PARTNER}} are up on [Frame.io]({{FRAMEIO_URL}}).\n\nLeave a note on any frame you want changed and I'll fold it into the next version before the test fields on {{FIELD_DATE}}.\n\nBrendan"
  },
  {
    "id": "5f5654aa-b972-4440-8e4a-6eb55bc8d329",
    "kind": "Notifications",
    "name": "Clip ready to test",
    "from": "assistant",
    "subject": "{{CLIP_NAME}} is ready to test",
    "body": "{{CLIP_NAME}} passed review and its question card is approved.\n\nApprove the test and the Pollster sends it to {{GROUP_NAME}}.\n\n[Approve the test]({{APPROVE_URL}})\n\nAssistant"
  },
  {
    "id": "60a17086-59b0-4d40-8b4a-225349dab33a",
    "kind": "Notifications",
    "name": "Test approved",
    "from": "assistant",
    "subject": "Approved to field: {{TEST_NAME}}",
    "body": "{{APPROVER}} approved {{TEST_NAME}}. The Pollster sends it to {{GROUP_NAME}} today and expects to close by {{CLOSE_DATE}}.\n\nAssistant"
  },
  {
    "id": "c6467616-fc1b-4037-8c99-59b1e9e2b63e",
    "kind": "Notifications",
    "name": "Report filed",
    "from": "assistant",
    "subject": "Report filed: {{REPORT_NAME}}",
    "body": "{{REPORT_NAME}} is filed in Reports and attached to its clips.\n\n[Read the report]({{REPORT_URL}})\n\nAssistant"
  },
  {
    "id": "fd015258-0456-4999-9f12-2347c8d99a8b",
    "kind": "Reminders",
    "name": "Review reminder",
    "from": "assistant",
    "subject": "Reminder: review {{CLIP_NAME}} by {{DUE_DATE}}",
    "body": "{{CLIP_NAME}} is waiting on your notes in Frame.io. The test fields on {{FIELD_DATE}}, so notes by {{DUE_DATE}} make the next cut.\n\n[Open it in Frame.io]({{FRAMEIO_URL}})\n\nAssistant"
  },
  {
    "id": "d446ab11-70e0-42f2-9f70-d482913b1026",
    "kind": "Reminders",
    "name": "Approval reminder",
    "from": "assistant",
    "subject": "Waiting on your approval: {{TEST_NAME}}",
    "body": "{{TEST_NAME}} is ready and waiting on your approval. Approve by {{DUE_DATE}} to close before {{CLOSE_DATE}}.\n\n[Approve the test]({{APPROVE_URL}})\n\nAssistant"
  },
  {
    "id": "cc42f54e-014c-41cd-81fd-89cbbdbf92a7",
    "kind": "Reminders",
    "name": "Weekly digest",
    "from": "assistant",
    "subject": "This week on PAX",
    "body": "This week: {{CLIP_COUNT}} new clips, {{TESTS_IN_FIELD}} tests in the field, {{REPORTS_FILED}} reports filed.\n\nThe biggest move: {{TOP_LINE}}.\n\n[See the week]({{DIGEST_URL}})\n\nAssistant"
  },
  {
    "id": "f2daf280-6886-41b3-8be7-b60670d42cac",
    "kind": "Onboarding",
    "name": "Invitation",
    "from": "assistant",
    "subject": "{{INVITER}} invited you to PAX",
    "body": "Hi {{RECIPIENT_NAME}},\n\n{{INVITER}} invited you to PAX, where {{ORG_NAME}} sees its clips, surveys, tests, Lift and reports in one place.\n\nYour account is ready under this address. To set your password, open [sign in]({{SIGNIN_URL}}), choose Forgot password, and enter the code that arrives by email.\n\nAssistant"
  },
  {
    "id": "f784b4c1-f68f-4778-ae9a-3c82eef70ec0",
    "kind": "Onboarding",
    "name": "Your login",
    "from": "assistant",
    "subject": "Your PAX login",
    "body": "Hi {{RECIPIENT_NAME}},\n\nYour account is ready. Your username is {{USERNAME}}. [Sign in]({{SIGNIN_URL}}) with your password; if you haven't set one yet, choose Forgot password and enter the code that arrives by email.\n\nIf you didn't expect this, reply and I'll close the account.\n\nAssistant"
  },
  {
    "id": "b61002fc-f16c-468f-90e2-fcc80b521b17",
    "kind": "Onboarding",
    "name": "Password reset",
    "from": "assistant",
    "subject": "Reset your PAX password",
    "body": "Someone asked to reset the password for {{USERNAME}}.\n\n[Choose a new password]({{RESET_URL}}). The link works for one hour. If it wasn't you, ignore this and nothing changes.\n\nAssistant"
  }
]
