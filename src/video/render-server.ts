import "server-only"

import { randomUUID } from "node:crypto"
import { readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { getRenderProgress, renderMediaOnLambda, renderStillOnLambda as lambdaStill, type AwsRegion } from "@remotion/lambda/client"

import { CLIPS_CDN } from "@/components/clips/catalog"
import { CLIPS_BUCKET } from "@/lib/clips/storage"
import { canonicalJson, hash } from "@/lib/fnv"

import { durationOf, type AnySpec } from "./specs"

// Rendering a template to a file, on the server, two ways. Production renders on
// Remotion Lambda (the function and the pax-video site, deployed in the new account by
// npm run video:site; docs/briefs/render-lambda.md): the file goes straight to the
// clips bucket under rendered/ and is served from the clips CDN. Local development
// without Lambda renders in-process: @remotion/renderer drives a headless Chrome and
// ships native compositor binaries, which belong neither in Amplify's 220 MB server
// bundle nor in a request on its compute. Both of those packages are loaded by a name
// the build's file tracer cannot follow, so neither reaches the deploy;
// @remotion/lambda's client is only AWS calls, and stays external (next.config.ts).

type Bundler = typeof import("@remotion/bundler")
type Renderer = typeof import("@remotion/renderer")

const load = <T>(name: string) => import(/* webpackIgnore: true */ /* turbopackIgnore: true */ name) as Promise<T>

export const FORMATS = {
  mp4: { codec: "h264", type: "video/mp4" },
  webm: { codec: "vp8", type: "video/webm" },
} as const
export type Format = keyof typeof FORMATS

// One webpack bundle of src/video per server process, on globalThis so a module
// re-evaluation keeps it; `fresh` rebuilds it after a template changes.
const kept = globalThis as { __paxVideoBundle?: Promise<string> }

async function serveUrl(fresh: boolean): Promise<string> {
  if (fresh || !kept.__paxVideoBundle) {
    const { bundle } = await load<Bundler>("@remotion/bundler")
    kept.__paxVideoBundle = bundle({ entryPoint: path.join(/* turbopackIgnore: true */ process.cwd(), "src", "video", "index.ts") })
    kept.__paxVideoBundle.catch(() => (kept.__paxVideoBundle = undefined))
  }
  return kept.__paxVideoBundle
}

/** Renders validated props to a file in the OS temp folder and returns its bytes; the file is gone after. */
export async function renderLocal({ spec, props, format, fresh = false }: { spec: AnySpec; props: unknown; format: Format; fresh?: boolean }): Promise<Buffer> {
  const { renderMedia, selectComposition } = await load<Renderer>("@remotion/renderer")
  const url = await serveUrl(fresh)
  const inputProps = props as Record<string, unknown>
  const composition = await selectComposition({ serveUrl: url, id: spec.id, inputProps })
  const out = path.join(os.tmpdir(), `pax-video-${randomUUID()}.${format}`)
  try {
    await renderMedia({ composition, serveUrl: url, codec: FORMATS[format].codec, outputLocation: out, inputProps })
    return await readFile(out)
  } finally {
    await rm(out, { force: true })
  }
}

// -- Lambda -------------------------------------------------------------------------

export const lambdaConfigured = () => Boolean(process.env.REMOTION_LAMBDA_FUNCTION && process.env.REMOTION_LAMBDA_SERVE_URL)

const lambda = () => ({
  functionName: process.env.REMOTION_LAMBDA_FUNCTION!,
  serveUrl: process.env.REMOTION_LAMBDA_SERVE_URL!,
  region: (process.env.REMOTION_LAMBDA_REGION || "us-east-2") as AwsRegion,
})

/** A render's file name: the template and a hash of its props, so the same props are the same file. */
export const renderedName = (spec: AnySpec, props: unknown) => `${spec.id}-${hash(canonicalJson(props))}`
export const renderedKey = (spec: AnySpec, props: unknown, ext: Format | "png") => `rendered/${renderedName(spec, props)}.${ext}`
export const cdnUrl = (key: string) => `${CLIPS_CDN}/${key}`

/** Where a render's progress is kept: enough to re-attach to it from any request. */
export type LambdaRender = { renderId: string; bucketName: string }
export type Progress = { done: true; key: string } | { done: false; fatal: string | null; progress: number }

// The clips bucket has ACLs off (BucketOwnerEnforced): the CDN reads it through its origin access, so nothing is written public.
const PRIVACY = "no-acl" as const

/** Starts the poster: the composition's middle frame as a PNG, keyed beside the video. `started` settles once
 *  Lambda has the render (it then finishes whether or not this process lives); `done` once the file is written. */
export function renderStillOnLambda({ spec, props }: { spec: AnySpec; props: unknown }) {
  const key = renderedKey(spec, props, "png")
  let init = () => {}
  const initialised = new Promise<void>((resolve) => (init = resolve))
  const done = lambdaStill({
    ...lambda(),
    composition: spec.id,
    inputProps: props as Record<string, unknown>,
    imageFormat: "png",
    frame: Math.floor(durationOf(spec, props) / 2),
    outName: { bucketName: CLIPS_BUCKET, key },
    privacy: PRIVACY,
    onInit: () => init(),
  }).then(() => ({ key, url: cdnUrl(key) }))
  done.catch(() => {})
  return { key, url: cdnUrl(key), started: Promise.race([initialised, done.then(() => {})]), done }
}

/** Starts the video and its poster; resolves once Lambda has both, with the video's render to re-attach to. */
export async function startOnLambda({ spec, props, format }: { spec: AnySpec; props: unknown; format: Format }) {
  const key = renderedKey(spec, props, format)
  const poster = renderStillOnLambda({ spec, props })
  const [media] = await Promise.all([
    renderMediaOnLambda({
      ...lambda(),
      composition: spec.id,
      inputProps: props as Record<string, unknown>,
      codec: FORMATS[format].codec,
      outName: { bucketName: CLIPS_BUCKET, key },
      privacy: PRIVACY,
    }),
    poster.started,
  ])
  return { renderId: media.renderId, bucketName: media.bucketName, key, url: cdnUrl(key), poster }
}

/** Where a video render stands. A fatal error is Remotion's own, out of retries. */
export async function lambdaProgress({ renderId, bucketName }: LambdaRender): Promise<Progress> {
  const { functionName, region } = lambda()
  const p = await getRenderProgress({ functionName, region, renderId, bucketName })
  if (p.done && p.outKey) return { done: true, key: p.outKey }
  if (p.fatalErrorEncountered) return { done: false, fatal: p.errors.find((e) => e.isFatal)?.message ?? "The render failed.", progress: p.overallProgress }
  return { done: false, fatal: null, progress: p.overallProgress }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Polls a video render until it is done or fatal, or the budget runs out; the render goes on either way. */
export async function waitOnLambda(render: LambdaRender, budgetMs: number): Promise<Progress> {
  const until = Date.now() + budgetMs
  for (;;) {
    const p = await lambdaProgress(render)
    if (p.done || p.fatal || Date.now() + 2_000 > until) return p
    await sleep(2_000)
  }
}

/** Renders the video and its poster on Lambda, waiting up to budgetMs (Amplify cuts a response at about 30 s):
 *  the file's address when it is done in time, else the render to re-attach to with lambdaProgress. */
export async function renderOnLambda({ spec, props, format, budgetMs = 20_000 }: { spec: AnySpec; props: unknown; format: Format; budgetMs?: number }) {
  const start = Date.now()
  const s = await startOnLambda({ spec, props, format })
  const progress = await waitOnLambda(s, budgetMs - (Date.now() - start))
  return { url: s.url, key: s.key, poster: s.poster.url, posterKey: s.poster.key, renderId: s.renderId, bucketName: s.bucketName, progress }
}
