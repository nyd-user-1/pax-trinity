import "server-only"

import { DEFINITIONS, normalise, type ToolName } from "@/lib/agents/tools"
import { deliver } from "@/lib/agents/connections"
import { keyDef } from "@/lib/forms/keys"
import { formById } from "@/lib/forms/programs"
import { postToDiscord } from "@/lib/agents/connections/discord"
import { postToSlack } from "@/lib/agents/connections/slack"
import { readPage, webSearch } from "@/lib/agents/search"
import { isDataTool, runDataTool, type Viewer } from "@/lib/chat-data/tools"

// Executing a tool call, all of it in this process: the web reads, the
// connections and the Filer's schema. Trinity's agents read no legislative
// record (Brendan, 2026-11-01), so nothing goes out to /api/policy any more.

export type ToolOutcome = {
  ok: boolean
  /** What the model is given back. JSON for a hit, a sentence for a miss. */
  payload: unknown
  /** One line for the transcript the browser renders. */
  summary: string
  ms: number
}

function count(payload: unknown): string {
  if (Array.isArray(payload)) return payload.length ? `${payload.length} rows` : "nothing"
  if (payload && typeof payload === "object") {
    const entries = Object.entries(payload)
    const parts: string[] = []
    for (const [key, value] of entries) {
      if (Array.isArray(value) && value.length) parts.push(`${value.length} ${key}`)
    }
    if (parts.length) return parts.slice(0, 4).join(", ")
    // A search that matched nothing answers with the same shape as one that
    // matched everything — all the arrays are simply empty. Saying "1 record"
    // there read as a hit in the transcript.
    if (entries.length && entries.every(([, value]) => Array.isArray(value) && !value.length))
      return "nothing"
    return "1 record"
  }
  return payload == null ? "nothing" : "1 value"
}

export type ToolContext = {
  /** Everything the agent has written this run — what deliver_report sends. */
  report?: string
  /**
   * The subject the reader gave the task. It wins over the title the model
   * would have invented, so the Discord thread and the inbox thread carry the
   * same words — which is the whole point of a subject line.
   */
  title?: string
  /** The signed-in reader the run is for: the data tools answer for them, and an admin's alone to an admin. */
  viewer?: Viewer | null
}

/** A data tool's transcript line: how many it found, or why it found nothing. */
function dataSummary(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "nothing"
  const p = payload as Record<string, unknown>
  if (typeof p.error === "string") return p.error.slice(0, 120)
  const totals = [p, ...Object.values(p)].flatMap((v) => (v && typeof v === "object" && typeof (v as { total?: unknown }).total === "number" ? [(v as { total: number }).total] : []))
  return totals.length ? `${totals.reduce((a, b) => a + b, 0)} found` : "1 record"
}

export async function runTool(
  name: ToolName,
  rawInput: Record<string, unknown>,
  context?: ToolContext
): Promise<ToolOutcome> {
  const started = Date.now()
  // The data tools read in this process, for the reader the run is for (lib/chat-data/tools.ts).
  if (isDataTool(name)) {
    const out = await runDataTool(name, rawInput, context?.viewer ?? null)
    return { ok: out.ok, payload: out.payload, summary: dataSummary(out.payload), ms: Date.now() - started }
  }
  const definition = DEFINITIONS[name]
  const input = normalise(name, rawInput)

  if (name === "deliver_report") {
    const title =
      (context?.title ?? "").trim() || String(rawInput.title ?? "").trim() || "Report"
    const body = (context?.report ?? "").trim()
    if (!body)
      return {
        ok: false,
        payload: { error: "There is nothing written to deliver yet." },
        summary: "nothing written yet",
        ms: Date.now() - started,
      }
    const result = await deliver(`**${title}**\n\n${body}`)
    return {
      ok: result.ok,
      payload: result,
      summary: result.ok
        ? `delivered to ${result.where}${result.ref ? ` · id ${result.ref}` : ""}`
        : `not delivered — ${result.error}`,
      ms: Date.now() - started,
    }
  }

  // The Filer's schema: the form's sections in order, each with its keys as
  // the vocabulary defines them. Data, not a route. Whether the profile holds
  // a value is the browser's knowledge, and it rides on the first turn and in
  // every ask receipt rather than here.
  if (name === "form_schema") {
    const form = formById(String(rawInput.form ?? ""))
    if (!form)
      return { ok: false, payload: { error: "form must be ldss-2921 or ocfs-6025" }, summary: "unknown form", ms: Date.now() - started }
    const sections = form.sections.map((s) => ({
      section: s.n,
      title: s.title,
      pages: s.pages,
      ...(s.consent ? { consent: true } : {}),
      ...(s.repeat ? { repeat: { key: s.repeat.key, label: s.repeat.label, min: 1, max: s.repeat.max } } : {}),
      keys: s.keys.map((key) => {
        const def = keyDef(key)
        return { key, label: def?.label ?? key, kind: def?.kind ?? "text", ...(def?.options ? { options: def.options.map((o) => o.split("|")[0]) } : {}), ...(def?.multi ? { multi: true } : {}) }
      }),
    }))
    return {
      ok: true,
      payload: { form: form.id, code: form.code, title: form.title, sections },
      summary: `${sections.length} sections`,
      ms: Date.now() - started,
    }
  }

  if (name === "post_to_slack" || name === "post_to_discord") {
    // The destination is the connection's, never the model's — see the note
    // above the two posting tools in tools.ts.
    const post = name === "post_to_slack" ? postToSlack : postToDiscord
    const result = await post({ text: String(rawInput.text ?? "") })
    return {
      ok: result.ok,
      payload: result,
      // The id is the proof the post exists — "posted" on its own is the agent
      // asserting success, which is the thing this whole surface avoids.
      summary: result.ok
        ? `posted to ${result.where}${result.ref ? ` · id ${result.ref}` : ""}`
        : `not posted — ${result.error}`,
      ms: Date.now() - started,
    }
  }

  // A shape may decide an answer was not one, by returning an error. That is a
  // miss, and the transcript should say so rather than print "1 record".
  const settle = (body: unknown): ToolOutcome => {
    const shaped = definition?.shape ? definition.shape(body, input) : body
    const refused =
      shaped && typeof shaped === "object" && "error" in shaped
        ? String((shaped as { error: unknown }).error)
        : null
    return {
      ok: !refused,
      payload: shaped,
      summary: refused ? refused.slice(0, 120) : count(shaped),
      ms: Date.now() - started,
    }
  }

  // The web is read here, in this process (2026-11-01): over HTTP it needed an
  // origin and an open /api/agents/search, since this runner carries no session.
  if (name === "web_search" || name === "read_page") {
    try {
      if (name === "web_search") {
        const q = (input.q ?? "").trim()
        if (q.length < 2) throw new Error("a search term of two characters or more is required")
        return settle(await webSearch(q, Math.min(Number(input.limit) || 6, 10)))
      }
      const url = (input.url ?? "").trim()
      if (!/^https?:\/\//i.test(url)) throw new Error("url must be http or https")
      return settle(await readPage(url, 6000))
    } catch (error) {
      // The provider's sentence goes to the model, which can say what it could
      // not do rather than guess.
      const message = error instanceof Error ? error.message : String(error)
      console.error(`agents ${name} failed`, message)
      return { ok: false, payload: { error: message }, summary: message.slice(0, 120), ms: Date.now() - started }
    }
  }

  return { ok: false, payload: { error: `no such tool ${name}` }, summary: "unknown tool", ms: 0 }
}
