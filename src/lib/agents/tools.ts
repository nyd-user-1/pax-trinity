import "server-only"

import type { Tool } from "@aws-sdk/client-bedrock-runtime"

import { DATA_TOOLS, type DataToolName } from "@/lib/chat-data/tools"

// The agents' tools. Trinity holds no legislative record (Brendan, 2026-11-01:
// "legislative record tools don't belong in trinity"), so what is left is the
// web, read in-process by lib/agents/run-tools; the posting connections; and
// the Filer's form tools, four of which the browser answers.
//
// A `shape` trims a payload before it is billed as input tokens: the model
// needs the rows, not every column of them.

export type ToolName =
  | "web_search"
  | "read_page"
  | "post_to_slack"
  | "post_to_discord"
  | "deliver_report"
  | "form_schema"
  | "ask"
  | "review"
  | "fill_form"
  | "remember"
  // The platform's own data, read-only (lib/chat-data/tools.ts, 2026-11-02): the same six /chat holds.
  | DataToolName

// Converse types a tool's input schema as DocumentType — JSON, all the way
// down — so `Record<string, unknown>` will not go in. Naming the two shapes a
// JSON-Schema property can actually take here is both what the API wants and a
// check that no tool grows a parameter the model cannot be told the type of.
// The Filer's `ask` hands the browser a list of fields, so an array of objects
// is the one nested shape allowed; it is spelled out rather than opened up.
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

  // ---- the Filer's tools ---------------------------------------------
  //
  // form_schema runs here (lib/agents/run-tools.ts). The other four are
  // client-side: the model calls them and the browser answers, because the
  // answers are the applicant's values and the model is never their ledger —
  // an SSN goes from the widget into the profile and from the profile into
  // the PDF, and the conversation carries a receipt. See lib/agents/loop.ts.

  form_schema: {
    description:
      "The sections of one of the two New York forms, in the order to ask them, with each section's keys — label, kind, fixed values, and the repeat for a section with rows. Call it once, first. Which keys the applicant's profile already holds is said on the first turn and in every ask receipt.",
    properties: {
      form: {
        type: "string",
        description: "Which form.",
        enum: ["ldss-2921", "ocfs-6025"],
      },
    },
    required: ["form"],
  },

  ask: {
    description:
      "Ask the applicant one section's questions as a widget in the chat. The browser renders the fields, collects the answers into the applicant's profile, and returns a receipt: which keys were answered and which were skipped. Call it alone, one section at a time, with only that section's keys from form_schema; a key the form does not have is refused. Keys the profile already knows arrive prefilled — include them so the applicant can confirm or edit, or leave them out to ask only the gap.",
    properties: {
      section: {
        type: "string",
        description: "The section's number or slug from form_schema.",
      },
      title: {
        type: "string",
        description: "The section's title, as form_schema gave it.",
      },
      intro: {
        type: "string",
        description: "One plain sentence above the fields, optional.",
      },
      fields: {
        type: "array",
        description: "The fields to show, in the form's order.",
        items: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description:
                "A key from form_schema. Row keys carry their row: household[1].dob.",
            },
            label: {
              type: "string",
              description:
                "What the applicant sees. Defaults to the key's own label.",
            },
            kind: {
              type: "string",
              description:
                "text, textarea, number, money, date, tel, email, ssn, select, radio, checkbox, yesno or attest. Defaults to the key's own kind.",
            },
            hint: {
              type: "string",
              description: "A short clarifier under the field, optional.",
            },
            required: {
              type: "boolean",
              description: "Blocks submit until answered. Default false.",
            },
          },
          required: ["key"],
        },
      },
      repeat: {
        type: "object",
        description:
          "For a section that repeats per person or per income: the row prefix and how many rows may be added.",
        properties: {
          key: {
            type: "string",
            description:
              "The row prefix: household, income, resources, absentParent.",
          },
          label: {
            type: "string",
            description: "What one row is: Person, Income.",
          },
          min: {
            type: "integer",
            description: "Rows shown at first. Default 1.",
          },
          max: {
            type: "integer",
            description: "Rows the paper form has room for.",
          },
        },
        required: ["key", "label", "max"],
      },
    },
    required: ["section", "title", "fields"],
  },

  review: {
    description:
      "Show every answer given for the form, grouped by section and editable, and wait for the applicant to confirm. Call it once, after the last section, before fill_form. Returns whether it was confirmed and how many answers there are.",
    properties: {
      form: {
        type: "string",
        description: "Which form.",
        enum: ["ldss-2921", "ocfs-6025"],
      },
    },
    required: ["form"],
  },

  fill_form: {
    description:
      "Write the applicant's answers into the form's own PDF fields in the browser and show the delivery card — download, email, save to the inbox. Call it once, after review confirms. Returns the filename, page count, how many fields were filled, and any keys the form had no field for.",
    properties: {
      form: {
        type: "string",
        description: "Which form.",
        enum: ["ldss-2921", "ocfs-6025"],
      },
    },
    required: ["form"],
  },

  remember: {
    description:
      "Keep facts the applicant states in conversation — a county, a household size, an employer — in their profile, so no later section asks for them. Values are keys from form_schema; unknown keys are rejected and reported back. Returns which keys were kept.",
    properties: {
      values: {
        type: "object",
        description:
          "Key → value, in the form's own vocabulary: dates YYYY-MM-DD, phones as ten digits, money as digits, fixed values by their value not their label.",
        additionalProperties: { type: "string" },
      },
    },
    required: ["values"],
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
