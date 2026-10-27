import "server-only"

import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb"

import { PUBLISHED } from "@/components/clips/catalog"
import { PLACEBO, type TestRecord } from "@/lib/tests/types"

// Message-test responses: one DynamoDB table, append-only.
//
//   test (pk)            id (sk)                 item
//   <test id>            <ULID>                  kind "start": a respondent pressed Start (arm, pid, startedAt)
//   <test id>            <ULID>                  kind "complete": the finished record from /test/<id>
//   <test id>            <ULID>                  kind "screenout": a respondent a gate turned away (the answers so far)
//
// The id is minted here on the server, so its time prefix is receipt time. Nothing that
// identifies the respondent is stored beyond the panel's own pid: no cookie, no IP, no user agent.
// Every record is checked against its test's own record (getTest), never a static list, and an
// arm's video against the published clip catalog. Only a test in the field records anything.

const TABLE = process.env.PAX_TRINITY_TEST_RESPONSES_TABLE ?? "pax-trinity-test-responses"
// The tables can sit in another region than Cognito, which PAX2_REGION names (the new account allows us-east-2 only).
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.PAX_TRINITY_TABLES_REGION ?? process.env.PAX2_REGION ?? "us-east-1" }), {
  marshallOptions: { removeUndefinedValues: true },
})

export const MAX_BYTES = 20_000

/** development or production, stamped on every item so dev walks can be told from the field. */
export const ENV = process.env.NODE_ENV === "production" ? "production" : "development"

export type StartItem = { test: string; id: string; kind: "start"; arm: string; pid: string | null; startedAt: string; receivedAt: string; env: string; schema: 1 }
export type RecordItem = {
  test: string
  id: string
  kind: "complete" | "screenout"
  pid: string | null
  arm: string
  src?: string
  startedAt: string
  completedAt: string
  answers: Record<string, string>
  comprehensionCorrect?: boolean
  watched?: number
  code?: string
  receivedAt: string
  env: string
  schema: 1
}
export type ResponseItem = StartItem | RecordItem

// -- ids -------------------------------------------------------------------------------

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

/** A ULID: 48 bits of milliseconds then 80 random bits, Crockford base32, so ids sort by time. */
export function ulid(now = Date.now()): string {
  let time = ""
  for (let t = now, i = 0; i < 10; i++, t = Math.floor(t / 32)) time = CROCKFORD[t % 32] + time
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  let rand = ""
  for (let i = 0; i < 16; i++) rand += CROCKFORD[bytes[i] % 32]
  return time + rand
}

// -- validation ------------------------------------------------------------------------

export type Invalid = { ok: false; error: string }
export type Valid<T> = { ok: true; value: T }
const fail = (error: string): Invalid => ({ ok: false, error })
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v)
const SKEW_MS = 5 * 60_000

function isoTime(v: unknown, now: number): number | null {
  if (typeof v !== "string" || v.length > 40 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(v)) return null
  const t = Date.parse(v)
  return Number.isFinite(t) && t <= now + SKEW_MS ? t : null
}

/** The panel's respondent id, as /test/<id>?pid= passed it: absent or null, or 1-128 characters
 *  with no control characters. Panels format their ids freely, so nothing stricter. */
function pidOf(v: unknown): { ok: true; pid: string | null } | Invalid {
  if (v === undefined || v === null) return { ok: true, pid: null }
  // eslint-disable-next-line no-control-regex
  if (typeof v !== "string" || v.length < 1 || v.length > 128 || /[\u0000-\u001f\u007f]/.test(v)) return fail("pid must be 1-128 characters")
  return { ok: true, pid: v }
}

/** The video an arm plays: the test's placebo source, or the published clip's own src. Null when
 *  the arm is not in the test, or its clip is missing from the catalog or has no playable file
 *  (a YouTube-only clip cannot play in the flow's video element). */
export function armSrc(test: TestRecord, arm: unknown): string | null {
  if (typeof arm !== "string" || !test.arms.includes(arm)) return null
  if (arm === PLACEBO) return test.placeboSrc
  return PUBLISHED.find((c) => c.id === arm)?.src || null
}

/** Every question the test asks, key -> the values its choices allow. */
function questionValues(test: TestRecord): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const q of test.entry) out.set(q.key, new Set(q.choices.map((c) => c.value)))
  out.set("ballot", new Set(test.ballot.choices.map((c) => c.value)))
  out.set("comprehension", new Set(test.comprehension.choices.map((c) => c.value)))
  return out
}

export function validateStart(test: TestRecord, body: Record<string, unknown>, now = Date.now()): Valid<Pick<StartItem, "arm" | "pid" | "startedAt">> | Invalid {
  const allowed = new Set(["kind", "test", "arm", "pid", "startedAt"])
  const extra = Object.keys(body).filter((k) => !allowed.has(k))
  if (extra.length) return fail(`unknown fields: ${extra.join(", ")}`)
  if (body.test !== test.id) return fail("test does not match the URL")
  if (typeof body.arm !== "string" || !test.arms.includes(body.arm)) return fail("arm is not one of the test's arms")
  if (!armSrc(test, body.arm)) return fail("the arm's clip is not a playable clip in the published catalog")
  if (isoTime(body.startedAt, now) === null) return fail("startedAt must be an ISO UTC time, not in the future")
  const pid = pidOf(body.pid)
  if (!pid.ok) return pid
  return { ok: true, value: { arm: body.arm, pid: pid.pid, startedAt: body.startedAt as string } }
}

// A complete record carries every field; a screenout carries the answers given before its gate.
// status and pid are optional so a page loaded before they existed still posts cleanly.
const RECORD_FIELDS = ["test", "status", "pid", "arm", "src", "startedAt", "completedAt", "answers", "comprehensionCorrect", "watched", "code"]
const REQUIRED = {
  complete: ["test", "arm", "src", "startedAt", "completedAt", "answers", "comprehensionCorrect", "watched", "code"],
  screenout: ["test", "arm", "startedAt", "completedAt", "answers"],
}

export function validateRecord(
  test: TestRecord,
  body: Record<string, unknown>,
  now = Date.now(),
): Valid<Omit<RecordItem, "test" | "id" | "receivedAt" | "env" | "schema">> | Invalid {
  const extra = Object.keys(body).filter((k) => !RECORD_FIELDS.includes(k))
  if (extra.length) return fail(`unknown fields: ${extra.join(", ")}`)
  const status = body.status ?? "complete"
  if (status !== "complete" && status !== "screenout") return fail("status must be complete or screenout")
  const missing = REQUIRED[status].filter((k) => !(k in body))
  if (missing.length) return fail(`missing fields: ${missing.join(", ")}`)
  const pid = pidOf(body.pid)
  if (!pid.ok) return pid
  if (body.test !== test.id) return fail("test does not match the URL")
  if (typeof body.arm !== "string" || !test.arms.includes(body.arm)) return fail("arm is not one of the test's arms")
  const expectedSrc = armSrc(test, body.arm)
  if (!expectedSrc) return fail("the arm's clip is not a playable clip in the published catalog")
  if (body.src !== undefined && body.src !== expectedSrc) return fail("src is not the video this arm plays")
  const started = isoTime(body.startedAt, now)
  const completed = isoTime(body.completedAt, now)
  if (started === null || completed === null) return fail("startedAt and completedAt must be ISO UTC times, not in the future")
  if (completed < started) return fail("completedAt is before startedAt")
  if (!isObject(body.answers)) return fail("answers must be an object")
  const questions = questionValues(test)
  const answers = body.answers
  const unknownKeys = Object.keys(answers).filter((k) => !questions.has(k))
  if (unknownKeys.length) return fail(`unknown answers: ${unknownKeys.join(", ")}`)
  for (const [key, values] of questions) {
    if (!(key in answers) && status === "screenout") continue
    if (typeof answers[key] !== "string" || !values.has(answers[key] as string)) return fail(`answer ${key} is missing or not one of its choices`)
  }
  if (body.comprehensionCorrect !== undefined) {
    if (typeof body.comprehensionCorrect !== "boolean") return fail("comprehensionCorrect must be a boolean")
    if (body.comprehensionCorrect !== (answers.comprehension === test.comprehension.correct))
      return fail("comprehensionCorrect does not match the comprehension answer")
  }
  if (body.watched !== undefined && (typeof body.watched !== "number" || !Number.isFinite(body.watched) || body.watched < 0 || body.watched > 1))
    return fail("watched must be a share between 0 and 1")
  if (body.code !== undefined && (typeof body.code !== "string" || !/^[0-9A-F]{8}$/.test(body.code))) return fail("code must be 8 hex characters")
  return {
    ok: true,
    value: {
      kind: status,
      pid: pid.pid,
      arm: body.arm,
      src: body.src as string | undefined,
      startedAt: body.startedAt as string,
      completedAt: body.completedAt as string,
      answers: answers as Record<string, string>,
      comprehensionCorrect: body.comprehensionCorrect as boolean | undefined,
      watched: body.watched as number | undefined,
      code: body.code as string | undefined,
    },
  }
}

// -- storage ---------------------------------------------------------------------------

export async function putItem(item: ResponseItem) {
  await client.send(new PutCommand({ TableName: TABLE, Item: item, ConditionExpression: "attribute_not_exists(id)" }))
}

export async function itemsFor(test: string): Promise<ResponseItem[]> {
  const out: ResponseItem[] = []
  let start: Record<string, unknown> | undefined
  do {
    const r = await client.send(
      new QueryCommand({ TableName: TABLE, KeyConditionExpression: "#t = :t", ExpressionAttributeNames: { "#t": "test" }, ExpressionAttributeValues: { ":t": test }, ExclusiveStartKey: start }),
    )
    out.push(...((r.Items as ResponseItem[]) ?? []))
    start = r.LastEvaluatedKey
  } while (start)
  return out
}
