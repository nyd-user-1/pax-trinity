"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpRight, ChevronDown, EllipsisVertical, Link2, PanelRight, Search, Star, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@govblock/ui/components/ny4/tooltip"
import { useShellPanel } from "@/components/shell"
import { KebabMenu, MenuFoot, MenuHeader, MenuRow, MenuSeparator } from "@/components/kebab-menu"
import { useNavFavorites } from "@/lib/nav-favorites"
import { SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader } from "@govblock/ui/components/ny4/sidebar"

// The bank's rail, in the shell menu's dress: a header (a title, or the
// surface's own — /audience's search), groups of rows, each row a topic or a
// folder with its count at the right — the open one on the white ground with
// the left bar. A row with an address swaps its count on hover for the
// sidebar's own: the Panel 2 arrow and the kebab with the sidebar's items
// (Brendan, 2026-10-31); a group can fold shut under its label, and a long one
// scrolls past its first rows.

/** `footer` stands at the rail's foot under its scrolling groups: the Inbox's mailbox chip (2026-11-02). */
export function BankRail({ title, header, footer, children }: { title?: string; header?: React.ReactNode; footer?: React.ReactNode; children: React.ReactNode }) {
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
      {footer && <SidebarFooter className="p-3">{footer}</SidebarFooter>}
    </>
  )
}

/** A rail's search in its header: the shell's ⌘K bar, exactly (shell.tsx's HeaderSearch), as America Thinks' and
 *  Lift's rails carry it; the keys are its dress. */
export function RailSearch({ query, onQuery, label }: { query: string; onQuery: (q: string) => void; label: string }) {
  return (
    <div className="flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-pax2-surface px-3 shadow-e1 transition-colors focus-within:border-slate-300">
      <Search className="size-4 shrink-0 text-slate-400" />
      <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search…" aria-label={label} className="w-full min-w-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400" />
      <span aria-hidden className="flex shrink-0 gap-1">
        <kbd className="rounded-md border border-slate-200 bg-pax2-mist px-1.5 py-0.5 text-[11px] text-slate-500">⌘</kbd>
        <kbd className="rounded-md border border-slate-200 bg-pax2-mist px-1.5 py-0.5 text-[11px] text-slate-500">K</kbd>
      </span>
    </div>
  )
}

/** The group a row sits in, named at the foot of the row's menu. */
const GroupLabel = React.createContext<string | undefined>(undefined)

/** `maxRows`: past that many rows the group scrolls (America Thinks' Index, Brendan 2026-10-31). */
export function RailGroup({ label, collapsible = false, defaultOpen = true, maxRows, children }: { label?: string; collapsible?: boolean; defaultOpen?: boolean; maxRows?: number; children: React.ReactNode }) {
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
          {/* A row is 36px with a 2px gap. */}
          <nav className={cn("flex flex-col gap-0.5 px-1", maxRows && "overflow-y-auto")} style={maxRows ? { maxHeight: maxRows * 38 } : undefined}>
            <GroupLabel.Provider value={label}>{children}</GroupLabel.Provider>
          </nav>
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
  lead,
  label,
  count,
  dim,
  drop,
  pane,
}: {
  on?: boolean
  onClick?: () => void
  /** A row that leaves for another surface: a link, never on. */
  href?: string
  icon?: LucideIcon
  /** A picture in the icon's place: a template's thumbnail, as Lift's rows wear their videos'. */
  lead?: React.ReactNode
  label: string
  count?: number | null
  /** The quiet row, the untagged remainder's dress. */
  dim?: boolean
  /** A drop target: an item dragged with this data type lands here (the Inbox's thread onto a folder). */
  drop?: { type: string; onDrop: (value: string) => void }
  /** The address the row's content opens at in the second panel (lib/pane.ts); a link's is its href. */
  pane?: string
}) {
  const { openPane } = useShellPanel()
  const { favs, toggle: toggleFav } = useNavFavorites()
  const group = React.useContext(GroupLabel)
  const paneHref = pane ?? href
  const fav = !!paneHref && favs.includes(paneHref)
  const [over, setOver] = React.useState(false)
  const dress = cn(
    "group relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm outline-none transition-[color,background-color,box-shadow]",
    on ? "bg-pax2-lift font-semibold text-pax2-blue shadow-e1" : "text-slate-500 hover:bg-pax2-lift/70 hover:text-pax2-blue hover:shadow-e1",
    over && "ring-2 ring-pax2-light-blue"
  )
  const dropProps = drop ? {
    onDragOver: (event: React.DragEvent) => {
      if (!event.dataTransfer.types.includes(drop.type)) return
      event.preventDefault()
      event.dataTransfer.dropEffect = "move"
      setOver(true)
    },
    onDragLeave: () => setOver(false),
    onDrop: (event: React.DragEvent) => {
      event.preventDefault()
      setOver(false)
      const value = event.dataTransfer.getData(drop.type)
      if (value) drop.onDrop(value)
    },
  } : {}
  const inner = (
    <>
      {on && <span aria-hidden className="absolute top-1/2 left-0 h-4 w-[3px] -translate-y-1/2 rounded-full bg-pax2-light-blue" />}
      {lead}
      {!lead && Icon && (
        <Icon
          className={cn("icon-pop size-4 shrink-0 transition-colors", on ? "fill-pax2-lavender text-pax2-blue" : "group-hover:fill-pax2-lavender group-hover:text-pax2-blue")}
          strokeWidth={on ? 2.25 : 1.75}
        />
      )}
      <span className={cn("min-w-0 flex-1 truncate", dim && !on && "text-slate-400")}>{label}</span>
      {count != null && (
        <span className={cn("shrink-0 text-xs text-slate-400 tabular-nums", paneHref && "group-hover/rail:invisible group-has-focus-visible/rail:invisible group-has-[[aria-expanded=true]]/rail:invisible")}>
          {count.toLocaleString("en-US")}
        </span>
      )}
    </>
  )
  const row = href ? (
    <Link href={href} className={dress} {...dropProps}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} aria-current={on ? "true" : undefined} className={dress} {...dropProps}>
      {inner}
    </button>
  )
  if (!paneHref) return row
  // On hover, the sidebar's own controls (Brendan, 2026-10-31): the Panel 2 arrow, then the kebab with the
  // sidebar's items. They stand beside the row, not inside it: a button may not hold a button. data-chrome:
  // inside the second panel's frame they are hidden (pax2.css).
  const ICON = "flex size-7 items-center justify-center rounded-lg text-slate-400 opacity-0 transition-opacity hover:bg-pax2-lift hover:text-pax2-blue focus-visible:opacity-100 group-hover/rail:opacity-100"
  return (
    <div className="group/rail relative">
      {row}
      <span data-chrome className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center">
        {fav && <Star aria-label="Favorite" className="mr-1 size-3 fill-amber-400 text-amber-400" />}
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label={`Open ${label} in panel 2`} onClick={(event) => (event.stopPropagation(), openPane(paneHref))} className={ICON}>
                <ArrowUpRight className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Panel 2</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <KebabMenu label={`${label} options`} align="left" width="w-56" trigger={<EllipsisVertical className="size-4" />} triggerClassName={cn(ICON, "aria-expanded:bg-pax2-lift aria-expanded:opacity-100")}>
          <MenuHeader text={paneHref} copy={paneHref} />
          <MenuSeparator />
          <MenuRow icon={<Star className={fav ? "fill-amber-400 text-amber-400" : undefined} />} label={fav ? "Unfavorite" : "Favorite"} onClick={() => toggleFav(paneHref)} />
          <MenuRow icon={<PanelRight />} label="Open in panel" onClick={() => openPane(paneHref)} />
          <MenuRow icon={<Link2 />} label="Copy link" onClick={() => void navigator.clipboard.writeText(`${window.location.origin}${paneHref}`)} />
          <MenuSeparator />
          <MenuFoot title={label} sub={group} />
        </KebabMenu>
      </span>
    </div>
  )
}
