"use client"

import { Folder } from "lucide-react"

import { cn } from "@/lib/utils"
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader } from "@govblock/ui/components/ny4/sidebar"

import { SEGMENT_SEED, shortSource, type SourceGroup } from "../audience/audience-data"

// The rail is folders alone (Brendan, 2026-10-26: "get rid of every drop
// down and just put all the questions in the middle panel"): one row per
// source in the sidebar items' dress, its segment count where a folder
// shows its contents, the active folder on the white ground with the left
// bar. Every question of the open folder is the middle panel's list.

export function SourceRail({
  groups,
  source,
  segments,
  onSource,
}: {
  groups: SourceGroup[]
  source: string | null
  /** Live per-source segment counts; the seed covers a source not yet read. */
  segments?: Record<string, number>
  onSource: (s: string) => void
}) {
  return (
    <>
      <SidebarHeader className="flex-row items-center gap-2.5 p-4">
        <p className="text-xl font-semibold">Constructs</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Folders</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav className="flex flex-col gap-0.5 px-1">
              {groups.map((g) => {
                const on = source === g.source
                const count = segments?.[g.source] ?? SEGMENT_SEED[g.source]
                return (
                  <button
                    key={g.source}
                    type="button"
                    onClick={() => onSource(g.source)}
                    aria-current={on ? "true" : undefined}
                    className={cn(
                      "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm outline-none transition-[color,background-color,box-shadow]",
                      on ? "bg-white font-semibold text-pax2-blue shadow-e1" : "text-slate-500 hover:bg-white/70 hover:text-pax2-blue hover:shadow-e1"
                    )}
                  >
                    {on && <span aria-hidden className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-pax2-light-blue" />}
                    <Folder
                      className={cn("icon-pop size-[18px] shrink-0 transition-colors", on ? "fill-pax2-lavender text-pax2-blue" : "group-hover:fill-pax2-lavender group-hover:text-pax2-blue")}
                      strokeWidth={on ? 2.25 : 1.75}
                    />
                    <span className="min-w-0 flex-1 truncate">{shortSource(g.source)}</span>
                    {count != null && <span className="shrink-0 text-xs text-slate-400 tabular-nums">{count.toLocaleString("en-US")}</span>}
                  </button>
                )
              })}
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </>
  )
}
