"use client"

import { BarChart3, CheckSquare, ClipboardList, FlaskConical, Landmark, TrendingUp, Users, Vote } from "lucide-react"

import { AccountFooter } from "@/components/admin/account-footer"
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@govblock/ui/components/ny4/sidebar"

import { shortSource, type SourceGroup } from "./audience-data"

// The audience rail, the inbox's rail with sources where the folders sit:
// each source a row with its count where the inbox shows unread.

const ICONS: Record<string, typeof Users> = {
  ACS: Users,
  ANES: ClipboardList,
  CES: ClipboardList,
  CPS: Vote,
  CVAP: Users,
  ELECTION_RESULT: CheckSquare,
  GSS: ClipboardList,
  LIFT_ARCHIVE: TrendingUp,
  MA_ENROLLMENT: Landmark,
  PAX_TEST: FlaskConical,
  POLL: BarChart3,
}

export function AudienceRail({ groups, source, onSource }: { groups: SourceGroup[]; source: string | null; onSource: (s: string) => void }) {
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
                const Icon = ICONS[g.source] ?? ClipboardList
                return (
                  <SidebarMenuItem key={g.source}>
                    <SidebarMenuButton onClick={() => onSource(g.source)} isActive={source === g.source} title={g.label}>
                      <Icon />
                      <span>{shortSource(g.source)}</span>
                      <span className="ml-auto text-xs tabular-nums">{g.rows.toLocaleString("en-US")}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <AccountFooter go={() => {}} />
    </>
  )
}
