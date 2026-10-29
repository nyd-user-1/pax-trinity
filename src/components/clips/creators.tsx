"use client"

import * as React from "react"
import { EllipsisVertical, ExternalLink, Link2, PlayIcon, Star } from "lucide-react"

import { KebabMenu, MenuFoot, MenuHeader, MenuRow, MenuSeparator } from "@/components/kebab-menu"
import { AccountMenu } from "@/components/shell"
import { cn } from "@govblock/ui/lib/utils"

export type ClipRow = { id: string; title: string; sub: string; partner: string }

// The Partners panel's body: one row per video in the sidebar items' dress —
// row kebab included — with the shell's account chip as the foot
// (Brendan, 2026-10-25). The header lives on the PanelBlock.
export function Creators({ clips, activeId, onOpenClip }: { clips: ClipRow[]; activeId: string | null; onOpenClip: (id: string) => void }) {
  const [favs, setFavs] = React.useState<Set<string>>(new Set())
  const toggleFav = (id: string) =>
    setFavs((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {clips.map((c) => {
          const on = activeId === c.id
          const fav = favs.has(c.id)
          const url = `/clips?c=${encodeURIComponent(c.id)}`
          return (
            <div key={c.id} className="group/item relative">
              <button
                type="button"
                onClick={() => onOpenClip(c.id)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl px-3 py-2 pr-12 text-left transition-[color,background-color,box-shadow]",
                  on ? "bg-accent text-pax2-blue" : "text-slate-500 hover:bg-accent/70 hover:text-pax2-blue",
                )}
              >
                <PlayIcon className={cn("size-[18px] shrink-0 transition-colors", on ? "fill-pax2-lavender text-pax2-blue" : "group-hover:fill-pax2-lavender group-hover:text-pax2-blue")} strokeWidth={on ? 2.25 : 1.75} />
                <span className="flex min-w-0 flex-col">
                  <span className={cn("truncate text-sm font-semibold", !on && "text-foreground group-hover:text-pax2-blue")}>{c.title}</span>
                  <span className="truncate text-xs text-muted-foreground">{c.sub}</span>
                </span>
              </button>
              <span className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center">
                {fav && <Star aria-label="Favorite" className="size-3 fill-amber-400 text-amber-400" />}
                <KebabMenu
                  label={`${c.title} options`}
                  align="left"
                  width="w-56"
                  trigger={<EllipsisVertical className="size-4" />}
                  triggerClassName="flex size-7 items-center justify-center rounded-lg text-slate-400 opacity-0 transition-opacity hover:bg-accent hover:text-pax2-blue focus-visible:opacity-100 group-hover/item:opacity-100 aria-expanded:opacity-100"
                >
                  <MenuHeader text={url} copy={url} />
                  <MenuSeparator />
                  <MenuRow icon={<Star className={fav ? "fill-amber-400 text-amber-400" : undefined} />} label={fav ? "Unfavorite" : "Favorite"} onClick={() => toggleFav(c.id)} />
                  <MenuRow icon={<ExternalLink />} label="Open in new tab" onClick={() => window.open(url, "_blank", "noopener")} />
                  <MenuRow icon={<Link2 />} label="Copy link" onClick={() => navigator.clipboard.writeText(`${window.location.origin}${url}`)} />
                  <MenuSeparator />
                  <MenuFoot title={c.title} sub={c.partner} />
                </KebabMenu>
              </span>
            </div>
          )
        })}
      </div>
      <div className="border-t border-slate-200/70 px-3 py-2">
        <AccountMenu />
      </div>
    </div>
  )
}
