import "server-only"

import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb"

import { memberByEmail } from "@/lib/roles"
import { validate } from "@/video/specs"

// A video made from a template is data, not code: { templateId, props, version } per user
// (Brendan, 2026-10-30). Chat writes one when it draws a pax-video block, and the next one when
// it revises it ("make it shorter"); the Studio lists them all as compositions in its Versions
// folder. One table in the new account's us-east-2, on demand; Amplify's compute role holds the
// pax-trinity-video-versions policy for it.
//
//   pk               sk                          item
//   USER#<email>     <templateId>#<0001>         one version: its props, title, where it came from
//
// A version's id is its Studio composition id, v-<templateId>-<n>, so /studio?v=<id> and the
// Studio's own URL name the same thing.

const TABLE = "pax-trinity-video-versions"
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.PAX_TRINITY_TABLES_REGION ?? "us-east-2" }), { marshallOptions: { removeUndefinedValues: true } })

export type VersionSource = "chat" | "studio"

export type VideoVersion = {
  id: string
  templateId: string
  version: number
  props: unknown
  title: string
  createdAt: string
  source: VersionSource
  chatId?: string
  /** The version this one revises. */
  parent?: string
  /** What the caller saved it under (a chat's message and block), so a second save returns this one. */
  key?: string
}

type Row = VideoVersion & { pk: string; sk: string }

/** The one address a person signs in with, so Brendan's Gmail and his own address share a list. */
const owner = (email: string) => `USER#${(memberByEmail(email)?.email ?? email).toLowerCase()}`
const sortKey = (templateId: string, version: number) => `${templateId}#${String(version).padStart(4, "0")}`
export const versionId = (templateId: string, version: number) => `v-${templateId}-${version}`

/** v-lift-card-2 → lift-card and 2; template ids hold hyphens, so the number is the last part. */
export function parseVersionId(id: string): { templateId: string; version: number } | null {
  const m = /^v-([a-z0-9-]+)-(\d+)$/.exec(id)
  return m ? { templateId: m[1], version: Number(m[2]) } : null
}

const strip = ({ pk: _pk, sk: _sk, ...v }: Row): VideoVersion => v

async function rows(email: string): Promise<Row[]> {
  const out: Row[] = []
  let start: Record<string, unknown> | undefined
  do {
    const r = await client.send(new QueryCommand({ TableName: TABLE, KeyConditionExpression: "pk = :pk", ExpressionAttributeValues: { ":pk": owner(email) }, ExclusiveStartKey: start }))
    out.push(...((r.Items as Row[] | undefined) ?? []))
    start = r.LastEvaluatedKey
  } while (start)
  return out
}

/** Every version the person has saved, newest first. */
export async function list(email: string): Promise<VideoVersion[]> {
  return (await rows(email)).map(strip).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.version - a.version)
}

export async function get(email: string, id: string): Promise<VideoVersion | null> {
  const p = parseVersionId(id)
  if (!p) return null
  const r = await client.send(new GetCommand({ TableName: TABLE, Key: { pk: owner(email), sk: sortKey(p.templateId, p.version) } }))
  return r.Item ? strip(r.Item as Row) : null
}

export type SaveMeta = { title?: string; source: VersionSource; chatId?: string; parent?: string; key?: string }

export type Saved = { ok: true; version: VideoVersion; existing: boolean } | { ok: false; error: string }

/** Validates the props against the template's schema, then writes them as that template's next
 *  version. A save under a key already used returns the version saved under it. */
export async function save(email: string, templateId: string, props: unknown, meta: SaveMeta): Promise<Saved> {
  const v = validate(templateId, props)
  if (!v.ok) return { ok: false, error: v.error }
  const all = await rows(email)
  if (meta.key) {
    const same = all.find((r) => r.key === meta.key)
    if (same) return { ok: true, version: strip(same), existing: true }
  }
  let next = Math.max(0, ...all.filter((r) => r.templateId === templateId).map((r) => r.version)) + 1
  // Two saves at once can pick the same number; the condition refuses the second, which takes the next.
  for (let tries = 0; tries < 5; tries++, next++) {
    const version: VideoVersion = {
      id: versionId(templateId, next),
      templateId,
      version: next,
      props: v.props,
      title: meta.title?.trim() || v.spec.name,
      createdAt: new Date().toISOString(),
      source: meta.source,
      chatId: meta.chatId,
      parent: meta.parent,
      key: meta.key,
    }
    try {
      await client.send(new PutCommand({ TableName: TABLE, Item: { pk: owner(email), sk: sortKey(templateId, next), ...version }, ConditionExpression: "attribute_not_exists(sk)" }))
      return { ok: true, version, existing: false }
    } catch (e) {
      if ((e as { name?: string }).name !== "ConditionalCheckFailedException") throw e
    }
  }
  return { ok: false, error: "Another save took this version's number; try again." }
}
