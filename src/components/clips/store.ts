"use client"

import { DEFAULT_AVATAR } from "@/lib/auth/use-account"

import { creatorOf } from "./desks"

// The clips a reader can see, who made them, and what was said under them.
// This began as the mock's store (Brendan, 2026-09-07: "have it be a mockup,
// just to show me how it would really look and feel, and we'd wire it up
// later"). Likes and comments a reader adds still sit in localStorage, and
// the stock set is free Mixkit clips (no attribution required) under the
// desks that would have shot them.
//
// Wired (2026-09-14): `saveClip` writes the row in Aurora through /api/clips,
// which hands back signed addresses in the private clips bucket on S3; the
// browser sends the take and its poster there itself, and the row is
// published once the video has arrived. `loadMine` reads the reader's own
// rows back. Recorded, cut and
// generated clips all come back through the same `loadFeed`. Nothing that
// renders changes.

export { CREATORS, creatorOf, type Creator } from "./desks"

export type Visibility = "private" | "public"

export type Clip = {
  id: string
  creatorId: string
  author: { name: string; handle: string; image?: string | null }
  title: string
  /** Who speaks in the cut — shown beside the partner on every card. */
  messenger?: string
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

export type Comment = { id: string; clipId: string; author: { name: string; handle: string; image?: string | null }; text: string; at: string; likes: number; mine?: boolean }

const by = (id: string) => {
  const c = creatorOf(id)!
  return { name: c.name, handle: c.handle, image: c.image }
}

// The Frame.io review cuts (2026-10-25): transcoded once to 720-width
// faststart MP4 and served from S3 behind CloudFront (private bucket, OAC).
// The originals stay in public/clips-media/, untracked, as the archive.
const CLIPS_CDN = "https://d3tyjc2amjpyom.cloudfront.net"
const frame = (id: string, file: string, o: { title: string; duration: number; createdAt?: string; messenger?: string; partner?: string }): Clip => ({
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

export const PUBLISHED: Clip[] = [
  frame("danielle", "danielle-allen.mp4", { title: "Danielle Allen", messenger: "Danielle Allen", duration: 35 }),

  frame("dustin", "dustin-cathcart.mp4", { title: "Dustin Cathcart", messenger: "Dustin Cathcart", duration: 28 }),

  frame("jesse", "jesse-littlewood.mp4", { title: "Jesse Littlewood", messenger: "Jesse Littlewood", duration: 49 }),

  frame("paul", "paul-schilchtman.mp4", { title: "Paul Schilchtman", messenger: "Paul Schilchtman", duration: 43 }),

  frame("alex", "alex-rodriguez.mp4", { title: "Alex Rodriguez", messenger: "Alex Rodriguez", duration: 37 }),

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
]

const person = (name: string, handle: string) => ({ name, handle, image: null })

export const SEED_COMMENTS: Comment[] = []

/* ---- what the reader adds: S3 for the video, Aurora for the row, localStorage for the rest ---- */

/** Sends `blob` to a signed S3 address in one PUT, reporting the fraction sent. The type must be the one the address was signed for. */
export function putSigned(url: string, blob: Blob, contentType: string, onProgress?: (fraction: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", url)
    xhr.setRequestHeader("Content-Type", contentType)
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total)
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error("The upload was refused.")))
    xhr.onerror = () => reject(new Error("The upload stopped. Check the connection and try again."))
    xhr.send(blob)
  })
}

/** The bare type a recorder or a file names ("video/webm;codecs=vp9,opus" → "video/webm"). */
const bareType = (type: string, fallback: string) => type.split(";")[0].trim() || fallback

/** A JPEG data URL (the poster drawn from the take) as a Blob. */
function dataUrlBlob(dataUrl: string) {
  const [head, body] = dataUrl.split(",")
  const bytes = atob(body)
  const out = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) out[i] = bytes.charCodeAt(i)
  return new Blob([out], { type: /data:([^;]+)/.exec(head)?.[1] ?? "image/jpeg" })
}

/** A link a reader pasted, in the queue to be cut. */
export type Upload = { id: string; title: string; status: "queued" | "running" | "review" | "done" | "failed"; clips: number | null; createdAt: string; error?: string | null; videoId?: string | null }

export type Feed = { published: Clip[]; mine: Clip[]; uploads: Upload[] }

// A reader without a picture wears the site's default (Brendan, 2026-09-11: "george... the standard for any user who has not added a picture").
const withAvatar = (c: Clip): Clip => ({ ...c, author: { ...c.author, image: c.author.image || DEFAULT_AVATAR } })

/** Every published clip in Aurora, whatever its origin, and the reader's own. */
export async function loadFeed(): Promise<Feed> {
  const res = await fetch("/api/clips", { credentials: "same-origin", cache: "no-store" }).catch(() => null)
  if (!res?.ok) return { published: [], mine: [], uploads: [] }
  const body = (await res.json()) as Feed
  return { published: body.published.map(withAvatar), mine: body.mine.map(withAvatar), uploads: body.uploads ?? [] }
}

export const loadMine = async () => (await loadFeed()).mine

async function send<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method, credentials: "same-origin", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined })
  const out = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(out.error ?? `${res.status} ${res.statusText}`)
  return out
}

/**
 * A take, to the clips bucket. The row is written first and hands back the
 * signed addresses; the video and its poster go from the browser to S3
 * directly; then the server checks the video arrived and publishes the row.
 */
export async function saveClip(clip: Clip, onProgress?: (fraction: number) => void): Promise<Clip> {
  if (!clip.blob) throw new Error("Nothing was recorded.")
  const contentType = bareType(clip.blob.type, "video/webm")
  const made = await send<{ clip: Clip; uploadUrl: string; posterUrl: string | null }>("/api/clips", "POST", { title: clip.title, caption: clip.caption, visibility: clip.visibility, bytes: clip.blob.size, contentType, duration: clip.duration, poster: Boolean(clip.poster) })
  try {
    await putSigned(made.uploadUrl, clip.blob, contentType, onProgress)
    if (made.posterUrl && clip.poster) await putSigned(made.posterUrl, dataUrlBlob(clip.poster), "image/jpeg").catch(() => {})
    const done = await send<{ clip: Clip }>("/api/clips/" + encodeURIComponent(made.clip.id) + "/complete", "POST")
    return { ...done.clip, author: clip.author, mine: true }
  } catch (error) {
    await send("/api/clips/" + encodeURIComponent(made.clip.id), "DELETE").catch(() => {})
    throw error
  }
}

/** What Generate previewed, posted to the feed as its template and data. */
export async function postGenerated(post: { template: string } & Record<string, unknown>): Promise<Clip> {
  return (await send<{ clip: Clip }>("/api/clips/generated", "POST", post)).clip
}

export async function updateClip(id: string, patch: { visibility?: Visibility; title?: string; caption?: string }) {
  await send("/api/clips/" + encodeURIComponent(id), "PATCH", patch)
}

export async function deleteClip(id: string) {
  await send("/api/clips/" + encodeURIComponent(id), "DELETE")
}

/** A link to a long video, queued to be cut into clips. */
export async function submitLink(url: string): Promise<Upload> {
  return (await send<{ upload: Upload }>("/api/clips/uploads", "POST", { url })).upload
}

/** One step of cutting a pasted YouTube link: the captions, then the moments. Called again until the answer is done, failed, or waiting on the worker box. */
export async function cutLink(id: string): Promise<{ upload: Pick<Upload, "id" | "status" | "clips" | "error">; step: "transcript" | "moments" | null }> {
  return send("/api/clips/uploads/" + encodeURIComponent(id) + "/cut", "POST")
}

export async function withdrawUpload(id: string) {
  await send("/api/clips/uploads/" + encodeURIComponent(id), "DELETE")
}

export type ReportReason = "copyright" | "privacy" | "harmful" | "other"

export async function reportClip(report: { clipId: string; reason: ReportReason; details: string; contact: string }) {
  await send("/api/clips/reports", "POST", report)
}

export async function takeDown(id: string) {
  await send("/api/clips/" + encodeURIComponent(id) + "/takedown", "POST")
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
const writeJson = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

const LIKES = "govblock:clips:likes"
const SAVES = "govblock:clips:saves"
const FOLLOWS = "govblock:clips:follows"
const COMMENTS = "govblock:clips:comments"

export const loadLikes = () => new Set(readJson<string[]>(LIKES, []))
export const storeLikes = (s: Set<string>) => writeJson(LIKES, [...s])
export const loadSaves = () => new Set(readJson<string[]>(SAVES, []))
export const storeSaves = (s: Set<string>) => writeJson(SAVES, [...s])
export const loadFollows = () => new Set(readJson<string[]>(FOLLOWS, []))
export const storeFollows = (s: Set<string>) => writeJson(FOLLOWS, [...s])
export const loadMyComments = () => readJson<Comment[]>(COMMENTS, [])
export const storeMyComments = (rows: Comment[]) => writeJson(COMMENTS, rows)

/* ---- formatting ---- */

export const fmtDuration = (s?: number) => {
  if (!s || !Number.isFinite(s)) return ""
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.round(s % 60)).padStart(2, "0")}`
}

/** 98,800 → 98.8K, as the play count on a tile. */
export const fmtCount = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K` : String(n))

export const fmtWhen = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric" })

/** "3w", "4d", "2h", as a comment's age. */
export function fmtAge(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d`
  if (s < 86400 * 365) return `${Math.floor(s / (86400 * 7))}w`
  return `${Math.floor(s / (86400 * 365))}y`
}
