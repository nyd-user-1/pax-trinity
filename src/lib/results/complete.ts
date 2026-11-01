import "server-only"

import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb"

import { PUBLISHED } from "@/components/clips/catalog"
import { recordedClip } from "@/lib/clips/recorded"
import { ENV, itemsFor } from "@/lib/tests/responses"
import { getTest } from "@/lib/tests/store"

import MA_GENERAL_ADULTS from "../../../scripts/results/configs/ma-general-adults.json"
import MA_WAVE_3 from "../../../scripts/results/configs/ma-wave-3.json"
import OPEN_PRIMARIES_1 from "../../../scripts/results/configs/open-primaries-1.json"
import { deriveResults, EXPORT_DIMS, type Derived, type Targets } from "./derive"
import type { VideoState } from "./video"

// The completion hook (docs/briefs/loop-pipeline.md, part A): a message test that has finished
// writes its own results. completeTest reads the test record and every response, derives the
// register-shaped ResultSet, the pax_test export rows and the index entry (./derive.ts), and keeps
// them in the responses table beside the answers:
//
//   test (pk)          id (sk)    item
//   result:<test>      latest     kind "result": resultSet, rows, indexEntry, env, computedAt
//
// It runs when a test is closed (the admin's save in /message-tests, a fielding's close) or on an
// admin's POST to /api/results/<test>. scripts/results/publish.mjs then writes the three artifacts
// where the surfaces read them: the register (src/lib/results/computed/), the audience export
// (public/audience-data/pax_test.json and index.json, synced to the export buckets).
// Weighted to Massachusetts general adults, the audience store's sourced targets
// (scripts/results/configs/ma-general-adults.json). Once the result is kept it starts the
// result's video (./video.ts, beside it as id "video"), which never holds the result up.

const TABLE = process.env.PAX_TRINITY_TEST_RESPONSES_TABLE ?? "pax-trinity-test-responses"
const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.PAX_TRINITY_TABLES_REGION ?? process.env.PAX2_REGION ?? "us-east-1" }), {
  marshallOptions: { removeUndefinedValues: true },
})
export { TABLE as RESPONSES_TABLE, client as responsesClient }

/** A test's own naming and dimensions, where its config carries them. `simulated` is the line a seeded
 *  demo run's results carry first among their limitations; it marks the set simulated. */
const TEST_CONFIGS: Record<string, { study?: string; wave?: number; title?: string; simulated?: string; dimensions?: { key: string; name: string; group: string; selfSelected?: boolean }[] }> = {
  "open-primaries-1": OPEN_PRIMARIES_1,
  "ma-wave-3": MA_WAVE_3,
}

/** An arm's name as compute.mjs names it: the clip's title with its messenger, else its length. */
function armName(id: string) {
  if (id === "placebo") return "Placebo"
  const c = PUBLISHED.find((x) => x.id === id)
  if (!c) return id
  return c.messenger && c.messenger !== c.title ? `${c.title} — ${c.messenger}` : c.messenger ? c.title : c.duration ? `${c.title} (${c.duration} s)` : c.title
}

export type ResultItem = { test: string; id: "latest"; kind: "result"; env: string; computedAt: string } & Derived

export const resultPartition = (testId: string) => `result:${testId}`

/** Derive a test's results from its responses and keep them, then start or continue their video; null for a test nobody set up.
 *  `retryFailedVideo: false` (the fielding's close) leaves a video that failed failed, so the readout goes without it. */
export async function completeTest(
  testId: string,
  opts: { env?: "production" | "development" | "all"; retryFailedVideo?: boolean } = {},
): Promise<(ResultItem & { video: VideoState }) | null> {
  const test = await getTest(testId)
  if (!test) return null
  const items = await itemsFor(testId)
  const cfg = TEST_CONFIGS[testId] ?? {}
  const env = opts.env ?? (ENV as "production" | "development")
  const now = new Date()
  // The test's arms that are recordings kept in Clips, read from their rows.
  const kept = await Promise.all(test.arms.filter((a) => a.startsWith("rec-")).map((a) => recordedClip(a).catch(() => null))).then((rows) =>
    rows.flatMap((r) => (r ? [{ id: r.id, duration: r.duration }] : [])),
  )
  const derived = deriveResults(test, items, MA_GENERAL_ADULTS as Targets, {
    env,
    id: `${testId}-computed`,
    study: cfg.study ?? test.title,
    wave: cfg.wave ?? 1,
    title: cfg.title,
    geo: "25",
    source: `pax-trinity-test-responses:${testId}`,
    armName,
    clipOf: (id) => {
      const c = PUBLISHED.find((x) => x.id === id) ?? kept.find((x) => x.id === id)
      return c ? { clipId: c.id, durationSeconds: c.duration ?? undefined } : null
    },
    dimensions: cfg.dimensions?.map((d) => ({ ...d, exportName: EXPORT_DIMS[d.key] ?? d.key })),
    now,
  })
  if (cfg.simulated) {
    derived.resultSet.simulated = true
    derived.resultSet.notes.limitations.unshift(cfg.simulated)
  }
  const item: ResultItem = { test: resultPartition(testId), id: "latest", kind: "result", env, computedAt: now.toISOString(), ...derived }
  await client.send(new PutCommand({ TableName: TABLE, Item: item }))
  let video: VideoState = { state: "none" }
  try {
    // Loaded here, not at the top: ./video reads this module's table.
    const { resultVideo } = await import("./video")
    video = await resultVideo(testId, { resultSet: item.resultSet, retryFailed: opts.retryFailedVideo ?? true })
  } catch (e) {
    console.error("resultVideo failed", (e as Error).message)
  }
  return { ...item, video }
}

/** A test's last derived results, or null. A query, not a get: the roles that read responses are granted Query. */
export async function latestResult(testId: string): Promise<ResultItem | null> {
  const r = await client.send(
    new QueryCommand({ TableName: TABLE, KeyConditionExpression: "#t = :t AND #i = :i", ExpressionAttributeNames: { "#t": "test", "#i": "id" }, ExpressionAttributeValues: { ":t": resultPartition(testId), ":i": "latest" } }),
  )
  return (r.Items?.[0] as ResultItem | undefined) ?? null
}
