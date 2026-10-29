"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { LockIcon, PlayIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@govblock/ui/components/nova/avatar"
import { cn } from "@govblock/ui/lib/utils"


import { fmtCount, type Clip } from "./store"

const CompositionThumb = dynamic(() => import("./composition-player").then((m) => m.CompositionThumb), { ssr: false })

// Instagram's grid: the poster fills the tile, the author's avatar and handle
// sit top left, the play count and the caption sit at the foot. Three across
// on a phone, four on a desktop, with the hairline gaps Instagram uses.

export function Grid({ clips, onOpen, className }: { clips: Clip[]; onOpen: (clip: Clip) => void; className?: string }) {
  return (
    <div className={cn("grid grid-cols-3 gap-0.5", className)}>
      {clips.map((clip) => (
        <button key={clip.id} type="button" onClick={() => onOpen(clip)} className="group relative aspect-[9/16] overflow-hidden bg-black text-left text-white" aria-label={clip.title}>
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
          {/* The play button shows on hover; the tile opens the clip in the single view, playing. */}
          <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <span className="flex size-14 items-center justify-center rounded-full bg-black/35">
              <PlayIcon className="size-7 translate-x-0.5 fill-white text-white" />
            </span>
          </span>
          {clip.visibility === "private" && (
            <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-black/50" title="Private">
              <LockIcon className="size-3" />
            </span>
          )}
        </button>
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
  return (
    <div ref={ref} className="size-full">
      {near && (
        // A recording has no cues to seek by, so it loads whole rather than sitting black on metadata alone.
        <video src={clip.mine ? clip.src : `${clip.src}#t=0.1`} preload={clip.mine ? "auto" : "metadata"} muted playsInline className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
      )}
    </div>
  )
}
