import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { TEMPLATES } from "../agents/templates"
import { FLOWS } from "./defs"

// The flows as the engine reads them (./defs.ts) and the mail they send (lib/agents/templates.ts, kind
// Flows): every step's template exists, every page is a route, the priorities and days read, and every
// mail keeps the house's rules and fills only the three fields the engine's tick fills.

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const FIELDS = new Set(["RECIPIENT_NAME", "PAGE_URL", "SITE_URL"])
const DOC_SLUGS = new Set(
  fs
    .readdirSync(path.join(SRC, "lib/docs"))
    .filter((f) => f.endsWith(".ts"))
    .flatMap((f) => [...fs.readFileSync(path.join(SRC, "lib/docs", f), "utf8").matchAll(/slug: "([a-z0-9-]+)"/g)].map((m) => m[1])),
)
const flowTemplates = TEMPLATES.filter((t) => t.kind === "Flows")
const byName = new Map(TEMPLATES.map((t) => [t.name, t]))

describe("FLOWS", () => {
  it("is the six flows, in priority order, each a real page", () => {
    expect(FLOWS.map((f) => [f.id, f.page, f.priority])).toEqual([
      ["chat", "/chat", 1],
      ["lift", "/lift", 2],
      ["america-thinks", "/america-thinks", 3],
      ["studio", "/studio", 4],
      ["inbox", "/inbox", 5],
      ["survey", "/survey", 6],
    ])
    expect(new Set(FLOWS.map((f) => f.priority)).size).toBe(FLOWS.length)
    expect(new Set(FLOWS.map((f) => f.id)).size).toBe(FLOWS.length)
    for (const f of FLOWS) expect(fs.existsSync(path.join(SRC, "app", f.page, "page.tsx")), f.page).toBe(true)
  })

  it("steps on days 0, 2, 5 and 9, ascending, each naming a Flows template from the Assistant", () => {
    for (const f of FLOWS) {
      const days = f.steps.map((s) => s.day)
      expect(days, f.id).toEqual([0, 2, 5, 9])
      expect(days.every((d, i) => i === 0 || d > days[i - 1]), f.id).toBe(true)
      for (const s of f.steps) {
        const t = byName.get(s.template)
        expect(t, s.template).toBeDefined()
        expect(t?.kind, s.template).toBe("Flows")
        expect(t?.from, s.template).toBe("assistant")
      }
    }
  })

  it("uses every Flows template once, and no other", () => {
    const used = FLOWS.flatMap((f) => f.steps.map((s) => s.template))
    expect(new Set(used).size).toBe(used.length)
    expect([...used].sort()).toEqual(flowTemplates.map((t) => t.name).sort())
  })
})

describe.each(flowTemplates.map((t) => [t.name, t] as const))("%s", (name, t) => {
  it("is named, keyed and headed the house way", () => {
    expect(name).toMatch(/^(Chat|Lift|America Thinks|Studio|Inbox|Survey) flow [1-4]: \S/)
    expect(t.id).toBe(`local-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`)
    const blocks = t.body.split("\n\n")
    expect(blocks[0]).toBe(`**${t.subject}**`)
    expect(blocks[1]).toBe("Hi {{RECIPIENT_NAME}},")
    expect(blocks.at(-1)).toBe("Assistant")
  })

  it("fills only the engine's three fields", () => {
    const fields = [...`${t.subject}\n${t.body}`.matchAll(/\{\{([A-Z_]+)\}\}/g)].map((m) => m[1])
    expect(fields.filter((f) => !FIELDS.has(f))).toEqual([])
  })

  it("has one button, to its flow's page or a doc that exists", () => {
    const buttons = t.body.split("\n\n").filter((b) => /^\[[^\]]+\]\([^)\s]+\)$/.test(b))
    expect(buttons).toHaveLength(1)
    const href = buttons[0].match(/\(([^)\s]+)\)$/)![1]
    const doc = href.match(/^\{\{SITE_URL\}\}\/docs\/([a-z0-9-]+)$/)?.[1]
    if (doc) expect(DOC_SLUGS.has(doc), href).toBe(true)
    else expect(href).toMatch(/^\{\{PAGE_URL\}\}(\?[a-z]+=[a-z0-9]+)?$/)
    // Every link in the mail, the button's included, is one the engine can fill.
    for (const m of t.body.matchAll(/\]\(([^)\s]+)\)/g)) expect(m[1], m[1]).toMatch(/^\{\{(PAGE_URL|SITE_URL)\}\}/)
  })

  it("speaks as I, never we, and draws no arrow", () => {
    const text = `${t.subject}\n${t.body}`
    expect(text).not.toMatch(/\b(we|we're|we've|our|ours|us)\b/i)
    expect(text).not.toMatch(/the platform/i)
    expect(text).not.toContain("→")
  })
})
