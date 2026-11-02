import "server-only"

import { createHash } from "node:crypto"

import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb"

import { asked, type Conversation } from "@/lib/consensus/data"
import { ENV } from "@/lib/tests/responses"

// A signed-in reader's answers to a consensus survey, kept so no one takes a survey twice (Brendan, 2026-11-02).
// One item per reader per survey, in the message tests' responses table (src/lib/tests/responses.ts):
//
//   test (pk)               id (sk)                       item
//   consensus:<slug>        <env>:u:<sha256 of email>     kind "consensus": the answers by statement, the ones
//                                                         marked as mattering more than most, completedAt
//
// The put refuses a second item for the same reader, so the first answers stand. The email itself is not
// stored. Development and production keep apart by the key's env. A signed-out reader's answers are not kept.

const TABLE = process.env.PAX_TRINITY_TEST_RESPONSES_TABLE ?? "pax-trinity-test-responses"
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.PAX_TRINITY_TABLES_REGION ?? "us-east-2" }), {
  marshallOptions: { removeUndefinedValues: true },
})

export type Answer = "agree" | "disagree" | "pass"
const ANSWERS: readonly string[] = ["agree", "disagree", "pass"]

/** A reader's answers: by statement id, and the statements marked as mattering more than most. */
export type Taken = { answers: Record<number, Answer>; salient: number[]; completedAt: string }
type TakenItem = Taken & { test: string; id: string; kind: "consensus"; env: string; schema: 1 }

const key = (slug: string, email: string) => ({ test: `consensus:${slug}`, id: `${ENV}:u:${createHash("sha256").update(email.trim().toLowerCase()).digest("hex")}` })

/** A body's answers when every asked statement has one of the three and nothing else rides along. */
export function validTaken(c: Conversation, body: unknown): { ok: true; answers: Record<number, Answer>; salient: number[] } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, error: "body must be an object" }
  const b = body as Record<string, unknown>
  const extra = Object.keys(b).filter((k) => k !== "answers" && k !== "salient")
  if (extra.length) return { ok: false, error: `unknown fields: ${extra.join(", ")}` }
  const a = b.answers
  if (typeof a !== "object" || a === null || Array.isArray(a)) return { ok: false, error: "answers must be an object" }
  const tids = new Set(asked(c).map((s) => s.tid))
  const given = a as Record<string, unknown>
  const unknown = Object.keys(given).filter((k) => !tids.has(Number(k)))
  if (unknown.length) return { ok: false, error: `unknown statements: ${unknown.join(", ")}` }
  const answers: Record<number, Answer> = {}
  for (const tid of tids) {
    const v = given[String(tid)]
    if (typeof v !== "string" || !ANSWERS.includes(v)) return { ok: false, error: `statement ${tid} has no answer` }
    answers[tid] = v as Answer
  }
  const s = b.salient ?? []
  if (!Array.isArray(s) || s.some((x) => typeof x !== "number" || !tids.has(x))) return { ok: false, error: "salient must list asked statements" }
  return { ok: true, answers, salient: [...new Set(s as number[])] }
}

/** The reader's answers to the survey, or null when they haven't taken it (or the table can't be read). */
export async function takenBy(slug: string, email: string): Promise<Taken | null> {
  try {
    const r = await client.send(new GetCommand({ TableName: TABLE, Key: key(slug, email) }))
    const it = r.Item as TakenItem | undefined
    return it?.kind === "consensus" ? { answers: it.answers, salient: it.salient ?? [], completedAt: it.completedAt } : null
  } catch (err) {
    console.warn(`consensus answers unreachable (${(err as Error).name})`)
    return null
  }
}

/** Keeps the reader's answers; false when they had already taken the survey, whose first answers stand. */
export async function keepTaken(slug: string, email: string, t: Omit<Taken, "completedAt">): Promise<boolean> {
  const item: TakenItem = { ...key(slug, email), kind: "consensus", answers: t.answers, salient: t.salient, completedAt: new Date().toISOString(), env: ENV, schema: 1 }
  try {
    await client.send(new PutCommand({ TableName: TABLE, Item: item, ConditionExpression: "attribute_not_exists(id)" }))
    return true
  } catch (err) {
    if ((err as Error).name === "ConditionalCheckFailedException") return false
    throw err
  }
}
