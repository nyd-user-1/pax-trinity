import { NextResponse } from "next/server"

import { currentUser } from "@/lib/auth"
import { fill, origin, sendMail } from "@/lib/mail/send"
import { memberByEmail } from "@/lib/roles"

// The Inbox's real send (Brendan, 2026-10-29), through lib/mail/send.ts: the
// signed-in person's message, sent through Resend as them (Brendan from his own
// address, anyone else via PAX with replies to them), every recipient screened by
// the allowlist first. The sender is the session's, never the client's: no one
// sends as someone else or as an agent from here; agents send from the engine. A template's fields are
// filled before it goes: {{RECIPIENT_NAME}} per recipient (each then gets their
// own copy), and any other field still in braces stops the send so nobody
// receives a raw {{TEST_NAME}}. Admins only.

type Person = { email: string; name?: string }
type Body = { to?: Person[]; cc?: Person[]; subject?: string; markdown?: string }

const first = (p: Person) => (p.name ?? "").split(/\s+/)[0] || "there"

export async function POST(request: Request) {
  const user = await currentUser()
  if (!user?.admin) return NextResponse.json({ error: "Sign in as an admin to send mail." }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as Body
  const from = `${user.email}|${memberByEmail(user.email)?.name ?? ""}`
  const to = (body.to ?? []).filter((p) => p?.email)
  const cc = (body.cc ?? []).filter((p) => p?.email)
  const subject = (body.subject ?? "").trim() || "(no subject)"
  const markdown = body.markdown ?? ""
  const base = origin(request)

  const unfilled = fill(`${subject}\n${markdown}`, { RECIPIENT_NAME: "x" }).missing
  if (unfilled.length) return NextResponse.json({ error: `Fill in ${unfilled.map((n) => `{{${n}}}`).join(", ")} before sending.` }, { status: 400 })

  if (/\{\{RECIPIENT_NAME\}\}/.test(subject + markdown)) {
    const sent: string[] = []
    const held: string[] = []
    for (const person of [...to, ...cc]) {
      const fields = { RECIPIENT_NAME: first(person) }
      const r = await sendMail({ from, to: [person.email], subject: fill(subject, fields).text, markdown: fill(markdown, fields).text, base })
      if (r.error) return NextResponse.json({ ...r, sent, held: [...held, ...r.held] }, { status: 502 })
      sent.push(...r.sent)
      held.push(...r.held)
    }
    return NextResponse.json({ sent, held })
  }

  const r = await sendMail({ from, to: to.map((p) => p.email), cc: cc.map((p) => p.email), subject, markdown, base })
  return NextResponse.json(r, { status: r.error ? 502 : 200 })
}
