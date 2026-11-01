import { NextResponse } from "next/server"

import { readPage, webSearch } from "@/lib/agents/search"
import { currentUser } from "@/lib/auth"

// The agents' one read that is not the legislative record. It sits here rather
// than under /api/policy because /api/policy is the record — jurisdiction
// scoped, half-hour edge cache, one resource per legislature — and a web search
// is none of those things.
//
// The agents no longer come through here: the tool runner calls lib/agents/search
// in its own process (lib/agents/run-tools.ts). The route stays for a signed-in
// browser, behind the same sign-in as /api/agents/chat, since every call is a
// paid search. No cache header: a search for what happened this week should not
// be answered with what happened last fortnight.

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!(await currentUser())) return NextResponse.json({ error: "Sign in to search." }, { status: 401 })
  const sp = new URL(request.url).searchParams
  const q = (sp.get("q") ?? "").trim()
  // `url=` reads one page instead of searching for several — the half that
  // gets through a site which refuses a plain fetch.
  const url = (sp.get("url") ?? "").trim()
  if (!url && q.length < 2) return NextResponse.json({ error: "a search term of two characters or more is required" }, { status: 400 })
  if (url && !/^https?:\/\//i.test(url)) return NextResponse.json({ error: "url must be http or https" }, { status: 400 })
  try {
    if (url) return NextResponse.json(await readPage(url, Number(sp.get("chars")) || 6000))
    return NextResponse.json(await webSearch(q, Number(sp.get("limit")) || 6))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("agents/search failed", message)
    // 503 with the sentence, as /api/policy does: the runner hands the sentence
    // to the model, which can say what it could not do rather than guess.
    return NextResponse.json({ error: message }, { status: 503 })
  }
}
