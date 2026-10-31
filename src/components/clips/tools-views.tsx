"use client"

import * as React from "react"
import { FileText } from "lucide-react"

import type { Nav } from "@/components/connect-view"
import { useClipsPanel } from "@/lib/clips-panel"

import { PUBLISHED, type Clip } from "./catalog"
import { isTested, testsOf } from "./clip-test"
import { ClipReport, EditThread } from "./comments"

// Tools' Edits and Reports (Brendan, 2026-10-31): the Edit Panel and the Report Panel that sat right of the
// clips on /clips, moved into the shell's right panel. Both read the clip /clips is playing
// (lib/clips-panel.ts); off /clips there is none, and Reports still lists every tested clip.

const NO_LIKES = new Set<string>()
const noop = () => {}

export function ClipEdits() {
  const p = useClipsPanel()
  return <EditThread clip={p?.clip ?? null} comments={p?.comments ?? []} signedIn={!!p?.signedIn} onPost={p?.onPost ?? noop} onLikeComment={p?.onLikeComment ?? noop} likedComments={p?.likedComments ?? NO_LIKES} focusKey={p?.focusKey} className="min-h-0 flex-1" />
}

/** The clips with a published randomized test, latest wave first, as Lift Analysis lists its deliverables. */
const TESTED: { clip: Clip; sub: string }[] = PUBLISHED.filter((c) => isTested(c.id))
  .map((clip) => {
    const t = testsOf(clip.id)[0]
    return { clip, sub: `Wave ${t.rs.wave}`, wave: t.rs.wave }
  })
  .sort((a, b) => b.wave - a.wave)

// The Blocks shelf's plain tiles, as Lift Analysis has them.
const MIN_TILE = 120
const GAP = 10

/** Reports: every tested clip as a tile; a tile, or the clip playing on /clips, opens its readout here, the
 *  header's Back returning to the tiles. On /clips the readout follows the clip as it changes. */
export function ClipReports({ onNav }: { onNav: (nav: Nav) => void }) {
  const p = useClipsPanel()
  const playing = p?.clip ?? null
  const [picked, setPicked] = React.useState<string | null>(playing?.id ?? null)
  React.useEffect(() => {
    if (playing && picked) setPicked(playing.id)
    // Only the clip changing moves the readout; going back to the tiles stays there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing?.id])
  const clip = picked ? (playing?.id === picked ? playing : (PUBLISHED.find((c) => c.id === picked) ?? null)) : null

  React.useEffect(() => {
    onNav(clip ? { title: clip.title, back: () => setPicked(null) } : null)
  }, [clip, onNav])
  React.useEffect(() => () => onNav(null), [onNav])

  const box = React.useRef<HTMLDivElement>(null)
  const [size, setSize] = React.useState({ w: 372, h: 600 })
  React.useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [clip])

  if (clip)
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ClipReport clip={clip} />
      </div>
    )

  const cols = Math.min(6, Math.max(3, Math.floor((size.w + GAP) / (MIN_TILE + GAP))))
  const tileSide = (size.w - GAP * (cols - 1)) / cols
  const rows = Math.max(Math.ceil(TESTED.length / cols), Math.ceil((size.h + GAP) / (tileSide + GAP)))
  const open = (id: string) => {
    setPicked(id)
    p?.onOpen(id)
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-1">
      <div ref={box} className="h-full">
        <div className="grid content-start" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: GAP }}>
          {TESTED.map(({ clip: c, sub }) => (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => open(c.id)}
              onKeyDown={(e) => e.key === "Enter" && open(c.id)}
              aria-label={`Open the report on ${c.title}`}
              className="group relative flex aspect-square cursor-pointer flex-col justify-between overflow-hidden rounded-xl border border-slate-200 bg-pax2-surface p-2.5 shadow-e1 transition-[box-shadow,border-color] hover:border-pax2-blue hover:shadow-e2"
            >
              <FileText className="size-4 text-pax2-blue" />
              <span className="min-w-0">
                <span className="line-clamp-3 text-[12px] font-semibold leading-snug text-slate-900">{c.title}</span>
                <span className="mt-0.5 block truncate text-[10px] text-slate-500">{sub}</span>
              </span>
            </div>
          ))}
          {Array.from({ length: Math.max(0, rows * cols - TESTED.length) }, (_, i) => (
            <div key={i} aria-hidden className="aspect-square rounded-xl border border-dashed border-slate-300" />
          ))}
        </div>
      </div>
    </div>
  )
}
