import "server-only"
import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb"

import { ENV, ulid } from "@/lib/tests/responses"

// A send, kept the way the responses are: append-only events in the
// message tests' responses table (src/lib/tests/responses.ts), under their own
// partitions. Production's compute role may put and query that table and
// nothing more, so nothing here updates in place; a send's state is the
// fold of its events.
//
//   test (pk)              id (sk)     item
// The partitions keep the names they were written under (stored keys, unchanged):
//   fieldings              <fid>       kind "index": one row per send, for the list
//   fielding:<fid>         def         kind "fielding": what was sent, to whom, by when
//   fielding:<fid>         <ULID>      kind "invite" | "open" | "reminder" | "closed" | "report"
//
// A respondent's link carries pid <fid>-<token>; the test and survey records
// already keep the pid, which is how a send counts who started and finished.

const TABLE = process.env.PAX_TRINITY_TEST_RESPONSES_TABLE ?? "pax-trinity-test-responses"
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.PAX_TRINITY_TABLES_REGION ?? "us-east-2" }), {
  marshallOptions: { removeUndefinedValues: true },
})

export type SendDef = {
  kind: "fielding"
  fid: string
  type: "test" | "survey"
  /** The test's id or the survey's slug. */
  target: string
  title: string
  group: string
  groupName: string
  /** Finished completes wanted: per arm for a test, in all for a survey. */
  quota: number
  closeAt: string
  remindAfterHours: number
  finalBeforeHours: number
  createdAt: string
}
export type InviteEvent = { kind: "invite"; pid: string; email: string; name: string; arm?: string; at: string; held?: boolean; error?: string }
export type OpenEvent = { kind: "open"; pid: string; at: string }
export type ReminderEvent = { kind: "reminder"; pid: string; round: "first" | "final"; at: string }
export type ClosedEvent = { kind: "closed"; at: string; reason: "quota" | "deadline" | "by hand" }
export type ReportEvent = { kind: "report"; at: string; results: unknown }
export type SendEvent = SendDef | InviteEvent | OpenEvent | ReminderEvent | ClosedEvent | ReportEvent

const partition = (fid: string) => `fielding:${fid}`

/** A send's id: a ULID, lower-cased so it reads in a link. */
export const newFid = () => ulid().toLowerCase()

/** A respondent's pid: the send's id, a dash, a token of their own. */
export const newPid = (fid: string) => `${fid}-${Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 10)}`

/** The send a pid belongs to, when it is one of ours. */
export const fidOf = (pid: string | null | undefined) => (pid && /^[0-9a-z]{26}-[0-9a-z]{4,}$/.test(pid) ? pid.slice(0, 26) : null)

async function put(item: Record<string, unknown>, unique = false) {
  await client.send(new PutCommand({ TableName: TABLE, Item: { ...item, env: ENV, schema: 1 }, ...(unique ? { ConditionExpression: "attribute_not_exists(id)" } : {}) }))
}

async function query(pk: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = []
  let start: Record<string, unknown> | undefined
  do {
    const r = await client.send(new QueryCommand({ TableName: TABLE, KeyConditionExpression: "#t = :t", ExpressionAttributeNames: { "#t": "test" }, ExpressionAttributeValues: { ":t": pk }, ExclusiveStartKey: start }))
    out.push(...((r.Items as Record<string, unknown>[]) ?? []))
    start = r.LastEvaluatedKey
  } while (start)
  return out.filter((x) => x.env === ENV)
}

export async function createSend(def: SendDef) {
  await put({ test: partition(def.fid), id: "def", ...def }, true)
  await put({ test: "fieldings", id: def.fid, kind: "index", fid: def.fid, title: def.title, type: def.type, createdAt: def.createdAt }, true)
}

export async function record(fid: string, event: Exclude<SendEvent, SendDef>) {
  await put({ test: partition(fid), id: ulid(), ...event })
}

/** An event written at most once, under a fixed key: false when another tick wrote it first. */
export async function recordOnce(fid: string, key: string, event: Exclude<SendEvent, SendDef>): Promise<boolean> {
  try {
    await put({ test: partition(fid), id: key, ...event }, true)
    return true
  } catch (error) {
    if ((error as { name?: string }).name === "ConditionalCheckFailedException") return false
    throw error
  }
}

export async function sendIds(): Promise<string[]> {
  return (await query("fieldings")).map((x) => String(x.fid)).sort().reverse()
}

export async function events(fid: string): Promise<SendEvent[]> {
  return (await query(partition(fid))).map((x) => x as unknown as SendEvent)
}
