"use client"

import { Folder } from "lucide-react"

import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@govblock/ui/components/ny4/sidebar"

import { SEGMENT_SEED, shortSource, type SourceGroup } from "./audience-data"

// The audience rail, the inbox's rail with sources where the folders sit —
// and wearing the folder's icon, because a source is a folder of data, not a
// different kind of thing (Brendan, 2026-10-26: "aren't they all just data
// sets?"). The count is the folder's contents: its segments, the rows of the
// list it opens — seeded from the export, corrected live once a source reads.

export function AudienceRail({ groups, source, onSource, segments }: { groups: SourceGroup[]; source: string | null; onSource: (s: string) => void; segments?: Record<string, number> }) {
  return (
    <>
      <SidebarHeader className="flex-row items-center gap-2.5 p-4">
        <p className="text-xl font-semibold">Audience</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Sources</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {groups.map((g) => {
                const count = segments?.[g.source] ?? SEGMENT_SEED[g.source]
                return (
                  <SidebarMenuItem key={g.source}>
                    <SidebarMenuButton onClick={() => onSource(g.source)} isActive={source === g.source} title={g.label}>
                      <Folder />
                      <span>{shortSource(g.source)}</span>
                      {count != null && <span className="ml-auto text-xs tabular-nums">{count.toLocaleString("en-US")}</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </>
  )
}
