"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader } from "@govblock/ui/components/ny4/sidebar"

// The bank's rail: a title, groups of rows, each row a topic or a folder with
// its count at the right — the open one on the white ground with the left bar.

export function BankRail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <SidebarHeader className="flex-row items-center gap-2.5 p-4">
        <p className="text-xl font-semibold">{title}</p>
      </SidebarHeader>
      <SidebarContent>{children}</SidebarContent>
    </>
  )
}

export function RailGroup({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <SidebarGroup>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <nav className="flex flex-col gap-0.5 px-1">{children}</nav>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

export function RailRow({
  on,
  onClick,
  icon: Icon,
  label,
  count,
  dim,
}: {
  on: boolean
  onClick: () => void
  /** A folder's icon; a topic row goes without. */
  icon?: LucideIcon
  label: string
  count?: number | null
  /** The quiet row, the untagged remainder's dress. */
  dim?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={on ? "true" : undefined}
      className={cn(
        "group relative flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm outline-none transition-[color,background-color,box-shadow]",
        on ? "bg-white font-semibold text-pax2-blue shadow-e1" : "text-slate-500 hover:bg-white/70 hover:text-pax2-blue hover:shadow-e1"
      )}
    >
      {on && <span aria-hidden className="absolute top-1/2 left-0 h-4 w-[3px] -translate-y-1/2 rounded-full bg-pax2-light-blue" />}
      {Icon && (
        <Icon
          className={cn("icon-pop size-[18px] shrink-0 transition-colors", on ? "fill-pax2-lavender text-pax2-blue" : "group-hover:fill-pax2-lavender group-hover:text-pax2-blue")}
          strokeWidth={on ? 2.25 : 1.75}
        />
      )}
      <span className={cn("min-w-0 flex-1 truncate", dim && !on && "text-slate-400")}>{label}</span>
      {count != null && <span className="shrink-0 text-xs text-slate-400 tabular-nums">{count.toLocaleString("en-US")}</span>}
    </button>
  )
}
