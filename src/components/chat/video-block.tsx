"use client"

import * as React from "react"
import { Clapperboard, Download, Loader2 } from "lucide-react"

import { useShellPanel } from "@/components/shell"
import { TemplatePlayer } from "@/components/video/TemplatePlayer"
import { whiteButton } from "@/components/white-button"
import { noteDrawn, openStudio, VERSIONS_CHANGED } from "@/lib/studio"
import { validate } from "@/video/specs"

// A ```pax-video block in a finished reply (chat.tsx): the template drawn live, saved once as the reader's
// next version of it (/api/video/versions), its number as a badge, and for admins Get MP4, which renders it
// on the server (/api/video/render, Remotion Lambda) and opens the file, and Open in Studio, which
// opens the right panel's Studio on that version. Props that fail the template's schema show the schema's
// error where the video would be. A block is saved under its chat, its message and its own JSON
// (lib/studio.ts blockKey), so drawing it again (a re-render, a reload of the saved chat) finds the version
// already made.

type Saved = { id: string; version: number }

// One request per block per page load, however often the block draws.
const saves = new Map<string, Promise<Saved | null>>()

function saveOnce(key: string, body: Record<string, unknown>): Promise<Saved | null> {
  let p = saves.get(key)
  if (!p) {
    p = fetch("/api/video/versions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, key }) })
      .then(async (r) => {
        if (!r.ok) return null
        const v = (await r.json()) as Saved
        // The chat sends it back to the model with the block, so a revision can name it as its parent.
        noteDrawn(key, v.id)
        // A new version: an open Studio reloads onto it.
        if (r.status === 201) window.dispatchEvent(new CustomEvent(VERSIONS_CHANGED, { detail: { id: v.id } }))
        return { id: v.id, version: v.version }
      })
      .catch(() => null)
    saves.set(key, p)
  }
  return p
}

type Mp4 = { state: "idle" } | { state: "working" } | { state: "ready"; url: string } | { state: "failed"; error: string }

/** The block rendered to an MP4 on the server: its address on the clips CDN. A render that outlasts the request
 *  answers 202 with its id, polled here until done; local development without Lambda answers the file itself. */
async function renderMp4(templateId: string, props: unknown): Promise<string> {
  let r = await fetch("/api/video/render", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ templateId, props, format: "mp4" }) })
  for (let polls = 0; polls < 60; polls++) {
    if (r.ok && r.headers.get("content-type")?.startsWith("video/")) return URL.createObjectURL(await r.blob())
    const d = (await r.json().catch(() => ({}))) as { url?: string; renderId?: string; bucketName?: string; error?: string }
    if (r.status !== 202 || !d.renderId || !d.bucketName) {
      if (r.ok && d.url) return d.url
      throw new Error(d.error ?? `The render answered ${r.status}.`)
    }
    await new Promise((resolve) => setTimeout(resolve, 3_000))
    r = await fetch(`/api/video/render?${new URLSearchParams({ renderId: d.renderId, bucketName: d.bucketName })}`)
  }
  throw new Error("The render is taking longer than three minutes.")
}

export type VideoBlockProps = {
  templateId: string
  props: unknown
  /** The version this block revises, as the model wrote it. */
  parent?: string
  title?: string
  /** The block's key (lib/studio.ts blockKey); without one it is drawn but not saved. */
  saveKey?: string | null
  chatId?: string
}

export function VideoBlock({ templateId, props, parent, title, saveKey, chatId }: VideoBlockProps) {
  const { admin } = useShellPanel()
  const v = React.useMemo(() => validate(templateId, props), [templateId, props])
  const [saved, setSaved] = React.useState<Saved | null>(null)
  const [mp4, setMp4] = React.useState<Mp4>({ state: "idle" })
  const getMp4 = () => {
    setMp4({ state: "working" })
    renderMp4(templateId, props).then(
      (url) => {
        setMp4({ state: "ready", url })
        // Opened once it is ready; a browser that blocks a window opened this late still has the link on the button.
        const w = window.open(url, "_blank")
        if (w) w.opener = null
      },
      (e: Error) => setMp4({ state: "failed", error: e.message }),
    )
  }
  React.useEffect(() => {
    if (!saveKey || !v.ok) return
    let live = true
    void saveOnce(saveKey, { templateId, props, parent, title, chatId, source: "chat" }).then((s) => {
      if (live) setSaved(s)
    })
    return () => {
      live = false
    }
    // The key names the block; its props cannot change under the same key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveKey, v.ok])

  if (!v.ok)
    return (
      <div className="rounded-xl border border-pax2-red/40 bg-pax2-surface p-4">
        <p className="text-sm font-medium text-pax2-red">I couldn&apos;t draw this video.</p>
        <pre className="mt-2 overflow-x-auto font-mono text-xs whitespace-pre-wrap text-slate-700">{v.error}</pre>
      </div>
    )

  return (
    <div>
      <TemplatePlayer templateId={templateId} props={props} />
      {(saved || admin) && (
        <div className="mx-auto mt-2 flex max-w-[360px] items-center justify-between gap-2 data-[wide=true]:max-w-none" data-wide={v.spec.width >= v.spec.height}>
          {saved ? <span className="rounded-full bg-pax2-lavender px-2.5 py-0.5 text-xs font-semibold text-pax2-blue">v{saved.version}</span> : <span />}
          {admin && (
            <div className="flex items-center gap-2">
              {mp4.state === "ready" ? (
                <a href={mp4.url} target="_blank" rel="noopener noreferrer" className={whiteButton("md", "px-4 py-1.5")}>
                  <Download className="size-4" />
                  Open MP4
                </a>
              ) : (
                <button type="button" onClick={getMp4} disabled={mp4.state === "working"} title={mp4.state === "failed" ? mp4.error : undefined} className={whiteButton("md", "px-4 py-1.5")}>
                  {mp4.state === "working" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                  {mp4.state === "working" ? "Rendering" : mp4.state === "failed" ? "Try again" : "Get MP4"}
                </button>
              )}
              <button type="button" onClick={() => openStudio(saved?.id ?? templateId)} className={whiteButton("md", "px-4 py-1.5")}>
                <Clapperboard className="size-4" />
                Open in Studio
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
