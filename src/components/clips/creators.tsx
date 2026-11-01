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
// A row picks its clip without playing it, with the grid's blue border on hover and on the row picked; its play
// icon, which grows on hover, plays it; ↑ ↓ step the rows, the grid following (clips-app.tsx) (Brendan, 2026-10-31).
export function Creators({ clips, activeId, onSelect, onPlay }: { clips: ClipRow[]; activeId: string | null; onSelect: (id: string) => void; onPlay: (id: string) => void }) {
  const list = React.useRef<HTMLDivElement>(null)
  // The row picked comes into view, and keeps the focus where the keys are stepping the list.
  React.useEffect(() => {
    if (!activeId) return
    const row = list.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(activeId)}"]`)
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    if (row && list.current?.contains(document.activeElement)) row.focus({ preventScroll: true })
  }, [activeId])
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
      <div ref={list} data-partner-list className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {clips.map((c) => {
          const on = activeId === c.id
          const fav = favs.has(c.id)
          const url = `/clips?c=${encodeURIComponent(c.id)}`
          return (
            <div key={c.id} className="group/item relative">
              <div
                role="button"
                tabIndex={0}
                data-row={c.id}
                aria-current={on || undefined}
                onClick={() => onSelect(c.id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(c.id))}
                className={cn(
                  "group flex w-full cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2 pr-12 text-left outline-none transition-[color,background-color,border-color]",
                  // A focused row must not wear the picked row's border (it read as a second, stuck selection,
                  // Brendan 2026-11-01): the keys' focus gets a soft half-tone border of its own.
                  on ? "border-pax2-light-blue bg-accent text-pax2-blue" : "border-transparent text-slate-500 hover:border-pax2-light-blue hover:text-pax2-blue focus-visible:border-pax2-light-blue/40",
                )}
              >
                <button
                  type="button"
                  aria-label={`Play ${c.title}`}
                  onClick={(e) => (e.stopPropagation(), onPlay(c.id))}
                  className="group/play relative -m-1 flex size-8 shrink-0 items-center justify-center rounded-full outline-none transition-transform duration-200 ease-out hover:scale-125 focus-visible:ring-2 focus-visible:ring-pax2-light-blue"
                >
                  <span aria-hidden className="absolute inset-0 rounded-full bg-pax2-lavender opacity-0 transition-opacity group-hover/play:animate-pulse group-hover/play:opacity-100" />
                  <PlayIcon className={cn("relative size-[18px] transition-colors", on ? "fill-pax2-lavender text-pax2-blue" : "group-hover/play:fill-pax2-blue group-hover/play:text-pax2-blue")} strokeWidth={on ? 2.25 : 1.75} />
                </button>
                <span className="flex min-w-0 flex-col">
                  <span className={cn("truncate text-sm font-semibold", !on && "text-foreground group-hover:text-pax2-blue")}>{c.title}</span>
                  <span className="truncate text-xs text-muted-foreground">{c.sub}</span>
                </span>
              </div>
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
