import { NextResponse } from "next/server"

import { currentUser, forbidDemo } from "@/lib/auth"
// specs, not the registry: the registry carries the components, and Remotion's
// components cannot load in a route.
import { validate } from "@/video/specs"
import { cdnUrl, FORMATS, lambdaConfigured, lambdaProgress, renderLocal, renderOnLambda, type Format } from "@/video/render-server"

// POST { templateId, props, format: "mp4" | "webm", fresh? }: any signed-in account but a demo one
// (Brendan, 2026-11-01; admins only before), since a render spends Lambda money. Props already
// rendered are answered from the bucket unless `fresh`.
// Validates first (a schema failure is a 422 with zod's message, before
// any render), refuses anything over a minute, then renders. On Lambda the answer is JSON:
// { url, poster } on the clips CDN when the render finishes within the request, else a 202
// with { renderId, bucketName } to poll with GET ?renderId=&bucketName= until it is
// { url, poster } (Amplify cuts a response at about 30 s; see src/video/render-server.ts).
// Without Lambda, local development renders in-process and answers the file's bytes;
// production answers 501.

export const runtime = "nodejs"
export const maxDuration = 300

const MAX_DURATION_SECONDS = 60

const signIn = () => NextResponse.json({ error: "Sign in to render a video." }, { status: 401 })

export async function POST(req: Request) {
  const user = await currentUser()
  if (!user) return signIn()
  // A demo account renders nothing (lib/demo.ts): the sandbox spends no Lambda money.
  try {
    forbidDemo(user)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 })
  }
  let body: { templateId?: unknown; props?: unknown; format?: unknown; fresh?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "The body is not JSON." }, { status: 400 })
  }
  const format = (body.format ?? "mp4") as Format
  if (!(format in FORMATS)) return NextResponse.json({ error: `format is "mp4" or "webm".` }, { status: 400 })

  const v = validate(String(body.templateId ?? ""), body.props)
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 422 })
  const seconds = v.durationInFrames / v.spec.fps
  if (seconds > MAX_DURATION_SECONDS) return NextResponse.json({ error: `${seconds.toFixed(1)}s is over the ${MAX_DURATION_SECONDS}s limit.` }, { status: 422 })

  if (lambdaConfigured()) {
    try {
      const r = await renderOnLambda({ spec: v.spec, props: v.props, format, fresh: body.fresh === true })
      if (r.progress.done) return NextResponse.json({ url: r.url, poster: r.poster })
      if (r.progress.fatal) return NextResponse.json({ error: r.progress.fatal }, { status: 502 })
      return NextResponse.json({ renderId: r.renderId, bucketName: r.bucketName, progress: r.progress.progress }, { status: 202 })
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 502 })
    }
  }
  if (process.env.NODE_ENV !== "development") return NextResponse.json({ error: "Rendering a file needs Remotion Lambda here (REMOTION_LAMBDA_FUNCTION, REMOTION_LAMBDA_SERVE_URL)." }, { status: 501 })

  const file = await renderLocal({ spec: v.spec, props: v.props, format, fresh: body.fresh === true })
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": FORMATS[format].type,
      "Content-Disposition": `attachment; filename="${v.spec.id}.${format}"`,
      "Content-Length": String(file.length),
    },
  })
}

/** GET ?renderId=&bucketName=: where a Lambda render the POST started stands. */
export async function GET(req: Request) {
  if (!(await currentUser())) return signIn()
  if (!lambdaConfigured()) return NextResponse.json({ error: "Remotion Lambda is not configured here." }, { status: 501 })
  const q = new URL(req.url).searchParams
  const renderId = q.get("renderId") ?? ""
  const bucketName = q.get("bucketName") ?? ""
  // Remotion's own buckets only: the read runs on the server's role.
  if (!/^[a-z0-9]+$/.test(renderId) || !/^remotionlambda-[a-z0-9-]+$/.test(bucketName)) return NextResponse.json({ error: "renderId and bucketName name a Lambda render." }, { status: 400 })
  try {
    const p = await lambdaProgress({ renderId, bucketName })
    if (p.done) return NextResponse.json({ url: cdnUrl(p.key), poster: cdnUrl(p.key.replace(/\.\w+$/, ".png")) })
    if (p.fatal) return NextResponse.json({ error: p.fatal }, { status: 502 })
    return NextResponse.json({ renderId, bucketName, progress: p.progress }, { status: 202 })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
