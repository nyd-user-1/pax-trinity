"use client"

import * as React from "react"
import { ArrowLeft, RefreshCwIcon, Search, X, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
import { BankTone } from "./bank-frame"

// The pane's two 52px bars on /lift and /survey, flush with the list's two
// beside them (Brendan's dev-tool pass, 2026-10-27): the search row with the
// view toggle at its right, then the title row — the open item, its controls
// at the right. America Thinks' pane has one bar (Brendan's DevTools pass,
// 2026-10-28): the title row, with the view toggle at its right.

/** The bordered search box the list's search row and the pane's both carry.
 *  With `onClose` it closes back to its icon: Escape and the X close it. */
export function SearchField({
  query,
  onQuery,
  placeholder,
  autoFocus,
  onClose,
}: {
  query: string
  onQuery: (q: string) => void
  placeholder: string
  autoFocus?: boolean
  onClose?: () => void
}) {
  return (
    <div className="flex w-full min-w-0 items-center gap-2 rounded-lg border px-3 py-1.5">
      <Search className="size-4 shrink-0 text-muted-foreground" />
      <input
        autoFocus={onClose ? autoFocus : undefined}
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        onKeyDown={onClose ? (event) => event.key === "Escape" && onClose() : undefined}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      {onClose ? (
        <button type="button" aria-label="Close the search" onClick={onClose} className="shrink-0 text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      ) : (
        query && (
          <button type="button" aria-label="Clear the search" onClick={() => onQuery("")} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        )
      )}
    </div>
  )
}

export function PaneSearchRow({
  query,
  onQuery,
  placeholder,
  onBack,
  children,
}: {
  query: string
  onQuery: (q: string) => void
  placeholder: string
  /** The reading pane off, the item has the screen: Back returns to the list (Gmail's). */
  onBack?: () => void
  children?: React.ReactNode
}) {
  return (
    <div className="flex h-[52px] shrink-0 items-center gap-2 border-b px-4">
      {onBack && (
        <Button variant="ghost" size="icon-sm" aria-label="Back to the list" title="Back to the list" className="-ml-1.5 shrink-0" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
      )}
      <SearchField query={query} onQuery={onQuery} placeholder={placeholder} />
      {children}
    </div>
  )
}

/** The title row's search (Brendan, 2026-10-29): an icon after the row's
 *  leading controls; opened, or holding a query, the field takes the row up to
 *  the controls at its right, over the title. The owner keeps it open across
 *  remounts. */
export type PaneSearch = { query: string; onQuery: (q: string) => void; placeholder: string; open: boolean; onOpen: () => void; onClose: () => void }

export function PaneTitleRow({ title, leading, search, children }: { title: React.ReactNode; leading?: React.ReactNode; search?: PaneSearch; children?: React.ReactNode }) {
  const searching = search != null && (search.open || search.query !== "")
  return (
    <div className="flex h-[52px] shrink-0 items-center gap-2 border-b px-4">
      {leading && <div className="flex shrink-0 items-center gap-1">{leading}</div>}
      {search && !searching && (
        <Button variant="ghost" size="icon-sm" aria-label="Search" title="Search" className={cn("shrink-0", !leading && "-ml-1.5")} onClick={search.onOpen}>
          <Search className="size-4" />
        </Button>
      )}
      {search && searching ? (
        <div className="min-w-0 flex-1">
          <SearchField query={search.query} onQuery={search.onQuery} placeholder={search.placeholder} autoFocus={search.open} onClose={search.onClose} />
        </div>
      ) : (
        // 68ch, the list row's clamp: the measure of "All things considered,
        // how well do you think relying on volunteers…".
        <span className="max-w-[68ch] min-w-0 truncate text-sm font-semibold">{title}</span>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-2">{children}</div>
    </div>
  )
}

export function RefreshButton({ onRefresh }: { onRefresh: () => void }) {
  return (
    <Button variant="ghost" size="icon-sm" aria-label="Refresh" title="Refresh" className="-mr-1.5 shrink-0" onClick={onRefresh}>
      <RefreshCwIcon className="size-4" />
    </Button>
  )
}

/** The segmented toggle: Data, Crosstab, Trend, Topline and the globe on America Thinks, each an icon. A view with an icon shows the icon alone, its label as the name. */
export function ViewToggle<V extends string>({ views, value, onChange }: { views: readonly { value: V; label: string; icon?: LucideIcon }[]; value: V; onChange: (v: V) => void }) {
  const rail = React.useContext(BankTone) === "rail"
  // The hover's grey slides from one view to the next (Brendan, 2026-10-29),
  // under the buttons, so the picked one's own ground covers it there. It
  // appears in place, and slides only once it is showing.
  const [hl, setHl] = React.useState({ left: 0, width: 0, shown: false, slide: false })
  return (
    <div className="relative flex shrink-0 rounded-lg border p-0.5 text-xs" onMouseLeave={() => setHl((h) => ({ ...h, shown: false, slide: false }))}>
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0.5 rounded-md bg-slate-200/70 duration-200 ease-out",
          hl.slide ? "transition-[left,width,opacity]" : "transition-opacity",
          hl.shown ? "opacity-100" : "opacity-0"
        )}
        style={{ left: hl.left, width: hl.width }}
      />
      {views.map((v) => {
        const Icon = v.icon
        const on = value === v.value
        return (
          <button
            key={v.value}
            type="button"
            aria-pressed={on}
            aria-label={Icon ? v.label : undefined}
            title={Icon ? v.label : undefined}
            onClick={() => onChange(v.value)}
            onMouseEnter={(event) => {
              const { offsetLeft: left, offsetWidth: width } = event.currentTarget
              setHl((h) => ({ left, width, shown: true, slide: h.shown }))
            }}
            className={cn(
              "relative rounded-md py-1 transition-colors",
              Icon ? "px-2" : "px-2.5",
              on ? (rail ? "bg-pax2-surface font-semibold text-pax2-blue shadow-e1" : "bg-pax2-mist font-semibold text-pax2-blue") : "text-muted-foreground hover:text-foreground"
            )}
          >
            {Icon ? <Icon className="size-4" /> : v.label}
          </button>
        )
      })}
    </div>
  )
}
