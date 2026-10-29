import { nameOf, type Message, type Thread } from "@/lib/agents/inbox"
import { CONTACT_GROUPS } from "@/lib/fielding/contacts"

// The Pollster's live fieldings as Inbox threads (2026-10-29). /api/fielding
// answers with each fielding's counts; each becomes a thread that rewrites
// itself on every refresh: the send, the running count, the reminders, the
// close, and the Analyst's readout once the result is computed.

export type LiveArm = { arm: string; name: string; invited: number; opened: number; started: number; finished: number }
export type LiveFielding = {
  def: { fid: string; type: "test" | "survey"; target: string; title: string; groupName: string; quota: number; closeAt: string; createdAt: string }
  invited: number
  held: number
  opened: number
  started: number
  finished: number
  arms: LiveArm[]
  reminders: { first: number; final: number; firstAt?: string; finalAt?: string }
  closed?: { at: string; reason: "quota" | "deadline" | "by hand" }
  lastAt: string
  readout: string | null
}

const t = (iso: string) => Date.parse(iso)
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })

export function liveThread(f: LiveFielding): Thread {
  const d = f.def
  const test = d.type === "test"
  const messages: Message[] = [
    {
      id: `live-${d.fid}-sent`,
      from: "tracker",
      at: t(d.createdAt),
      body: [
        `**${d.title}** went to ${d.groupName}: ${f.invited} invitations, each with a link of its own${test ? ", every respondent assigned to a cut or the placebo, balanced within the group" : ""}.${f.held ? ` ${f.held} held by the allowlist.` : ""}`,
        `I close at ${d.quota} ${test ? "per arm" : "completes"}, or on ${day(d.closeAt)}.`,
        "Pollster",
      ].join("\n\n"),
    },
  ]
  if (f.reminders.first) messages.push({ id: `live-${d.fid}-r1`, from: "tracker", at: t(f.reminders.firstAt!), body: `First reminder sent to ${f.reminders.first} who hadn't finished.\n\nPollster` })
  if (f.reminders.final) messages.push({ id: `live-${d.fid}-r2`, from: "tracker", at: t(f.reminders.finalAt!), body: `Last reminder sent to ${f.reminders.final} before the close.\n\nPollster` })
  const counts = `Invited ${f.invited} · opened ${f.opened} · started ${f.started} · finished ${f.finished}`
  const perArm = test ? f.arms.map((a) => `- ${a.name}: ${a.finished} of ${d.quota} finished (${a.started} started)`).join("\n") : ""
  messages.push({
    id: `live-${d.fid}-count`,
    from: "tracker",
    at: f.closed ? t(f.closed.at) : t(f.lastAt),
    body: [f.closed ? `Closed ${f.closed.reason === "quota" ? "at quota" : f.closed.reason === "deadline" ? "at the deadline" : "by hand"}. ${counts}.` : `${counts}.`, perArm, "Pollster"].filter(Boolean).join("\n\n"),
  })
  if (f.readout) messages.push({ id: `live-${d.fid}-readout`, from: "bill-reader", at: t(f.closed?.at ?? f.lastAt) + 1000, body: f.readout, unread: true })
  return {
    id: `live-${d.fid}`,
    agent: "tracker",
    agentName: nameOf("tracker"),
    to: ["tracker"],
    cc: [],
    bcc: [],
    subject: `${f.readout ? (test ? "Results" : "Topline") : f.closed ? "Closed" : "In the field"}: ${d.title}`,
    createdAt: t(d.createdAt),
    updatedAt: Math.max(...messages.map((m) => m.at)),
    status: "delivered",
    important: !f.closed,
    messages,
  }
}

/** A New test or New survey to the Pollster that names a real group and its test or survey: what to field,
 *  with the request's own Quota (a number) and Close by (a date) when it gives them. */
export function fieldingRequest(to: string[], cc: string[], body: string): { type: "test" | "survey"; target: string; group: string; quota?: number; closeAt?: string } | null {
  if (!to.includes("tracker")) return null
  const group = [...to, ...cc].find((h) => CONTACT_GROUPS.some((g) => g.handle === h))
  const m = /\*\*(Test|Survey):\*\*\s*([a-z0-9][a-z0-9-]*)/i.exec(body)
  if (!group || !m) return null
  const quota = Number(/\*\*Quota:\*\*\s*([\d,]+)/i.exec(body)?.[1]?.replace(/,/g, ""))
  const by = /\*\*Close by:\*\*\s*([^\n*]+)/i.exec(body)?.[1]?.trim()
  const close = by ? Date.parse(/\d{4}/.test(by) ? by : `${by} ${new Date().getFullYear()}`) : NaN
  return { type: m[1].toLowerCase() as "test" | "survey", target: m[2], group, quota: quota > 0 ? quota : undefined, closeAt: close > Date.now() ? new Date(close).toISOString() : undefined }
}
