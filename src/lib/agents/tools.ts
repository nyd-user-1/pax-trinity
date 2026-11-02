import "server-only"

import type { Tool } from "@aws-sdk/client-bedrock-runtime"

import { DATA_TOOLS, type DataToolName } from "@/lib/chat-data/tools"

// The agents' tools. Trinity holds no legislative record (Brendan, 2026-11-01:
// "legislative record tools don't belong in trinity"), so what is left is the
// web, read in-process by lib/agents/run-tools; the posting connections; and
// the platform's own data. The Filer's form tools went with the Filer (2026-11-02).
//
// A `shape` trims a payload before it is billed as input tokens: the model
// needs the rows, not every column of them.

export type ToolName =
  | "web_search"
  | "read_page"
  | "post_to_slack"
  | "post_to_discord"
  | "deliver_report"
  // The platform's own data, read-only (lib/chat-data/tools.ts, 2026-11-02): the same six /chat holds.
  | DataToolName

// Converse types a tool's input schema as DocumentType — JSON, all the way
// down — so `Record<string, unknown>` will not go in. Naming the two shapes a
// JSON-Schema property can actually take here is both what the API wants and a
// check that no tool grows a parameter the model cannot be told the type of.
// An array of objects is the one nested shape allowed (the Filer's field lists
// needed it); it is spelled out rather than opened up.
type SchemaProperty =
  | {
      type: "string" | "integer" | "boolean"
      description: string
      enum?: string[]
    }
  | {
      type: "array"
      description: string
      items:
        | { type: "string" }
        | {
            type: "object"
            properties: Record<string, SchemaProperty>
            required?: string[]
          }
    }
  | {
      type: "object"
      description: string
      properties?: Record<string, SchemaProperty>
      required?: string[]
      additionalProperties?: { type: "string" }
    }
type Schema = {
  type: "object"
  properties: Record<string, SchemaProperty>
  required: string[]
}

type Definition = {
  description: string
  properties: Record<string, SchemaProperty>
  required?: string[]
  shape?: (data: unknown, input: Record<string, string>) => unknown
}

function trim<T>(rows: T[] | undefined, n: number) {
  return Array.isArray(rows) ? rows.slice(0, n) : []
}

export const DEFINITIONS: Record<ToolName, Definition> = {
  ...DATA_TOOLS,

  web_search: {
    description:
      "Search the web. Returns titles, links and short snippets — enough to cite and link, not the page itself. Six results by default; keep the query specific.",
    properties: {
      q: {
        type: "string",
        description:
          "The search query, as you would type it into a search engine.",
      },
      limit: { type: "integer", description: "1–10, default 6." },
    },
    required: ["q"],
    shape: (data) => {
      const d = data as { provider?: string; results?: unknown[] } | null
      if (!d) return null
      return { provider: d.provider, results: trim(d.results, 10) }
    },
  },

  read_page: {
    description:
      "Read one web page the search results pointed you at, as text. Use it when a snippet is not enough — a disclosure filing, a committee's own page, a table of figures. It gets through pages that refuse an ordinary fetch, which is most of the campaign-finance sources. Returns an excerpt with the page's full length; ask for a page you have a URL for, never a guessed one.",
    properties: {
      url: {
        type: "string",
        description: "The full http(s) URL, as a search result gave it.",
      },
    },
    required: ["url"],
    shape: (data) => {
      const d = data as Record<string, unknown> | null
      if (!d) return null
      const full = Number(d.full_chars) || 0
      const chars = Number(d.chars) || 0
      return {
        url: d.url,
        chars,
        full_chars: full,
        more:
          full > chars
            ? `${(full - chars).toLocaleString()} characters of this page were not read.`
            : null,
        text: d.text,
      }
    },
  },

  // Neither posting tool takes a destination, deliberately. This route is
  // public, so the model — and anyone who can reach the site and phrase a
  // request — decides the text; letting it also decide where the text lands
  // would turn one agent into a way to write anywhere the credential reaches.
  // Slack's channel is an SSM parameter; Discord's is baked into the webhook URL
  // and could not be a parameter even if we wanted it to be.
  post_to_slack: {
    description:
      "Post a message to the connected Slack channel. Use it once, at the end of a run, with the finished digest — not for progress notes.",
    properties: {
      text: {
        type: "string",
        description: "The message. Slack mrkdwn: *bold*, <url|label>.",
      },
    },
    required: ["text"],
  },

  deliver_report: {
    // No text parameter, deliberately, and not only for the reason the two
    // posting tools have none. A report is thousands of tokens the agent has
    // already written; making it retype them into an argument doubles the cost
    // of the longest thing it does and — on a host that discards a response
    // after thirty seconds — is how a finished report gets lost on its last
    // step. This tool sends what the run has already said.
    description:
      "Deliver the report you have written so far to wherever this agent is connected. Call it once, when the report is finished. You do not pass the report — it is what you have already written in this run. Give it a title.",
    properties: {
      title: {
        type: "string",
        description: "One line naming the report, as a subject line would.",
      },
    },
    required: ["title"],
  },

  post_to_discord: {
    description:
      "Post a message to the connected Discord channel. Use it once, at the end of a run, with the finished digest — not for progress notes.",
    properties: {
      text: {
        type: "string",
        description:
          "The message. Discord markdown: **bold**, *italic*, [label](url). Long digests are sent as an embed automatically; do not split it yourself.",
      },
    },
    required: ["text"],
  },

}

/** A tool call's input as strings, the shape every runner branch reads. */
export function normalise(
  _name: ToolName,
  input: Record<string, unknown>
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(input ?? {})) {
    if (value === undefined || value === null) continue
    out[key] = String(value)
  }
  return out
}

export function toolSpec(name: ToolName): Tool {
  const definition = DEFINITIONS[name]
  const json: Schema = {
    type: "object",
    properties: definition.properties,
    required: definition.required ?? [],
  }
  return {
    toolSpec: {
      name,
      description: definition.description,
      inputSchema: { json },
    },
  }
}
