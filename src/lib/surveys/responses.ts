import "server-only"

import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb"

import type { Survey } from "@/lib/surveys/catalog"
import { ENV } from "@/lib/tests/responses"

// Survey responses, in the message tests' append-only responses table
// (src/lib/tests/responses.ts) under their own partition:
//
//   test (pk)              id (sk)    item
//   survey:<slug>          <ULID>     kind "survey": the answers, keyed by America Thinks construct id
//
// The id is minted on the server, so it sorts by receipt. Nothing that identifies the respondent is
// stored: no cookie, no IP, no user agent. Every answer is checked against the survey's own options.

const TABLE = process.env.PAX_TRINITY_TEST_RESPONSES_TABLE ?? "pax-trinity-test-responses"
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.PAX_TRINITY_TABLES_REGION ?? process.env.PAX2_REGION ?? "us-east-1" }), {
  marshallOptions: { removeUndefinedValues: true },
})

export type SurveyItem = { test: string; id: string; kind: "survey"; answers: Record<string, string>; startedAt: string; completedAt: string; receivedAt: string; env: string; schema: 1 }

export const partition = (slug: string) => `survey:${slug}`

/** A body's answers when every question has one of its own options and nothing else rides along. */
export function validAnswers(survey: Survey, body: Record<string, unknown>): { ok: true; answers: Record<string, string>; startedAt: string } | { ok: false; error: string } {
  const extra = Object.keys(body).filter((k) => k !== "answers" && k !== "startedAt")
  if (extra.length) return { ok: false, error: `unknown fields: ${extra.join(", ")}` }
  const a = body.answers
  if (typeof a !== "object" || a === null || Array.isArray(a)) return { ok: false, error: "answers must be an object" }
  const answers = a as Record<string, unknown>
  const unknown = Object.keys(answers).filter((k) => !survey.questions.some((q) => q.id === k))
  if (unknown.length) return { ok: false, error: `unknown questions: ${unknown.join(", ")}` }
  for (const q of survey.questions) if (typeof answers[q.id] !== "string" || !q.options.includes(answers[q.id] as string)) return { ok: false, error: `answer ${q.id} is missing or not one of its options` }
  const startedAt = typeof body.startedAt === "string" && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(body.startedAt) ? body.startedAt : new Date().toISOString()
  return { ok: true, answers: answers as Record<string, string>, startedAt }
}

export async function putSurveyItem(item: SurveyItem) {
  await client.send(new PutCommand({ TableName: TABLE, Item: item, ConditionExpression: "attribute_not_exists(id)" }))
}

/** This deployment's responses to a survey (development and production keep apart), oldest first. */
export async function surveyItems(slug: string): Promise<SurveyItem[]> {
  const out: SurveyItem[] = []
  let start: Record<string, unknown> | undefined
  do {
    const r = await client.send(
      new QueryCommand({ TableName: TABLE, KeyConditionExpression: "#t = :t", ExpressionAttributeNames: { "#t": "test" }, ExpressionAttributeValues: { ":t": partition(slug) }, ExclusiveStartKey: start }),
    )
    out.push(...((r.Items as SurveyItem[]) ?? []))
    start = r.LastEvaluatedKey
  } while (start)
  return out.filter((x) => x.kind === "survey" && x.env === ENV)
}

export type Topline = { n: number; first: string | null; last: string | null; counts: Record<string, Record<string, number>> }

/** The survey's own state: how many answered, when, and each option's count. Null when the table can't be read. */
export async function topline(survey: Survey): Promise<Topline | null> {
  let items: SurveyItem[]
  try {
    items = await surveyItems(survey.slug)
  } catch (err) {
    console.warn(`survey responses unreachable (${(err as Error).name})`)
    return null
  }
  const counts: Record<string, Record<string, number>> = {}
  for (const q of survey.questions) counts[q.id] = Object.fromEntries(q.options.map((o) => [o, 0]))
  for (const it of items) for (const q of survey.questions) if (it.answers[q.id] in counts[q.id]) counts[q.id][it.answers[q.id]]++
  const times = items.map((x) => x.completedAt).sort()
  return { n: items.length, first: times[0] ?? null, last: times[times.length - 1] ?? null, counts }
}
