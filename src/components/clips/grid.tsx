"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { LockIcon, PlayIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@govblock/ui/components/nova/avatar"
import { cn } from "@govblock/ui/lib/utils"
import { Skeleton } from "@/ui/components/nova/skeleton"


import { isTested, RctBadge } from "./clip-test"
import { fmtCount, type Clip } from "./store"

const CompositionThumb = dynamic(() => import("./composition-player").then((m) => m.CompositionThumb), { ssr: false })

// Instagram's grid: the poster fills the tile, the author's avatar and handle
// sit top left, the play count and the caption sit at the foot, with the
// hairline gaps Instagram uses.

/** `activeId`: the clip the page has picked (the header's chevrons step it), which wears the 1px blue border hover gives any tile.
 *  A click on a tile picks it (`onSelect`); only its play button plays it (`onOpen`) (Brendan, 2026-10-31). */
export function Grid({ clips, onOpen, onSelect, activeId, className }: { clips: Clip[]; onOpen: (clip: Clip) => void; onSelect?: (clip: Clip) => void; activeId?: string | null; className?: string }) {
  return (
    // As many columns as fit at 240px or more (Brendan, 2026-10-31): three in the page's usual width, two and
    // then one as the column narrows, more when it is wide.
    <div className={cn("grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-0.5", className)}>
      {clips.map((clip) => (
        <div
          key={clip.id}
          role="button"
          tabIndex={0}
          data-tile={clip.id}
          aria-current={clip.id === activeId || undefined}
          onClick={() => (onSelect ?? onOpen)(clip)}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), (onSelect ?? onOpen)(clip))}
          className="group @container/tile relative aspect-[9/16] cursor-pointer overflow-hidden bg-black text-left text-white outline-none"
          aria-label={clip.title}
        >
          {clip.composition ? (
            <div className="size-full transition-transform duration-300 group-hover:scale-[1.03]">
              <CompositionThumb composition={clip.composition} />
            </div>
          ) : clip.poster ? (
            <img src={clip.poster} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          ) : (
            <TileVideo clip={clip} />
          )}
          <div className="absolute inset-x-0 top-0 flex items-center gap-1.5 bg-gradient-to-b from-black/60 to-transparent p-2 pb-6">
            <Avatar className="size-6 ring-1 ring-white/40 max-sm:size-5">
              <AvatarImage src={clip.author.image ?? undefined} alt="" className="object-cover" />
              <AvatarFallback className="bg-white/20 text-[10px] text-white">{clip.author.name.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <span className="truncate text-xs font-semibold max-sm:text-[11px]">{clip.messenger ?? clip.author.name}</span>
            {isTested(clip.id) && <RctBadge collapse className="ml-auto" />}
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2 pt-8">
            {!clip.mine && (
              <p className="flex items-center gap-1 text-sm font-medium max-sm:text-xs">
                <PlayIcon className="size-3.5 fill-current" /> {fmtCount(clip.views)}
              </p>
            )}
            <p className="line-clamp-2 text-xs leading-tight max-sm:text-[11px]">
              <span className="font-semibold">{clip.title}</span> {clip.caption}
            </p>
          </div>
          {/* The play button, about 10% larger (62px, was 56): it shows on hover and on the picked tile, and it alone
              opens the clip in the single view, playing; the rest of the tile picks it. */}
          <span className={cn("pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100", clip.id === activeId ? "opacity-100" : "opacity-0")}>
            <button
              type="button"
              aria-label={`Play ${clip.title}`}
              onClick={(e) => (e.stopPropagation(), onOpen(clip))}
              className="pointer-events-auto flex size-[62px] items-center justify-center rounded-full bg-black/35 transition-[transform,box-shadow] duration-200 ease-out outline-none hover:-translate-y-1 hover:shadow-lg hover:shadow-black/40 focus-visible:ring-2 focus-visible:ring-white"
            >
              <PlayIcon className="size-[31px] translate-x-0.5 fill-white text-white" />
            </button>
          </span>
          {clip.visibility === "private" && (
            <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-black/50" title="Private">
              <LockIcon className="size-3" />
            </span>
          )}
          {/* The 1px blue border (Brendan, 2026-10-31): on hover, and on the clip picked. Drawn over the video. */}
          <span aria-hidden className={cn("pointer-events-none absolute inset-0 z-10 border transition-colors", clip.id === activeId ? "border-pax2-light-blue" : "border-transparent group-hover:border-pax2-light-blue")} />
        </div>
      ))}
    </div>
  )
}

/** A tile's video mounts only as the tile nears the screen (2026-10-29): the grid
 *  mounting all 209 players at once pulled the head of every video to paint its
 *  still, and the page took 8-11 s to settle even with everything cached. */
function TileVideo({ clip }: { clip: Clip }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [near, setNear] = React.useState(false)
  React.useEffect(() => {
    const el = ref.current
    if (!el || near) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setNear(true)
          io.disconnect()
        }
      },
      { rootMargin: "400px 0px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [near])
  // The tile holds a skeleton until its still paints.
  const [ready, setReady] = React.useState(false)
  return (
    <div ref={ref} className="relative size-full">
      {!ready && <Skeleton className="absolute inset-0 rounded-none" />}
      {near && (
        // A recording has no cues to seek by, so it loads whole rather than sitting black on metadata alone.
        <video
          src={clip.mine ? clip.src : `${clip.src}#t=0.1`}
          preload={clip.mine ? "auto" : "metadata"}
          muted
          playsInline
          ref={(v) => {
            if (v && v.readyState >= 2) setReady(true)
          }}
          onLoadedData={() => setReady(true)}
          onSeeked={() => setReady(true)}
          className={cn("size-full object-cover transition-[opacity,transform] duration-300 group-hover:scale-[1.03]", ready ? "opacity-100" : "opacity-0")}
        />
      )}
    </div>
  )
}
