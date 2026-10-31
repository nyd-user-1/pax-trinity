// /docs' pictures and videos (Brendan, 2026-10-31): screenshots of every page, the guide videos made from them with
// Remotion (scripts/docs-media) and screen recordings, served from the clips bucket's docs/ folder behind its
// CloudFront distribution, so none of it rides in the repo or the deploy.

export const DOCS_MEDIA = process.env.NEXT_PUBLIC_DOCS_MEDIA ?? "https://d19bx9wfmnrb34.cloudfront.net/docs"

/** A screenshot, as markdown: shots/<name>.jpg. */
export const shot = (name: string, alt: string) => `![${alt}](${DOCS_MEDIA}/shots/${name}.jpg)`

/** A video, as markdown the docs draw as a player; its poster is the same name as a .jpg. */
export const video = (name: string, alt: string) => `![${alt}](${DOCS_MEDIA}/videos/${name}.mp4)`

/** The narrators each video is rendered in (Brendan, 2026-10-31), the first the default: ElevenLabs' Sarah, then
 *  Amazon Polly's Ruth and Matthew, each <name><suffix>.mp4 (a voice's own name, so a browser never replays a file
 *  cached before it was narrated). More of ElevenLabs' voices (Brian…) join once its plan has the characters
 *  (scripts/docs-media/capture/narrate.mjs). */
export const NARRATORS: { id: string; label: string; provider: string; suffix: string }[] = [
  { id: "sarah", label: "Sarah", provider: "ElevenLabs", suffix: ".sarah" },
  { id: "ruth", label: "Ruth", provider: "Polly", suffix: ".ruth" },
  { id: "matthew", label: "Matthew", provider: "Polly", suffix: ".matthew" },
]

/** The guide videos, for Video guides and each article that plays one. */
export const GUIDES: { name: string; title: string; summary: string; article: string }[] = [
  { name: "guide-lift-analysis", title: "Read a result in Lift", summary: "Open a lift, read its analysis, and step through the table.", article: "lift-analysis" },
  { name: "guide-lift-filters", title: "Filter Lift and keep favorites", summary: "Hide what you don't need, star what you do.", article: "lift-sidebar" },
  { name: "guide-survey", title: "Answer a survey", summary: "Agree, disagree or pass, then see where people agree.", article: "answer-a-survey" },
  { name: "guide-tools", title: "Get around with Tools", summary: "One panel for Blocks, Chat, Lift Analysis, Theme and more.", article: "tools" },
  { name: "guide-second-panel", title: "Open a second panel", summary: "Keep two pages side by side.", article: "second-panel" },
  { name: "guide-blocks", title: "Save a block", summary: "Keep any block one click away.", article: "blocks" },
  { name: "record-chat", title: "Make videos in Chat", summary: "Three videos from one request, then a change to one of them.", article: "videos-in-chat" },
  { name: "record-studio", title: "Studio", summary: "Every template, played one after another.", article: "studio" },
]
