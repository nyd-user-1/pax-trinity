"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronDown, EllipsisVerticalIcon, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader } from "@govblock/ui/components/ny4/sidebar"

// The bank's rail, in the shell menu's dress: a header (a title, or the
// surface's own — /audience's search), groups of rows, each row a topic or a
// folder with its count at the right — the open one on the white ground with
// the left bar. A row with a menu swaps its count for a kebab on hover, the
// card list's swap; a group can fold shut under its label.

export function BankRail({ title, header, children }: { title?: string; header?: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      {header ? (
        <SidebarHeader className="p-3">{header}</SidebarHeader>
      ) : (
        title && (
          <SidebarHeader className="flex-row items-center gap-2.5 p-4">
            <p className="text-xl font-semibold">{title}</p>
          </SidebarHeader>
        )
      )}
      <SidebarContent>{children}</SidebarContent>
    </>
  )
}

export function RailGroup({ label, collapsible = false, defaultOpen = true, children }: { label?: string; collapsible?: boolean; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(defaultOpen)
  const shown = !collapsible || open
  return (
    <SidebarGroup>
      {label &&
        (collapsible ? (
          <SidebarGroupLabel asChild>
            <button type="button" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="w-full justify-between text-left hover:text-sidebar-foreground">
              {label}
              <ChevronDown className={cn("transition-transform", !open && "-rotate-90")} />
            </button>
          </SidebarGroupLabel>
        ) : (
          <SidebarGroupLabel>{label}</SidebarGroupLabel>
        ))}
      {shown && (
        <SidebarGroupContent>
          <nav className="flex flex-col gap-0.5 px-1">{children}</nav>
        </SidebarGroupContent>
      )}
    </SidebarGroup>
  )
}

export function RailRow({
  on = false,
  onClick,
  href,
  icon: Icon,
  label,
  count,
  dim,
  menu,
}: {
  on?: boolean
  onClick?: () => void
  /** A row that leaves for another surface: a link, never on. */
  href?: string
  icon?: LucideIcon
  label: string
  count?: number | null
  /** The quiet row, the untagged remainder's dress. */
  dim?: boolean
  /** The row kebab's items; present, the count gives way to the kebab on hover. */
  menu?: React.ReactNode
}) {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const dress = cn(
    "group relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm outline-none transition-[color,background-color,box-shadow]",
    on ? "bg-pax2-lift font-semibold text-pax2-blue shadow-e1" : "text-slate-500 hover:bg-pax2-lift/70 hover:text-pax2-blue hover:shadow-e1"
  )
  const inner = (
    <>
      {on && <span aria-hidden className="absolute top-1/2 left-0 h-4 w-[3px] -translate-y-1/2 rounded-full bg-pax2-light-blue" />}
      {Icon && (
        <Icon
          className={cn("icon-pop size-4 shrink-0 transition-colors", on ? "fill-pax2-lavender text-pax2-blue" : "group-hover:fill-pax2-lavender group-hover:text-pax2-blue")}
          strokeWidth={on ? 2.25 : 1.75}
        />
      )}
      <span className={cn("min-w-0 flex-1 truncate", dim && !on && "text-slate-400")}>{label}</span>
      {count != null && (
        <span className={cn("shrink-0 text-xs text-slate-400 tabular-nums", menu && "group-hover/rail:invisible group-has-focus-visible/rail:invisible", menu && menuOpen && "invisible")}>
          {count.toLocaleString("en-US")}
        </span>
      )}
    </>
  )
  const row = href ? (
    <Link href={href} className={dress}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} aria-current={on ? "true" : undefined} className={dress}>
      {inner}
    </button>
  )
  if (!menu) return row
  // The kebab stands beside the row, not inside it: a button may not hold a button.
  return (
    <div className="group/rail relative">
      {row}
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`${label} options`}
            onClick={(event) => event.stopPropagation()}
            className={cn("absolute top-1/2 right-1.5 size-7 -translate-y-1/2 opacity-0 group-hover/rail:opacity-100 focus-visible:opacity-100", menuOpen && "opacity-100")}
          >
            <EllipsisVerticalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        {/* The menu portals out; its clicks stop here. */}
        <DropdownMenuContent align="start" className="w-max min-w-44" onClick={(event) => event.stopPropagation()}>
          {menu}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
