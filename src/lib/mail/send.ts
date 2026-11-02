import "server-only"

import { screen } from "@/lib/mail/allowlist"
import { designedHtml, plainHtml } from "@/lib/mail/design"
import { AGENT_MAILBOX, personMailbox, platformMailbox, recordMessage } from "@/lib/mail/store"

// Real mail, one place for it (2026-10-29). An agent sends from its own
// AgentMail inbox; a person through Resend from their nysgpt.com address. Every
// recipient passes the allowlist first; anyone not on it is held and returned,
// never mailed. The body is the composer's markdown, drawn in pax2's mail design
// (lib/mail/design.ts); {{NAME}} fields are filled from `fields` before it goes,
// and a field left unfilled stops the send. Every message that goes is kept (lib/mail/store.ts): in the
// sender's Sent and in the Inbox of every platform recipient it reached (Brendan, 2026-11-02). This is
// the one place that records, so the flows, the surveys' and tests' invitations and reminders, the
// readouts and /api/inbox/send are all kept the same way.

export const AGENT_INBOX: Record<string, string> = Object.fromEntries(Object.entries(AGENT_MAILBOX).map(([slug, p]) => [slug, p.email]))
/** An agent's name on nysgpt.com, for when AgentMail will not carry a message; replies still go to its AgentMail inbox. */
const AGENT_RELAY: Record<string, string> = {
  tracker: "Pollster <pollster@nysgpt.com>",
  "bill-reader": "Analyst <analyst@nysgpt.com>",
  assistant: "Assistant <assistant@nysgpt.com>",
}
const PERSON_FROM: Record<string, string> = {
  you: "Brendan Stanton <brendan@nysgpt.com>",
  brendan: "Brendan Stanton <brendan@nysgpt.com>",
}

/** Where links in mail point: the deployment that sent it. */
export function origin(request?: Request) {
  const host = request?.headers.get("x-forwarded-host") ?? request?.headers.get("host")
  if (host) return `${host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https"}://${host}`
  return "https://main.d2vlduiqvq0u36.amplifyapp.com"
}

/** Fills {{NAME}} fields; returns the names still unfilled. */
export function fill(text: string, fields: Record<string, string>): { text: string; missing: string[] } {
  const missing = new Set<string>()
  const out = text.replace(/\{\{([A-Z_]+)\}\}/g, (whole, name: string) => {
    if (fields[name] != null && fields[name] !== "") return fields[name]
    missing.add(name)
    return whole
  })
  return { text: out, missing: [...missing] }
}

export type Sent = { sent: string[]; held: string[]; error?: string; /** The kept message's thread, once it went. */ threadId?: string }

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** A POST that waits out a rate limit: three more tries, a second and more apart, on 429 or a 5xx. */
async function postWithRetry(url: string, init: RequestInit): Promise<Response> {
  let res = await fetch(url, init)
  for (let attempt = 1; attempt <= 3 && (res.status === 429 || res.status >= 500); attempt++) {
    await pause(1200 * attempt)
    res = await fetch(url, init)
  }
  return res
}

/** A signed-in person's From line: Brendan from his own nysgpt.com address; anyone else as themselves via PAX, replies to them. */
function personFrom(from: string): { from: string; replyTo?: string } {
  if (PERSON_FROM[from]) return { from: PERSON_FROM[from] }
  if (from.includes("@")) {
    const [email, name] = from.split("|")
    if (email.toLowerCase() === "brendan@nysgpt.com") return { from: PERSON_FROM.brendan }
    return { from: `${name || email} via PAX <pax@nysgpt.com>`, replyTo: email }
  }
  return { from: PERSON_FROM.you }
}

/** The sender as the Inbox keeps it: an agent's mailbox and name, or a person's. */
function senderOf(from: string): { mailbox: string; party: { name: string; email: string } } {
  if (AGENT_MAILBOX[from]) return { mailbox: from, party: AGENT_MAILBOX[from] }
  const [email, name] = from.includes("@") ? from.split("|") : ["brendan@nysgpt.com", "Brendan Stanton"]
  return { mailbox: personMailbox(email), party: { name: name || "", email: email.trim().toLowerCase() } }
}

/** One message to one or more recipients, screened by the allowlist. `from` is an agent's slug, or a
 *  signed-in person as "email|name" (the route derives it from the session, never from the client).
 *  A reply passes its thread's id; a template's id rides along to the kept message. */
export async function sendMail({ from, to, cc = [], subject, markdown, base, threadId, templateId }: { from: string; to: string[]; cc?: string[]; subject: string; markdown: string; base: string; threadId?: string; templateId?: string }): Promise<Sent> {
  // An agent among the recipients (its slug or its AgentMail address) is the platform's own mailbox: the
  // message is kept in it and never mailed, so a send to an agent alone goes out to no one (2026-11-02).
  const agent = (a: string) => !!AGENT_MAILBOX[platformMailbox(a) ?? ""]
  const internalTo = [...new Set(to.filter(agent).map((a) => AGENT_MAILBOX[platformMailbox(a)!].email))]
  const internalCc = [...new Set(cc.filter(agent).map((a) => AGENT_MAILBOX[platformMailbox(a)!].email))].filter((a) => !internalTo.includes(a))
  to = to.filter((a) => !agent(a))
  cc = cc.filter((a) => !agent(a))
  const a = screen(to)
  const b = screen(cc.filter((x) => !a.allowed.includes(x.toLowerCase())))
  const held = [...a.held, ...b.held]
  const primary = a.allowed.length ? a.allowed : b.allowed
  const copied = a.allowed.length && b.allowed.length ? b.allowed : undefined
  if (!primary.length && !internalTo.length && !internalCc.length) return { sent: [], held }
  const internal = [...internalTo, ...internalCc]
  const text = markdown.replace(/\*\*|<\/?u>/g, "")
  // An agent's mail wears the design frame (its templated mail); a person's goes as plain email (2026-11-02).
  const body = AGENT_MAILBOX[from] ? designedHtml(markdown, base, subject.replace(/^(re|fwd?):\s*/i, "")) : plainHtml(markdown, base)
  const inbox = AGENT_INBOX[from]
  // A recipient AgentMail has suppressed (it bounced once) still gets the agent's mail, through
  // Resend from the agent's nysgpt.com name with replies routed back to its AgentMail inbox.
  let relay = false
  try {
    if (!primary.length) {
      // Only agents: nothing to mail.
    } else if (inbox) {
      const key = process.env.AGENTMAILORG_API_KEY
      if (!key) return { sent: [], held, error: "AGENTMAILORG_API_KEY is not set." }
      const res = await postWithRetry(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inbox)}/messages/send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to: primary, cc: copied, subject, text, html: body }),
      })
      if (!res.ok) {
        const said = await res.text()
        if (!(res.status === 403 && /suppressed/i.test(said))) return { sent: [], held, error: `AgentMail ${res.status}: ${said.slice(0, 160)}` }
        relay = true
      }
    }
    if (primary.length && (!inbox || relay)) {
      const key = process.env.RESEND_FULL_API_KEY ?? process.env.RESEND_API_KEY
      if (!key) return { sent: [], held, error: "No Resend key is set." }
      const res = await postWithRetry("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: relay ? AGENT_RELAY[from] : personFrom(from).from, reply_to: relay ? inbox : personFrom(from).replyTo, to: primary, cc: copied, subject, text, html: body }),
      })
      if (!res.ok) return { sent: [], held, error: `Resend ${res.status}: ${(await res.text()).slice(0, 160)}` }
    }
  } catch (error) {
    return { sent: [], held, error: error instanceof Error ? error.message : "Send failed" }
  }
  // It went: keep it. A failure to keep is logged, never turned into a failed send (the mail is out).
  let kept: string | undefined
  try {
    const sender = senderOf(from)
    const keptTo = [...primary, ...internalTo]
    const keptCc = [...(copied ?? []), ...internalCc]
    kept = (await recordMessage({ mailbox: sender.mailbox, from: sender.party, to: keptTo.length ? keptTo : keptCc, cc: keptTo.length && keptCc.length ? keptCc : undefined, subject, markdown, html: body, threadId, templateId, held })).threadId
  } catch (error) {
    console.error("mail: sent but not kept", error)
  }
  return { sent: [...primary, ...(copied ?? []), ...internal], held, ...(kept ? { threadId: kept } : {}) }
}
