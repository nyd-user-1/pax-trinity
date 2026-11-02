import { TEMPLATES, TEMPLATE_KINDS } from "@/lib/agents/templates"

import { shot } from "./media"
import { doc, type Doc } from "./types"

const SENDER: Record<string, string> = { tracker: "the Pollster", "bill-reader": "the Analyst", assistant: "Pax", brendan: "Brendan" }
const fields = (s: string) => [...new Set([...s.matchAll(/\{\{([A-Z_]+)\}\}/g)].map((m) => m[1]))]

export const INBOX: Doc[] = [
  {
    slug: "inbox",
    title: "The Inbox",
    category: "inbox",
    summary: "Mail between you and three agents. Send a task, and the work arrives as replies on the thread.",
    tags: ["Inbox", "Staff"],
    body: `The [Inbox](/inbox) is mail between you and three agents, each with its own address. Send a task; the work arrives as replies on the thread.

${shot("inbox", "The Inbox")}

## The agents

- **Pax**, the assistant, sends staff and partners their notices, reminders, digests and onboarding mail.
- **The Pollster** sends consensus conversations, surveys and tests. It mails each member of a contact group a link of their own, tracks who opened, started and finished, sends reminders, and closes when enough have answered or at the deadline.
- **The Analyst** writes the question cards, toplines and readouts.

Each survey or test sent out is one live thread that rewrites itself: the send, the reminders, the count, the close and the readout.

## Start work

- **New test** and **New survey** open a request to the Pollster.
- **Groups** in the address book are the audiences a survey or test goes to.
- [Templates](${doc("email-templates")}) start the common messages.

> Sending needs a staff account. While mail is being proved out, it reaches only approved addresses; mail to anyone else is held and counted.`,
  },
  {
    slug: "email-templates",
    title: "Email templates",
    category: "inbox",
    summary: `The ${TEMPLATES.length} messages the agents and staff send again and again, by kind.`,
    tags: ["Inbox", "Email"],
    body: `Every message that goes out more than once starts from a template. Pick one in the Inbox's composer and it fills the message; the parts in capitals between double braces are what you fill in.

Each is sent in the same design: the PAX mark, a white card headed by the message's first line, and its details in a pale panel.

${TEMPLATE_KINDS.filter((k) => TEMPLATES.some((t) => t.kind === k))
  .map(
    (k) => `## ${k}

| Template | From | Subject | Fills in |
|---|---|---|---|
${TEMPLATES.filter((t) => t.kind === k)
  .map((t) => `| **${t.name}** | ${SENDER[t.from] ?? t.from} | ${t.subject.replace(/\|/g, "/")} | ${fields(t.subject + t.body).map((f) => `\`${f}\``).join(" ")} |`)
  .join("\n")}`
  )
  .join("\n\n")}`,
  },
]
