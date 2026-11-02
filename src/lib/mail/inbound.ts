import "server-only"

import { createHash } from "node:crypto"

import { get, put, putOnce } from "@/lib/ledger"
import { AGENT_MAILBOX, mailboxRows, partyOf, pkOf, snippetOf, threadFor, type MailParty, type MailRow } from "@/lib/mail/store"

// What people send the agents (Brendan, 2026-11-02; commit 3 of the inbox brief). Each agent has an
// AgentMail inbox (pax-pollster, pax-analyst, pax-assistant), and mail sent to it was never read. This
// pass reads each one's received mail (api.agentmail.to v0, read-only) newer than its high-water mark
// (MAIL#<slug> WATERMARK) and keeps each message as an unread inbox row in the agent's mailbox. A reply
// joins its thread: one already holding the same AgentMail thread, else the newest with the same subject
// (Re: and Fwd: dropped) between the same people, else a thread of its own. A message is written once:
// its row's id comes from its AgentMail message id. Run by the super admin (/api/inbox/ingest) and by the
// sends tick.

const API = "https://api.agentmail.to/v0"

type Listed = { message_id: string; thread_id: string; timestamp: string; labels: string[] }
type Full = Listed & { from: string; to?: string[]; cc?: string[]; subject?: string; text?: string; html?: string; extracted_text?: string; extracted_html?: string; preview?: string }

/** "Name <a@b>" or a bare address, as a party. */
export function parseAddress(raw: string): MailParty {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/)
  const email = (m ? m[2] : raw).trim().toLowerCase()
  const known = partyOf(email)
  return { name: known.name || (m ? m[1].trim() : ""), email }
}

/** A row id from an AgentMail message id: the same message, the same row. */
export const inboundId = (messageId: string) => `am${createHash("sha256").update(messageId).digest("hex").slice(0, 24)}`

export type IngestResult = Record<string, { listed: number; written: number; already: number; watermark: string | null; error?: string }>

/** Reads every agent's received mail since its mark and keeps it. Never sends; never marks anything in AgentMail. */
export async function ingestAgentMail(opts: { fetchImpl?: typeof fetch } = {}): Promise<IngestResult> {
  const key = process.env.AGENTMAILORG_API_KEY
  const out: IngestResult = {}
  if (!key) {
    for (const slug of Object.keys(AGENT_MAILBOX)) out[slug] = { listed: 0, written: 0, already: 0, watermark: null, error: "AGENTMAILORG_API_KEY is not set." }
    return out
  }
  const f = opts.fetchImpl ?? fetch
  const call = async <T,>(path: string): Promise<T> => {
    const r = await f(`${API}${path}`, { headers: { Authorization: `Bearer ${key}` } })
    if (!r.ok) throw new Error(`AgentMail ${r.status}: ${(await r.text()).slice(0, 160)}`)
    return (await r.json()) as T
  }
  for (const [slug, agent] of Object.entries(AGENT_MAILBOX)) {
    const inbox = encodeURIComponent(agent.email)
    const mark = await get<{ pk: string; sk: string; at?: string }>(pkOf(slug), "WATERMARK").catch(() => null)
    const result = { listed: 0, written: 0, already: 0, watermark: mark?.at ?? null } as IngestResult[string]
    out[slug] = result
    try {
      // Oldest first, so each message finds the thread an earlier one started.
      const listed: Listed[] = []
      let page: string | undefined
      do {
        const q = new URLSearchParams({ labels: "received", ascending: "true", limit: "100", ...(mark?.at ? { after: mark.at } : {}), ...(page ? { page_token: page } : {}) })
        const res = await call<{ messages?: Listed[]; next_page_token?: string }>(`/inboxes/${inbox}/messages?${q}`)
        listed.push(...(res.messages ?? []).filter((m) => m.labels?.includes("received")))
        page = res.next_page_token
      } while (page)
      result.listed = listed.length
      if (!listed.length) continue
      const rows = await mailboxRows(slug)
      for (const l of listed) {
        const id = inboundId(l.message_id)
        if (rows.some((r) => r.id === id)) {
          result.already++
          continue
        }
        const m = await call<Full>(`/inboxes/${inbox}/messages/${encodeURIComponent(l.message_id)}`)
        const from = parseAddress(m.from)
        const to = (m.to ?? []).map(parseAddress)
        const cc = (m.cc ?? []).map(parseAddress)
        const subject = m.subject ?? "(no subject)"
        const createdAt = new Date(m.timestamp).toISOString()
        const threadId =
          rows.find((r) => r.agentmail?.threadId === m.thread_id)?.threadId ??
          threadFor(rows, subject, [from.email, ...to.map((p) => p.email), ...cc.map((p) => p.email)]) ??
          id
        const markdown = (m.extracted_text ?? m.text ?? m.preview ?? "").trim()
        const row: MailRow = {
          pk: pkOf(slug),
          sk: `${createdAt}#${id}`,
          id,
          threadId,
          folder: "inbox",
          from,
          to,
          ...(cc.length ? { cc } : {}),
          subject,
          markdown,
          html: m.extracted_html ?? m.html ?? "",
          snippet: snippetOf(markdown),
          createdAt,
          read: false,
          starred: false,
          trashed: false,
          archived: false,
          source: "live",
          agentmail: { messageId: m.message_id, threadId: m.thread_id },
        }
        if (await putOnce(row)) {
          result.written++
          rows.push(row)
        } else result.already++
      }
      const newest = listed[listed.length - 1].timestamp
      await put({ pk: pkOf(slug), sk: "WATERMARK", at: newest })
      result.watermark = newest
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error)
    }
  }
  return out
}
