import "server-only"

import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb"

import { seedEvents } from "@/lib/delivery/seed"
import { fold, type DeliveryEvent, type Item } from "@/lib/delivery/types"
import { ENV, ulid } from "@/lib/tests/responses"

// The Delivery Board's events, kept as the fieldings are (lib/fielding/store.ts): append-only, in the
// message tests' responses table under partitions of their own, so production's compute role needs
// nothing new (it may put and query that table, no more). An item's state is the fold of its events.
//
//   test (pk)              id (sk)     item
//   delivery:<partner>     <ULID>      ev "open" | "stage" | "assign" | "due" | "note" | "link" | "account"
//
// Local development adds the sample work in ./seed.ts ahead of the table's events, so the board has
// something to move; a deployed build shows only what was written.

const TABLE = process.env.PAX_TRINITY_TEST_RESPONSES_TABLE ?? "pax-trinity-test-responses"
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.PAX_TRINITY_TABLES_REGION ?? process.env.PAX2_REGION ?? "us-east-1" }), {
  marshallOptions: { removeUndefinedValues: true },
})

const partition = (partner: string) => `delivery:${partner}`

/** An item id: a ULID, lower-cased so it reads in a link. */
export const newItemId = () => ulid().toLowerCase()

export async function record(partner: string, event: DeliveryEvent) {
  await client.send(new PutCommand({ TableName: TABLE, Item: { test: partition(partner), id: ulid(), ...event, env: ENV, schema: 1 } }))
}

async function stored(partner: string): Promise<DeliveryEvent[]> {
  const out: DeliveryEvent[] = []
  let start: Record<string, unknown> | undefined
  do {
    const r = await client.send(new QueryCommand({ TableName: TABLE, KeyConditionExpression: "#t = :t", ExpressionAttributeNames: { "#t": "test" }, ExpressionAttributeValues: { ":t": partition(partner) }, ExclusiveStartKey: start }))
    for (const x of r.Items ?? []) if (x.env === ENV) out.push(x as DeliveryEvent)
    start = r.LastEvaluatedKey
  } while (start)
  return out
}

export type Ledger = { items: Item[]; owner: string | null }

/** A partner's work. reachable is false when the table could not be read (the sample still shows locally). */
export async function ledger(partner: string): Promise<Ledger & { reachable: boolean }> {
  const seed = ENV === "development" ? seedEvents(partner) : []
  try {
    return { ...fold(partner, [...seed, ...(await stored(partner))]), reachable: true }
  } catch (err) {
    console.warn(`delivery events unreachable (${(err as Error).name}); serving the sample only`)
    return { ...fold(partner, seed), reachable: false }
  }
}
