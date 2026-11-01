import "server-only"

import type { Connection } from "@/lib/agents/connections"
import { param } from "@/lib/ssm-param"

// Slack, the first connection written and the second one live.
//
// A single-workspace bot posting to one channel needs a bot token and nothing
// else — no OAuth dance, no per-user consent, no refresh — so the credential is
// the PAX bot's token in SSM, the same /pax2/slack/bot-token Housekeeping reads
// (lib/slack.ts; SLACK_BOT_TOKEN overrides it), and `chat.postMessage` is one
// signed HTTPS call. The channel the agents post to is its own parameter,
// /pax2/slack/agents-channel. Bedrock AgentCore Identity's SlackOauth2 credential
// provider is the AWS-standard alternative and is the right answer the moment a
// *second* workspace or a per-user token appears; it is the wrong answer for one
// bot, because it wants a client id and secret for a three-legged flow this app
// never performs. The adoption trigger is written in this directory's index.
//
// Until both parameters hold a value this returns `connected: false` and
// contributes no tools, so the Tracker is never offered a way to post that does
// not work.

const TOKEN_PARAM = "/pax2/slack/bot-token"
const CHANNEL_PARAM = "/pax2/slack/agents-channel"

async function credentials() {
  const [token, channel] = await Promise.all([process.env.SLACK_BOT_TOKEN?.trim() || param(TOKEN_PARAM), param(CHANNEL_PARAM)])
  return { token, channel }
}

/** What is missing, as a sentence, or null when both are there. */
const missing = ({ token, channel }: { token: string | null; channel: string | null }) =>
  !token ? `${TOKEN_PARAM} holds no bot token` : !channel ? `${CHANNEL_PARAM} names no channel` : null

export type Posted = { ok: true; where: string; ref: string } | { ok: false; error: string }

export async function postToSlack({ text }: { text: string }): Promise<Posted> {
  const found = await credentials()
  const gap = missing(found)
  if (gap) return { ok: false, error: `Slack is not connected — ${gap}.` }
  const { token, channel } = found as { token: string; channel: string }

  try {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json; charset=utf-8",
        "user-agent": "govblock-agents/1 (+https://policy.nysgpt.com)",
      },
      body: JSON.stringify({ channel, text, unfurl_links: false }),
      signal: AbortSignal.timeout(15_000),
    })
    const body = (await response.json()) as { ok?: boolean; error?: string; ts?: string; channel?: string }
    if (!body.ok) return { ok: false, error: body.error ?? `HTTP ${response.status}` }
    return { ok: true, where: body.channel ?? channel, ref: body.ts ?? "" }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export const slack: Connection = {
  id: "slack",
  name: "Slack",
  summary: "Post a finished digest into a channel, so a tracking run ends somewhere people already look.",
  logo: "/logos/slack.png",
  tint: "#611f69",
  auth: `Bot token in SSM, ${TOKEN_PARAM} (the PAX bot, shared with Housekeeping), and the channel in ${CHANNEL_PARAM}, read by the pax-trinity-amplify-compute role.`,
  tools: ["post_to_slack"],
  async status() {
    const found = await credentials()
    const gap = missing(found)
    if (!gap) return { connected: true, detail: `Posting to ${found.channel}.` }
    return { connected: false, detail: `Not connected: ${gap}, so this contributes no tools.` }
  },
}
