import "server-only"

import { randomUUID } from "node:crypto"

import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb"
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

import { MEMBERS, memberByEmail } from "@/lib/roles"

// Housekeeping (Brendan, 2026-10-30): the admins' comments on the app for the super admin, as a
// chat stream, with one-to-one direct messages beside it. A comment pointed at an element (the
// sonar overlay, components/housekeeping) carries its page, the element and a CSS path back to it;
// screenshots ride along in S3. Only the super admin edits or resolves.
//
//   pk                    sk               item
//   STREAM                <iso>#<id>       a message to everyone
//   DM#<email>|<email>    <iso>#<id>       a direct message (the two emails sorted)
//
// The new account's us-east-2: table pax-trinity-housekeeping, screenshots under housekeeping/ in
// the clips bucket; Amplify's compute role holds the pax-trinity-housekeeping policy for both.

const REGION = process.env.PAX_TRINITY_TABLES_REGION ?? "us-east-2"
const TABLE = process.env.PAX_TRINITY_HOUSEKEEPING_TABLE ?? "pax-trinity-housekeeping"
const BUCKET = process.env.PAX_TRINITY_HOUSEKEEPING_BUCKET ?? "pax-trinity-clips-613473203863"

const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }), { marshallOptions: { removeUndefinedValues: true } })
const s3 = new S3Client({ region: REGION })

export type Message = {
  pk: string
  sk: string
  id: string
  author: string
  authorName: string
  /** The other person in a direct message; absent on the stream. */
  to?: string
  text: string
  /** "comment": pointed at an element; "message": typed in the panel. */
  kind: "comment" | "message"
  page?: string
  route?: string
  target?: string
  path?: string
  /** The overlay's full locator bundle, for whoever fixes it. */
  bundle?: string
  /** S3 keys of the screenshots. */
  images?: string[]
  status: "open" | "resolved"
  resolvedBy?: string
  resolvedAt?: string
  editedAt?: string
  createdAt: string
}

/** Who can be in Housekeeping: the super admin and the admins, by lib/roles.ts. */
export const PEOPLE = MEMBERS.filter((m) => m.email && (m.role === "superadmin" || m.role === "admin")).map((m) => ({ email: m.email!.toLowerCase(), name: m.name, role: m.role }))

export const nameOf = (email: string) => memberByEmail(email)?.name ?? email
/** A member's main address, so either of Brendan's addresses lands in the same thread. */
export const canonical = (email: string) => memberByEmail(email)?.email?.toLowerCase() ?? email.toLowerCase()

export const dmKey = (a: string, b: string) => `DM#${[canonical(a), canonical(b)].sort().join("|")}`

export async function listThread(pk: string): Promise<Message[]> {
  const out = await db.send(new QueryCommand({ TableName: TABLE, KeyConditionExpression: "pk = :pk", ExpressionAttributeValues: { ":pk": pk }, ScanIndexForward: false, Limit: 300 }))
  return ((out.Items ?? []) as Message[]).reverse()
}

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" }

/** Up to four screenshots, from data URLs, each at most 4 MB. */
async function putImages(id: string, images: { mime: string; data: string }[]): Promise<string[]> {
  const keys: string[] = []
  for (const [i, img] of images.slice(0, 4).entries()) {
    const ext = EXT[img.mime]
    const comma = img.data.indexOf(",")
    if (!ext || comma < 0) continue
    const body = Buffer.from(img.data.slice(comma + 1), "base64")
    if (body.length > 4 * 1024 * 1024) throw new Error("A screenshot is over 4 MB.")
    const key = `housekeeping/${id}-${i}.${ext}`
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: img.mime }))
    keys.push(key)
  }
  return keys
}

export async function post(input: {
  author: string
  to?: string | null
  text: string
  kind: "comment" | "message"
  page?: string
  route?: string
  target?: string
  path?: string
  bundle?: string
  images?: { mime: string; data: string }[]
}): Promise<Message> {
  const id = randomUUID()
  const createdAt = new Date().toISOString()
  const author = canonical(input.author)
  const to = input.to ? canonical(input.to) : undefined
  const item: Message = {
    pk: to ? dmKey(author, to) : "STREAM",
    sk: `${createdAt}#${id}`,
    id,
    author,
    authorName: nameOf(author),
    to,
    text: input.text.trim().slice(0, 4000),
    kind: input.kind,
    page: input.page?.slice(0, 600),
    route: input.route?.slice(0, 300),
    target: input.target?.slice(0, 300),
    path: input.path?.slice(0, 1000),
    bundle: input.bundle?.slice(0, 6000),
    images: input.images?.length ? await putImages(id, input.images) : undefined,
    status: "open",
    createdAt,
  }
  await db.send(new PutCommand({ TableName: TABLE, Item: item }))
  return item
}

/** The super admin's two levers: resolve or reopen, and edit the text. */
export async function update(key: { pk: string; sk: string }, change: { status?: "open" | "resolved"; text?: string }, by: string): Promise<void> {
  const now = new Date().toISOString()
  if (change.status) {
    await db.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: key,
        ConditionExpression: "attribute_exists(pk)",
        UpdateExpression: change.status === "resolved" ? "SET #s = :s, resolvedBy = :by, resolvedAt = :at" : "SET #s = :s REMOVE resolvedBy, resolvedAt",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: change.status === "resolved" ? { ":s": "resolved", ":by": canonical(by), ":at": now } : { ":s": "open" },
      }),
    )
  }
  if (change.text != null) {
    await db.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: key,
        ConditionExpression: "attribute_exists(pk)",
        UpdateExpression: "SET #t = :t, editedAt = :at",
        ExpressionAttributeNames: { "#t": "text" },
        ExpressionAttributeValues: { ":t": change.text.trim().slice(0, 4000), ":at": now },
      }),
    )
  }
}

/** A screenshot's short-lived link. */
export async function imageUrl(key: string): Promise<string> {
  if (!key.startsWith("housekeeping/")) throw new Error("Not a Housekeeping screenshot.")
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 600 })
}
