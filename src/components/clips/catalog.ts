import { creatorOf } from "./desks"

// The published clip catalog — every type and row the clips surfaces render,
// in a module without "use client" so the server can read the same list the
// rail shows (test arms are validated against it). The client store
// (./store) re-exports everything here; nothing that imports the store moves.

export type Visibility = "private" | "public"

export type Clip = {
  id: string
  creatorId: string
  author: { name: string; handle: string; image?: string | null }
  title: string
  /** Who speaks in the cut — shown beside the partner on every card. */
  messenger?: string
  /** A randomized test's published readout for this cut, when one exists. */
  report?: ClipReport
  caption: string
  src: string
  /** A YouTube video id: the clip plays in YouTube's own player and `src` is empty. */
  youtube?: string
  /** Where a cut of a YouTube video starts and ends, in seconds. */
  youtubeStart?: number
  youtubeEnd?: number
  blob?: Blob
  /** A frame of the recording as a JPEG data URL, drawn when it was saved, so a tile has something to show before the video decodes. */
  poster?: string
  duration?: number
  createdAt: string
  visibility: Visibility
  views: number
  likes: number
  mine?: boolean
  /** How a clip in Aurora came to be; absent on a stock clip. */
  origin?: "recorded" | "cut" | "generated"
  /** `processing` until its upload has arrived; only a clip's owner sees it then. */
  status?: "processing" | "review" | "published" | "removed"
  /** The record's own pages the clip is keyed to: the hearing, the bill, the roll call. */
  links?: { label: string; href: string }[]
  /** A generated clip: the template and the data it plays from, live in the browser. */
  composition?: { template: string; props: Record<string, unknown> }
}

export type ClipReport = {
  study: string
  fielded: string
  armN: number
  placeboN: number
  outcomes: { name: string; lift: number; label: "Persuasive" | "No measurable effect" }[]
}

export type Comment = { id: string; clipId: string; author: { name: string; handle: string; image?: string | null }; text: string; at: string; likes: number; mine?: boolean }

const by = (id: string) => {
  const c = creatorOf(id)!
  return { name: c.name, handle: c.handle, image: c.image }
}

// The Frame.io review cuts (2026-10-25): transcoded once to 720-width
// faststart MP4 and served from S3 behind CloudFront (private bucket, OAC).
// The originals stay in public/clips-media/, untracked, as the archive.
// NEXT_PUBLIC_CLIPS_CDN names the distribution per deploy (inlined at build); the old account's is the default.
const CLIPS_CDN = process.env.NEXT_PUBLIC_CLIPS_CDN ?? "https://d3tyjc2amjpyom.cloudfront.net"
/** Where the MA test's Wave 2 videos live, as the results register links them (src/lib/results/ma-wave-2.ts). */
const GP_MP4 = "https://s3.amazonaws.com/condoropenskies.net/videos/"

// The partner channels' shorts (pulled 2026-10-25 through the Webshare fleet),
// one manifest row per cut, files at <CDN>/<dir>/<id>.mp4.
type PartnerShort = { id: string; partner: string; title: string; duration: number }
const SHORT_DIR: Record<string, string> = { "voter-freedom": "vf", "yeson3": "y3", "unite-america": "ua" }
const shortClip = (x: PartnerShort): Clip => ({
  id: `yt-${x.id}`,
  creatorId: x.partner,
  author: by(x.partner),
  title: x.title,
  caption: "",
  src: `${CLIPS_CDN}/${SHORT_DIR[x.partner]}/${x.id}.mp4`,
  duration: x.duration,
  createdAt: "2026-10-25T12:00:00Z",
  visibility: "public",
  views: 0,
  likes: 0,
})
const frame = (id: string, file: string, o: { title: string; duration: number; createdAt?: string; messenger?: string; partner?: string; report?: ClipReport; src?: string; poster?: string; caption?: string }): Clip => ({
  id: `px-${id}`,
  creatorId: o.partner ?? "parallax",
  author: by(o.partner ?? "parallax"),
  src: `${CLIPS_CDN}/${file}`,
  caption: "Vertical cut, from the review set.",
  createdAt: "2026-10-24T19:50:00Z",
  visibility: "public",
  views: 0,
  likes: 0,
  ...o,
})

import PARTNER_SHORTS from "./partner-shorts.json"

export const PUBLISHED: Clip[] = [
  frame("danielle", "danielle-allen.mp4", { title: "Danielle Allen", messenger: "Danielle Allen", report: { study: "Grow Progress · Massachusetts Wave 1", fielded: "Oct 2–7, 2026", placeboN: 494, armN: 512, outcomes: [{ name: "Support — % choosing Yes", lift: 18, label: "Persuasive" }, { name: "Comprehension — % identifying the change", lift: 3, label: "No measurable effect" }] }, duration: 35 }),

  frame("dustin", "dustin-cathcart.mp4", { title: "Dustin Cathcart", messenger: "Dustin Cathcart", report: { study: "Grow Progress · Massachusetts Wave 1", fielded: "Oct 2–7, 2026", placeboN: 494, armN: 520, outcomes: [{ name: "Support — % choosing Yes", lift: 11, label: "Persuasive" }, { name: "Comprehension — % identifying the change", lift: 0, label: "No measurable effect" }] }, duration: 28 }),

  frame("jesse", "jesse-littlewood.mp4", { title: "Jesse Littlewood", messenger: "Jesse Littlewood", report: { study: "Grow Progress · Massachusetts Wave 1", fielded: "Oct 2–7, 2026", placeboN: 494, armN: 484, outcomes: [{ name: "Support — % choosing Yes", lift: 15, label: "Persuasive" }, { name: "Comprehension — % identifying the change", lift: -3, label: "No measurable effect" }] }, duration: 49 }),

  // Wave 1's Donut (the donut-shop line), which the register joins by this id.
  frame("paul", "paul-schilchtman.mp4", { title: "Paul Schilchtman", messenger: "Paul Schilchtman", duration: 43 }),
  // The rest of the tested videos (2026-10-29): Wave 2's four from the files the report links (the source's own
  // S3), and Wave 1's campaign ad from its Dropbox file (a horizontal 30s spot behind a slate, so its tile shows a
  // frame cut from it).
  frame("pahlow", "", { title: "Henry Pahlow", messenger: "Henry Pahlow", duration: 33, src: `${GP_MP4}435f181a420581798fd5d3f0fb00fc15.mp4` }),
  frame("dizoglio", "", { title: "DiZoglio", messenger: "DiZoglio", duration: 30, src: `${GP_MP4}526c5d31f5ba126c1776c3cd098c5e9c.mp4` }),
  frame("matt-wilson", "", { title: "Matt Wilson", messenger: "Matt Wilson", duration: 36, src: `${GP_MP4}6417d791d9411c2c168787b7e8d2008e.mp4` }),
  frame("green", "", { title: "David Green", messenger: "David Green", duration: 35, src: `${GP_MP4}6ca5b15be2ca5c2ce9ea963e6b66fd35.mp4` }),
  frame("hold-them-accountable", "", {
    title: "Hold Them Accountable",
    messenger: "Coalition for Healthy Democracy",
    partner: "yeson3",
    duration: 37,
    caption: "",
    src: "https://www.dropbox.com/scl/fi/jateupa882uhqcqlhro6u/CFHD_HTA30_1026.mp4?rlkey=v58jz7ynw5derpf80b89803su&raw=1",
    poster: "/clips-posters/hold-them-accountable.jpg",
  }),

  frame("alex", "alex-rodriguez.mp4", { title: "Alex Rodriguez", messenger: "Alex Rodriguez", report: { study: "Grow Progress · Massachusetts Wave 1", fielded: "Oct 2–7, 2026", placeboN: 494, armN: 546, outcomes: [{ name: "Support — % choosing Yes", lift: 2, label: "No measurable effect" }, { name: "Comprehension — % identifying the change", lift: 0, label: "No measurable effect" }] }, duration: 37 }),

  frame("ajayi", "ajayi-harris.mp4", { title: "Ajayi Harris", messenger: "Ajayi Harris", duration: 27 }),

  frame("liam-kerr", "closed-primaries-fuel-extremes-liam-kerr-55s.mp4", { title: "Closed primaries fuel extremes", messenger: "Liam Kerr", partner: "voter-freedom", duration: 55, createdAt: "2026-10-05T12:00:00Z" }),
  frame("beth-co", "independent-votersin-colorado-beth-42s.mp4", { title: "Independent voters in Colorado", messenger: "Beth", partner: "voter-freedom", duration: 43, createdAt: "2026-10-05T12:00:00Z" }),
  frame("john-avlon", "let-all-americans-vote-john-avlon-1m3s.mp4", { title: "Let all Americans vote", messenger: "John Avlon", partner: "voter-freedom", duration: 63, createdAt: "2026-10-05T12:00:00Z" }),
  frame("cameron", "millionsof-unheard-voters-cameron-44s.mp4", { title: "Millions of unheard voters", messenger: "Cameron", partner: "voter-freedom", duration: 44, createdAt: "2026-10-05T12:00:00Z" }),
  frame("larry-sokoff", "more-than-two-choices-larry-sokoff-34s.mp4", { title: "More than two choices", messenger: "Larry Sokoff", partner: "voter-freedom", duration: 34, createdAt: "2026-10-05T12:00:00Z" }),
  frame("theo-wilson", "name-another-job-theo-wilson-1m4s.mp4", { title: "Name another job", messenger: "Theo Wilson", partner: "voter-freedom", duration: 64, createdAt: "2026-10-05T12:00:00Z" }),
  frame("beth-jon", "no-football-for-you-beth-jon-2m13s.mp4", { title: "No football for you", messenger: "Beth and Jon", partner: "voter-freedom", duration: 133, createdAt: "2026-10-05T12:00:00Z" }),
  frame("garrett", "taxation-without-choice-garrett-52s.mp4", { title: "Taxation without choice", messenger: "Garrett", partner: "voter-freedom", duration: 53, createdAt: "2026-10-05T12:00:00Z" }),
  frame("landon", "taxation-without-representation-landon-45s.mp4", { title: "Taxation without representation", messenger: "Landon", partner: "voter-freedom", duration: 45, createdAt: "2026-10-05T12:00:00Z" }),
  frame("john-opdycke", "the-case-for-open-primaries-john-opdycke.mp4", { title: "The case for open primaries", messenger: "John Opdycke", partner: "voter-freedom", duration: 45, createdAt: "2026-10-05T12:00:00Z" }),
  frame("rise-independents", "the-rise-of-independents-voters-41s.mp4", { title: "The rise of independent voters", partner: "voter-freedom", duration: 42, createdAt: "2026-10-05T12:00:00Z" }),
  frame("jimmy-carr", "two-things-needto-happen-jimmy-carr-59s.mp4", { title: "Two things need to happen", messenger: "Jimmy Carr", partner: "voter-freedom", duration: 60, createdAt: "2026-10-05T12:00:00Z" }),
  frame("gaby", "windependentsare-locked-out-gaby.mp4", { title: "Why independents are locked out", messenger: "Gaby", partner: "voter-freedom", duration: 46, createdAt: "2026-10-05T12:00:00Z" }),
  frame("cats", "when-political-parties-see-independent-voters-cats-19s.mp4", { title: "When political parties see independent voters", messenger: "Cats", partner: "voter-freedom", duration: 19, createdAt: "2026-10-05T12:00:00Z" }),
  frame("nick-jon", "whos-in-charge-nick-jon-1m10s.mp4", { title: "Who's in charge", messenger: "Nick and Jon", partner: "voter-freedom", duration: 70, createdAt: "2026-10-05T12:00:00Z" }),
  frame("msnow", "why-independents-are-locked-out-msnow-39s.mp4", { title: "Why independents are locked out", messenger: "MSNOW", partner: "voter-freedom", duration: 39, createdAt: "2026-10-05T12:00:00Z" }),
  frame("locked-out", "why-independentsare-locked-out-40s.mp4", { title: "Why independents are locked out", partner: "voter-freedom", duration: 41, createdAt: "2026-10-05T12:00:00Z" }),
  frame("no-newscaster", "why-independentsare-locked-out-no-newscaster-21s.mp4", { title: "Why independents are locked out", partner: "voter-freedom", duration: 21, createdAt: "2026-10-05T12:00:00Z" }),
  frame("theo", "why-nothing-passes-theo-51s.mp4", { title: "Why nothing passes", messenger: "Theo", partner: "voter-freedom", duration: 52, createdAt: "2026-10-05T12:00:00Z" }),
  ...(PARTNER_SHORTS as PartnerShort[]).map(shortClip),
]

const person = (name: string, handle: string) => ({ name, handle, image: null })

export const SEED_COMMENTS: Comment[] = []
