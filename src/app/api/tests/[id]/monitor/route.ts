import { requireAdmin } from "@/lib/auth"
import { itemsFor, type RecordItem } from "@/lib/tests/responses"
import { getTest } from "@/lib/tests/store"

// GET /api/tests/<id>/monitor (admins only): per arm, how many respondents started, finished
// and were screened out, and the party and 2024-vote distributions of those who finished, so
// balance across arms is visible while the test is in the field. JSON only.

export const dynamic = "force-dynamic"

const BALANCE = ["party", "vote2024"]
const share = (n: number, d: number) => (d ? Math.round((1000 * n) / d) / 1000 : null)

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
  } catch {
    return Response.json({ error: "admins only" }, { status: 403 })
  }
  const { id } = await params
  const test = await getTest(id)
  if (!test) return Response.json({ error: "unknown test" }, { status: 404 })

  const items = await itemsFor(test.id)
  // Balance on the entry questions this test asks of the two the monitor watches.
  const balanceQuestions = test.entry.filter((q) => BALANCE.includes(q.key))
  const arms = test.arms.map((arm) => {
    const done = items.filter((i): i is RecordItem => i.kind === "complete" && i.arm === arm)
    const started = items.filter((i) => i.kind === "start" && i.arm === arm).length
    const screenouts = items.filter((i) => i.kind === "screenout" && i.arm === arm).length
    const balance = Object.fromEntries(
      balanceQuestions.map((q) => [
        q.key,
        Object.fromEntries(
          q.choices.map((c) => {
            const n = done.filter((d) => d.answers[q.key] === c.value).length
            return [c.value, { n, share: share(n, done.length) }]
          }),
        ),
      ]),
    )
    return { arm, started, finished: done.length, screenouts, target: test.targetPerArm, completionRate: share(done.length, started), balance }
  })
  const env: Record<string, number> = {}
  for (const i of items) env[i.env] = (env[i.env] ?? 0) + 1
  return Response.json({
    test: test.id,
    status: test.status,
    generatedAt: new Date().toISOString(),
    totals: {
      started: arms.reduce((a, r) => a + r.started, 0),
      finished: arms.reduce((a, r) => a + r.finished, 0),
      screenouts: arms.reduce((a, r) => a + r.screenouts, 0),
      itemsByEnv: env,
    },
    arms,
    note: "started counts Start presses, logged since the collector went live; finished counts completed records; screenouts counts records a gate turned away. Balance is over finished respondents.",
  })
}
