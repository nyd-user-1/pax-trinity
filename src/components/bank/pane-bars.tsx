"use client"

import * as React from "react"
import { ArrowLeft, RefreshCwIcon, Search, X, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"

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

export function PaneTitleRow({ title, leading, children }: { title: React.ReactNode; leading?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex h-[52px] shrink-0 items-center gap-2 border-b px-4">
      {leading && <div className="flex shrink-0 items-center gap-2">{leading}</div>}
      {/* 68ch, the list row's clamp: the measure of "All things considered, how
          well do you think relying on volunteers…". */}
      <span className="max-w-[68ch] min-w-0 truncate text-sm font-semibold">{title}</span>
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

/** The segmented toggle: Data, Crosstab, Trend and the globe on /audience. A view with an icon shows the icon alone, its label as the name. */
export function ViewToggle<V extends string>({ views, value, onChange }: { views: readonly { value: V; label: string; icon?: LucideIcon }[]; value: V; onChange: (v: V) => void }) {
  return (
    <div className="flex shrink-0 rounded-lg border p-0.5 text-xs">
      {views.map((v) => {
        const Icon = v.icon
        return (
          <button
            key={v.value}
            type="button"
            aria-pressed={value === v.value}
            aria-label={Icon ? v.label : undefined}
            title={Icon ? v.label : undefined}
            onClick={() => onChange(v.value)}
            className={cn("rounded-md py-1 transition-colors", Icon ? "px-2" : "px-2.5", value === v.value ? "bg-pax2-mist font-semibold text-pax2-blue" : "text-muted-foreground hover:text-foreground")}
          >
            {Icon ? <Icon className="size-4" /> : v.label}
          </button>
        )
      })}
    </div>
  )
}
