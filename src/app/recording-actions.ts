"use server"

import { currentUser } from "@/lib/auth"
import { keepRecorded, RECORDED_KEY, recordedKey, toClip } from "@/lib/clips/recorded"
import { stat, uploadUrl } from "@/lib/clips/storage"
import { ulid } from "@/lib/tests/responses"

// A recording's way into Clips: a signed address in the clips bucket for the take, then, once the
// take has arrived, its row in the recorded catalog (src/lib/clips/recorded.ts). Keeping a recording
// needs an account, as recording in Clips does.

const EXT: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" }

async function signedIn() {
  const user = await currentUser()
  if (!user) throw new Error("Sign in to keep your video in Clips.")
  return user
}

/** A one-time address the browser PUTs the take to, with the bare type it must send. */
export async function recordingUpload(contentType: string) {
  await signedIn()
  const type = String(contentType).split(";")[0].trim()
  const ext = EXT[type]
  if (!ext) throw new Error("That recording is not a video Clips can keep.")
  const id = `rec-${ulid().toLowerCase()}`
  const key = recordedKey(id, ext)
  return { id, key, type, url: await uploadUrl(key, type) }
}

/** Files a take that has arrived as the recorder's clip; answers where it plays. */
export async function keepRecording(input: { id: string; key: string; title: string; caption?: string; visibility?: "private" | "public"; messenger?: string; seconds: number; script?: string }) {
  const user = await signedIn()
  if (!RECORDED_KEY.test(input.key) || !input.key.startsWith(`recorded/${input.id}.`)) throw new Error("That is not a recording's key.")
  const title = String(input.title ?? "").trim().slice(0, 150)
  if (!title) throw new Error("Give your video a title.")
  const sent = await stat(input.key)
  if (!sent?.bytes) throw new Error("The video did not arrive. Send it again.")
  const seconds = Number(input.seconds)
  const row = await keepRecorded({
    id: input.id,
    key: input.key,
    contentType: sent.type ?? `video/${input.key.split(".").pop()}`,
    title,
    caption: String(input.caption ?? "").trim().slice(0, 2200) || null,
    visibility: input.visibility === "public" ? "public" : "private",
    messenger: String(input.messenger ?? "").trim().slice(0, 120) || null,
    owner: user.email,
    duration: Number.isFinite(seconds) && seconds > 0 ? Math.round(seconds) : null,
    script: String(input.script ?? "").trim().slice(0, 4000) || null,
    createdAt: new Date().toISOString(),
  })
  return { id: input.id, href: `/clips?c=${encodeURIComponent(input.id)}`, clip: toClip(row, user.email) }
}
