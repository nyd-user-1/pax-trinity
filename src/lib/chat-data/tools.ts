import "server-only"

import { createHash } from "node:crypto"

import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb"
import type { Tool } from "@aws-sdk/client-bedrock-runtime"

import { PUBLISHED } from "@/components/clips/catalog"
import { videosMentioned } from "@/lib/chat-videos"
import { consensusStatements, divisiveStatements, share, standing, type Conversation } from "@/lib/consensus/data"
import { PRETRAININGS } from "@/lib/consensus/pretrainings"
import { conversation, conversations } from "@/lib/consensus/store"
import { events, fieldingIds, type FieldingDef } from "@/lib/fielding/store"
import { latestResult } from "@/lib/results/complete"
import { RESULT_SETS, type ResultSet } from "@/lib/results"
import { memberByEmail } from "@/lib/roles"
import { SURVEYS, surveyBySlug } from "@/lib/surveys/catalog"
import { buildBank, consensusOrigin, pretrainingOrigin, surveyOrigin, testOrigin, wordingKey } from "@/lib/surveys/question-bank"
import { topline as surveyTopline } from "@/lib/surveys/responses"
import { ENV, itemsFor } from "@/lib/tests/responses"
import { getTest, listTests } from "@/lib/tests/store"
import { list as listVersions } from "@/lib/video-versions"

import { atlas, searchQuestions, topline as questionTopline } from "./america-thinks"

// Chat's data tools (Brendan, 2026-11-02; the lead's review of the set the same night). Six, read-only:
// nothing here writes anything. Each wraps a reader the platform already has, and each answers small,
// since the model pays for every token it is handed: ten rows by default, twenty-five at most, long text
// cut, and `total` beside the rows so a count never needs a second call. Signed in only; a message test's
// questions and results, and who was invited to answer, are an admin's alone, as their pages are. What
// the store calls a fielding the tools call invitations: the word is not the readers' (Brendan, 2026-11-02). A person's state is
// their own, or anyone's for an admin, and holds only what their own pages show: their role and the
// Consensus surveys they have taken.

export type Viewer = { email: string; admin: boolean }

export type DataToolName = "find_questions" | "question_topline" | "survey_results" | "list_records" | "person_state" | "find_shorts"

type Property = { type: "string" | "integer"; description: string; enum?: string[] }
export type DataDefinition = { description: string; properties: Record<string, Property>; required?: string[] }

export const DATA_TOOLS: Record<DataToolName, DataDefinition> = {
  find_questions: {
    description:
      "Find survey questions by their words. Searches America Thinks (8,028 questions from the GSS, ANES, CES, census, turnout and public polls, with their wording, answer options and years) and Survey's own questions (the topline surveys, Consensus statements, pretrainings and, for an admin, the message tests' questions, each with where it was asked). Returns ids for question_topline.",
    properties: {
      q: { type: "string", description: "Words the question would contain, or a question's id." },
      where: { type: "string", description: "Which to search; both by default.", enum: ["america-thinks", "survey", "both"] },
      source: { type: "string", description: "America Thinks only: one source, e.g. GSS, ANES, CES, POLL." },
      limit: { type: "integer", description: "1–25, default 10." },
    },
    required: ["q"],
  },
  question_topline: {
    description:
      "One America Thinks question's numbers: each answer option's estimate at its latest wave (or a year you name), for the US or a state, with n, margin and the source's link; the lead option's trend across waves; and, with `by`, the crosstab by one breakdown. It lists the years, places and breakdowns it holds.",
    properties: {
      id: { type: "string", description: "The question's id, from find_questions." },
      geo: { type: "string", description: "A state's name, or US. Defaults to the highest place the question reaches." },
      by: { type: "string", description: "A breakdown it lists, e.g. party, age_bucket, education_4." },
      year: { type: "string", description: "A wave's year, e.g. 2016. Defaults to the latest." },
      source: { type: "string", description: "Only when the question is asked by more than one source." },
    },
    required: ["id"],
  },
  survey_results: {
    description:
      "Results of one of Survey's own: a topline survey (each question's answer counts and n), a Consensus survey (its statements with agree, disagree and pass shares, and the ones every group agreed on and the most divisive), or, for an admin, a message test (its responses so far: starts, completes and completes by arm; its arms; its outcomes' levels and lifts with their verdicts). This is where a test's completes are; list_records gives only its target.",
    properties: {
      kind: { type: "string", description: "Which kind of survey.", enum: ["survey", "consensus", "test"] },
      id: { type: "string", description: "Its slug or id, from list_records." },
    },
    required: ["kind", "id"],
  },
  list_records: {
    description:
      "List what the platform holds of one kind, with counts: topline surveys, Consensus conversations, pretrainings, published clips, your own template videos, and, for an admin, message tests, test results and invitations (each time a survey or test went out to a group: who was invited, how many opened it, when it closes). `q` filters by words in the title or id.",
    properties: {
      kind: { type: "string", description: "What to list.", enum: ["surveys", "conversations", "pretrainings", "clips", "my_videos", "tests", "results", "invitations"] },
      q: { type: "string", description: "Words the title or id holds." },
      limit: { type: "integer", description: "1–25, default 10." },
    },
    required: ["kind"],
  },
  person_state: {
    description:
      "Where a person stands: their role and the Consensus surveys they have taken (when, and how many statements they answered). Your own by default; an admin may name anyone by their exact email.",
    properties: {
      email: { type: "string", description: "An admin only: the person's exact email." },
    },
  },
  find_shorts: {
    description:
      "Find shorts PAX2 holds (the 5,379 baseline shorts, the feed and the tracked channels) by title words, a channel, a link or an id: each with its page, channel, views, Outlier Score and publish date.",
    properties: {
      q: { type: "string", description: "Title words, a channel's name, a YouTube link or an 11-character id." },
      limit: { type: "integer", description: "1–10, default 6." },
    },
    required: ["q"],
  },
}

export const DATA_TOOL_NAMES = Object.keys(DATA_TOOLS) as DataToolName[]
export const isDataTool = (name: string): name is DataToolName => name in DATA_TOOLS

/** The six as Converse's tool list. */
export function dataToolSpecs(): Tool[] {
  return DATA_TOOL_NAMES.map((name) => {
    const d = DATA_TOOLS[name]
    return { toolSpec: { name, description: d.description, inputSchema: { json: { type: "object", properties: d.properties, required: d.required ?? [] } } } }
  })
}

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const limitOf = (v: unknown, dflt: number, max: number) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), max) : dflt
}
const str = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim())
const matches = (q: string, ...fields: (string | undefined)[]) => {
  const ws = q.toLowerCase().split(/\s+/).filter(Boolean)
  const hay = fields.join(" ").toLowerCase()
  return ws.every((w) => hay.includes(w))
}
const ADMIN_ONLY = "That is an admin's alone, as its pages are."
/** A test's status in the readers' words: one taking answers is open. */
const statusWord = (s: string) => (s === "fielding" ? "open" : s)

/** Survey's places, for the bank: the tests only for an admin. */
async function bankOrigins(viewer: Viewer) {
  const [all, tests] = await Promise.all([conversations(), viewer.admin ? listTests().then((r) => r.tests) : []])
  return [...SURVEYS.map(surveyOrigin), ...all.map(consensusOrigin), ...tests.map(testOrigin), ...PRETRAININGS.map(pretrainingOrigin)]
}

async function findQuestions(input: Record<string, unknown>, viewer: Viewer) {
  const q = str(input.q)
  if (!q) return { error: "Say what the question is about." }
  const where = str(input.where) || "both"
  const limit = limitOf(input.limit, 10, 25)
  const out: Record<string, unknown> = {}
  if (where !== "survey") {
    const found = searchQuestions(await atlas(), q, { source: str(input.source) || undefined, limit })
    out.america_thinks = { total: found.total, questions: found.hits }
  }
  if (where !== "america-thinks") {
    const key = wordingKey(q)
    const bank = buildBank(await bankOrigins(viewer)).filter((b) => b.id === q || matches(q, b.text, b.id ?? "") || wordingKey(b.text) === key)
    out.survey = {
      total: bank.length,
      questions: bank.slice(0, limit).map((b) => ({ question: cut(b.text, 240), ...(b.id ? { id: b.id } : {}), options: b.options.slice(0, 8), asked_on: b.on.map((a) => `${a.title} (${a.kind})`) })),
    }
  }
  return out
}

const pct = (x: number) => Math.round(x)

function consensusResults(c: Conversation) {
  const stood = c.statements.filter(standing)
  const line = (s: Conversation["statements"][number]) => {
    const v = share(s.votes)
    return { tid: s.tid, statement: cut(s.text, 200), agree: pct(v.agree), disagree: pct(v.disagree), pass: pct(v.pass), saw: s.votes.seen }
  }
  return {
    title: c.title,
    participants: c.stats.voters,
    votes: c.stats.votes,
    opinion_groups: c.stats.groups,
    total: stood.length,
    statements: stood.slice(0, 25).map(line),
    every_group_agreed: consensusStatements(c).map((s) => s.tid),
    most_divisive: divisiveStatements(c).map((s) => s.tid),
  }
}

function resultSummary(r: ResultSet) {
  const arm = new Map(r.arms.map((a) => [a.id, a.name]))
  return {
    title: r.title,
    fielded: `${r.fielded.start} to ${r.fielded.end}`,
    sample: r.sample,
    simulated: r.simulated || undefined,
    arms: r.arms.map((a) => ({ id: a.id, name: a.name, role: a.role, n: a.nWeighted })),
    outcomes: r.outcomes.map((o) => ({ id: o.id, name: o.name })),
    toplines: r.toplines.slice(0, 25).map((t) => ({ arm: arm.get(t.armId) ?? t.armId, outcome: t.outcomeId, level: t.levelPct, lift_pp: t.liftPp, verdict: t.verdict })),
  }
}

async function surveyResults(input: Record<string, unknown>, viewer: Viewer) {
  const kind = str(input.kind)
  const id = str(input.id)
  if (!id) return { error: "Name the survey by its slug or id (list_records lists them)." }
  if (kind === "survey") {
    const s = surveyBySlug(id)
    if (!s) return { error: `No topline survey is called "${id}".`, surveys: SURVEYS.map((x) => x.slug) }
    const t = await surveyTopline(s)
    if (!t) return { error: "The survey's answers could not be read just now." }
    return { title: s.title, n: t.n, first: t.first, last: t.last, questions: s.questions.map((q) => ({ id: q.id, question: q.text, counts: t.counts[q.id] })) }
  }
  if (kind === "consensus") {
    const c = await conversation(id)
    if (!c) return { error: `No Consensus survey is called "${id}".` }
    return consensusResults(c)
  }
  if (kind === "test") {
    if (!viewer.admin) return { error: ADMIN_ONLY }
    const test = await getTest(id)
    if (!test) return { error: `No message test has the id "${id}".` }
    const [kept, items] = await Promise.all([latestResult(id).catch(() => null), itemsFor(id).catch(() => null)])
    // The register keeps a computed test under <id>-computed (lib/results/computed).
    const set = kept?.resultSet ?? RESULT_SETS.find((r) => r.id === id || r.id === `${id}-computed`) ?? null
    const byKind: Record<string, number> = {}
    const completesByArm: Record<string, number> = {}
    for (const it of items ?? []) {
      const k = String((it as { kind?: string }).kind ?? "")
      byKind[k] = (byKind[k] ?? 0) + 1
      const arm = (it as { arm?: string }).arm
      if (k === "complete" && arm) completesByArm[arm] = (completesByArm[arm] ?? 0) + 1
    }
    return {
      id: test.id,
      title: test.title,
      status: statusWord(test.status),
      target_per_arm: test.targetPerArm,
      responses: items ? { ...byKind, completes_by_arm: completesByArm } : "could not be read just now",
      result: set ? resultSummary(set) : null,
    }
  }
  return { error: "kind is survey, consensus or test." }
}

async function listRecords(input: Record<string, unknown>, viewer: Viewer) {
  const kind = str(input.kind)
  const q = str(input.q)
  const limit = limitOf(input.limit, 10, 25)
  const page = <T,>(rows: T[], text: (r: T) => string) => {
    const kept = q ? rows.filter((r) => matches(q, text(r))) : rows
    return { kind, total: kept.length, rows: kept.slice(0, limit) }
  }
  if (["tests", "results", "invitations"].includes(kind) && !viewer.admin) return { error: ADMIN_ONLY }
  switch (kind) {
    case "surveys":
      return page(SURVEYS.map((s) => ({ slug: s.slug, title: s.title, questions: s.questions.length, by: s.fieldedBy })), (r) => `${r.slug} ${r.title}`)
    case "conversations":
      return page((await conversations()).map((c) => ({ slug: c.slug, title: c.title, statements: c.statements.length, participants: c.stats.voters })), (r) => `${r.slug} ${r.title}`)
    case "pretrainings":
      return page(PRETRAININGS.map((p) => ({ slug: p.slug, title: p.title, questions: p.questions.length, seed: p.seed })), (r) => `${r.slug} ${r.title}`)
    case "clips":
      return page(
        PUBLISHED.filter((c) => c.visibility === "public").map((c) => ({ id: c.id, title: c.title, messenger: c.messenger, by: c.author.name, seconds: c.duration ? Math.round(c.duration) : undefined })),
        (r) => `${r.id} ${r.title} ${r.messenger ?? ""} ${r.by}`,
      )
    case "my_videos":
      return page((await listVersions(viewer.email)).map((v) => ({ id: v.id, title: v.title, template: v.templateId, version: v.version, made: v.createdAt.slice(0, 10), from: v.source })), (r) => `${r.id} ${r.title} ${r.template}`)
    case "tests":
      return page((await listTests()).tests.map((t) => ({ id: t.id, title: t.title, status: statusWord(t.status), arms: t.arms.length, target_per_arm: t.targetPerArm, updated: t.updatedAt?.slice(0, 10) ?? "seeded" })), (r) => `${r.id} ${r.title}`)
    case "invitations": {
      const ids = await fieldingIds()
      const rows = await Promise.all(
        ids.map(async (fid) => {
          const evs = await events(fid)
          const def = evs.find((e): e is FieldingDef => e.kind === "fielding")
          const count = (k: string) => evs.filter((e) => e.kind === k).length
          return { id: fid, title: def?.title ?? fid, type: def?.type, target: def?.target, group: def?.groupName, closes: def?.closeAt?.slice(0, 10), invited: count("invite"), opened: count("open"), closed: evs.some((e) => e.kind === "closed") }
        }),
      )
      return page(rows, (r) => `${r.id} ${r.title} ${r.target ?? ""}`)
    }
    case "results":
      return page(RESULT_SETS.map((r) => ({ id: r.id, title: r.title, fielded: r.fielded.end, sample: r.sample.raw, arms: r.arms.length, simulated: r.simulated || undefined })), (r) => `${r.id} ${r.title}`)
    default:
      return { error: "kind is surveys, conversations, pretrainings, clips, my_videos, tests, results or invitations." }
  }
}

// The Consensus answers by a reader, read by query: the compute role holds Query on the responses table, not GetItem.
let responses: DynamoDBDocumentClient | null = null
async function takenRow(slug: string, email: string) {
  responses ??= DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.PAX_TRINITY_TABLES_REGION ?? "us-east-2" }))
  const id = `${ENV}:u:${createHash("sha256").update(email.trim().toLowerCase()).digest("hex")}`
  const r = await responses.send(
    new QueryCommand({
      TableName: process.env.PAX_TRINITY_TEST_RESPONSES_TABLE ?? "pax-trinity-test-responses",
      KeyConditionExpression: "#t = :t AND #i = :i",
      ExpressionAttributeNames: { "#t": "test", "#i": "id" },
      ExpressionAttributeValues: { ":t": `consensus:${slug}`, ":i": id },
    }),
  )
  const it = r.Items?.[0] as { kind?: string; answers?: Record<string, string>; salient?: number[]; completedAt?: string } | undefined
  return it?.kind === "consensus" ? it : null
}

async function personState(input: Record<string, unknown>, viewer: Viewer) {
  const asked = str(input.email).toLowerCase()
  // One's own: no email, one's own, or one of one's own aliases (lib/roles.ts).
  const self = !asked || asked === viewer.email.toLowerCase() || (!!memberByEmail(asked) && memberByEmail(asked) === memberByEmail(viewer.email))
  if (!self && !viewer.admin) return { error: "Only an admin can look up someone else." }
  const email = self ? viewer.email : asked
  const member = memberByEmail(email)
  const all = await conversations()
  const taken = (
    await Promise.all(
      all.map(async (c) => {
        const row = await takenRow(c.slug, email).catch(() => null)
        return row ? { slug: c.slug, title: c.title, taken: row.completedAt?.slice(0, 10) ?? null, answered: Object.keys(row.answers ?? {}).length, marked_as_mattering: (row.salient ?? []).length } : null
      }),
    )
  ).filter((x) => x !== null)
  return { email, name: member?.name ?? null, role: member?.role ?? "member", consensus_taken: { total: taken.length, of: all.length, surveys: taken } }
}

async function findShorts(input: Record<string, unknown>) {
  const q = str(input.q)
  if (!q) return { error: "Give title words, a channel, a link or an id." }
  const limit = limitOf(input.limit, 6, 10)
  // The matcher wants most of a title's words; a few words that appear together in a title are a phrase.
  let found = await videosMentioned(q, limit)
  if (!found.length && q.length >= 4 && !/["“”]/.test(q)) found = await videosMentioned(`"${q}"`, limit)
  return {
    total: found.length,
    shorts: found.map((e) => ({ id: e.id, page: `/v/yt-${e.id}`, title: cut(e.title, 160), channel: e.channel || undefined, views: e.views, outlier_score: e.ratio != null ? Math.round(e.ratio * 100) / 100 : null, published: e.published?.slice(0, 10) ?? null })),
  }
}

/** Runs one data tool for a signed-in viewer. Never throws: a failure comes back as { error }. */
export async function runDataTool(name: DataToolName, input: Record<string, unknown>, viewer: Viewer | null): Promise<{ ok: boolean; payload: unknown }> {
  if (!viewer) return { ok: false, payload: { error: "Sign in to look things up." } }
  try {
    const payload =
      name === "find_questions"
        ? await findQuestions(input, viewer)
        : name === "question_topline"
          ? await questionTopline(await atlas(), { id: str(input.id), source: str(input.source) || undefined, geo: str(input.geo) || undefined, by: str(input.by) || undefined, year: str(input.year) || undefined })
          : name === "survey_results"
            ? await surveyResults(input, viewer)
            : name === "list_records"
              ? await listRecords(input, viewer)
              : name === "person_state"
                ? await personState(input, viewer)
                : await findShorts(input)
    const failed = !!payload && typeof payload === "object" && "error" in payload
    return { ok: !failed, payload }
  } catch (e) {
    console.warn(`chat data tool ${name} failed`, e)
    return { ok: false, payload: { error: `${name} could not read its store just now.` } }
  }
}
