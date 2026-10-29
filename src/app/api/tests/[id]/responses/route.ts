import { recordedSrcs } from "@/lib/clips/recorded"
import { getTest } from "@/lib/tests/store"
import { ENV, MAX_BYTES, putItem, ulid, validateRecord, validateStart, type ResponseItem } from "@/lib/tests/responses"

// POST /api/tests/<id>/responses: the respondent flow's collector. Two bodies:
//   { kind: "start", test, arm, pid, startedAt }   when the respondent presses Start
//   the record, status complete or screenout       at the end (the shape flow.tsx builds)
// Only a test whose status is fielding records; drafts and closed tests get 409. Each body is
// validated against the test's own record (getTest: its arms and questions, the arm's clip in the
// published catalog), given a server-side ULID and receipt time, and written once. Nothing about
// the respondent beyond their answers and the panel's pid is kept.

export const dynamic = "force-dynamic"

const json = (body: unknown, status: number) => Response.json(body, { status })

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const declared = Number(req.headers.get("content-length") ?? 0)
  if (declared > MAX_BYTES) return json({ error: `payload over ${MAX_BYTES} bytes` }, 413)

  const { id } = await params
  const test = await getTest(id)
  if (!test) return json({ error: "unknown test" }, 404)
  // The hard stop: a draft (previewable by admins) or closed test records nothing.
  if (test.status !== "fielding") return json({ error: `test is ${test.status}, not fielding` }, 409)

  const raw = await req.text()
  if (new TextEncoder().encode(raw).length > MAX_BYTES) return json({ error: `payload over ${MAX_BYTES} bytes` }, 413)
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return json({ error: "body is not JSON" }, 400)
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return json({ error: "body must be an object" }, 400)
  const record = body as Record<string, unknown>

  const now = Date.now()
  // A recording kept in Clips is an arm like a catalog clip; its video is read from its row.
  const kept = await recordedSrcs(test.arms).catch(() => new Map<string, string>())
  const base = { test: test.id, id: ulid(now), receivedAt: new Date(now).toISOString(), env: ENV, schema: 1 as const }
  let item: ResponseItem
  if (record.kind === "start") {
    const v = validateStart(test, record, now, kept)
    if (!v.ok) return json({ error: v.error }, 400)
    item = { ...base, kind: "start", ...v.value }
  } else {
    const v = validateRecord(test, record, now, kept)
    if (!v.ok) return json({ error: v.error }, 400)
    item = { ...base, ...v.value }
  }

  try {
    await putItem(item)
  } catch (e) {
    console.error("test response write failed", (e as Error).name)
    return json({ error: "could not store the response" }, 503)
  }
  return json({ id: item.id, receivedAt: item.receivedAt }, 201)
}
