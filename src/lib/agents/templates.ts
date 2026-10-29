// The inbox's templates (Brendan, 2026-10-29): three messages a human or an agent
// sends again and again. Each one lives in Resend, published, under the id kept
// here; the copy below is the same text as markdown, so picking one fills the
// composer. Agents send from their AgentMail inboxes (pax-pollster, pax-analyst),
// a person from their own address. {{NAME}} marks what the sender fills in.

export type Template = {
  /** The template's id in Resend. */
  id: string
  name: string
  /** Who sends it: a roster agent's slug or a staff handle (lib/agents/inbox.ts). */
  from: string
  subject: string
  body: string
  /** When it was last edited, for the list's date column. */
  at: string
}

export const TEMPLATES: Template[] = [
  {
    id: "7ff83159-240a-46af-b3d7-5ecdb1641a8e",
    name: "Fielding started",
    from: "tracker",
    subject: "In the field: {{TEST_NAME}}",
    body: [
      "Hi {{RECIPIENT_NAME}},",
      "{{TEST_NAME}} went into the field today. I'm reaching {{SAMPLE_SIZE}} {{AUDIENCE}} across {{ARMS}} arms, and I expect to close on {{CLOSE_DATE}}.",
      "You can watch the sample fill in on the [monitor]({{MONITOR_URL}}). I'll write again when it closes.",
      "Pollster",
    ].join("\n\n"),
    at: "2026-10-29T06:20:00-04:00",
  },
  {
    id: "9e62b372-de7b-426e-8218-b3dff4c9031b",
    name: "Results readout",
    from: "bill-reader",
    subject: "Results: {{TEST_NAME}}",
    body: [
      "Hi {{RECIPIENT_NAME}},",
      "{{TEST_NAME}} closed with {{COMPLETES}} completes. The strongest treatment was {{TOP_TREATMENT}}, which moved support {{LIFT}} points (±{{MARGIN}}).",
      "The full readout, with the subgroups and pairings, is in the [report]({{REPORT_URL}}).",
      "Analyst",
    ].join("\n\n"),
    at: "2026-10-29T06:20:00-04:00",
  },
  {
    id: "8eaa95f3-af62-4470-8261-522ddcfe0c6d",
    name: "Cuts ready for review",
    from: "brendan",
    subject: "New cuts for {{PARTNER}}",
    body: [
      "Hi {{RECIPIENT_NAME}},",
      "{{CUT_COUNT}} new cuts for {{PARTNER}} are up on [Frame.io]({{FRAMEIO_URL}}).",
      "Leave a note on any frame you want changed and I'll fold it into the next version before the test fields on {{FIELD_DATE}}.",
      "Brendan",
    ].join("\n\n"),
    at: "2026-10-29T06:20:00-04:00",
  },
]
