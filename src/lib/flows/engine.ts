import { memberByEmail } from "../roles"

import { claimDay, claimStep, daySk, readRoster, readSends, stepSk, writeEnrollment, writeOutcome, type Enrollment, type FlowStore } from "./store"

// The marketing flows' engine (Brendan, 2026-11-01). A signed-in user's visit to a page enrolls them in the
// flow that teaches it (enroll, from POST /api/flows/enroll); each tick (POST /api/fielding/tick, after the
// fielding work) mails the steps that are due, at most one per user per day, from the Assistant. The flows
// and their templates are worker-1's (lib/flows/defs.ts, the "Flows" kind in lib/agents/templates.ts); this
// file holds to their contract and takes everything it touches as `deps`, so the checks run in Node against
// a table double (engine.test.ts).

/** The contract's FlowDef (lib/flows/defs.ts), restated so the engine needs nothing from that file. */
export type FlowLike = { id: string; page: string; priority: number; steps: { template: string; day: number }[] }
type TemplateLike = { name: string; subject: string; body: string }
type Mail = { from: string; to: string[]; subject: string; markdown: string; base: string }
type Sent = { sent: string[]; held: string[]; error?: string }

export type FlowDeps = {
  flows: FlowLike[]
  templates: TemplateLike[]
  store: FlowStore
  mail: (m: Mail) => Promise<Sent>
  fill: (text: string, fields: Record<string, string>) => { text: string; missing: string[] }
  now: () => number
}

const DAY_MS = 24 * 3_600_000

/** The tick-day: the date in New York, the house's clock for mail. */
export const tickDay = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/New_York" })

/** The flow a path enrolls in: the one whose page is the path or a prefix of it at a segment boundary, the
 *  longest such page winning, then the lowest priority number. */
export function flowFor(flows: FlowLike[], path: string): FlowLike | null {
  const bare = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/"
  const hits = flows.filter((f) => {
    const page = f.page.replace(/\/+$/, "") || "/"
    return page === "/" ? bare === "/" : bare === page || bare.startsWith(`${page}/`)
  })
  return hits.sort((a, b) => b.page.length - a.page.length || a.priority - b.priority)[0] ?? null
}

export type EnrollResult = "enrolled" | "already" | "no flow" | "demo"

/** A visit: enrolls a signed-in user in the path's flow, once. A demo account's visits write nothing. */
export async function enroll(user: { email: string; demo?: boolean }, path: string, deps: Pick<FlowDeps, "flows" | "store" | "now">): Promise<EnrollResult> {
  if (user.demo) return "demo"
  const flow = flowFor(deps.flows, path)
  if (!flow) return "no flow"
  const email = user.email.trim().toLowerCase()
  const fresh = await writeEnrollment(deps.store, { email, flowId: flow.id, enrolledAt: new Date(deps.now()).toISOString(), path: path.split(/[?#]/)[0] })
  return fresh ? "enrolled" : "already"
}

/** Whether a step is due: enrolledAt plus its day in whole days has come, the boundary included. */
export const isDue = (enrolledAt: string, day: number, now: number) => Date.parse(enrolledAt) + day * DAY_MS <= now

/** "Brendan" for a member; otherwise the address's name part, its first word capitalised. */
export function recipientName(email: string): string {
  const member = memberByEmail(email)
  if (member?.name) return member.name.split(/\s+/)[0]
  const word = email.split("@")[0].split(/[._+-]/).find(Boolean) ?? "there"
  return word.charAt(0).toUpperCase() + word.slice(1)
}

export type TickLine = { email: string; did: string }

/** One pass: for each enrolled user, the first due step (lowest priority number, then lowest day) that has
 *  no send row, unless a send already went to them today. The day and the step are claimed before the mail
 *  goes, so overlapping ticks never send twice; a failed send is recorded and not retried. A step whose
 *  template is missing or leaves a field unfilled is passed over unclaimed, so it goes once that's fixed. */
export async function flowsTick(base: string, deps: FlowDeps): Promise<TickLine[]> {
  const now = deps.now()
  const today = tickDay(now)
  const at = new Date(now).toISOString()
  const byId = new Map(deps.flows.map((f) => [f.id, f]))
  const users = new Map<string, Enrollment[]>()
  for (const e of await readRoster(deps.store)) users.set(e.email, [...(users.get(e.email) ?? []), e])

  const out: TickLine[] = []
  for (const [email, enrollments] of users) {
    const sends = await readSends(deps.store, email)
    if (sends.some((r) => r.sk === daySk(today) || r.date === today)) continue
    const taken = new Set(sends.map((r) => r.sk))
    const due = enrollments
      .flatMap((e) => {
        const flow = byId.get(e.flowId)
        return flow ? flow.steps.filter((s) => isDue(e.enrolledAt, s.day, now) && !taken.has(stepSk(flow.id, s.day))).map((s) => ({ flow, step: s })) : []
      })
      .sort((a, b) => a.flow.priority - b.flow.priority || a.step.day - b.step.day)

    for (const { flow, step } of due) {
      const tpl = deps.templates.find((t) => t.name === step.template)
      if (!tpl) {
        out.push({ email, did: `skipped ${flow.id} day ${step.day}: no template "${step.template}"` })
        continue
      }
      const fields = { RECIPIENT_NAME: recipientName(email), PAGE_URL: `${base}${flow.page}`, SITE_URL: base }
      const subject = deps.fill(tpl.subject, fields)
      const body = deps.fill(tpl.body, fields)
      const missing = [...new Set([...subject.missing, ...body.missing])]
      if (missing.length) {
        out.push({ email, did: `skipped ${flow.id} day ${step.day}: "${tpl.name}" leaves ${missing.join(", ")} unfilled` })
        continue
      }
      if (!(await claimDay(deps.store, email, today, at))) break
      if (!(await claimStep(deps.store, email, flow.id, step.day, today, at, tpl.name))) {
        out.push({ email, did: `${flow.id} day ${step.day} already claimed` })
        break
      }
      let r: Sent
      try {
        r = await deps.mail({ from: "assistant", to: [email], subject: subject.text, markdown: body.text, base })
      } catch (e) {
        r = { sent: [], held: [], error: e instanceof Error ? e.message : String(e) }
      }
      const failed = r.error ?? (!r.sent.length && !r.held.length ? "nothing sent" : undefined)
      await writeOutcome(deps.store, email, flow.id, step.day, failed ? { failed, at } : { sent: r.sent.length ? r.sent : undefined, held: r.held.length ? r.held : undefined, at })
      out.push({ email, did: `${flow.id} day ${step.day} ${failed ? `failed: ${failed}` : r.sent.length ? "sent" : "held"}` })
      break
    }
  }
  return out
}
