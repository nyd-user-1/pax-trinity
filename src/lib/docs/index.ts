import { ADMIN } from "./admin"
import { FAQ } from "./faq"
import { GET_STARTED } from "./get-started"
import { INBOX } from "./inbox"
import { PARTNERS } from "./partners"
import { RELEASE_NOTES } from "./release-notes"
import { RESEARCH } from "./research"
import { RESULTS } from "./results"
import { SURVEYS } from "./surveys"
import { TOOLS } from "./tools"
import type { Doc, DocCategory } from "./types"
import { VIDEO } from "./video"

export type { Doc, DocCategory } from "./types"

/** The help center's categories, in the sidebar's order (Notion's Help Center, Brendan 2026-10-31). Video guides
 *  sits apart, under Learn by doing. */
export const CATEGORIES: { id: DocCategory; title: string; blurb: string }[] = [
  { id: "get-started", title: "Get started", blurb: "What PAX is, your account, and finding your way around." },
  { id: "results", title: "Read results", blurb: "Lift, Lift Analysis, the Archive and Reports." },
  { id: "research", title: "Research opinion", blurb: "America Thinks, Constructs and the data dictionary." },
  { id: "surveys", title: "Surveys and consensus", blurb: "Answer surveys, read consensus and run message tests." },
  { id: "video", title: "Make videos", blurb: "Chat, video templates, Studio, recording and Clips." },
  { id: "tools", title: "Tools and Blocks", blurb: "The Tools panel, saving blocks and the second panel." },
  { id: "inbox", title: "Inbox and email", blurb: "The agents, fielding and the email templates." },
  { id: "admin", title: "For staff", blurb: "Dev Tools and the Dashboard." },
  { id: "partners", title: "Partner onboarding", blurb: "From your account to your first test." },
  { id: "faq", title: "FAQ", blurb: "Answers to the questions people ask most." },
  { id: "releases", title: "Release notes", blurb: "What changed, day by day." },
]

export const DOCS: Doc[] = [...GET_STARTED, ...RESULTS, ...RESEARCH, ...SURVEYS, ...VIDEO, ...TOOLS, ...INBOX, ...ADMIN, ...PARTNERS, ...FAQ, ...RELEASE_NOTES]

/** The help center's old addresses (?page=), by their old slugs. */
const ALIASES: Record<string, string> = { "the-loop": "welcome", "who-uses-pax": "accounts", "staff-sign-in": "first-sign-in", "finding-your-way": "find-your-way", tests: "message-tests", survey: "survey-toplines", consensus: "answer-a-survey" }

export const docBySlug = (slug: string | undefined) => (slug ? DOCS.find((d) => d.slug === (ALIASES[slug] ?? slug)) : undefined)
export const categoryOf = (id: DocCategory) => CATEGORIES.find((c) => c.id === id)
export const inCategory = (id: DocCategory) => DOCS.filter((d) => d.category === id)

/** A heading's anchor, shared by the article's headings and its contents. */
export const headingId = (text: string) =>
  text
    .toLowerCase()
    .replace(/[*`[\]]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

/** The article's sections, for its contents. */
export const headingsOf = (body: string) => [...body.matchAll(/^## (.+)$/gm)].map((m) => ({ id: headingId(m[1]!), text: m[1]!.replace(/[*`]/g, "") }))

/** Minutes to read, at 200 words a minute; pictures and links don't count. */
export const readMinutes = (body: string) => Math.max(1, Math.round(body.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\]\([^)]*\)/g, "]").split(/\s+/).filter(Boolean).length / 200))

/** The articles before and after, in the sidebar's order. */
export function neighbors(slug: string) {
  const order = [...CATEGORIES.flatMap((c) => inCategory(c.id)), ...DOCS.filter((d) => d.category === "guides")]
  const i = order.findIndex((d) => d.slug === slug)
  return { prev: i > 0 ? order[i - 1] : undefined, next: i >= 0 && i < order.length - 1 ? order[i + 1] : undefined }
}
