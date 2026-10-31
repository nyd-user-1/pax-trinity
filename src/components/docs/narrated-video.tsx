"use client"

import * as React from "react"

import { NARRATORS } from "@/lib/docs/media"

/** A docs video and its narrator (Brendan, 2026-10-31): each voice is its own render, <name><suffix>.mp4; picking
 *  another swaps the file and carries on from the same moment, playing if it was. */
export function NarratedVideo({ src, alt }: { src: string; alt: string }) {
  const base = src.replace(/\.mp4$/i, "")
  const [voice, setVoice] = React.useState(NARRATORS[0]!.id)
  const video = React.useRef<HTMLVideoElement>(null)
  const resume = React.useRef<{ at: number; playing: boolean } | null>(null)
  const narrator = NARRATORS.find((n) => n.id === voice) ?? NARRATORS[0]!
  const pick = (id: string) => {
    const v = video.current
    if (v) resume.current = { at: v.currentTime, playing: !v.paused }
    setVoice(id)
  }
  return (
    <figure className="my-8">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-pax2-surface shadow-e2">
        {/* The captions are drawn into the video, and the narrator reads them. */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={video}
          key={narrator.id}
          src={`${base}${narrator.suffix}.mp4`}
          poster={`${base}.jpg`}
          controls
          playsInline
          preload={resume.current ? "auto" : "none"}
          onLoadedMetadata={(e) => {
            const r = resume.current
            if (!r) return
            resume.current = null
            e.currentTarget.currentTime = r.at
            if (r.playing) void e.currentTarget.play()
          }}
          className="block aspect-[16/10] w-full bg-slate-100"
        />
      </div>
      <figcaption className="mt-2.5 flex items-center justify-between gap-4 text-[13px] text-slate-500">
        <span>{alt}</span>
        {NARRATORS.length > 1 && (
          <label className="flex shrink-0 items-center gap-2">
            Narrator
            <select value={voice} onChange={(e) => pick(e.target.value)} className="rounded-md border border-slate-200 bg-pax2-surface px-2 py-1 text-[13px] text-slate-700 outline-none focus:border-pax2-light-blue">
              {NARRATORS.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </figcaption>
    </figure>
  )
}
