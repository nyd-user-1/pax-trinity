// Dev Comments' threads (Brendan, 2026-11-01): the pure rules the store (lib/housekeeping.ts), its routes
// and the panel (components/housekeeping/view.tsx) share. A message becomes a thread of replies, each a
// row of its own under the same partition, pointing at its parent's sort key. Replies are a person's
// (the panel's composer) or Claude's (written through the loop's API). The super admin can send a
// pointed comment to Claude: its status goes "claude" until Claude replies ("answered"); a person's reply
// on an answered thread sends it back to "claude". Claude's replies, those two statuses, the prompt and
// the locator bundle are the super admin's alone: every read path passes its rows through forReader.

/** The author id of Claude's replies, and the name and mark they show with. */
export const CLAUDE = "claude"
export const CLAUDE_NAME = "Claude"
export const CLAUDE_MARK = "/logos/models/anthropic.webp"

export type Status = "open" | "resolved" | "claude" | "answered"

/** The fields every reader may see, and the ones that stay the super admin's. */
type Row = { author: string; kind: string; status: string; replyTo?: string; prompt?: string; promptAt?: string; bundle?: string; claudeAt?: string; answeredAt?: string }

/** A thread's rows as one reader may see them: all of it for the super admin; for anyone else, no
 *  reply of Claude's, no prompt or bundle, and a comment with Claude (or answered) reading as open. */
export function forReader<T extends Row>(rows: T[], superAdmin: boolean): T[] {
  if (superAdmin) return rows
  return rows
    .filter((r) => r.author !== CLAUDE)
    .map((r) => {
      const { prompt: _p, promptAt: _pa, bundle: _b, claudeAt: _c, answeredAt: _a, ...rest } = r
      return { ...rest, status: r.status === "claude" || r.status === "answered" ? "open" : r.status } as T
    })
}

/** A comment's status once a reply lands: Claude's answers it (from "claude" only); a person's reply on
 *  an answered comment sends it back to Claude; anything else leaves the status as it is (null). */
export function statusAfterReply(status: Status, byClaude: boolean): Status | null {
  if (byClaude) return status === "claude" ? "answered" : null
  return status === "answered" ? "claude" : null
}

/** Top-level messages in their order, each with its replies in theirs (rows arrive oldest first). A reply
 *  whose parent is not in the list (past the read's limit) is left out rather than shown loose. */
export function grouped<T extends { sk: string; kind: string; replyTo?: string }>(rows: T[]): { message: T; replies: T[] }[] {
  const top = rows.filter((r) => r.kind !== "reply")
  const by = new Map(top.map((m) => [m.sk, [] as T[]]))
  for (const r of rows) if (r.kind === "reply" && r.replyTo) by.get(r.replyTo)?.push(r)
  return top.map((message) => ({ message, replies: [...(by.get(message.sk) ?? [])].sort((a, b) => a.sk.localeCompare(b.sk)) }))
}
