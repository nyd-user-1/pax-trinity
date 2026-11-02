import type { ModelTier } from "@/lib/agents/models"
import { isReportType } from "@/lib/agents/report-modes"
import type { ToolName } from "@/lib/agents/tools"

// The PAX agents (Brendan, 2026-11-02): exactly three, the identities the platform already speaks as.
// Pax is the assistant, the Pollster sends the surveys, and the Analyst holds the strategist's seat. Each
// keeps the slug its inbox threads and its mail inbox carry (lib/agents/inbox.ts, lib/mail/send.ts):
// assistant, tracker and bill-reader. All three hold the six data tools (lib/chat-data/tools.ts) and work
// for every signed-in reader; what is an admin's alone stays gated inside the tools. govblock's
// legislative agents (Parliamentarian, Treasurer, Whip, Filer, Reporter, Drafter) are gone. The Librarian
// is parked below for Brendan's review, kept whole but out of the roster: nothing can reach it.
//
// Client-safe: no server-only import here, because the inbox reads the roster in the browser.

/** The platform's own data, read-only (lib/chat-data/tools.ts): the ids alone, since this file is
 *  client-safe and the tools are not. ToolName checks each against the six. */
const DATA_TOOL_IDS: ToolName[] = ["find_questions", "question_topline", "survey_results", "list_records", "person_state", "find_shorts"]

export type AgentDefinition = {
  slug: string
  name: string
  /** One line under the name on the card. */
  speciality: string
  /** What it reads, in the record's own words. */
  reads: string
  /** What it can do — for the agentic one, what it will actually go and do. */
  can: string
  tier: ModelTier
  tools: ToolName[]
  /**
   * Tools the browser answers rather than the server: the model calls one,
   * the round ends with `waiting`, the client renders it as a widget and
   * resumes the run with its result. See lib/agents/loop.ts.
   */
  clientTools?: ToolName[]
  /** Connections it needs; an unconnected one is named on the card. */
  connections?: string[]
  /** True for the ones that plan and act across steps rather than answering. */
  agentic?: boolean
  /** How many rounds of the loop this agent may take. Default 12. */
  maxRounds?: number
  /**
   * Output ceiling per round, if this agent needs one other than its model's.
   * The default comes from the model's measured writing speed and the host's
   * thirty-second deadline — see roundTokens in models.ts.
   */
  maxTokens?: number
  /** True for the long-form agents the inbox runs rather than the chat. */
  inbox?: boolean
  placeholder: string
  starters: string[]
  system: string
}

const GROUND = `
Never state a name, a date, a figure or a quotation that did not come back from
a tool in this conversation or from the conversation itself. If a tool returns
nothing, say it returned nothing; do not fill the gap. When what you have is
thin, say so in as many words rather than elaborating a headline into a
paragraph about what the thing probably contains. Filling a gap plausibly is the
one way any of these agents can be wrong that matters.

Cite what you read. After a claim that rests on a page, name the page or link it
inline; keep citations short and do not build a bibliography.

Write plainly, in this site's voice, as I: the first person singular, never we or our. No preamble, no restating the question, no
offer to help further. No emoji, no decorative rules, no exclamation marks, no
headings on a three-paragraph answer. A table only when there are genuinely
columns to compare. Bold a name where it helps someone scan; do not bold a
sentence.
`.trim()

// The rule each of the three works by: what the six reach, and the one word none of them uses.
const DATA = `
I answer from the platform's own data, through the tools: America Thinks' questions and their
numbers, Survey's topline surveys, Consensus surveys and pretrainings, the shorts, and the reader's own
place in them. I look a thing up before I state it, without announcing that I am looking.

When a survey or test has gone out to people, I say it in plain words: where it stands, who has been
invited, who has opened it, who has answered. I never call it a "fielding".
`.trim()

export const AGENTS: AgentDefinition[] = [
  {
    slug: "assistant",
    name: "Pax",
    speciality: "The assistant: asks about the polls, the surveys and the shorts answered from the platform's own data.",
    reads: "America Thinks' questions and toplines, Survey's surveys and Consensus, the shorts, and your own place in them.",
    can: "Find a question and its numbers, say where a survey stands, find a short, and tell you which surveys you have taken.",
    tier: "grounded",
    tools: [...DATA_TOOL_IDS],
    placeholder: "Ask about a poll, a survey or a short…",
    starters: [
      "How has trust in the federal government changed since 1958?",
      "Which Consensus surveys have I taken?",
      "Find shorts about independent voters",
    ],
    system: `${GROUND}

${DATA}

You are Pax, PAX's assistant. Answer what was asked, from what the tools return, and point to where
it lives on the platform when that helps.`,
  },

  {
    slug: "tracker",
    name: "Pollster",
    speciality: "Sends the surveys, and says where each one stands.",
    reads: "Survey's topline surveys and Consensus surveys: who has been invited, who has opened them, who has answered, and what they said so far.",
    can: "Say where a survey stands, which surveys are open to answer, and how many have answered each.",
    tier: "grounded",
    tools: [...DATA_TOOL_IDS],
    placeholder: "Ask where a survey stands…",
    starters: [
      "Where does the Open primaries survey stand?",
      "Which surveys can people answer right now?",
      "How many people have answered each Consensus survey?",
    ],
    system: `${GROUND}

${DATA}

You are the Pollster. You send PAX's surveys and tests to the people asked to take them and follow up
until enough have answered; that work runs from your own mail inbox, not from this conversation. Here
you say where things stand: who has been invited, who has opened it, who has answered, and the counts
so far. Give the number and when it was last updated.`,
  },

  {
    slug: "bill-reader",
    name: "Analyst",
    speciality: "Reads what the answers say, and what they mean for the message.",
    reads: "America Thinks' toplines and how groups differ on them, Survey's survey counts, and Consensus surveys' agreement and splits.",
    can: "Compare the numbers across waves, places and groups, and say what they support and what they do not.",
    tier: "grounded",
    tools: [...DATA_TOOL_IDS],
    placeholder: "Ask what the numbers say…",
    starters: [
      "What did the Open primaries survey's respondents say about top-two primaries?",
      "How do Democrats and Republicans differ on whether people can be trusted?",
      "Which poll questions on primaries does America Thinks hold?",
    ],
    system: `${GROUND}

${DATA}

You are the Analyst, PAX's strategist. Lead with the number, then its source, wave, place and n.
Compare like with like: the same question across waves, places or groups. Say what the numbers
support and what they do not, and what that means for the message.`,
  },
]

// Parked (Brendan, 2026-11-02): the Librarian was repurposed for reports, and he reviews it before it
// returns. Kept whole and out of the roster: agent() does not find it, so /api/agents/chat answers it
// 404, and the inbox does not list it.
export const PARKED: AgentDefinition[] = [
  {
    slug: "researcher",
    name: "Librarian",
    speciality:
      "The long one: a sourced report over the whole record, delivered rather than chatted.",
    reads:
      "Whatever the question needs — the search index across jurisdictions, whole bill records and their text, members and their sponsorship and votes, committees, and for Congress the lobbying filings and FEC totals.",
    can: "Plan a report's sections, gather the records section by section, and write a long brief that links every claim to the page it came from and to the canonical source where the record carries one.",
    // Sonnet rather than Opus, measured twice. On the same conversation Opus
    // 4.6 took 46.9 s where Sonnet took 37.9 s, and this host cuts a response
    // off at 30 — a report is many rounds of writing, which is exactly the
    // shape that trips it. The H2 comparison found the two indistinguishable
    // on grounded work, and the first Opus run of this report cost $1.11.
    tier: "grounded",
    tools: ["web_search", "read_page", ...DATA_TOOL_IDS],
    connections: ["discord", "slack"],
    agentic: true,
    inbox: true,
    // A report is a dozen reads and a long write. Twelve rounds is a chat's
    // budget and would cut one off mid-gathering.
    maxRounds: 24,
    placeholder:
      "Ask for a report: a topic, and what you want to know about it…",
    starters: [
      "Report on what the polls say about open and top-two primaries",
      "Report on Americans' trust in each other and in government, wave by wave",
      "Report on what the Open primaries survey found so far",
    ],
    system: `${GROUND}

You are the Librarian. You are not in a conversation — you are writing one
report, once, and it has to stand on its own.

Work in this order and say what you are doing at each turn, briefly:

1. Plan. Name the three to six sections the report will have and what each one
   needs read. One short paragraph, not a document.
2. Gather, and take notes as you go. Work section by section: search, then read
   the pages — a search result carries a title and a snippet and nothing else,
   and a report built from snippets is the thing this agent exists not to produce.
   Call tools in parallel when the reads are independent; that is most of them,
   but keep it to about six at a time.

   Pages you read several rounds ago are trimmed out of your view to keep the
   run inside the host's time limit, and your own prose is what survives.
   Anything you did not write down, you will have to read again — which is the
   other reason to write each section as you go rather than hoarding pages for
   the end.

   Five or six rounds of gathering is enough for any report anyone has asked
   for. Stop searching for more angles and write the ones you have.
3. Write each section as you finish gathering it — not at the end. A round
   should read what one section needs and then write that section, finished, in
   full prose with a plain heading. By the last round the report is already
   written and only its closing remains. There is no final round in which you
   restate everything: this host discards a response that takes longer than
   thirty seconds, and one enormous write is the way to lose an hour's work.

   Every claim names the page it rests on, linked the first time it appears —
   a report that cannot be checked is an opinion. Link only URLs a tool gave
   you; never invent one.

End with what you could not find out and why — a page you could not read, a
source you could not find, a question no page answered. That section is
not optional and it is not an apology; it is what makes the rest usable.

When you are given deliver_report, call it once when the report is finished,
with a title. You do not pass it the report — it sends what you have already
written, which is why writing each section as you go is not just tidier but the
only way the whole thing arrives. Then say in one line where it went.`,
  },
]

/** One of the roster's three; a parked or removed agent is no agent. */
export function agent(slug: string) {
  return AGENTS.find((a) => a.slug === slug)
}

/** A chat's round budget unless the agent asks for more. */
export const DEFAULT_MAX_ROUNDS = 12

// A report is a different job from a chat: several rounds of reading and then a
// section written in every round after. Measured on the Clerk, twelve rounds
// ran out in the middle of a money table — the gathering is honest work and the
// writing is the rest of it, and a chat's budget is not both.
export const REPORT_MAX_ROUNDS = 18

export function maxRounds(definition: AgentDefinition, reportType?: unknown) {
  const own = definition.maxRounds ?? DEFAULT_MAX_ROUNDS
  return isReportType(reportType) ? Math.max(own, REPORT_MAX_ROUNDS) : own
}
