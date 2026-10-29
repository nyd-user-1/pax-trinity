import { surveyBySlug } from "@/lib/surveys/catalog"
import { partition, putSurveyItem, validAnswers } from "@/lib/surveys/responses"
import { ENV, MAX_BYTES, ulid } from "@/lib/tests/responses"

// POST /api/surveys/<slug>/responses: a respondent's answers from /s/<slug>, { answers, startedAt }.
// Each answer is checked against the survey's own options, given a server-side ULID and receipt
// time, and written once to the responses table. Nothing about the respondent beyond the answers is kept.

export const dynamic = "force-dynamic"

const json = (body: unknown, status: number) => Response.json(body, { status })

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BYTES) return json({ error: `payload over ${MAX_BYTES} bytes` }, 413)
  const survey = surveyBySlug((await params).slug)
  if (!survey) return json({ error: "unknown survey" }, 404)
  const raw = await req.text()
  if (new TextEncoder().encode(raw).length > MAX_BYTES) return json({ error: `payload over ${MAX_BYTES} bytes` }, 413)
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return json({ error: "body is not JSON" }, 400)
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return json({ error: "body must be an object" }, 400)
  const v = validAnswers(survey, body as Record<string, unknown>)
  if (!v.ok) return json({ error: v.error }, 400)
  const now = new Date()
  const item = { test: partition(survey.slug), id: ulid(now.getTime()), kind: "survey" as const, answers: v.answers, startedAt: v.startedAt, pid: v.pid, completedAt: now.toISOString(), receivedAt: now.toISOString(), env: ENV, schema: 1 as const }
  try {
    await putSurveyItem(item)
  } catch (e) {
    console.error("survey response write failed", (e as Error).name)
    return json({ error: "could not store the response" }, 503)
  }
  return json({ id: item.id, receivedAt: item.receivedAt }, 201)
}
