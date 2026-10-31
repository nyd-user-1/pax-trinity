import { MODEL_OPTIONS } from "@/lib/model-options"
import { VIDEO_MODEL_OPTIONS } from "@/lib/video-model-options"

// /models' cards (Brendan, 2026-10-29). LLM and Visual read the chat's two pickers (model-options.ts,
// video-model-options.ts), so a model added there gets a card here; FACTS holds each one's basics, from
// the makers' release notes as of 2026-10-29. Prices are Bedrock's us-east-1 list (lib/agents/models.ts)
// and appear only where they are known. Original is the PAX Series 1.0 cards, word for word.

export type Fact = [label: string, value: string]
export type CommercialCard = { id: string; name: string; maker: string; logo: string | null; badge?: { label: string; tone: "blue" | "amber" }; facts: Fact[] }
export type OriginalCard = { id: string; name: string; tagline: string; what: string; who: string; proof: string; uses: string[] }

const CLOSED: Fact = ["Weights", "Closed"]
const IMAGES: Fact = ["Inputs", "Text, images"]
const TEXT: Fact = ["Inputs", "Text"]

// Keyed by the picker's id. "In PAX" appears only where a model does more than sit in the picker.
const LLM_FACTS: Record<string, { maker: string; facts: Fact[] }> = {
  "us.anthropic.claude-sonnet-4-6": { maker: "Anthropic", facts: [["Released", "Feb 17, 2026"], ["Context window", "200K tokens, 1M in beta"], IMAGES, CLOSED, ["Price", "$3 in, $15 out per 1M tokens"], ["In PAX", "The chat's default; the agents' grounded tier"]] },
  "us.anthropic.claude-haiku-4-5-20251001-v1:0": { maker: "Anthropic", facts: [["Released", "Oct 15, 2025"], ["Context window", "200K tokens"], IMAGES, CLOSED, ["Price", "$1 in, $5 out per 1M tokens"], ["In PAX", "The agents' routing tier"]] },
  "us.anthropic.claude-opus-4-6-v1": { maker: "Anthropic", facts: [["Released", "Feb 5, 2026"], ["Context window", "200K tokens, 1M in beta"], IMAGES, CLOSED, ["Price", "$5 in, $25 out per 1M tokens"], ["In PAX", "The agents' reasoning tier"]] },
  "us.anthropic.claude-opus-4-5-20251101-v1:0": { maker: "Anthropic", facts: [["Released", "Nov 24, 2025"], ["Context window", "200K tokens"], IMAGES, CLOSED, ["Price", "$5 in, $25 out per 1M tokens"]] },
  "us.anthropic.claude-sonnet-4-5-20250929-v1:0": { maker: "Anthropic", facts: [["Released", "Sep 29, 2025"], ["Context window", "200K tokens, 1M in beta"], IMAGES, CLOSED, ["Price", "$3 in, $15 out per 1M tokens"]] },
  "openai.gpt-oss-120b-1:0": { maker: "OpenAI", facts: [["Released", "Aug 5, 2025"], ["Context window", "128K tokens"], TEXT, ["Weights", "Open, Apache 2.0"], ["Size", "117B, 5.1B active"]] },
  "us.meta.llama4-maverick-17b-instruct-v1:0": { maker: "Meta", facts: [["Released", "Apr 5, 2025"], ["Context window", "Up to 1M tokens"], IMAGES, ["Weights", "Open, Llama 4 license"], ["Size", "400B, 17B active"]] },
  "us.meta.llama4-scout-17b-instruct-v1:0": { maker: "Meta", facts: [["Released", "Apr 5, 2025"], ["Context window", "Up to 10M tokens"], IMAGES, ["Weights", "Open, Llama 4 license"], ["Size", "109B, 17B active"]] },
  "us.meta.llama3-3-70b-instruct-v1:0": { maker: "Meta", facts: [["Released", "Dec 6, 2024"], ["Context window", "128K tokens"], TEXT, ["Weights", "Open, Llama 3.3 license"], ["Size", "70B"]] },
  "us.mistral.pixtral-large-2502-v1:0": { maker: "Mistral AI", facts: [["Released", "Feb 2025"], ["Context window", "128K tokens"], IMAGES, ["Weights", "Open, Mistral Research License"], ["Size", "124B"]] },
  "mistral.mistral-large-3-675b-instruct": { maker: "Mistral AI", facts: [["Released", "Dec 2, 2025"], ["Context window", "256K tokens"], IMAGES, ["Weights", "Open, Apache 2.0"], ["Size", "675B, 41B active"]] },
  "us.amazon.nova-pro-v1:0": { maker: "Amazon", facts: [["Released", "Dec 3, 2024"], ["Context window", "300K tokens"], ["Inputs", "Text, images, video"], CLOSED] },
  "us.amazon.nova-2-lite-v1:0": { maker: "Amazon", facts: [["Released", "Dec 2, 2025"], ["Context window", "1M tokens"], ["Inputs", "Text, images, video"], CLOSED] },
  "us.deepseek.r1-v1:0": { maker: "DeepSeek", facts: [["Released", "Jan 20, 2025"], ["Context window", "128K tokens"], TEXT, ["Weights", "Open, MIT"], ["Size", "671B, 37B active"]] },
  "us.moonshotai.kimi-k3": { maker: "Moonshot AI", facts: [["Released", "Jul 16, 2026"], ["Context window", "1M tokens"], IMAGES, ["Size", "2.8T"]] },
  "moonshotai.kimi-k2.5": { maker: "Moonshot AI", facts: [["Released", "Jan 27, 2026"], ["Context window", "256K tokens"], IMAGES, ["Weights", "Open, modified MIT"], ["Size", "1T, 32B active"]] },
  "moonshot.kimi-k2-thinking": { maker: "Moonshot AI", facts: [["Released", "Nov 6, 2025"], ["Context window", "256K tokens"], TEXT, ["Weights", "Open, modified MIT"], ["Size", "1T, 32B active"]] },
  "qwen.qwen3-next-80b-a3b": { maker: "Alibaba", facts: [["Released", "Sep 2025"], ["Context window", "256K tokens"], TEXT, ["Weights", "Open, Apache 2.0"], ["Size", "80B, 3B active"]] },
  "minimax.minimax-m2.5": { maker: "MiniMax", facts: [["Released", "Feb 12, 2026"], ["Context window", "205K tokens"], TEXT, ["Weights", "Open, MiniMax license"]] },
  "zai.glm-5": { maker: "Z.ai", facts: [["Released", "Feb 11, 2026"], ["Context window", "200K tokens"], TEXT, ["Weights", "Open, MIT"], ["Size", "744B, 40B active"]] },
}

export const LLM_CARDS: CommercialCard[] = MODEL_OPTIONS.map((m, i): CommercialCard => {
  const known = LLM_FACTS[m.id]
  return {
    id: m.id,
    // The cards name no model Claude (Brendan, 2026-10-31): Sonnet 4.6, not Claude Sonnet 4.6.
    name: m.label.replace(/^Claude /, ""),
    maker: known?.maker ?? m.description,
    logo: m.logo,
    badge: i === 0 ? { label: "Default", tone: "blue" } : undefined,
    facts: [...(known?.facts ?? []), ["Model ID", m.id]],
  }
})

// The video models in the picker's order, which is also the order a failed generation falls back down.
const VIDEO_FACTS: Record<string, { name?: string; maker: string; facts: Fact[]; badge?: CommercialCard["badge"] }> = {
  kling: { maker: "Kuaishou", facts: [["Released", "Jun 17, 2026"], ["Makes", "Video from text"], ["Clips in PAX", "3 to 15 seconds, 720p"], ["Model ID", "kling-3.0-turbo"]] },
  veo: { maker: "Google", badge: { label: "Preview", tone: "amber" }, facts: [["Released", "Oct 15, 2025"], ["Makes", "Video from text"], ["Clips in PAX", "4, 6 or 8 seconds, 720p"], ["Shutdown", "Oct 22, 2026"], ["Model ID", "veo-3.1-generate-preview"]] },
  higgsfield: { maker: "ByteDance, through Higgsfield", facts: [["Makes", "Video from text"], ["Clips in PAX", "4 to 30 seconds, 720p"], ["Model ID", "bytedance/seedance-2.5/text-to-video"]] },
  elevenlabs: { name: "Seedance 2.0", maker: "ByteDance, through ElevenLabs", facts: [["Released", "Feb 2026"], ["Makes", "Video from text"], ["Clips in PAX", "3 to 12 seconds, 720p"], ["Model ID", "bytedance-seedance-v2"]] },
}
const ORDINAL = ["First", "Second", "Third", "Fourth", "Fifth"]

export const VISUAL_CARDS: CommercialCard[] = [
  ...VIDEO_MODEL_OPTIONS.map((m, i): CommercialCard => {
    const known = VIDEO_FACTS[m.id]
    const facts = known?.facts ?? []
    return {
      id: m.id,
      name: known?.name ?? m.label,
      maker: known?.maker ?? m.description,
      logo: m.logo ? encodeURI(m.logo) : null,
      badge: i === 0 ? { label: "Default", tone: "blue" } : known?.badge,
      // "In PAX" sits before the id, which every card ends on.
      facts: [...facts.filter(([k]) => k !== "Model ID"), ["In PAX", `B-roll for the chat's enhance flow, ${ORDINAL[i]!.toLowerCase()} in line`], ...facts.filter(([k]) => k === "Model ID")],
    }
  }),
  // The enhance flow's clean-up pass (app/video-gen-actions.ts), outside the picker.
  {
    id: "runway-aleph",
    name: "Runway Aleph",
    maker: "Runway",
    logo: "/logos/RUNWAY.jpeg",
    facts: [["Released", "Jul 25, 2025"], ["Makes", "Video from video"], ["In PAX", "Cleans up a recorded take: steadies the camera, evens the light"], ["Clips in PAX", "Portrait, 720 × 1280"], ["Model ID", "gen4_aleph"]],
  },
]

export const PAX_SERIES: Fact[] = [
  ["Trained by", "NYSgpt.com"],
  ["Sponsored by", "Unite America"],
]

export const ORIGINAL_CARDS: OriginalCard[] = [
  {
    id: "affinity",
    name: "Affinity",
    tagline: "The videos the same audience rewarded",
    what: "Lookalikes, plus a lesson from audience behavior: which shorts broke out together on the same channel. It finds past videos the same audience rewarded, not just ones on the same topic.",
    who: "Channels planning what to make next.",
    proof: "Inside a single channel, it picks the breakout 58 times out of 100: 16% more often than a coin flip, and 9% more often than the general-purpose model.",
    uses: ["Check whether a draft resembles a channel's past breakouts or its misses", "Group a catalog into families of videos one audience rewards together", "Choose the next idea from the family that keeps breaking out"],
  },
  {
    id: "craft",
    name: "Craft",
    tagline: "Why one video beat another, in plain editing terms",
    what: "Measures how a short is made: how fast it cuts, when the first cut lands, how loud the opening is, how much text is on screen and how quickly someone starts speaking. Every finding reads as an edit, such as “the breakouts on this channel cut first at 5.4 seconds; the rest at 6.3.”",
    who: "Editors and producers who want to know what to change, not just a score.",
    proof: "Shown two shorts from the same channel, it picks the one that broke out 60 times out of 100: 20% more often than a coin flip, on channels it never saw.",
    uses: ["Give editors specific notes before publishing", "Explain in a post-mortem why one short beat another", "Build a style guide for each channel from its own breakouts"],
  },
  {
    id: "duel",
    name: "Duel",
    tagline: "Which headline wins the click",
    what: "Give it two headlines or titles for the same story and it predicts which one people will choose. It learned from more than 12,000 real, randomized headline experiments in the Upworthy Research Archive.",
    who: "Newsrooms, publishers, campaigns, marketers and anyone choosing between titles.",
    proof: "It picks the winning headline 67 times out of 100: 34% more often than a coin flip, and 10% more often than the best rules of thumb.",
    uses: ["Choose between headline drafts before publishing", "Narrow ten candidates to the best two before a live A/B test", "Screen email subject lines, push notifications and text messages"],
  },
  {
    id: "lift",
    name: "Lift",
    tagline: "Measure Movement",
    what: "PAX's reference library of measured lift: how much each of 28 ad traits shifted favorability and vote choice across 146 randomized political ad tests, built from the published archive of Hewitt, Broockman, Coppock and colleagues (American Political Science Review, 2024).",
    who: "Campaign and advocacy teams who want evidence, not hunches, beside their creative.",
    proof: "A plain-spoken, everyday messenger added about 0.8 points of vote choice, and an explicit ask to vote for the candidate about 0.6.",
    uses: ["Cite measured effects in creative briefs", "Benchmark your own test results against the 146-study average and spread", "Make the case for message-testing budgets"],
  },
  {
    id: "lookalikes",
    name: "Lookalikes",
    tagline: "Finding the videos that worked like this one",
    what: "Turns each short's title, description and transcript into a fingerprint of what made it land, then pulls the past shorts that performed most like it. A companion ranker puts the most telling comparisons first.",
    who: "Teams that want comparables: the closest past hits and misses to the video they are about to post.",
    proof: "Judging shorts by their closest past matches, it picks the breakout 61 times out of 100: 22% more often than a coin flip, and 5% more often than the general-purpose model it was built from.",
    uses: ["Search a video catalog by meaning: “shorts like this one”", "Pull the closest past hits and misses for a draft", "Attach real examples to creative briefs"],
  },
  {
    id: "odds-are",
    name: "Odds Are",
    tagline: "The odds, before anyone has seen it",
    what: "Reads everything a short carries the moment it goes up: title, description, tags, length, posting time, thumbnail and, where there is one, the transcript. It estimates the chance this short breaks out for its channel.",
    who: "Teams deciding which of several cuts to post, and when.",
    proof: "Before a single view comes in, it picks the breakout 59 times out of 100: 18% more often than a coin flip, on channels it never saw.",
    uses: ["Pick which of several cuts or versions to post", "Triage a backlog of drafts and post the strongest first", "Flag low-odds posts for a stronger title or thumbnail"],
  },
  {
    id: "sticky",
    name: "Sticky",
    tagline: "How much of it people will actually watch",
    what: "Estimates how much of a short viewers will watch before they swipe away, from its length, format and tags. Watching through falls fast with length: viewers watched about a third of shorts under 15 seconds, and about an eighth of those near a minute.",
    who: "Editors deciding how long a cut should run.",
    proof: "Trained on a public research dataset from another short-video platform, its ranking of videos it had never seen closely matched how much people really watched. It retrains on a channel's own analytics once they are connected.",
    uses: ["Set target lengths for cuts", "Compare a long and a short edit before export", "Plan series formats around how much people finish"],
  },
  {
    id: "surge",
    name: "Surge",
    tagline: "Spotting a breakout in its first hours",
    what: "Watches a short's views in its first one, three and six hours and estimates whether it will be a breakout by the end of day three.",
    who: "Teams deciding where to put promotion budget, and which videos to follow up on while they are still rising.",
    proof: "Six hours in, it picks the breakout 73 times out of 100: 46% more often than a coin flip. Its top tenth break out at about 3.7 times the usual rate.",
    uses: ["Decide which posts get paid promotion while they are still rising", "Stop spending on posts that are not taking off", "Publish a follow-up while the topic is still hot"],
  },
  {
    id: "wave",
    name: "Wave",
    tagline: "What is catching on this week",
    what: "Affinity's sibling, which also learns from shorts that took off in the same week. It leans toward the topics catching on right now.",
    who: "Rapid-response and news teams, where timing matters as much as content.",
    proof: "It picks the future breakout 62 times out of 100: 24% more often than a coin flip, and 7% more often than the general-purpose model.",
    uses: ["Match a draft to what is taking off across channels this week", "Find this week's closest breakouts before a rapid response", "Feed a weekly “what's catching on” briefing"],
  },
]
