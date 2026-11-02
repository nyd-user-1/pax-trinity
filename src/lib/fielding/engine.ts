import "server-only"

import { TEMPLATES } from "@/lib/agents/templates"
import { contactGroup } from "@/lib/fielding/contacts"
import { createFielding, events, fidOf, fieldingIds, newFid, newPid, record, recordOnce, type ClosedEvent, type FieldingDef, type FieldingEvent, type InviteEvent } from "@/lib/fielding/store"
import { fill, sendMail } from "@/lib/mail/send"
import { completeTest } from "@/lib/results/complete"
import { videoOf, type VideoState } from "@/lib/results/video"
import { surveyBySlug } from "@/lib/surveys/catalog"
import { surveyItems, type SurveyItem } from "@/lib/surveys/responses"
import { ENV, itemsFor, type RecordItem } from "@/lib/tests/responses"
import { getTest } from "@/lib/tests/store"
import { PLACEBO } from "@/lib/tests/types"

// The Pollster's fielding (Brendan, 2026-10-29; docs/briefs/loop-agent.md).
// A survey or a test goes to a contact group: every member gets a link of
// their own, mailed from pax-pollster. A test's arms, the placebo included,
// are assigned when the links are made, balanced within the group (shuffled
// blocks of every arm), so a small group still fills each arm. Each tick
// reminds whoever hasn't finished or been screened out (after remindAfterHours,
// and again finalBeforeHours before the close, never sooner than twelve hours
// after the first), closes the fielding at its quota or its deadline, computes
// the result, and mails it: the Analyst's readout and the Assistant's notice.
// The close, the report and each reminder are written once under fixed keys,
// so overlapping ticks (two open Inboxes) cannot send anything twice; a close
// whose report never landed is finished by the next tick. A test's close also
// writes its results (lib/results/complete.ts) and starts their video, and the
// report waits for the video across ticks, never within one: while it renders the
// report is not recorded, and a later tick picks it up and mails the readout with
// the poster, or without it when the render failed. The fielding's state lives on
// the fielding: a closed fielding's links say so, and the test itself stays as its
// owner set it in /message-tests.

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
    // The test's own state is its owner's, set and validated in /message-tests; a fielding only reads it.
    if (test.status !== "fielding") throw new Error(`${test.title} is ${test.status}; set it to fielding in Survey's Tests first.`)
    if (test.arms.length < 2 || !test.arms.includes(PLACEBO)) throw new Error(`${test.title} needs the placebo and at least one cut.`)
    title = test.title
    arms = test.arms
    // A group too small for the test's target per arm fields to what it can fill.
    quota = o.quota ?? Math.max(1, Math.min(test.targetPerArm, Math.floor(group.members.length / arms.length)))
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
    finalBeforeHours: o.finalBeforeHours ?? 12,
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
    const r = await sendMail({ from: "tracker", to: [member.email], subject: fill(tpl.subject, fields).text, markdown: fill(tpl.body, fields).text, base: o.base, templateId: tpl.id })
    if (r.sent.length) sent++
    else held++
    await record(def.fid, { kind: "invite", pid, email: member.email, name: member.name, arm: assigned[i], at: new Date().toISOString(), held: !r.sent.length || undefined, error: r.error })
  }
  return { fid: def.fid, sent, held }
}

type Answer = { pid: string; arm?: string; answers: Record<string, string>; comprehensionCorrect?: boolean; completedAt: string }

/** This fielding's respondents: who started, who finished (one record per pid, the last), who a gate screened out. */
async function answersFor(def: FieldingDef): Promise<{ started: Set<string>; finished: Answer[]; screened: Set<string> }> {
  const last = <T extends { pid: string }>(rows: T[]) => [...new Map(rows.map((r) => [r.pid, r])).values()]
  if (def.type === "test") {
    const items = (await itemsFor(def.target)).filter((x) => x.env === ENV && fidOf(x.pid) === def.fid)
    const started = new Set(items.filter((x) => x.kind === "start").map((x) => x.pid!))
    const screened = new Set(items.filter((x) => x.kind === "screenout").map((x) => x.pid!))
    const finished = last((items.filter((x) => x.kind === "complete") as RecordItem[]).map((x) => ({ pid: x.pid!, arm: x.arm, answers: x.answers, comprehensionCorrect: x.comprehensionCorrect, completedAt: x.completedAt })))
    return { started, finished, screened }
  }
  const items = (await surveyItems(def.target)).filter((x: SurveyItem) => fidOf(x.pid) === def.fid) as (SurveyItem & { pid: string })[]
  return { started: new Set(items.map((x) => x.pid)), finished: last(items.map((x) => ({ pid: x.pid, answers: x.answers, completedAt: x.completedAt }))), screened: new Set() }
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

type Loaded = { summary: Summary; ev: FieldingEvent[]; answers: Awaited<ReturnType<typeof answersFor>> }

/** One read of a fielding: its events and its respondents, folded. */
async function load(fid: string): Promise<Loaded | null> {
  const ev = await events(fid)
  const def = ev.find((e) => e.kind === "fielding") as FieldingDef | undefined
  if (!def) return null
  const answers = await answersFor(def)
  const { started, finished } = answers
  const invites = ev.filter((e): e is InviteEvent => e.kind === "invite")
  const opened = new Set(ev.filter((e) => e.kind === "open").map((e) => (e as { pid: string }).pid))
  const reminders = ev.filter((e) => e.kind === "reminder") as { pid: string; round: "first" | "final"; at: string }[]
  const done = new Set(finished.map((f) => f.pid))
  const armOf = new Map(invites.map((i) => [i.pid, i.arm ?? ""]))
  const armIds = def.type === "test" ? [...new Set(invites.map((i) => i.arm ?? ""))].sort((a, b) => (a === PLACEBO ? -1 : b === PLACEBO ? 1 : a.localeCompare(b))) : [""]
  const arms = armIds.map((arm) => {
    const mine = (pid: string) => def.type !== "test" || armOf.get(pid) === arm
    return { arm, invited: invites.filter((i) => mine(i.pid)).length, opened: [...opened].filter(mine).length, started: [...started].filter(mine).length, finished: [...done].filter(mine).length }
  })
  const firsts = reminders.filter((r) => r.round === "first")
  const finals = reminders.filter((r) => r.round === "final")
  const report = ev.find((e) => e.kind === "report") as { results: Results } | undefined
  const summary: Summary = {
    def,
    invited: invites.length,
    held: invites.filter((i) => i.held).length,
    opened: new Set([...opened, ...started, ...done]).size,
    started: new Set([...started, ...done]).size,
    finished: done.size,
    arms,
    reminders: { first: firsts.length, final: finals.length, firstAt: firsts.map((r) => r.at).sort().at(-1), finalAt: finals.map((r) => r.at).sort().at(-1) },
    closed: ev.find((e) => e.kind === "closed") as ClosedEvent | undefined,
    report: report?.results,
    lastAt: [def.createdAt, ...ev.map((e) => (e as { at?: string }).at ?? ""), ...finished.map((f) => f.completedAt)].filter(Boolean).sort().at(-1)!,
  }
  return { summary, ev, answers }
}

export async function summary(fid: string): Promise<Summary | null> {
  return (await load(fid))?.summary ?? null
}

// -- the result ------------------------------------------------------------------------

export type ArmResult = { arm: string; n: number; yesPct: number; comprehensionPct: number; liftPp: number | null; marginPp: number | null; verdict: "detectable" | "inconclusive" | "placebo" }
export type Results =
  | { type: "test"; n: number; first: string; last: string; arms: ArmResult[] }
  | { type: "survey"; n: number; first: string; last: string; questions: { id: string; text: string; shares: { option: string; pct: number }[] }[] }

const pct = (k: number, n: number) => (n ? (100 * k) / n : 0)

/** Lift against the placebo in points, with the margin at 1.645 standard errors (the register's 90% convention). Unweighted. */
async function compute(def: FieldingDef, finished: Answer[]): Promise<Results> {
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

/** The result video's lines in a readout: its poster linking to the MP4, and the link alone beneath. */
function videoLines(video: VideoState): string[] {
  if (video.state === "done") return [...(video.poster ? [`[![Result video](${video.poster})](${video.url})`] : []), `Result video: [${video.url}](${video.url})`]
  if (video.state === "failed") return ["The result video didn't render."]
  return []
}

/** The Analyst's readout, as markdown, from the computed result. */
export function readout(def: FieldingDef, r: Results, armName: (id: string) => string, video: VideoState = { state: "none" }): string {
  if (r.type === "test") {
    const ranked = r.arms.filter((a) => a.liftPp != null).sort((a, b) => b.liftPp! - a.liftPp!)
    const top = ranked[0]
    const placebo = r.arms.find((a) => a.verdict === "placebo")
    return [
      `${def.title} closed with **${r.n} completes** from ${def.groupName}, every respondent assigned at random to a cut or the placebo, balanced within the group.`,
      top ? `The strongest treatment was **${armName(top.arm)}**, ${signed(top.liftPp!)} points on Yes (±${Math.round(top.marginPp!)}) against the placebo's ${Math.round(placebo?.yesPct ?? 0)}%.` : "No treatment arm finished.",
      r.arms.map((a) => (a.verdict === "placebo" ? `- Placebo: ${Math.round(a.yesPct)}% Yes, n ${a.n}` : `- ${armName(a.arm)}: ${Math.round(a.yesPct)}% Yes, ${a.liftPp == null ? "no lift yet" : `${signed(a.liftPp)} (±${Math.round(a.marginPp!)}), ${a.verdict}`}; comprehension ${Math.round(a.comprehensionPct)}%; n ${a.n}`)).join("\n"),
      "The levels are unweighted; with this few per arm every margin is wide, so read the order, not the size.",
      ...videoLines(video),
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

/** The report, written once; only the tick that writes it sends the readout and the notice. A test's waits, unrecorded, while its video renders. */
async function finish(l: Loaded, reason: ClosedEvent["reason"], base: string, armName: (id: string) => string) {
  const s = l.summary
  let video: VideoState = { state: "none" }
  if (s.def.type === "test") {
    const kept = await completeTest(s.def.target, { retryFailedVideo: false }).catch((e: Error) => (console.error("completeTest failed on the fielding's close", e.message), null))
    video = kept?.video ?? (await videoOf(s.def.target).catch((): VideoState => ({ state: "none" })))
    if (video.state === "rendering") return false
  }
  const results = await compute(s.def, l.answers.finished)
  if (!(await recordOnce(s.def.fid, "report", { kind: "report", at: new Date().toISOString(), results }))) return false
  const subject = s.def.type === "test" ? `Results: ${s.def.title}` : `Topline: ${s.def.title}`
  await sendMail({ from: "bill-reader", to: STAFF, subject, markdown: readout(s.def, results, armName, video), base })
  await sendMail({
    from: "assistant",
    to: STAFF,
    subject: `Results are in: ${s.def.title}`,
    markdown: [`${s.def.title} closed ${reason === "quota" ? "at its quota" : reason === "deadline" ? "at its deadline" : "by hand"} with ${results.n} completes, and the Analyst's readout is in your inbox.`, s.def.type === "test" ? "Lift and the report pick it up from here." : "America Thinks files the answers under Responses.", "Assistant"].join("\n\n"),
    base,
  })
  return true
}

/** Closes once (the close is a fixed key), then finishes the report. */
async function close(l: Loaded, reason: ClosedEvent["reason"], base: string, armName: (id: string) => string) {
  if (!(await recordOnce(l.summary.def.fid, "closed", { kind: "closed", at: new Date().toISOString(), reason }))) return false
  await finish(l, reason, base, armName)
  return true
}

/** One pass over every fielding: a close whose report never landed is finished; an open one is reminded, then closed at quota or deadline. */
export async function tick(base: string, armName: (id: string) => string) {
  const out: { fid: string; did: string[] }[] = []
  for (const fid of await fieldingIds()) {
    const l = await load(fid)
    if (!l) continue
    const s = l.summary
    if (s.closed) {
      if (!s.report && (await finish(l, s.closed.reason, base, armName))) out.push({ fid, did: ["report finished"] })
      continue
    }
    const did: string[] = []
    const now = Date.now()
    const reached = s.def.type === "test" ? s.arms.length > 0 && s.arms.every((a) => a.finished >= s.def.quota) : s.finished >= s.def.quota
    const late = now >= Date.parse(s.def.closeAt)
    if (reached || late) {
      if (await close(l, reached ? "quota" : "deadline", base, armName)) out.push({ fid, did: [`closed (${reached ? "quota" : "deadline"})`] })
      continue
    }
    const reminded = new Map(l.ev.filter((e) => e.kind === "reminder").map((e) => [`${(e as { pid: string }).pid}:${(e as { round: string }).round}`, (e as { at: string }).at]))
    const done = new Set([...l.answers.finished.map((f) => f.pid), ...l.answers.screened])
    // The final reminder never follows the first by less than twelve hours (a quarter of a short fielding).
    const gap = Math.min(12 * HOUR, (Date.parse(s.def.closeAt) - Date.parse(s.def.createdAt)) / 4)
    for (const inv of l.ev.filter((e): e is InviteEvent => e.kind === "invite" && !e.held)) {
      if (done.has(inv.pid)) continue
      const firstAt = reminded.get(`${inv.pid}:first`)
      const round: "first" | "final" | null = !firstAt
        ? now - Date.parse(inv.at) >= s.def.remindAfterHours * HOUR
          ? "first"
          : null
        : !reminded.has(`${inv.pid}:final`) && Date.parse(s.def.closeAt) - now <= s.def.finalBeforeHours * HOUR && now - Date.parse(firstAt) >= gap
          ? "final"
          : null
      if (!round) continue
      if (!(await recordOnce(fid, `reminder-${round}-${inv.pid}`, { kind: "reminder", pid: inv.pid, round, at: new Date().toISOString() }))) continue
      const link = linkFor(s.def, inv.pid, base)
      const tpl = template(s.def.type === "test" ? "Test reminder" : "Survey reminder")
      const fields = { RECIPIENT_NAME: firstName(inv.name), SENT_DATE: day(inv.at), MINUTES: s.def.type === "test" ? "4" : "2", TEST_URL: link, SURVEY_URL: link, SURVEY_NAME: s.def.title, TOPIC: s.def.title.toLowerCase(), CLOSE_DATE: day(s.def.closeAt) }
      await sendMail({ from: "tracker", to: [inv.email], subject: fill(tpl.subject, fields).text, markdown: fill(tpl.body, fields).text, base, templateId: tpl.id })
      did.push(`${round} reminder ${inv.email}`)
    }
    if (did.length) out.push({ fid, did })
  }
  return out
}

/** Closes a fielding now, whatever its counts. */
export async function closeNow(fid: string, base: string, armName: (id: string) => string) {
  const l = await load(fid)
  if (!l || l.summary.closed) return false
  return close(l, "by hand", base, armName)
}

/** A pid's assigned arm and whether its fielding has closed, when the pid is one of a fielding's; records the open. */
export async function armForPid(pid: string | null): Promise<{ arm: string | null; closed: boolean } | null> {
  const fid = fidOf(pid)
  if (!fid || !pid) return null
  const ev = await events(fid)
  const invite = ev.find((e): e is InviteEvent => e.kind === "invite" && e.pid === pid)
  if (!invite) return null
  const closed = ev.some((e) => e.kind === "closed")
  if (!closed) await record(fid, { kind: "open", pid, at: new Date().toISOString() }).catch(() => {})
  return { arm: invite.arm ?? null, closed }
}
