#!/usr/bin/env node
// The Inbox's backfill and seed (Brendan, 2026-11-02; commit 4 of the inbox brief). Every real send on
// record before the mail was kept (lib/mail/store.ts) is reconstructed into the mailboxes that hold it,
// source "backfill"; the Inbox's authored demo threads (lib/agents/history.ts) go in as source "seed".
//
//   AWS_PROFILE=pax-new node scripts/inbox/backfill.mjs [--dry]
//
// What it reads, and what each becomes:
//   - The agents' AgentMail sent copies (read-only): each message exactly as it went, from its agent.
//   - The flows' sends (the ledger's FLOWSEND rows with a sent outcome): the step's template as it was
//     filled, from Pax.
//   - The fieldings' invitations and reminders (their events): the templates as the engine filled them,
//     from the Pollster; a reminder joins its invitation's thread. A send AgentMail already holds a copy of
//     (the same recipient within five minutes) is not written twice.
//   - Each fielding's thread as the Inbox drew it live (lib/agents/live.ts): the Pollster's notices and the
//     Analyst's readout, which is the readout mail itself; and Pax's "Results are in" mail.
//   - The authored history, into Brendan's mailbox and the agents' (a message another staff member wrote
//     lands in Brendan's inbox alone).
// A message's id comes from what it reconstructs, so a second run writes nothing. A message joins the
// thread in its sender's mailbox with the same subject between the same people (lib/mail/store.ts
// threadFor), so the flow mail Brendan answered joins his reply, which the inbound pass kept. Only the
// recipients the mail reached get an inbox row (the allowlist held the rest, and they are named on the
// sender's row). Never sends anything.

import { createHash } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import { createJiti } from "jiti"

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..")
const jiti = createJiti(import.meta.url, { alias: { "@": `${ROOT}/src`, "server-only": `${ROOT}/node_modules/server-only/empty.js` } })
const load = (p) => jiti.import(`${ROOT}/src/${p}`)
const DRY = process.argv.includes("--dry")
/** The deployment the links in reconstructed mail point at (lib/mail/send.ts origin's default). */
const BASE = "https://main.d2vlduiqvq0u36.amplifyapp.com"

// The AgentMail key, from the environment or this checkout's .env.local (never printed).
if (!process.env.AGENTMAILORG_API_KEY && fs.existsSync(`${ROOT}/.env.local`)) {
  for (const line of fs.readFileSync(`${ROOT}/.env.local`, "utf8").split("\n")) {
    const m = line.match(/^AGENTMAILORG_API_KEY=(.*)$/)
    if (m) process.env.AGENTMAILORG_API_KEY = m[1].replace(/^["']|["']$/g, "")
  }
}

const store = await load("lib/mail/store.ts")
const { parseAddress } = await load("lib/mail/inbound.ts")
const { putOnce, query } = await load("lib/ledger.ts")
const { designedHtml } = await load("lib/mail/design.ts")
const { fill } = await load("lib/mail/send.ts")
const { TEMPLATES } = await load("lib/agents/templates.ts")
const { FLOWS } = await load("lib/flows/defs.ts")
const { linkFields } = await load("lib/flows/engine.ts")
const { fieldingIds, events } = await load("lib/fielding/store.ts")
const { linkFor, readout, summary } = await load("lib/fielding/engine.ts")
const { armName } = await load("lib/fielding/arms.ts")
const { videoOf } = await load("lib/results/video.ts")
const { liveThread } = await load("lib/agents/live.ts")
const { HISTORY } = await load("lib/agents/history.ts")
const { addressFor } = await load("lib/agents/inbox.ts")
const { getTest } = await load("lib/tests/store.ts")
const { surveyBySlug } = await load("lib/surveys/catalog.ts")

const { AGENT_MAILBOX, messageRows, threadFor, mailboxRows, platformMailbox } = store
const BRENDAN = "brendan@nysgpt.com"
const STAFF = ["brendan@nysgpt.com", "garrett@parallaxinnovations.com", "sajeela@parallaxinnovations.com", "ted@parallaxinnovations.com"]
const idOf = (prefix, key) => `${prefix}${createHash("sha256").update(key).digest("hex").slice(0, 24)}`
const html = (markdown, subject) => designedHtml(markdown, BASE, subject.replace(/^(re|fwd?):\s*/i, ""))
const template = (name) => TEMPLATES.find((t) => t.name === name)
const firstName = (name) => String(name ?? "").split(/\s+/)[0] || "there"
const day = (iso) => new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/New_York" })
const agentFrom = (slug) => ({ mailbox: slug, party: AGENT_MAILBOX[slug] })
const brendanFrom = () => ({ mailbox: BRENDAN, party: { name: "Brendan Stanton", email: BRENDAN } })

/** The messages to write, each: { key, prefix, source, kind, at, sender, to, cc, held, subject, markdown, html?, templateId?, threadKey?, read?, only? } */
const messages = []

// 1. The agents' AgentMail sent copies, exactly as they went.
const key = process.env.AGENTMAILORG_API_KEY
const agentmailSent = []
if (key) {
  const call = async (p) => {
    const r = await fetch(`https://api.agentmail.to/v0${p}`, { headers: { Authorization: `Bearer ${key}` } })
    if (!r.ok) throw new Error(`AgentMail ${r.status}`)
    return r.json()
  }
  for (const [slug, agent] of Object.entries(AGENT_MAILBOX)) {
    const inbox = encodeURIComponent(agent.email)
    let page
    do {
      const q = new URLSearchParams({ labels: "sent", ascending: "true", limit: "100", ...(page ? { page_token: page } : {}) })
      const res = await call(`/inboxes/${inbox}/messages?${q}`)
      for (const l of res.messages ?? []) {
        const m = await call(`/inboxes/${inbox}/messages/${encodeURIComponent(l.message_id)}`)
        const to = (m.to ?? []).map((a) => parseAddress(a).email)
        const cc = (m.cc ?? []).map((a) => parseAddress(a).email)
        agentmailSent.push({ to, at: Date.parse(m.timestamp) })
        messages.push({ key: `agentmail-sent|${m.message_id}`, prefix: "bf", source: "backfill", kind: "agentmail sent", at: new Date(m.timestamp).toISOString(), sender: agentFrom(slug), to, cc, held: [], subject: m.subject ?? "(no subject)", markdown: (m.text ?? m.preview ?? "").trim(), html: m.html ?? "" })
      }
      page = res.next_page_token
    } while (page)
  }
} else console.warn("No AGENTMAILORG_API_KEY: AgentMail's sent copies are skipped.")
const inAgentMail = (email, at) => agentmailSent.some((s) => s.to.includes(email.toLowerCase()) && Math.abs(s.at - Date.parse(at)) < 5 * 60_000)

// 2. The flows' sends: a step's claim names its template; its outcome, whom it reached.
const flowEmails = new Set((await query("FLOWS")).map((r) => String(r.email ?? "").toLowerCase()).filter(Boolean))
for (const email of flowEmails) {
  const rows = await query(`FLOWSEND#${email}`)
  for (const claim of rows.filter((r) => r.template && r.flowId != null)) {
    const outcome = rows.find((r) => r.sk === `${claim.sk}#outcome`)
    const reached = (outcome?.sent ?? []).map((a) => String(a).toLowerCase())
    if (!reached.length || inAgentMail(email, claim.at)) continue
    const tpl = template(claim.template)
    const flow = FLOWS.find((f) => f.id === claim.flowId)
    if (!tpl || !flow) {
      console.warn(`flow send ${claim.sk} for ${email}: no template or flow, skipped`)
      continue
    }
    const fields = linkFields(BASE, flow.page, email)
    const subject = fill(tpl.subject, fields).text
    const markdown = fill(tpl.body, fields).text
    messages.push({ key: `flow|${email}|${claim.flowId}|${claim.day}`, prefix: "bf", source: "backfill", kind: "flow", at: claim.at, sender: agentFrom("assistant"), to: reached, cc: [], held: outcome?.held ?? [], subject, markdown, templateId: tpl.id })
  }
}

// 3 and 4. The fieldings: invitations, reminders, the thread the Inbox drew live, and Pax's notice.
for (const fid of await fieldingIds()) {
  const evs = await events(fid)
  const def = evs.find((e) => e.kind === "fielding")
  if (!def) continue
  const test = def.type === "test"
  const questions = test ? ((await getTest(def.target))?.entry.length ?? 5) + 2 : (surveyBySlug(def.target)?.questions.length ?? 0)
  const invites = evs.filter((e) => e.kind === "invite")
  for (const inv of invites) {
    if (inv.held || inAgentMail(inv.email, inv.at)) continue
    const tpl = template(test ? "Test invitation" : "Survey invitation")
    const link = linkFor(def, inv.pid, BASE)
    const fields = { RECIPIENT_NAME: firstName(inv.name), QUESTION_COUNT: String(questions), MINUTES: test ? "4" : "2", TEST_URL: link, SURVEY_URL: link, TOPIC: def.title.toLowerCase() }
    messages.push({ key: `invite|${fid}|${inv.pid}`, prefix: "bf", source: "backfill", kind: "invitation", at: inv.at, sender: agentFrom("tracker"), to: [inv.email], cc: [], held: [], subject: fill(tpl.subject, fields).text, markdown: fill(tpl.body, fields).text, templateId: tpl.id, threadKey: `invite|${fid}|${inv.pid}` })
  }
  for (const rem of evs.filter((e) => e.kind === "reminder")) {
    const inv = invites.find((i) => i.pid === rem.pid)
    if (!inv || inv.held) continue
    const tpl = template(test ? "Test reminder" : "Survey reminder")
    const link = linkFor(def, inv.pid, BASE)
    const fields = { RECIPIENT_NAME: firstName(inv.name), SENT_DATE: day(inv.at), MINUTES: test ? "4" : "2", TEST_URL: link, SURVEY_URL: link, SURVEY_NAME: def.title, TOPIC: def.title.toLowerCase(), CLOSE_DATE: day(def.closeAt) }
    messages.push({ key: `reminder|${fid}|${rem.pid}|${rem.round}`, prefix: "bf", source: "backfill", kind: "reminder", at: rem.at, sender: agentFrom("tracker"), to: [inv.email], cc: [], held: [], subject: fill(tpl.subject, fields).text, markdown: fill(tpl.body, fields).text, templateId: tpl.id, threadKey: `invite|${fid}|${inv.pid}` })
  }

  // The thread the Inbox drew from the engine (GET /api/fielding, then liveThread), as kept mail.
  const s = await summary(fid)
  if (!s) continue
  const video = s.report && test ? await videoOf(s.def.target).catch(() => ({ state: "none" })) : { state: "none" }
  const live = liveThread({ ...s, arms: s.arms.map((a) => ({ ...a, name: a.arm ? armName(a.arm) : "" })), readout: s.report ? readout(s.def, s.report, armName, video) : null })
  for (const m of live.messages) {
    const analyst = m.from === "bill-reader"
    messages.push({
      key: `live|${m.id}`,
      prefix: "bf",
      source: "backfill",
      kind: analyst ? "readout" : "fielding notice",
      at: new Date(m.at).toISOString(),
      sender: agentFrom(m.from),
      // The readout went to the staff by mail, and reached Brendan; the Pollster's notices were the Inbox's own, to him.
      to: [BRENDAN],
      cc: [],
      held: analyst ? STAFF.filter((a) => a !== BRENDAN) : [],
      subject: live.subject,
      markdown: m.body,
      threadKey: `live|${live.id}`,
    })
  }
  const report = evs.find((e) => e.kind === "report")
  const closed = evs.find((e) => e.kind === "closed")
  if (report) {
    const reason = closed?.reason
    const markdown = [`${def.title} closed ${reason === "quota" ? "at its quota" : reason === "deadline" ? "at its deadline" : "by hand"} with ${report.results?.n ?? 0} completes, and the Analyst's readout is in your inbox.`, test ? "Lift and the report pick it up from here." : "America Thinks files the answers under Responses.", "Assistant"].join("\n\n")
    messages.push({ key: `results-in|${fid}`, prefix: "bf", source: "backfill", kind: "results notice", at: new Date(Date.parse(report.at) + 2000).toISOString(), sender: agentFrom("assistant"), to: [BRENDAN], cc: [], held: STAFF.filter((a) => a !== BRENDAN), subject: `Results are in: ${def.title}`, markdown })
  }
}

// 5. The seed: the Inbox's authored history, into Brendan's mailbox and the agents'.
const handleEmail = (h) => (h === "you" ? BRENDAN : AGENT_MAILBOX[h] ? AGENT_MAILBOX[h].email : addressFor(h)?.email ?? null)
for (const t of HISTORY) {
  const people = [...new Set(["you", ...(t.to ?? []), ...(t.cc ?? []), t.agent, ...t.messages.map((m) => m.from)])]
  t.messages.forEach((m, i) => {
    const sender = m.from === "you" ? brendanFrom() : AGENT_MAILBOX[m.from] ? agentFrom(m.from) : null
    const to = people.filter((p) => p !== m.from).map(handleEmail).filter(Boolean)
    messages.push({
      key: `seed|${t.id}|${m.id ?? i}`,
      prefix: "sd",
      source: "seed",
      kind: "history",
      at: new Date(m.at).toISOString(),
      // Another staff member's message is in Brendan's inbox alone: the seed is his and the agents'.
      sender: sender ?? { mailbox: null, party: { name: addressFor(m.from)?.name ?? m.from, email: handleEmail(m.from) ?? m.from } },
      to,
      cc: [],
      held: [],
      subject: t.subject,
      markdown: m.body,
      read: !m.unread,
      threadKey: `seed|${t.id}`,
      only: [BRENDAN, ...Object.keys(AGENT_MAILBOX)],
    })
  })
}

// Thread and stage, oldest first, so each message finds the thread an earlier one started.
const boxes = new Map()
const rowsOf = async (mailbox) => {
  if (!boxes.has(mailbox)) boxes.set(mailbox, await mailboxRows(mailbox))
  return boxes.get(mailbox)
}
const threads = new Map()
const staged = []
for (const m of [...messages].sort((a, b) => a.at.localeCompare(b.at))) {
  const id = idOf(m.prefix, m.key)
  const senderBox = m.sender.mailbox
  let threadId = m.threadKey ? threads.get(m.threadKey) : undefined
  if (!threadId && !m.threadKey && senderBox) threadId = threadFor(await rowsOf(senderBox), m.subject, [m.sender.party.email, ...m.to, ...m.cc]) ?? undefined
  threadId ??= id
  if (m.threadKey && !threads.has(m.threadKey)) threads.set(m.threadKey, threadId)
  let rows = messageRows({ mailbox: senderBox ?? "__nobody__", from: m.sender.party, to: m.to, cc: m.cc, subject: m.subject, markdown: m.markdown, html: m.html || html(m.markdown, m.subject), threadId, templateId: m.templateId, held: m.held, source: m.source, at: m.at, id, read: m.read })
  if (!senderBox) rows = rows.filter((r) => r.folder !== "sent")
  if (m.only) rows = rows.filter((r) => m.only.includes(r.pk.slice(5)))
  for (const r of rows) {
    staged.push({ row: r, kind: m.kind })
    ;(await rowsOf(r.pk.slice(5))).push(r)
  }
}

// Write, once each, and count by mailbox and source.
const counts = {}
const kinds = {}
for (const { row, kind } of staged) {
  const box = row.pk.slice(5)
  counts[box] ??= {}
  const c = (counts[box][row.source] ??= { written: 0, already: 0 })
  const fresh = DRY ? true : await putOnce(row)
  if (fresh) c.written++
  else c.already++
  kinds[kind] = (kinds[kind] ?? 0) + 1
}
console.log(JSON.stringify({ dry: DRY, messages: messages.length, rows: staged.length, byKind: kinds, byMailbox: counts }, null, 1))
const reply = (await rowsOf("assistant")).filter((r) => /start from where opinion stands/i.test(r.subject))
console.log("Pax's 'Start from where opinion stands' thread:", JSON.stringify(reply.map((r) => ({ folder: r.folder, subject: r.subject, at: r.createdAt, thread: r.threadId, source: r.source }))))
