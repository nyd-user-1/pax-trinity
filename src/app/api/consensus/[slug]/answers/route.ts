import { currentUser } from "@/lib/auth"
import { conversation } from "@/lib/consensus/store"
import { keepTaken, validTaken } from "@/lib/consensus/taken"
import { MAX_BYTES } from "@/lib/tests/responses"

// POST /api/consensus/<slug>/answers: a signed-in reader's answers to the survey, { answers: { <tid>: "agree" |
// "disagree" | "pass" }, salient: [<tid>] }, kept once (lib/consensus/taken.ts). Every asked statement needs an
// answer. 201 when kept; 409 when the reader had already taken it, whose first answers stand.

export const dynamic = "force-dynamic"

const json = (body: unknown, status: number) => Response.json(body, { status })

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await currentUser()
  if (!user) return json({ error: "sign in to keep your answers" }, 401)
  const c = await conversation((await params).slug)
  if (!c) return json({ error: "unknown survey" }, 404)
  const raw = await req.text()
  if (new TextEncoder().encode(raw).length > MAX_BYTES) return json({ error: `payload over ${MAX_BYTES} bytes` }, 413)
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return json({ error: "body is not JSON" }, 400)
  }
  const v = validTaken(c, body)
  if (!v.ok) return json({ error: v.error }, 400)
  try {
    return (await keepTaken(c.slug, user.email, { answers: v.answers, salient: v.salient })) ? json({ kept: true }, 201) : json({ error: "already taken" }, 409)
  } catch (e) {
    console.error("consensus answers write failed", (e as Error).name)
    return json({ error: "could not keep the answers" }, 503)
  }
}
