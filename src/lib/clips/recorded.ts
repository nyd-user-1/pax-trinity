import "server-only"

import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb"

import { CLIPS_CDN, type Clip } from "@/components/clips/catalog"
import { creatorOf } from "@/components/clips/desks"
import { DEMO_EMAILS } from "@/lib/demo"
import { ENV } from "@/lib/tests/responses"

// Recordings kept as clips (Brendan's order, through the lead, 2026-10-29): the take itself in the clips
// bucket under recorded/, played from the clips CDN as every cut in the catalog is; its row in the
// message tests' responses table under its own partition, inside the put and query the compute role
// already has. Rows are written once.
//
//   test (pk)   id (sk)        item
//   clips       rec-<ulid>     kind "clip": the take's key, title, caption, messenger, owner, length,
//                              visibility, script
//
// A recording is its owner's (Your library on /clips), everyone's too once its owner chose public when
// keeping it, and an arm any admin can field; a demo account's recordings stay in the demo world, as
// everything a demo account makes does. Chat keeps its recordings private; Clips' Record asks.

const TABLE = process.env.PAX_TRINITY_TEST_RESPONSES_TABLE ?? "pax-trinity-test-responses"
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.PAX_TRINITY_TABLES_REGION ?? "us-east-2" }), {
  marshallOptions: { removeUndefinedValues: true },
})
const PK = "clips"

export type RecordedItem = {
  test: typeof PK
  id: string
  kind: "clip"
  /** The take's key in the clips bucket: recorded/<id>.<ext>. */
  key: string
  contentType: string
  title: string
  caption: string | null
  visibility: "private" | "public"
  /** Who speaks in it, as the recorder gave their name. */
  messenger: string | null
  /** The recorder's email. */
  owner: string
  duration: number | null
  /** The script it was read from, when it came from Chat. */
  script: string | null
  createdAt: string
  env: string
  schema: 1
}

export const RECORDED_KEY = /^recorded\/rec-[0-9a-z]{26}\.(mp4|webm|mov)$/
export const recordedKey = (id: string, ext: string) => `recorded/${id}.${ext}`

type Viewer = { email: string; admin: boolean; demo: boolean }

async function query(extra?: { id: string }): Promise<RecordedItem[]> {
  const out: RecordedItem[] = []
  let start: Record<string, unknown> | undefined
  do {
    const r = await client.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: extra ? "#t = :t AND #i = :i" : "#t = :t",
        ExpressionAttributeNames: extra ? { "#t": "test", "#i": "id" } : { "#t": "test" },
        ExpressionAttributeValues: extra ? { ":t": PK, ":i": extra.id } : { ":t": PK },
        ExclusiveStartKey: start,
      }),
    )
    for (const item of r.Items ?? []) if (item.kind === "clip" && item.env === ENV) out.push(item as RecordedItem)
    start = r.LastEvaluatedKey
  } while (start)
  return out
}

/** A recording as the clips surfaces draw it: filed under the PAX desk, its recorder the messenger. */
export function toClip(r: RecordedItem, viewer?: string | null): Clip {
  const desk = creatorOf("parallax")!
  return {
    id: r.id,
    creatorId: desk.id,
    author: { name: desk.name, handle: desk.handle, image: desk.image },
    title: r.title,
    messenger: r.messenger ?? undefined,
    caption: r.caption ?? "",
    src: `${CLIPS_CDN}/${r.key}`,
    duration: r.duration ?? undefined,
    createdAt: r.createdAt,
    visibility: r.visibility === "public" ? "public" : "private",
    views: 0,
    likes: 0,
    origin: "recorded",
    status: "published",
    mine: viewer ? r.owner === viewer : undefined,
  }
}

const sameWorld = (r: RecordedItem, v: Viewer) => DEMO_EMAILS.has(r.owner) === v.demo

/** Everyone else's public recordings, for the library; a signed-out reader sees the real world's. */
export async function publicRecordings(v: Viewer | null): Promise<Clip[]> {
  const world = v ?? { email: "", admin: false, demo: false }
  return (await query())
    .filter((r) => r.visibility === "public" && r.owner !== world.email && sameWorld(r, world))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => toClip(r, world.email))
}

/** The viewer's own recordings, newest first. */
export async function myRecordings(v: Viewer): Promise<Clip[]> {
  return (await query())
    .filter((r) => r.owner === v.email)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => toClip(r, v.email))
}

/** The recordings an admin may make arms of: every recording in the admin's world. */
export async function armRecordings(v: Viewer | null): Promise<Clip[]> {
  if (!v?.admin) return []
  return (await query())
    .filter((r) => sameWorld(r, v))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((r) => toClip(r, v.email))
}

/** The video each recorded id plays, for the ids that are recordings. */
export async function recordedSrcs(ids: string[]): Promise<Map<string, string>> {
  const want = ids.filter((id) => id.startsWith("rec-"))
  if (!want.length) return new Map()
  const rows = await query()
  return new Map(rows.filter((r) => want.includes(r.id)).map((r) => [r.id, `${CLIPS_CDN}/${r.key}`]))
}

/** One recording by id, or null. */
export async function recordedClip(id: string): Promise<RecordedItem | null> {
  if (!id.startsWith("rec-")) return null
  return (await query({ id }))[0] ?? null
}

/** Keeps a recording's row, once. */
export async function keepRecorded(item: Omit<RecordedItem, "test" | "kind" | "env" | "schema">) {
  const row: RecordedItem = { ...item, test: PK, kind: "clip", env: ENV, schema: 1 }
  await client.send(new PutCommand({ TableName: TABLE, Item: row, ConditionExpression: "attribute_not_exists(id)" }))
  return row
}
