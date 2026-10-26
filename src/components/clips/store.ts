"use client"

import { DEFAULT_AVATAR } from "@/lib/auth/use-account"

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

export * from "./catalog"

import { type Clip, type Comment, PUBLISHED, SEED_COMMENTS, type Visibility } from "./catalog"


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
