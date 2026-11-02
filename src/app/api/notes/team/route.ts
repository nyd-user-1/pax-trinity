import { NextResponse } from "next/server"

import { currentUser, forbidDemo } from "@/lib/auth"
import { writerFor } from "@/lib/connect-run"
import { post as postComment } from "@/lib/housekeeping"
import { postToDiscord } from "@/lib/agents/connections/discord"
import { slackPost, slackTeam } from "@/lib/slack"
import { param } from "@/lib/ssm-param"
import { TEAM_SLACK_CHANNEL, isTeamPlace, teamText } from "@/lib/note-team"

// A note posted to the team (Brendan, 2026-11-02; components/notes/note-team.tsx). Admins only, as Dev Comments, Slack
// and Discord are.
//
//   GET   → { comments, slack, discord }: which places can take a post now (nothing is posted to find out)
//   POST  { to: "comments" | "slack" | "discord", text, url, route } → { ok: true, where } or { ok: false, error }
//
// comments: a comment on the page in the stream every admin reads, anchored to the page (its route and address), the
//           super admin's included (his pointed comments go to his channel with Claude; a note to the team does not)
// slack:    #pax2 (C0CBK58L0NN), under the writer's name, through the PAX bot (lib/slack.ts)
// discord:  #pax, through the agents' webhook (/pax2/discord/agents-webhook-url), the writer signing it

export const dynamic = "force-dynamic"

const WEBHOOK = "/pax2/discord/agents-webhook-url"
const MAX = 3500

export async function GET() {
  const user = await currentUser()
  if (!user?.admin) return NextResponse.json({ error: "Admins only." }, { status: 403 })
  const [team, hook] = await Promise.all([slackTeam().catch(() => null), param(WEBHOOK).catch(() => null)])
  return NextResponse.json({ comments: true, slack: !!team, discord: !!hook })
}

export async function POST(request: Request) {
  const user = await currentUser()
  if (!user?.admin) return NextResponse.json({ ok: false, error: "Posting to the team is open to admins only." }, { status: 403 })
  try {
    forbidDemo(user)
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 403 })
  }
  const body = (await request.json().catch(() => null)) as { to?: unknown; text?: unknown; url?: unknown; route?: unknown } | null
  if (!body || !isTeamPlace(body.to)) return NextResponse.json({ ok: false, error: "to is comments, slack or discord." }, { status: 400 })
  const text = typeof body.text === "string" ? body.text.trim() : ""
  if (!text) return NextResponse.json({ ok: false, error: "The note is empty." }, { status: 400 })
  if (text.length > MAX) return NextResponse.json({ ok: false, error: `A note to the team runs to ${MAX} characters.` }, { status: 400 })
  const url = typeof body.url === "string" && /^https?:\/\//.test(body.url) ? body.url.slice(0, 600) : ""
  if (!url) return NextResponse.json({ ok: false, error: "Which page?" }, { status: 400 })
  const route = typeof body.route === "string" && body.route.startsWith("/") ? body.route.slice(0, 300) : new URL(url).pathname
  try {
    const writer = await writerFor(user)
    if (body.to === "comments") {
      await postComment({ author: user.email, text: teamText("comments", text, url, writer.name), kind: "comment", page: url, route })
      return NextResponse.json({ ok: true, where: "Dev Comments" })
    }
    if (body.to === "slack") {
      await slackPost(TEAM_SLACK_CHANNEL, teamText("slack", text, url, writer.name), writer)
      return NextResponse.json({ ok: true, where: "Slack #pax2" })
    }
    const posted = await postToDiscord({ text: teamText("discord", text, url, writer.name) })
    if (!posted.ok) return NextResponse.json({ ok: false, error: posted.error }, { status: 502 })
    return NextResponse.json({ ok: true, where: "Discord #pax" })
  } catch (e) {
    console.error("notes/team: not posted", e)
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Not posted." }, { status: 502 })
  }
}
