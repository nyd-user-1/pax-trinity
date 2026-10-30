"use client"

import * as React from "react"
import { Player } from "@remotion/player"

import { cn } from "@/lib/utils"
import { getTemplate, validate } from "@/video/registry"

// A template, filled and played in the page: the props pass the template's
// schema first (src/video/registry.ts validate), then Remotion's Player draws
// them live in the browser, so nothing is rendered to a file. Controls on,
// autoplay and loop off. It waits on its last frame, the finished picture, and
// play starts it from the top. A wide (16:9) template takes the column's width;
// a vertical (9:16) one stands centered at phone width.

export function TemplatePlayer({ templateId, props, className }: { templateId: string; props: unknown; className?: string }) {
  const v = React.useMemo(() => validate(templateId, props), [templateId, props])

  if (!v.ok)
    return process.env.NODE_ENV === "development" ? (
      <div className={cn("rounded-xl border border-pax2-red/40 bg-white p-4", className)}>
        <p className="text-sm font-medium text-pax2-red">These props do not fit {templateId}</p>
        <pre className="mt-2 overflow-x-auto font-mono text-xs whitespace-pre-wrap text-slate-700">{v.error}</pre>
      </div>
    ) : (
      <div className={cn("rounded-xl border bg-white px-4 py-3 text-sm text-muted-foreground", className)}>This video could not be drawn.</div>
    )

  const t = getTemplate(v.spec.id)
  if (!t) return <div className={cn("rounded-xl border bg-white px-4 py-3 text-sm text-muted-foreground", className)}>This video could not be drawn.</div>
  const vertical = t.height > t.width
  return (
    <div className={cn("w-full", vertical && "mx-auto max-w-[360px]", className)}>
      <Player
        component={t.component}
        inputProps={v.props as Record<string, unknown>}
        durationInFrames={v.durationInFrames}
        fps={t.fps}
        compositionWidth={t.width}
        compositionHeight={t.height}
        controls
        autoPlay={false}
        loop={false}
        initialFrame={v.durationInFrames - 1}
        className="overflow-hidden rounded-xl shadow-e1 ring-1 ring-slate-200"
        style={{ width: "100%", aspectRatio: `${t.width} / ${t.height}` }}
      />
    </div>
  )
}
