import "server-only"

import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb"

import { PUBLISHED } from "@/components/clips/catalog"
import { stat } from "@/lib/clips/storage"
import { validate } from "@/video/specs"
import { cdnUrl, lambdaConfigured, renderedKey, startOnLambda, waitOnLambda } from "@/video/render-server"

import { latestResult, resultPartition, RESPONSES_TABLE as TABLE, responsesClient as client } from "./complete"
import type { ResultSet } from "./types"
import { liftCardProps } from "./video-props"

// A closed test's result video (docs/briefs/render-lambda.md): the lift card for its
// headline outcome's strongest treatment, rendered on Remotion Lambda with a poster, and
// kept beside the result in the responses table:
//
//   test (pk)       id (sk)   item
//   result:<test>   video     key, poster (the clips bucket's rendered/ keys), claimedAt,
//                             renderId + bucketName once Lambda has it, then renderedAt or failedAt
//
// completeTest starts it after writing the result. Nothing here waits on a whole render,
// since Amplify cuts a response at about 30 s: a call claims the row with a conditional put
// (so overlapping ticks never render twice), starts the render, notes its renderId, and
// polls within a budget. A later call with the same props re-attaches by that renderId and
// finishes the row; one with new props (more responses) renders again under a new key. A
// claim that has said nothing for ten minutes counts as failed. The row is read by query
// and written by put, the two the compute role holds on the table.

const TEMPLATE = "lift-card"
const STALE_MS = 10 * 60_000
/** How long after the claim a missing poster is waited for, once the video is in. */
const POSTER_GRACE_MS = 3 * 60_000

type VideoRow = {
  test: string
  id: "video"
  kind: "video"
  templateId: string
  key: string
  poster: string
  claimedAt: string
  renderId?: string
  bucketName?: string
  renderedAt?: string
  /** The poster did not render; the video stands alone. */
  posterMissing?: boolean
  failedAt?: string
  error?: string
}

export type VideoState = { state: "done"; url: string; poster: string | null } | { state: "rendering" } | { state: "failed"; error: string } | { state: "none" }

const partnerOf = (clipId: string) => {
  const c = PUBLISHED.find((x) => x.id === clipId)
  return c ? `@${c.author.handle}` : undefined
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const age = (row: VideoRow) => Date.now() - Date.parse(row.claimedAt)

async function readRow(testId: string): Promise<VideoRow | null> {
  const r = await client.send(
    new QueryCommand({ TableName: TABLE, KeyConditionExpression: "#t = :t AND #i = :i", ExpressionAttributeNames: { "#t": "test", "#i": "id" }, ExpressionAttributeValues: { ":t": resultPartition(testId), ":i": "video" } }),
  )
  return (r.Items?.[0] as VideoRow | undefined) ?? null
}

/** A row's state as it stands, rendering nothing. */
export function stateOf(row: VideoRow | null): VideoState {
  if (!row) return { state: "none" }
  if (row.renderedAt) return { state: "done", url: cdnUrl(row.key), poster: row.posterMissing ? null : cdnUrl(row.poster) }
  if (row.failedAt) return { state: "failed", error: row.error ?? "The render failed." }
  if (age(row) > STALE_MS) return { state: "failed", error: "The render stopped answering." }
  return { state: "rendering" }
}

/** A test's result video as its row stands. */
export async function videoOf(testId: string): Promise<VideoState> {
  return stateOf(await readRow(testId))
}

/** Puts the row on a condition: "new" (no row yet), the claim as it was read, or the claim this call holds, unfinished. */
async function put(row: VideoRow, on: "new" | { seen: string } | { held: string }): Promise<boolean> {
  const condition =
    on === "new"
      ? { ConditionExpression: "attribute_not_exists(#i)", ExpressionAttributeNames: { "#i": "id" } }
      : "seen" in on
        ? { ConditionExpression: "claimedAt = :c", ExpressionAttributeValues: { ":c": on.seen } }
        : { ConditionExpression: "claimedAt = :c AND attribute_not_exists(renderedAt) AND attribute_not_exists(failedAt)", ExpressionAttributeValues: { ":c": on.held } }
  try {
    await client.send(new PutCommand({ TableName: TABLE, Item: row, ...condition }))
    return true
  } catch (e) {
    if ((e as Error).name === "ConditionalCheckFailedException") return false
    throw e
  }
}

async function fail(row: VideoRow, error: string): Promise<VideoState> {
  console.error(`result video ${row.test}: ${error}`)
  await put({ ...row, failedAt: new Date().toISOString(), error }, { held: row.claimedAt })
  return { state: "failed", error }
}

/** Polls the row's render within the budget and finishes the row when the video (and its poster) are in. */
async function settle(row: VideoRow, budgetMs: number, posterDone?: Promise<unknown>): Promise<VideoState> {
  const until = Date.now() + budgetMs
  const p = await waitOnLambda({ renderId: row.renderId!, bucketName: row.bucketName! }, Math.max(0, budgetMs))
  if (!p.done) return p.fatal ? fail(row, p.fatal) : { state: "rendering" }
  // The video is in. Its poster, one frame, is almost always in before it.
  let poster: boolean | null = null
  if (posterDone) poster = await Promise.race([posterDone.then(() => true, () => false), sleep(Math.max(0, until - Date.now())).then(() => null)])
  if (!poster) poster = (await stat(row.poster)) ? true : poster === false || age(row) > POSTER_GRACE_MS ? false : null
  if (poster === null) return { state: "rendering" }
  const done: VideoRow = { ...row, renderedAt: new Date().toISOString(), ...(poster ? {} : { posterMissing: true }) }
  await put(done, { held: row.claimedAt })
  return stateOf(done)
}

/** Starts, continues or reports a test's result video; never throws, never waits past the budget by more than a request.
 *  `retryFailed: false` leaves a failed render failed (the readout's close mails without it); the admin close and the pass retry. */
export async function resultVideo(testId: string, opts: { resultSet?: ResultSet; budgetMs?: number; retryFailed?: boolean } = {}): Promise<VideoState> {
  const start = Date.now()
  const left = () => (opts.budgetMs ?? 15_000) - (Date.now() - start)
  if (!lambdaConfigured()) return { state: "none" }
  try {
    const rs = opts.resultSet ?? (await latestResult(testId))?.resultSet
    const props = rs ? liftCardProps(rs, partnerOf) : null
    if (!props) return { state: "none" }
    const v = validate(TEMPLATE, props)
    if (!v.ok) {
      console.error(`result video ${testId}: the lift card's props do not parse`, v.error)
      return { state: "none" }
    }
    const key = renderedKey(v.spec, v.props, "mp4")
    const row = await readRow(testId)
    const now = stateOf(row)
    if (row?.key === key) {
      if (now.state === "done") return now
      if (now.state === "rendering") return row.renderId ? await settle(row, left()) : now
      if (opts.retryFailed === false) return now
    } else if (now.state === "rendering") return now // another set of props is rendering; the next call takes over

    const claim: VideoRow = { test: resultPartition(testId), id: "video", kind: "video", templateId: TEMPLATE, key, poster: renderedKey(v.spec, v.props, "png"), claimedAt: new Date().toISOString() }
    if (!(await put(claim, row ? { seen: row.claimedAt } : "new"))) return { state: "rendering" }
    let started: Awaited<ReturnType<typeof startOnLambda>>
    try {
      started = await startOnLambda({ spec: v.spec, props: v.props, format: "mp4" })
    } catch (e) {
      return await fail(claim, (e as Error).message)
    }
    const held: VideoRow = { ...claim, renderId: started.renderId, bucketName: started.bucketName }
    if (!(await put(held, { held: claim.claimedAt }))) return { state: "rendering" }
    return await settle(held, left(), started.poster.done)
  } catch (e) {
    console.error(`result video ${testId}:`, (e as Error).message)
    return videoOf(testId).catch(() => ({ state: "none" }) as const)
  }
}
