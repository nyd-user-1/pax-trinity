import { NextResponse } from "next/server"

import { currentUser } from "@/lib/auth"
import { screen } from "@/lib/mail/allowlist"

// The Inbox's real send (Brendan, 2026-10-29). A message from an agent goes out
// of that agent's AgentMail inbox; a message from a person goes through Resend
// from their own address on the verified nysgpt.com domain. Recipients pass the
// allowlist first (lib/mail/allowlist.ts): anyone not on it is held and named
// in the answer, never mailed. Admins only.

const AGENT_INBOX: Record<string, string> = {
  tracker: "pax-pollster@agentmail.to",
  "bill-reader": "pax-analyst@agentmail.to",
  assistant: "pax-assistant@agentmail.to",
}
const PERSON_FROM: Record<string, string> = {
  you: "Brendan Stanton <brendan@nysgpt.com>",
  brendan: "Brendan Stanton <brendan@nysgpt.com>",
}

type Body = { from?: string; to?: string[]; cc?: string[]; subject?: string; markdown?: string }

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/** The composer's markdown, the subset it writes, as mail HTML. */
function html(markdown: string) {
  const inline = (s: string) =>
    escape(s)
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, text, href) => `<a href="${href.startsWith("/") ? `https://main.d2vlduiqvq0u36.amplifyapp.com${href}` : href}" style="color:#1d4ed8">${text}</a>`)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
      .replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/g, "<u>$1</u>")
  const blocks = markdown.trim().split(/\n{2,}/).map((block) => {
    const lines = block.split("\n")
    if (lines.every((l) => /^\s*[-*] /.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*[-*] /, ""))}</li>`).join("")}</ul>`
    if (lines.every((l) => /^\s*\d+\. /.test(l))) return `<ol>${lines.map((l) => `<li>${inline(l.replace(/^\s*\d+\. /, ""))}</li>`).join("")}</ol>`
    if (lines.every((l) => /^> ?/.test(l))) return `<blockquote style="border-left:2px solid #cbd5e1;margin:0;padding-left:12px;color:#475569">${lines.map((l) => inline(l.replace(/^> ?/, ""))).join("<br>")}</blockquote>`
    return `<p style="margin:0 0 14px">${lines.map(inline).join("<br>")}</p>`
  })
  return `<div style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;max-width:560px">${blocks.join("")}</div>`
}

export async function POST(request: Request) {
  const user = await currentUser()
  if (!user?.admin) return NextResponse.json({ error: "Sign in as an admin to send mail." }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as Body
  const from = body.from ?? "you"
  const subject = (body.subject ?? "").trim() || "(no subject)"
  const markdown = body.markdown ?? ""
  const to = screen(body.to ?? [])
  const cc = screen((body.cc ?? []).filter((a) => !to.allowed.includes(a.toLowerCase())))
  const held = [...to.held, ...cc.held]
  if (!to.allowed.length && !cc.allowed.length) return NextResponse.json({ sent: [], held })

  const text = markdown.replace(/\*\*|<\/?u>/g, "")
  const agentInbox = AGENT_INBOX[from]
  try {
    if (agentInbox) {
      const key = process.env.AGENTMAILORG_API_KEY
      if (!key) return NextResponse.json({ error: "AGENTMAILORG_API_KEY is not set." }, { status: 500 })
      const res = await fetch(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(agentInbox)}/messages/send`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.allowed.length ? to.allowed : cc.allowed, cc: to.allowed.length && cc.allowed.length ? cc.allowed : undefined, subject, text, html: html(markdown) }),
      })
      if (!res.ok) return NextResponse.json({ error: `AgentMail: ${res.status} ${(await res.text()).slice(0, 200)}` }, { status: 502 })
    } else {
      const key = process.env.RESEND_FULL_API_KEY ?? process.env.RESEND_API_KEY
      if (!key) return NextResponse.json({ error: "No Resend key is set." }, { status: 500 })
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: PERSON_FROM[from] ?? PERSON_FROM.you, to: to.allowed.length ? to.allowed : cc.allowed, cc: to.allowed.length && cc.allowed.length ? cc.allowed : undefined, subject, text, html: html(markdown) }),
      })
      if (!res.ok) return NextResponse.json({ error: `Resend: ${res.status} ${(await res.text()).slice(0, 200)}` }, { status: 502 })
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Send failed" }, { status: 502 })
  }
  return NextResponse.json({ sent: [...to.allowed, ...cc.allowed], held })
}
