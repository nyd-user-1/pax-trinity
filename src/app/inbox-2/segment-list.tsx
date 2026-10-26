"use client"

import * as React from "react"
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, EllipsisVerticalIcon, RefreshCwIcon, StarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
import { Checkbox } from "@govblock/ui/components/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"
import { ScrollArea } from "@govblock/ui/components/ny4/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/ny4/tooltip"

import { mnemonicOf, WEB_GRID, WORDING, year, type MetricInfo } from "../audience/audience-data"

// The question list in the thread list's frame: the same toolbar —
// select-all with its menu, refresh, the more menu (tabs, the split, the
// flat table); the pager at the right — then one card per question, reading as the question
// would on a survey (Brendan, 2026-10-26): the wording where the bank carries
// one, the source label where it does not, the span and wave count under it
// with the source's mnemonic as the badge at the card's bottom right. Opening
// a card is the presto: the data takes the pane. The box is the column picker
// (four at most), the star pins.

export type Split = "none" | "vertical"
export type ListTab = "all" | "pinned"
const MAX_COLS = 4
/** Sixty rows to a read, sixty more on reaching the end — a bulk folder holds thousands. */
const PER_READ = 60

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

/** The card's foot: the question's span and wave count, read off its topline rows. */
function spanOf(c: MetricInfo | undefined) {
  if (!c) return null
  const ys = new Set<string>()
  for (const r of c.rs) ys.add(year(r[3]))
  const s = [...ys].sort()
  if (!s.length) return null
  return { span: s[0] === s[s.length - 1] ? s[0] : `${s[0]}–${s[s.length - 1]}`, waves: ys.size }
}

export function SegmentList({
  info,
  metricIds,
  label,
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
  label: (id: string) => string
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
  const [depth, setDepth] = React.useState(PER_READ)
  React.useEffect(() => setDepth(PER_READ), [query, tab, metricIds])
  const listed = ordered.slice(0, depth)
  const more = React.useCallback(() => setDepth((d) => d + PER_READ), [])
  const allChecked = ordered.length > 0 && ordered.slice(0, MAX_COLS).every((id) => checked.includes(id))

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
            <DropdownMenuRadioGroup value={split} onValueChange={(value) => onSplit(value as Split)}>
              <DropdownMenuRadioItem value="none">No split</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="vertical">Vertical split</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onFlatTable}>Open the flat table</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Newer" disabled>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Older" disabled>
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {error && <p className="p-6 text-center text-sm text-pax2-red">The data did not load: {error}</p>}
        {!error && loading && <p className="p-6 text-center text-sm text-muted-foreground">Reading the source…</p>}
        {!error && !loading && ordered.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">{tab === "pinned" ? "Nothing pinned." : q ? `Nothing matching “${query.trim()}”.` : "Nothing on file."}</p>}
        <ul className="divide-y">
          {listed.map((id) => {
            const c = info.get(id)
            const active = selected === id
            const atCap = !checked.includes(id) && checked.length >= MAX_COLS
            const foot = spanOf(c)
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
                  "group/row relative flex cursor-pointer items-start gap-3 px-3 py-2.5 text-sm transition-[background-color,box-shadow] hover:z-10 hover:bg-accent/60 hover:shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]",
                  active && "bg-muted"
                )}
                onClick={() => onOpen(id)}
              >
                <span className="flex shrink-0 items-center gap-2 pt-0.5" onClick={(event) => event.stopPropagation()}>
                  <Checkbox aria-label={`A column for ${label(id)}`} checked={checked.includes(id)} disabled={atCap} title={atCap ? "Four at most" : undefined} onCheckedChange={() => onCheck(id)} />
                  {star}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-semibold">
                    {WORDING[id] ?? label(id)}
                    {WEB_GRID.has(id) && <span className="font-normal text-muted-foreground"> (web grid)</span>}
                  </span>
                  <span className="flex items-end justify-between gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">{foot ? `${foot.span} · ${foot.waves} ${foot.waves === 1 ? "wave" : "waves"}` : ""}</span>
                    <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wider text-muted-foreground">{mnemonicOf(id)}</span>
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
        {depth < ordered.length && <MoreMark onMore={more} />}
      </ScrollArea>
    </div>
  )
}

/** The end of the list: reaching it reads sixty more. */
function MoreMark({ onMore }: { onMore: () => void }) {
  const mark = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const el = mark.current
    if (!el) return
    const o = new IntersectionObserver((xs) => xs.some((x) => x.isIntersecting) && onMore())
    o.observe(el)
    return () => o.disconnect()
  }, [onMore])
  return <div ref={mark} aria-hidden className="h-8" />
}
