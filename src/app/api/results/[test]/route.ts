import { requireAdmin } from "@/lib/auth"
import { completeTest, latestResult } from "@/lib/results/complete"

// /api/results/<test>: the completion hook's door (src/lib/results/complete.ts).
//   POST (admins)  derive the test's results from its responses now and keep them; answers the artifacts
//   GET            the last derived artifacts: the ResultSet, the pax_test rows, the index entry; aggregates only
// scripts/results/publish.mjs reads GET to write the register and the audience export.

export const dynamic = "force-dynamic"

export async function POST(req: Request, { params }: { params: Promise<{ test: string }> }) {
  try {
    await requireAdmin()
  } catch {
    return Response.json({ error: "admins only" }, { status: 403 })
  }
  const { test } = await params
  const env = new URL(req.url).searchParams.get("env")
  try {
    const item = await completeTest(test, env === "production" || env === "development" || env === "all" ? { env } : {})
    if (!item) return Response.json({ error: "unknown test" }, { status: 404 })
    return Response.json(item, { status: 201 })
  } catch (e) {
    console.error("completeTest failed", (e as Error).message)
    return Response.json({ error: "could not compute the results" }, { status: 503 })
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ test: string }> }) {
  const { test } = await params
  try {
    const item = await latestResult(test)
    return item ? Response.json(item) : Response.json({ error: "no results yet" }, { status: 404 })
  } catch (e) {
    console.error("latestResult failed", (e as Error).message)
    return Response.json({ error: "results unavailable" }, { status: 503 })
  }
}
