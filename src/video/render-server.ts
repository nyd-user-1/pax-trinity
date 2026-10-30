import "server-only"

import { randomUUID } from "node:crypto"
import { readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import type { AnySpec } from "./specs"

// Rendering a template to a file, on the server. Local development only for
// now: @remotion/renderer drives a headless Chrome and ships native compositor
// binaries, which belong neither in Amplify's 220 MB server bundle nor in a
// request on its compute. Both packages are loaded by a name the build's file
// tracer cannot follow, so neither reaches the deploy. Production's path is
// @remotion/lambda, stubbed below; until it is wired the Player draws every
// template in the browser, and the browser can render a file itself
// (@remotion/web-renderer, as the chat's footage does).

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

/** The Lambda seam, not wired yet. TODO(lambda): deploy the function and the
 *  site (deploySite with src/video/index.ts), set REMOTION_LAMBDA_FUNCTION and
 *  REMOTION_LAMBDA_SERVE_URL, and call renderMediaOnLambda here, returning the
 *  S3 location rather than bytes. */
export const lambdaConfigured = () => Boolean(process.env.REMOTION_LAMBDA_FUNCTION && process.env.REMOTION_LAMBDA_SERVE_URL)

export async function renderOnLambda(_: { spec: AnySpec; props: unknown; format: Format }): Promise<never> {
  throw new Error("@remotion/lambda is not wired yet.")
}
