import "server-only"

import { TEMPLATES } from "@/lib/agents/templates"
import { contactGroup } from "@/lib/fielding/contacts"
import { createFielding, events, fidOf, fieldingIds, newFid, newPid, record, type ClosedEvent, type FieldingDef, type InviteEvent } from "@/lib/fielding/store"
import { fill, sendMail } from "@/lib/mail/send"
import { surveyBySlug } from "@/lib/surveys/catalog"
import { surveyItems, type SurveyItem } from "@/lib/surveys/responses"
import { ENV, itemsFor, type RecordItem } from "@/lib/tests/responses"
import { getTest, saveTest } from "@/lib/tests/store"
import { PLACEBO } from "@/lib/tests/types"

// The Pollster's fielding (Brendan, 2026-10-29; docs/briefs/loop-agent.md).
// A survey or a test goes to a contact group: every member gets a link of
// their own, mailed from pax-pollster. A test's arms, the placebo included,
// are assigned when the links are made, balanced within the group (shuffled
// blocks of every arm), so a small group still fills each arm. Each tick
// reminds whoever hasn't finished (after remindAfterHours, and again
// finalBeforeHours before the close), closes the fielding at its quota or its
// deadline, computes the result, and mails it: the Analyst's readout and the
// Assistant's notice to the staff. Every send passes the allowlist.

const STAFF = ["brendan@nysgpt.com", "garrett@parallaxinnovations.com", "sajeela@parallaxinnovations.com", "ted@parallaxinnovations.com"]
const template = (name: string) => TEMPLATES.find((t) => t.name === name)!
const firstName = (name: string) => name.split(/\s+/)[0] || "there"
const HOUR = 3_600_000
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/New_York" })

/** Every arm once per block, each block shuffled, cut to n: balanced within the group. */
function balanced(arms: string[], n: number): string[] {
  const out: string[] = []
  while (out.length < n) {
    const block = [...arms]
    for (let i = block.length - 1; i > 0; i--) {
      const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1)
      ;[block[i], block[j]] = [block[j], block[i]]
    }
    out.push(...block)
  }
  return out.slice(0, n)
}

export const linkFor = (def: Pick<FieldingDef, "type" | "target">, pid: string, base: string) =>
  def.type === "test" ? `${base}/test/${encodeURIComponent(def.target)}?pid=${pid}` : `${base}/s/${encodeURIComponent(def.target)}?pid=${pid}`

export async function startFielding(o: { type: "test" | "survey"; target: string; group: string; quota?: number; closeAt?: string; remindAfterHours?: number; finalBeforeHours?: number; base: string }) {
  const group = contactGroup(o.group)
  if (!group) throw new Error("That group has no members to send to.")
  let title: string
  let arms: string[] = []
  let quota: number
  let questions: number
  if (o.type === "test") {
    const test = await getTest(o.target)
    if (!test) throw new Error(`No test ${o.target}.`)
    if (test.status !== "fielding") await saveTest({ ...test, status: "fielding" }, { create: false })
    title = test.title
    arms = test.arms
    quota = o.quota ?? test.targetPerArm
    questions = test.entry.length + 2
  } else {
    const survey = surveyBySlug(o.target)
    if (!survey) throw new Error(`No survey ${o.target}.`)
    title = survey.title
    quota = o.quota ?? group.members.length
    questions = survey.questions.length
  }
  const now = new Date()
  const def: FieldingDef = {
    kind: "fielding",
    fid: newFid(),
    type: o.type,
    target: o.target,
    title,
    group: group.handle,
    groupName: group.name,
    quota,
    closeAt: o.closeAt ?? new Date(now.getTime() + 72 * HOUR).toISOString(),
    remindAfterHours: o.remindAfterHours ?? 48,
    finalBeforeHours: o.finalBeforeHours ?? 24,
    createdAt: now.toISOString(),
  }
  await createFielding(def)
  const assigned = o.type === "test" ? balanced(arms, group.members.length) : []
  const tpl = template(o.type === "test" ? "Test invitation" : "Survey invitation")
  let sent = 0
  let held = 0
  for (const [i, member] of group.members.entries()) {
    const pid = newPid(def.fid)
    const link = linkFor(def, pid, o.base)
    const fields = { RECIPIENT_NAME: firstName(member.name), QUESTION_COUNT: String(questions), MINUTES: o.type === "test" ? "4" : "2", TEST_URL: link, SURVEY_URL: link, TOPIC: title.toLowerCase() }
    // A breath between sends: AgentMail limits how fast one inbox may send.
    if (i) await new Promise((r) => setTimeout(r, 400))
    const r = await sendMail({ from: "tracker", to: [member.email], subject: fill(tpl.subject, fields).text, markdown: fill(tpl.body, fields).text, base: o.base })
    if (r.sent.length) sent++
    else held++
    await record(def.fid, { kind: "invite", pid, email: member.email, name: member.name, arm: assigned[i], at: new Date().toISOString(), held: !r.sent.length || undefined, error: r.error })
  }
  return { fid: def.fid, sent, held }
}

export type ArmCount = { arm: string; invited: number; opened: number; started: number; finished: number }
export type Summary = {
  def: FieldingDef
  invited: number
  held: number
  opened: number
  started: number
  finished: number
  arms: ArmCount[]
  reminders: { first: number; final: number; firstAt?: string; finalAt?: string }
  closed?: ClosedEvent
  report?: Results
  /** The latest thing that happened: an invitation, an open, a reminder, a finish, the close. */
  lastAt: string
}

type Answer = { pid: string; arm?: string; answers: Record<string, string>; comprehensionCorrect?: boolean; completedAt: string }

async function answersFor(def: FieldingDef): Promise<{ started: Set<string>; finished: Answer[] }> {
  if (def.type === "test") {
    const items = (await itemsFor(def.target)).filter((x) => x.env === ENV && fidOf(x.pid) === def.fid)
    const started = new Set(items.filter((x) => x.kind === "start").map((x) => x.pid!))
    const finished = (items.filter((x) => x.kind === "complete") as RecordItem[]).map((x) => ({ pid: x.pid!, arm: x.arm, answers: x.answers, comprehensionCorrect: x.comprehensionCorrect, completedAt: x.completedAt }))
    return { started, finished }
  }
  const items = (await surveyItems(def.target)).filter((x: SurveyItem & { pid?: string | null }) => fidOf(x.pid) === def.fid) as (SurveyItem & { pid: string })[]
  return { started: new Set(items.map((x) => x.pid)), finished: items.map((x) => ({ pid: x.pid, answers: x.answers, completedAt: x.completedAt })) }
}

export async function summary(fid: string): Promise<Summary | null> {
  const ev = await events(fid)
  const def = ev.find((e) => e.kind === "fielding") as FieldingDef | undefined
  if (!def) return null
  const invites = ev.filter((e): e is InviteEvent => e.kind === "invite")
  const opened = new Set(ev.filter((e) => e.kind === "open").map((e) => (e as { pid: string }).pid))
  const reminders = ev.filter((e) => e.kind === "reminder") as { pid: string; round: "first" | "final"; at: string }[]
  const { started, finished } = await answersFor(def)
  const done = new Set(finished.map((f) => f.pid))
  const armOf = new Map(invites.map((i) => [i.pid, i.arm ?? ""]))
  const armIds = def.type === "test" ? [...new Set(invites.map((i) => i.arm ?? ""))].sort((a, b) => (a === PLACEBO ? -1 : b === PLACEBO ? 1 : a.localeCompare(b))) : [""]
  const arms = armIds.map((arm) => {
    const mine = (pid: string) => def.type !== "test" || armOf.get(pid) === arm
    return { arm, invited: invites.filter((i) => mine(i.pid)).length, opened: [...opened].filter(mine).length, started: [...started].filter(mine).length, finished: [...done].filter(mine).length }
  })
  const firsts = reminders.filter((r) => r.round === "first")
  const finals = reminders.filter((r) => r.round === "final")
  const report = ev.filter((e) => e.kind === "report").at(-1) as { results: Results } | undefined
  return {
    def,
    invited: invites.length,
    held: invites.filter((i) => i.held).length,
    opened: new Set([...opened, ...started, ...done]).size,
    started: new Set([...started, ...done]).size,
    finished: done.size,
    arms,
    reminders: { first: firsts.length, final: finals.length, firstAt: firsts.at(-1)?.at, finalAt: finals.at(-1)?.at },
    closed: ev.find((e) => e.kind === "closed") as ClosedEvent | undefined,
    report: report?.results,
    lastAt: [def.createdAt, ...ev.map((e) => (e as { at?: string }).at ?? ""), ...finished.map((f) => f.completedAt)].filter(Boolean).sort().at(-1)!,
  }
}

// -- the result ------------------------------------------------------------------------

export type ArmResult = { arm: string; n: number; yesPct: number; comprehensionPct: number; liftPp: number | null; marginPp: number | null; verdict: "detectable" | "inconclusive" | "placebo" }
export type Results =
  | { type: "test"; n: number; first: string; last: string; arms: ArmResult[] }
  | { type: "survey"; n: number; first: string; last: string; questions: { id: string; text: string; shares: { option: string; pct: number }[] }[] }

const pct = (k: number, n: number) => (n ? (100 * k) / n : 0)

/** Lift against the placebo in points, with the margin at 1.645 standard errors (the register's 90% convention). Unweighted. */
async function compute(def: FieldingDef): Promise<Results> {
  const { finished } = await answersFor(def)
  const dates = finished.map((f) => f.completedAt).sort()
  const first = dates[0] ?? def.createdAt
  const last = dates.at(-1) ?? def.createdAt
  if (def.type === "test") {
    const test = await getTest(def.target)
    const arms = test?.arms ?? [...new Set(finished.map((f) => f.arm!))]
    const level = (arm: string) => {
      const rows = finished.filter((f) => f.arm === arm)
      return { n: rows.length, yes: rows.filter((r) => r.answers.ballot === "yes").length, comp: rows.filter((r) => r.comprehensionCorrect).length }
    }
    const p = level(PLACEBO)
    const p0 = p.n ? p.yes / p.n : 0
    return {
      type: "test",
      n: finished.length,
      first,
      last,
      arms: arms.map((arm) => {
        const a = level(arm)
        if (arm === PLACEBO) return { arm, n: a.n, yesPct: pct(a.yes, a.n), comprehensionPct: pct(a.comp, a.n), liftPp: null, marginPp: null, verdict: "placebo" as const }
        const p1 = a.n ? a.yes / a.n : 0
        const lift = a.n && p.n ? 100 * (p1 - p0) : null
        const margin = a.n && p.n ? 100 * 1.645 * Math.sqrt((p1 * (1 - p1)) / a.n + (p0 * (1 - p0)) / p.n) : null
        return { arm, n: a.n, yesPct: pct(a.yes, a.n), comprehensionPct: pct(a.comp, a.n), liftPp: lift, marginPp: margin, verdict: lift != null && margin != null && Math.abs(lift) > margin && margin > 0 ? ("detectable" as const) : ("inconclusive" as const) }
      }),
    }
  }
  const survey = surveyBySlug(def.target)!
  return {
    type: "survey",
    n: finished.length,
    first,
    last,
    questions: survey.questions.map((q) => ({ id: q.id, text: q.text, shares: q.options.map((option) => ({ option, pct: pct(finished.filter((f) => f.answers[q.id] === option).length, finished.length) })) })),
  }
}

const signed = (x: number) => `${x >= 0 ? "+" : ""}${Math.round(x)}`

/** The Analyst's readout, as markdown, from the computed result. */
export function readout(def: FieldingDef, r: Results, armName: (id: string) => string): string {
  if (r.type === "test") {
    const ranked = r.arms.filter((a) => a.liftPp != null).sort((a, b) => b.liftPp! - a.liftPp!)
    const top = ranked[0]
    const placebo = r.arms.find((a) => a.verdict === "placebo")
    return [
      `${def.title} closed with **${r.n} completes** from ${def.groupName}, every respondent assigned at random to a cut or the placebo, balanced within the group.`,
      top ? `The strongest treatment was **${armName(top.arm)}**, ${signed(top.liftPp!)} points on Yes (±${Math.round(top.marginPp!)}) against the placebo's ${Math.round(placebo?.yesPct ?? 0)}%.` : "No treatment arm finished.",
      r.arms.map((a) => (a.verdict === "placebo" ? `- Placebo: ${Math.round(a.yesPct)}% Yes, n ${a.n}` : `- ${armName(a.arm)}: ${Math.round(a.yesPct)}% Yes, ${a.liftPp == null ? "no lift yet" : `${signed(a.liftPp)} (±${Math.round(a.marginPp!)}), ${a.verdict}`}; comprehension ${Math.round(a.comprehensionPct)}%; n ${a.n}`)).join("\n"),
      "The levels are unweighted; with this few per arm every margin is wide, so read the order, not the size.",
      "Analyst",
    ].join("\n\n")
  }
  return [
    `${def.title} closed with **${r.n} completes** from ${def.groupName}.`,
    r.questions.map((q) => `- ${q.text}: ${q.shares.map((s) => `${s.option} ${Math.round(s.pct)}%`).join(", ")}`).join("\n"),
    `The full topline is [here](/survey/${def.target}).`,
    "Analyst",
  ].join("\n\n")
}

async function close(s: Summary, reason: ClosedEvent["reason"], base: string, armName: (id: string) => string) {
  const at = new Date().toISOString()
  await record(s.def.fid, { kind: "closed", at, reason })
  const results = await compute(s.def)
  await record(s.def.fid, { kind: "report", at: new Date().toISOString(), results })
  if (s.def.type === "test") {
    const test = await getTest(s.def.target)
    if (test && test.status === "fielding") await saveTest({ ...test, status: "closed" }, { create: false })
  }
  const subject = s.def.type === "test" ? `Results: ${s.def.title}` : `Topline: ${s.def.title}`
  await sendMail({ from: "bill-reader", to: STAFF, subject, markdown: readout(s.def, results, armName), base })
  await sendMail({
    from: "assistant",
    to: STAFF,
    subject: `Results are in: ${s.def.title}`,
    markdown: [`${s.def.title} closed ${reason === "quota" ? "at its quota" : reason === "deadline" ? "at its deadline" : "by hand"} with ${results.n} completes, and the Analyst's readout is in your inbox.`, s.def.type === "test" ? "Lift and the report pick it up from here." : "America Thinks files the answers under Responses.", "Assistant"].join("\n\n"),
    base,
  })
}

/** One pass over every open fielding: reminders, then the close. Safe to call as often as anyone likes. */
export async function tick(base: string, armName: (id: string) => string) {
  const out: { fid: string; did: string[] }[] = []
  for (const fid of await fieldingIds()) {
    const s = await summary(fid)
    if (!s || s.closed) continue
    const did: string[] = []
    const now = Date.now()
    const reached = s.def.type === "test" ? s.arms.length > 0 && s.arms.every((a) => a.finished >= s.def.quota) : s.finished >= s.def.quota
    const late = now >= Date.parse(s.def.closeAt)
    if (reached || late) {
      await close(s, reached ? "quota" : "deadline", base, armName)
      out.push({ fid, did: [`closed (${reached ? "quota" : "deadline"})`] })
      continue
    }
    const ev = await events(fid)
    const invites = ev.filter((e): e is InviteEvent => e.kind === "invite" && !e.held)
    const reminded = (pid: string, round: "first" | "final") => ev.some((e) => e.kind === "reminder" && e.pid === pid && e.round === round)
    const { finished } = await answersFor(s.def)
    const done = new Set(finished.map((f) => f.pid))
    for (const inv of invites) {
      if (done.has(inv.pid)) continue
      const round: "first" | "final" | null =
        !reminded(inv.pid, "first") && now - Date.parse(inv.at) >= s.def.remindAfterHours * HOUR ? "first" : !reminded(inv.pid, "final") && Date.parse(s.def.closeAt) - now <= s.def.finalBeforeHours * HOUR ? "final" : null
      if (!round) continue
      const link = linkFor(s.def, inv.pid, base)
      const tpl = template(s.def.type === "test" ? "Test reminder" : "Survey reminder")
      const fields = { RECIPIENT_NAME: firstName(inv.name), SENT_DATE: day(inv.at), MINUTES: s.def.type === "test" ? "4" : "2", TEST_URL: link, SURVEY_URL: link, SURVEY_NAME: s.def.title, TOPIC: s.def.title.toLowerCase(), CLOSE_DATE: day(s.def.closeAt) }
      const r = await sendMail({ from: "tracker", to: [inv.email], subject: fill(tpl.subject, fields).text, markdown: fill(tpl.body, fields).text, base })
      if (r.sent.length) {
        await record(fid, { kind: "reminder", pid: inv.pid, round, at: new Date().toISOString() })
        did.push(`${round} reminder ${inv.email}`)
      }
    }
    if (did.length) out.push({ fid, did })
  }
  return out
}

/** Closes a fielding now, whatever its counts. */
export async function closeNow(fid: string, base: string, armName: (id: string) => string) {
  const s = await summary(fid)
  if (!s || s.closed) return false
  await close(s, "by hand", base, armName)
  return true
}

/** A pid's assigned arm, when the pid is one of a fielding's; records that its link was opened. */
export async function armForPid(pid: string | null): Promise<string | null> {
  const fid = fidOf(pid)
  if (!fid || !pid) return null
  const invite = (await events(fid)).find((e): e is InviteEvent => e.kind === "invite" && e.pid === pid)
  if (!invite) return null
  await record(fid, { kind: "open", pid, at: new Date().toISOString() }).catch(() => {})
  return invite.arm ?? null
}
