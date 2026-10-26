"use client"

import * as React from "react"
import { BarChart3, Banknote, Cake, ChevronDown, ChevronUp, Church, ClipboardList, Compass, EllipsisVertical, Flag, Folder, GraduationCap, HeartHandshake, Landmark, Scale, ShieldCheck, Thermometer, TrendingUp, UserCheck, UserRound, Users, Vote, Zap } from "lucide-react"

import { cn } from "@/lib/utils"
import { KebabMenu, MenuFoot, MenuHeader, MenuRow, MenuSeparator } from "@/components/kebab-menu"
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader } from "@govblock/ui/components/ny4/sidebar"

import { shortSegment, shortSource, type SourceGroup } from "../audience/audience-data"

// The rail on the shell sidebar's group pattern (components/shell.tsx,
// NAV_TREE): a source is a group row — icon, name, chevron — and its
// segments fold open under it on the comment thread's tree lines, each in
// the sidebar items' dress with its own small icon and Code/hq's row kebab
// on hover. The white ground and left bar belong to the active segment, not
// the group; shut, a group holding the page in view says so in bold blue.

/** A segment's small icon, by what its id and label say it measures. */
function iconFor(id: string, label: string) {
  const s = `${id} ${label}`.toLowerCase()
  if (/age/.test(s)) return Cake
  if (/citizen/.test(s)) return Flag
  if (/educ/.test(s)) return GraduationCap
  if (/income|enroll/.test(s) && /diff|reduce/.test(s) === false) return Banknote
  if (/race|eth/.test(s)) return Users
  if (/sex/.test(s)) return UserRound
  if (/party|congress|executive|government/.test(s)) return Landmark
  if (/ideolog/.test(s)) return Compass
  if (/vote|turnout|registration|primar|election/.test(s)) return Vote
  if (/trust|confidence/.test(s)) return ShieldCheck
  if (/thermometer/.test(s)) return Thermometer
  if (/pride|national/.test(s)) return Flag
  if (/relig|church/.test(s)) return Church
  if (/candidate/.test(s)) return UserCheck
  if (/efficacy/.test(s)) return Zap
  if (/egalitarian|differences/.test(s)) return Scale
  if (/fair|helpful|ahead/.test(s)) return HeartHandshake
  if (/lift/.test(s)) return TrendingUp
  if (/favorab|support/.test(s)) return BarChart3
  return ClipboardList
}

export function SourceRail({
  groups,
  source,
  branchOpen,
  segmentIds,
  railSeg,
  label,
  loading,
  onSource,
  onSegment,
}: {
  groups: SourceGroup[]
  source: string | null
  branchOpen: boolean
  /** The open source's segments, once its files have read. */
  segmentIds: string[]
  railSeg: string | null
  label: (id: string) => string
  loading: boolean
  onSource: (s: string) => void
  onSegment: (id: string) => void
}) {
  return (
    <>
      <SidebarHeader className="flex-row items-center gap-2.5 p-4">
        <p className="text-xl font-semibold">Audience</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Folders</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav className="flex flex-col gap-0.5 px-1">
              {groups.map((g) => {
                const open = source === g.source && branchOpen
                // Shut, the row still says the segment in view lives under it.
                const holds = !open && source === g.source && !!railSeg
                const Chevron = open ? ChevronUp : ChevronDown
                return (
                  <React.Fragment key={g.source}>
                    <button
                      type="button"
                      onClick={() => onSource(g.source)}
                      aria-expanded={open}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm outline-none transition-[color,background-color,box-shadow] hover:bg-white/70 hover:text-pax2-blue hover:shadow-e1 focus-visible:bg-white/70",
                        holds ? "font-semibold text-pax2-blue" : "text-slate-500"
                      )}
                    >
                      <Folder className={cn("icon-pop size-[18px] shrink-0 transition-colors", holds ? "fill-pax2-lavender text-pax2-blue" : "group-hover:fill-pax2-lavender group-hover:text-pax2-blue")} strokeWidth={holds ? 2.25 : 1.75} />
                      <span className="min-w-0 flex-1 truncate">{shortSource(g.source)}</span>
                      <Chevron className="size-4 shrink-0 text-slate-400 transition-colors group-hover:text-pax2-blue" />
                    </button>
                    {open && (
                      <div className="flex flex-col">
                        {loading && (
                          <div className="relative pl-8">
                            <span aria-hidden className="absolute left-[21px] top-0 h-4 w-5 rounded-bl-[10px] border-b-[1.5px] border-l-[1.5px] border-slate-300" />
                            <span className="flex items-center rounded-xl px-3 py-1.5 text-[13px] text-slate-400">Reading…</span>
                          </div>
                        )}
                        {!loading &&
                          segmentIds.map((id, k) => {
                            const on = railSeg === id
                            const name = shortSegment(id, label(id))
                            const Icon = iconFor(id, label(id))
                            return (
                              <div key={id} className="relative pl-8">
                                {k < segmentIds.length - 1 && <span aria-hidden className="absolute bottom-0 left-[21px] top-0 w-px bg-slate-300" />}
                                <span aria-hidden className="absolute left-[21px] top-0 h-4 w-5 rounded-bl-[10px] border-b-[1.5px] border-l-[1.5px] border-slate-300" />
                                <div className="group/item relative">
                                  <button
                                    type="button"
                                    onClick={() => onSegment(id)}
                                    aria-current={on ? "true" : undefined}
                                    className={cn(
                                      "group relative flex w-full items-center gap-3 rounded-xl px-3 py-1.5 pr-14 text-left text-[13px] outline-none transition-[color,background-color,box-shadow]",
                                      on ? "bg-white font-semibold text-pax2-blue shadow-e1" : "text-slate-500 hover:bg-white/70 hover:text-pax2-blue hover:shadow-e1"
                                    )}
                                  >
                                    {on && <span aria-hidden className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-pax2-light-blue" />}
                                    <Icon
                                      className={cn("icon-pop size-3.5 shrink-0 transition-colors", on ? "fill-pax2-lavender text-pax2-blue" : "group-hover:fill-pax2-lavender group-hover:text-pax2-blue")}
                                      strokeWidth={on ? 2.25 : 1.75}
                                    />
                                    <span className="min-w-0 flex-1 truncate">{name}</span>
                                  </button>
                                  <span className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center">
                                    <KebabMenu
                                      label={`${name} options`}
                                      align="left"
                                      width="w-56"
                                      trigger={<EllipsisVertical className="size-4" />}
                                      triggerClassName="flex size-7 items-center justify-center rounded-lg text-slate-400 opacity-0 transition-opacity hover:bg-white hover:text-pax2-blue focus-visible:opacity-100 group-hover/item:opacity-100 aria-expanded:bg-white aria-expanded:opacity-100"
                                    >
                                      <MenuHeader text={id} copy={id} />
                                      <MenuSeparator />
                                      <MenuRow icon={<BarChart3 />} label="Open the grid" onClick={() => onSegment(id)} />
                                      <MenuSeparator />
                                      <MenuFoot title={label(id)} sub={g.label} />
                                    </KebabMenu>
                                  </span>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    )}
                  </React.Fragment>
                )
              })}
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </>
  )
}
