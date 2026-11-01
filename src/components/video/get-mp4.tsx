"use client"

import * as React from "react"
import { Download, Loader2 } from "lucide-react"

import { whiteButton } from "@/components/white-button"

// Get MP4: a template and its props rendered to a file on the server (/api/video/render, Remotion Lambda;
// admins only, as the route is) and opened. Chat's video card and the template chooser over a recorded take
// (components/clips/template-chooser.tsx) both carry it.

type Mp4 = { state: "idle" } | { state: "working" } | { state: "ready"; url: string } | { state: "failed"; error: string }

/** The props rendered to an MP4 on the server: its address on the clips CDN. A render that outlasts the request
 *  answers 202 with its id, polled here until done; local development without Lambda answers the file itself. */
export async function renderMp4(templateId: string, props: unknown): Promise<string> {
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

/** The button: Get MP4, Rendering while it renders, then Open MP4 (a link, for a browser that blocks a window
 *  opened that long after the click), or Try again with the reason on hover. */
export function GetMp4({ templateId, props }: { templateId: string; props: unknown }) {
  const [mp4, setMp4] = React.useState<Mp4>({ state: "idle" })
  const get = () => {
    setMp4({ state: "working" })
    renderMp4(templateId, props).then(
      (url) => {
        setMp4({ state: "ready", url })
        const w = window.open(url, "_blank")
        if (w) w.opener = null
      },
      (e: Error) => setMp4({ state: "failed", error: e.message }),
    )
  }
  if (mp4.state === "ready")
    return (
      <a href={mp4.url} target="_blank" rel="noopener noreferrer" className={whiteButton("md", "px-4 py-1.5")}>
        <Download className="size-4" />
        Open MP4
      </a>
    )
  return (
    <button type="button" onClick={get} disabled={mp4.state === "working"} title={mp4.state === "failed" ? mp4.error : undefined} className={whiteButton("md", "px-4 py-1.5")}>
      {mp4.state === "working" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      {mp4.state === "working" ? "Rendering" : mp4.state === "failed" ? "Try again" : "Get MP4"}
    </button>
  )
}
