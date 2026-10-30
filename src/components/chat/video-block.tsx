"use client"

import * as React from "react"
import { Clapperboard } from "lucide-react"

import { useShellPanel } from "@/components/shell"
import { TemplatePlayer } from "@/components/video/TemplatePlayer"
import { whiteButton } from "@/components/white-button"
import { openStudio, VERSIONS_CHANGED } from "@/lib/studio"
import { validate } from "@/video/specs"

// A ```pax-video block in a finished reply (chat.tsx): the template drawn live, saved once as the reader's
// next version of it (/api/video/versions), its number as a badge, and for admins Open in Studio, which
// opens the right panel's Studio on that version. Props that fail the template's schema show the schema's
// error where the video would be. A block is saved under its chat, message and place in the message, so
// drawing it again (a re-render, a reload of the saved chat) finds the version already made.

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
        // A new version: an open Studio reloads onto it.
        if (r.status === 201) window.dispatchEvent(new CustomEvent(VERSIONS_CHANGED, { detail: { id: v.id } }))
        return { id: v.id, version: v.version }
      })
      .catch(() => null)
    saves.set(key, p)
  }
  return p
}

export type VideoBlockProps = {
  templateId: string
  props: unknown
  /** The version this block revises, as the model wrote it. */
  parent?: string
  title?: string
  /** Where the block stands (chat, message, place); without one it is drawn but not saved. */
  saveKey?: string | null
  chatId?: string
}

export function VideoBlock({ templateId, props, parent, title, saveKey, chatId }: VideoBlockProps) {
  const { admin } = useShellPanel()
  const v = React.useMemo(() => validate(templateId, props), [templateId, props])
  const [saved, setSaved] = React.useState<Saved | null>(null)
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
      <div className="rounded-xl border border-pax2-red/40 bg-white p-4">
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
            <button type="button" onClick={() => openStudio(saved?.id ?? templateId)} className={whiteButton("md", "px-4 py-1.5")}>
              <Clapperboard className="size-4" />
              Open in Studio
            </button>
          )}
        </div>
      )}
    </div>
  )
}
