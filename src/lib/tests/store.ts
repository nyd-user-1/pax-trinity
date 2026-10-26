import "server-only"

import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb"

import { SEED, type TestRecord } from "@/lib/tests/types"

export type { Choice, EntryQuestion, PanelConfig, Status, TestRecord } from "@/lib/tests/types"

// Message tests, one item per test in DynamoDB:
//
//   pax-trinity-tests   pk id   the whole TestRecord (src/lib/tests/types.ts)
//
// The seeded test (open-primaries-1) needs no item: getTest serves it from code when the table
// has no record for it, or when the table can't be reached (local dev without AWS credentials
// still runs the survey). Once an admin saves it in /message-tests, the saved item wins.

const TABLE = process.env.PAX_TRINITY_TESTS_TABLE ?? "pax-trinity-tests"
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.PAX2_REGION ?? "us-east-1" }), {
  marshallOptions: { removeUndefinedValues: true },
})

/** A stored item, with any field it predates filled from the seed's defaults. */
function normalize(item: Record<string, unknown>): TestRecord {
  const t = item as Partial<TestRecord>
  return {
    ...structuredClone(SEED),
    ...t,
    id: String(t.id),
    panel: t.panel ?? null,
  } as TestRecord
}

/** One test by id, or null for an id nobody set up. */
export async function getTest(id: string): Promise<TestRecord | null> {
  try {
    const { Item } = await client.send(new GetCommand({ TableName: TABLE, Key: { id } }))
    if (Item) return normalize(Item)
  } catch (err) {
    console.warn(`tests table unreachable (${(err as Error).name}); serving the seed only`)
  }
  return id === SEED.id ? structuredClone(SEED) : null
}

/** Every test, the seed included, newest first. reachable is false when the table could not be read. */
export async function listTests(): Promise<{ tests: TestRecord[]; reachable: boolean }> {
  const tests: TestRecord[] = []
  let reachable = true
  try {
    let start: Record<string, unknown> | undefined
    do {
      const page = await client.send(new ScanCommand({ TableName: TABLE, ExclusiveStartKey: start }))
      for (const item of page.Items ?? []) tests.push(normalize(item))
      start = page.LastEvaluatedKey
    } while (start)
  } catch (err) {
    console.warn(`tests table unreachable (${(err as Error).name}); listing the seed only`)
    reachable = false
  }
  if (!tests.some((t) => t.id === SEED.id)) tests.push(structuredClone(SEED))
  tests.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
  return { tests, reachable }
}

/** Write a whole record (the caller validates it first). created is true for a new id. */
export async function saveTest(t: TestRecord, opts: { create: boolean }): Promise<TestRecord> {
  const now = new Date().toISOString()
  const prior = opts.create ? null : await getTest(t.id)
  const record: TestRecord = { ...t, createdAt: prior?.createdAt ?? t.createdAt ?? now, updatedAt: now }
  await client.send(
    new PutCommand({
      TableName: TABLE,
      Item: record,
      // A create must not overwrite a test that already has the id.
      ...(opts.create ? { ConditionExpression: "attribute_not_exists(id)" } : {}),
    }),
  )
  return record
}
