import { readFile, stat } from "node:fs/promises"
import path from "node:path"

import { currentUser } from "@/lib/auth"

// Remotion Studio, served to admins from the static bundle the prebuild makes (npm run studio:bundle, into
// .studio-bundle/, its public path /studio-app/). /studio frames it, and so does the right panel's Studio view.
// A file name answers with that file; any other path is a composition's address in the Studio
// (/studio-app/v-lift-card-2), so it answers with index.html and the Studio opens on it. Everyone but an
// admin gets a 403. next.config.ts's outputFileTracingIncludes ships the files with this route.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ROOT = path.join(/* turbopackIgnore: true */ process.cwd(), ".studio-bundle")

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  // Only bundle.js.map ships; the Studio reads it to show where each sequence sits in the code.
  ".map": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
}

/** One path segment of a file the bundle could hold: no slashes, no "..", nothing hidden. */
const SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/

async function send(file: string, req: Request): Promise<Response | null> {
  const s = await stat(file).catch(() => null)
  if (!s?.isFile()) return null
  // The bundle's names are not hashed (bundle.js), so every load asks again; the tag makes the answer a 304.
  const etag = `"${s.size.toString(36)}-${Math.floor(s.mtimeMs).toString(36)}"`
  const headers = { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "private, no-cache", etag }
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers })
  return new Response(new Uint8Array(await readFile(file)), { headers })
}

export async function GET(req: Request, { params }: { params: Promise<{ path?: string[] }> }) {
  const user = await currentUser()
  if (!user?.admin) return new Response("Admins only.", { status: 403 })

  const parts = (await params).path ?? []
  if (!parts.every((p) => SEGMENT.test(p))) return new Response("Not found", { status: 404 })

  const ext = path.extname(parts.at(-1) ?? "")
  if (ext) {
    // A file: only the kinds the bundle ships, and only inside the bundle.
    const file = path.join(ROOT, ...parts)
    const found = TYPES[ext] && file.startsWith(ROOT + path.sep) ? await send(file, req) : null
    return found ?? new Response("Not found", { status: 404 })
  }

  return (await send(path.join(ROOT, "index.html"), req)) ?? new Response("The Studio has not been bundled: run npm run studio:bundle.", { status: 503 })
}
