import { beforeEach, describe, expect, it } from "vitest"

import { enroll, flowFor, flowsTick, isDue, linkFields, recipientName, tickDay, type FlowDeps, type FlowLike } from "./engine"
import type { FlowStore, Row } from "./store"

// The flows engine against a table double (Brendan, 2026-11-01): the ledger's putOnce and query, with the
// same conditional write, and a pause on every call so overlapping ticks actually interleave. The two flows
// below are a stub of the contract; worker-1's lib/flows/defs.ts holds the real ones.

const pause = () => new Promise((r) => setTimeout(r, 0))

function table(): FlowStore & { rows: Map<string, Row> } {
  const rows = new Map<string, Row>()
  return {
    rows,
    async putOnce(item) {
      await pause()
      const key = `${item.pk}\u0000${item.sk}`
      if (rows.has(key)) return false
      rows.set(key, { ...item })
      return true
    },
    async query(pk, prefix) {
      await pause()
      return [...rows.values()].filter((r) => r.pk === pk && (!prefix || r.sk.startsWith(prefix))).sort((a, b) => a.sk.localeCompare(b.sk))
    },
  }
}

const FLOWS: FlowLike[] = [
  { id: "chat", page: "/chat", priority: 1, steps: [{ template: "Chat 0", day: 0 }, { template: "Chat 2", day: 2 }] },
  { id: "clips", page: "/clips", priority: 2, steps: [{ template: "Clips 0", day: 0 }] },
]
const TEMPLATES = ["Chat 0", "Chat 2", "Clips 0"].map((name) => ({ name, subject: `${name} for {{RECIPIENT_NAME}}`, body: `Hi {{RECIPIENT_NAME}}, open {{PAGE_URL}}.` }))
const fill = (text: string, fields: Record<string, string>) => {
  const missing: string[] = []
  return { text: text.replace(/\{\{([A-Z_]+)\}\}/g, (w, n: string) => fields[n] ?? (missing.push(n), w)), missing }
}

const HOUR = 3_600_000
// Noon in New York on 2 November 2026, so a tick-day is a plain date.
const T0 = Date.parse("2026-11-02T17:00:00Z")
const USER = { email: "Reader@Example.org" }
const EMAIL = "reader@example.org"

let store: ReturnType<typeof table>
let mails: { to: string[]; subject: string; markdown: string }[]
let reply: (to: string[]) => { sent: string[]; held: string[]; error?: string }
let clock: number
const deps = (over: Partial<FlowDeps> = {}): FlowDeps => ({
  flows: FLOWS,
  templates: TEMPLATES,
  store,
  fill,
  now: () => clock,
  mail: async (m) => {
    await pause()
    mails.push(m)
    return reply(m.to)
  },
  ...over,
})

beforeEach(() => {
  store = table()
  mails = []
  reply = (to) => ({ sent: to, held: [] })
  clock = T0
})

describe("enrollment", () => {
  it("maps a path to its flow at a segment boundary", () => {
    expect(flowFor(FLOWS, "/chat")?.id).toBe("chat")
    expect(flowFor(FLOWS, "/chat/abc?x=1")?.id).toBe("chat")
    expect(flowFor(FLOWS, "/chat/")?.id).toBe("chat")
    expect(flowFor(FLOWS, "/chatter")).toBeNull()
    expect(flowFor(FLOWS, "/")).toBeNull()
    expect(flowFor(FLOWS, "/lift")).toBeNull()
  })

  it("a repeat visit never re-enrolls: one enrollment, one roster row, the first time kept", async () => {
    expect(await enroll(USER, "/chat", deps())).toBe("enrolled")
    clock = T0 + 5 * HOUR
    expect(await enroll(USER, "/chat/thread-9", deps())).toBe("already")
    const flowRows = [...store.rows.values()].filter((r) => r.pk === `FLOW#${EMAIL}`)
    const roster = [...store.rows.values()].filter((r) => r.pk === "FLOWS")
    expect(flowRows).toHaveLength(1)
    expect(roster).toHaveLength(1)
    expect(flowRows[0]).toMatchObject({ sk: "chat", email: EMAIL, enrolledAt: new Date(T0).toISOString(), path: "/chat" })
    expect(roster[0].sk).toBe(`${EMAIL}#chat`)
  })

  it("a demo account's visits write nothing", async () => {
    expect(await enroll({ email: "demo@nysgpt.com", demo: true }, "/chat", deps())).toBe("demo")
    expect(store.rows.size).toBe(0)
  })

  it("a page without a flow writes nothing", async () => {
    expect(await enroll(USER, "/lift", deps())).toBe("no flow")
    expect(store.rows.size).toBe(0)
  })
})

describe("the tick", () => {
  it("overlapping ticks never send a step twice", async () => {
    await enroll(USER, "/chat", deps())
    const results = await Promise.all([flowsTick("https://x", deps()), flowsTick("https://x", deps()), flowsTick("https://x", deps())])
    expect(mails).toHaveLength(1)
    expect(results.flat().filter((l) => l.did.endsWith("sent"))).toHaveLength(1)
    expect(store.rows.has(`FLOWSEND#${EMAIL}\u0000chat#0`)).toBe(true)
  })

  it("sends at most one step per user per day, priority first, then the rest on later days", async () => {
    await enroll(USER, "/clips", deps())
    await enroll(USER, "/chat", deps())
    await flowsTick("https://x", deps())
    expect(mails.map((m) => m.subject)).toEqual(["Chat 0 for Reader"])
    clock = T0 + 6 * HOUR // later the same New York day
    await flowsTick("https://x", deps())
    expect(mails).toHaveLength(1)
    clock = T0 + 24 * HOUR
    await flowsTick("https://x", deps())
    expect(mails.map((m) => m.subject)).toEqual(["Chat 0 for Reader", "Clips 0 for Reader"])
    clock = T0 + 48 * HOUR
    await flowsTick("https://x", deps())
    expect(mails.map((m) => m.subject)).toEqual(["Chat 0 for Reader", "Clips 0 for Reader", "Chat 2 for Reader"])
    clock = T0 + 96 * HOUR
    await flowsTick("https://x", deps())
    expect(mails).toHaveLength(3)
  })

  it("due-date math holds at the boundary", async () => {
    expect(isDue(new Date(T0).toISOString(), 0, T0)).toBe(true)
    expect(isDue(new Date(T0).toISOString(), 2, T0 + 48 * HOUR - 1)).toBe(false)
    expect(isDue(new Date(T0).toISOString(), 2, T0 + 48 * HOUR)).toBe(true)
    await enroll(USER, "/chat", deps())
    await flowsTick("https://x", deps()) // day 0
    clock = T0 + 48 * HOUR - 1 // the same New York day as the boundary, a millisecond short
    await flowsTick("https://x", deps())
    expect(mails).toHaveLength(1)
    clock = T0 + 48 * HOUR
    await flowsTick("https://x", deps())
    expect(mails.map((m) => m.subject)).toEqual(["Chat 0 for Reader", "Chat 2 for Reader"])
  })

  it("the tick-day is New York's date", () => {
    expect(tickDay(Date.parse("2026-11-03T04:59:59Z"))).toBe("2026-11-02")
    expect(tickDay(Date.parse("2026-11-03T05:00:00Z"))).toBe("2026-11-03")
  })

  it("a failed send is recorded on its own row and never retried", async () => {
    reply = () => ({ sent: [], held: [], error: "AgentMail 500: down" })
    await enroll(USER, "/chat", deps())
    await flowsTick("https://x", deps())
    expect(store.rows.get(`FLOWSEND#${EMAIL}\u0000chat#0#outcome`)).toMatchObject({ failed: "AgentMail 500: down" })
    reply = (to) => ({ sent: to, held: [] })
    clock = T0 + 24 * HOUR
    await flowsTick("https://x", deps())
    expect(mails).toHaveLength(1) // chat day 0 was not tried again; chat day 2 isn't due yet
  })

  it("a held recipient (off the allowlist) is the step's outcome, not a retry", async () => {
    reply = (to) => ({ sent: [], held: to })
    await enroll(USER, "/chat", deps())
    await flowsTick("https://x", deps())
    expect(store.rows.get(`FLOWSEND#${EMAIL}\u0000chat#0#outcome`)).toMatchObject({ held: [EMAIL] })
    clock = T0 + 24 * HOUR
    await flowsTick("https://x", deps())
    expect(mails).toHaveLength(1)
  })

  it("a step with no template yet is passed over unclaimed, and goes once the template lands", async () => {
    await enroll(USER, "/chat", deps())
    const lines = await flowsTick("https://x", deps({ templates: TEMPLATES.filter((t) => t.name !== "Chat 0") }))
    expect(mails).toHaveLength(0)
    expect(lines[0].did).toMatch(/no template "Chat 0"/)
    expect([...store.rows.keys()].some((k) => k.startsWith(`FLOWSEND#`))).toBe(false)
    await flowsTick("https://x", deps())
    expect(mails.map((m) => m.subject)).toEqual(["Chat 0 for Reader"])
  })

  it("fills PAGE_URL and SITE_URL with no trailing slash, whatever the origin or page carries", async () => {
    expect(linkFields("https://x.app/", "/chat/", EMAIL)).toEqual({ RECIPIENT_NAME: "Reader", PAGE_URL: "https://x.app/chat", SITE_URL: "https://x.app" })
    expect(linkFields("https://x.app", "/lift", EMAIL)).toMatchObject({ PAGE_URL: "https://x.app/lift", SITE_URL: "https://x.app" })
    const templates = [{ name: "Chat 0", subject: "Hi", body: "{{PAGE_URL}}?record=1 and {{SITE_URL}}/docs/chat" }]
    await enroll(USER, "/chat", deps())
    await flowsTick("https://x.app/", deps({ templates }))
    expect(mails[0].markdown).toBe("https://x.app/chat?record=1 and https://x.app/docs/chat")
  })

  it("fills the recipient's name from the member, else the address's name part", () => {
    expect(recipientName("brendan@nysgpt.com")).toBe("Brendan")
    expect(recipientName("sam.lee@example.org")).toBe("Sam")
  })
})
