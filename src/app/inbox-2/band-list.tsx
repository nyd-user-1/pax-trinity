"use client"

import * as React from "react"
import { ArrowLeft, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, PanelRightIcon, RowsIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"
import { ScrollArea } from "@govblock/ui/components/ny4/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/ny4/tooltip"

import { num, year, type SourceRow } from "../audience/audience-data"
import { type Split } from "./segment-list"

// The middle panel once a segment is picked from the rail's branch: its bands
// as the list, one Gmail row each — the segment where the sender sits, the
// band in bold, its topline after the dash, the year at the right. The back
// arrow returns the segment list; opening a band is the presto into the grid
// with that band's row in hand.

export type BandItem = { opt: string; r: SourceRow | null }

const value = (r: SourceRow) => (r[8] === "count" ? num(r[7], 0) : r[8] === "lift_pp" ? `${r[7] >= 0 ? "+" : "−"}${num(Math.abs(r[7]))} pp` : `${num(r[7])}%`)

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function BandList({
  items,
  segment,
  place,
  onBack,
  onOpen,
  split,
  onSplit,
  query = "",
}: {
  items: BandItem[]
  segment: string
  place: (code: string) => string
  onBack: () => void
  onOpen: (item: BandItem) => void
  split: Split
  onSplit: (split: Split) => void
  query?: string
}) {
  const q = query.trim().toLowerCase()
  const shown = items.filter((item) => !q || item.opt.toLowerCase().includes(q))
  const stacked = split === "vertical"

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[52px] shrink-0 items-center gap-1 border-b px-3">
        <Tip label="Back to the segments">
          <Button variant="ghost" size="sm" aria-label="Back to the segments" onClick={onBack}>
            <ArrowLeft className="size-4" />
          </Button>
        </Tip>
        <span className="truncate text-sm font-medium">{segment}</span>
        <div className="ml-auto flex items-center gap-1">
          <span className="px-2 text-xs text-muted-foreground tabular-nums">{shown.length ? `1–${shown.length} of ${shown.length}` : "0 of 0"}</span>
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
              <DropdownMenuRadioGroup value={split} onValueChange={(v) => onSplit(v as Split)}>
                <DropdownMenuRadioItem value="none">No split</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="vertical">Vertical split</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {shown.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">{q ? `Nothing matching “${query.trim()}”.` : "No bands on file."}</p>}
        <ul className="divide-y">
          {shown.map((item) => {
            const r = item.r
            const teaser = r ? `${value(r)} · ${place(r[1])} · ${year(r[3])}` : ""
            const date = r ? year(r[3]) : ""
            return (
              <li
                key={item.opt}
                className={cn(
                  "group/row relative flex cursor-pointer items-start gap-3 px-3 text-sm transition-[background-color,box-shadow] hover:z-10 hover:bg-accent/60 hover:shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]",
                  stacked ? "py-2.5" : "h-10 items-center"
                )}
                onClick={() => onOpen(item)}
              >
                {stacked ? (
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{segment}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">{date}</span>
                    </span>
                    <span className="truncate font-medium">{item.opt}</span>
                    <span className="truncate text-muted-foreground">{teaser}</span>
                  </span>
                ) : (
                  <>
                    <span className="w-44 shrink-0 truncate font-medium">{segment}</span>
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{item.opt}</span>
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
