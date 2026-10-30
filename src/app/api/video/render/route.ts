import { NextResponse } from "next/server"

// specs, not the registry: the registry carries the components, and Remotion's
// components cannot load in a route.
import { validate } from "@/video/specs"
import { FORMATS, lambdaConfigured, renderLocal, renderOnLambda, type Format } from "@/video/render-server"

// POST { templateId, props, format: "mp4" | "webm", fresh? } → the rendered
// file. Validates first (a schema failure is a 422 with zod's message, before
// any render), refuses anything over a minute, then renders: on Lambda once it
// is wired, else locally in development. Production answers 501 until Lambda
// is wired; see src/video/render-server.ts for why.

export const runtime = "nodejs"
export const maxDuration = 300

const MAX_DURATION_SECONDS = 60

export async function POST(req: Request) {
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

  if (lambdaConfigured())
    return renderOnLambda({ spec: v.spec, props: v.props, format }).catch((e: Error) => NextResponse.json({ error: e.message }, { status: 501 }))
  if (process.env.NODE_ENV !== "development")
    return NextResponse.json({ error: "Rendering a file runs in local development until @remotion/lambda is wired." }, { status: 501 })

  const file = await renderLocal({ spec: v.spec, props: v.props, format, fresh: body.fresh === true })
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": FORMATS[format].type,
      "Content-Disposition": `attachment; filename="${v.spec.id}.${format}"`,
      "Content-Length": String(file.length),
    },
  })
}
