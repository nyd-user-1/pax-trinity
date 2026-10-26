"use client"

import * as React from "react"
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, EllipsisVerticalIcon, PanelRightIcon, RefreshCwIcon, RowsIcon, StarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
import { Checkbox } from "@govblock/ui/components/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"
import { ScrollArea } from "@govblock/ui/components/ny4/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/ny4/tooltip"

import { shortSource, snippetOf, year, type MetricInfo } from "../audience/audience-data"

// The segment list in the thread list's exact shape: the same toolbar —
// select-all with its menu, refresh, more; the count, the pager and the split
// toggle at the right — then one row per segment, Gmail's anatomy. Full
// width, a row is one line: box, star, the source where the sender sits, the
// segment in bold with its bands and topline after a dash, the latest year
// where the time sits. Opening a row is the presto: the grid takes the pane.
// The box is the column picker (four at most), the star pins.

export type Split = "none" | "vertical"
export type ListTab = "all" | "pinned"
const MAX_COLS = 4

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** The line after the dash: the bands, then the topline the way the inbox teases a thread. */
function teaserOf(c: MetricInfo | undefined, place: (code: string) => string) {
  if (!c) return ""
  const base = snippetOf(c, place)
  if (c.median || c.options.length < 2) return base
  return base ? `${c.options.length} bands · ${base}` : `${c.options.length} bands`
}

export function SegmentList({
  info,
  metricIds,
  source,
  label,
  place,
  selected,
  checked,
  pinned,
  tab,
  onTab,
  onOpen,
  onCheck,
  onPin,
  onCheckAll,
  onRefresh,
  onFlatTable,
  split,
  onSplit,
  query = "",
  loading,
  error,
}: {
  info: Map<string, MetricInfo>
  metricIds: string[]
  source: string | null
  label: (id: string) => string
  place: (code: string) => string
  selected: string | null
  checked: string[]
  pinned: string[]
  tab: ListTab
  onTab: (tab: ListTab) => void
  onOpen: (id: string) => void
  onCheck: (id: string) => void
  onPin: (id: string) => void
  onCheckAll: (ids: string[]) => void
  onRefresh: () => void
  onFlatTable: () => void
  split: Split
  onSplit: (split: Split) => void
  /** The header search's filter; empty shows everything. */
  query?: string
  loading: boolean
  error: string | null
}) {
  const q = query.trim().toLowerCase()
  const shown = metricIds
    .filter((id) => !q || label(id).toLowerCase().includes(q) || id.toLowerCase().includes(q))
    .filter((id) => tab === "all" || pinned.includes(id))
  const ordered = [...shown.filter((id) => pinned.includes(id)), ...shown.filter((id) => !pinned.includes(id))]
  const allChecked = ordered.length > 0 && ordered.slice(0, MAX_COLS).every((id) => checked.includes(id))
  const stacked = split === "vertical"
  const who = source ? shortSource(source) : ""

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[52px] shrink-0 items-center gap-1 border-b px-3">
        <div className="flex items-center">
          <Checkbox aria-label="Select columns" checked={allChecked} indeterminate={!allChecked && checked.length > 0} onCheckedChange={(value) => onCheckAll(value === true ? ordered.slice(0, MAX_COLS) : [])} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Select" className="-ml-0.5 size-6">
                <ChevronDownIcon className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-max min-w-40">
              <DropdownMenuItem onClick={() => onCheckAll(ordered.slice(0, MAX_COLS))}>First four</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onCheckAll([])}>None</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onCheckAll(ordered.filter((id) => pinned.includes(id)).slice(0, MAX_COLS))}>Pinned</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Tip label="Refresh">
          <Button variant="ghost" size="icon-sm" aria-label="Refresh" onClick={onRefresh}>
            <RefreshCwIcon className="size-4" />
          </Button>
        </Tip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="More">
              <EllipsisVerticalIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-max min-w-48">
            <DropdownMenuRadioGroup value={tab} onValueChange={(value) => onTab(value as ListTab)}>
              <DropdownMenuRadioItem value="all">All segments</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="pinned">Pinned only</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onFlatTable}>Open the flat table</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto flex items-center gap-1">
          <span className="px-2 text-xs text-muted-foreground tabular-nums">{ordered.length ? `1–${ordered.length} of ${ordered.length}` : "0 of 0"}</span>
          <Button variant="ghost" size="icon-sm" aria-label="Newer" disabled>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Older" disabled>
            <ChevronRightIcon className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Toggle split pane" className="gap-0.5 px-1.5">
                {stacked ? <PanelRightIcon className="size-4" /> : <RowsIcon className="size-4" />}
                <ChevronDownIcon className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-max min-w-44">
              <DropdownMenuRadioGroup value={split} onValueChange={(value) => onSplit(value as Split)}>
                <DropdownMenuRadioItem value="none">No split</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="vertical">Vertical split</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {error && <p className="p-6 text-center text-sm text-pax2-red">The data did not load: {error}</p>}
        {!error && loading && <p className="p-6 text-center text-sm text-muted-foreground">Reading the source…</p>}
        {!error && !loading && ordered.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">{tab === "pinned" ? "Nothing pinned." : q ? `Nothing matching “${query.trim()}”.` : "Nothing on file."}</p>}
        <ul className="divide-y">
          {ordered.map((id) => {
            const c = info.get(id)
            const active = selected === id
            const atCap = !checked.includes(id) && checked.length >= MAX_COLS
            const teaser = teaserOf(c, place)
            const date = c?.topline ? year(c.topline[3]) : ""
            const star = (
              <button
                type="button"
                aria-label={pinned.includes(id) ? "Unpin" : "Pin"}
                aria-pressed={pinned.includes(id)}
                onClick={(event) => {
                  event.stopPropagation()
                  onPin(id)
                }}
                className="shrink-0 rounded-sm text-muted-foreground/60 hover:text-foreground"
              >
                <StarIcon className={cn("size-4", pinned.includes(id) && "fill-yellow-400 text-yellow-500")} />
              </button>
            )
            return (
              <li
                key={id}
                data-active={active}
                className={cn(
                  "group/row relative flex cursor-pointer items-start gap-3 px-3 text-sm transition-[background-color,box-shadow] hover:z-10 hover:bg-accent/60 hover:shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]",
                  stacked ? "py-2.5" : "h-10 items-center",
                  active && "bg-muted"
                )}
                onClick={() => onOpen(id)}
              >
                <span className={cn("flex shrink-0 items-center gap-2", stacked && "pt-0.5")} onClick={(event) => event.stopPropagation()}>
                  <Checkbox aria-label={`A column for ${label(id)}`} checked={checked.includes(id)} disabled={atCap} title={atCap ? "Four at most" : undefined} onCheckedChange={() => onCheck(id)} />
                  {!stacked && star}
                </span>
                {stacked ? (
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{who}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{date}</span>
                    </span>
                    <span className="truncate font-medium">{label(id)}</span>
                    <span className="flex items-center gap-2">
                      <span className="truncate text-muted-foreground">{teaser}</span>
                      <span className="ml-auto">{star}</span>
                    </span>
                  </span>
                ) : (
                  <>
                    <span className="w-44 shrink-0 truncate font-medium">{who}</span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{label(id)}</span>
                      {teaser && <span className="text-muted-foreground"> - {teaser}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{date}</span>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      </ScrollArea>
    </div>
  )
}
