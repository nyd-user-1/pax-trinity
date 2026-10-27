"use client"

import * as React from "react"
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, EllipsisVerticalIcon, RefreshCwIcon, Search, StarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
import { Checkbox } from "@govblock/ui/components/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"
import { ScrollArea } from "@govblock/ui/components/ny4/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/ny4/tooltip"

import { mnemonicOf, normalizeWording, scaleOf, WEB_GRID, year, type MetricInfo } from "../audience/audience-data"

// The question list in Gmail's exact anatomy (Brendan, 2026-10-26: "a near
// perfect mimic"): the same toolbar — select-all with its menu, refresh, the
// more menu (tabs, the split, the flat table); the pager at the right — then
// one line per question: box, star, the mnemonic badge where the sender
// sits, the wording in bold truncating at whatever width the row has with
// the scale family and wave count after Gmail's dash, and the span at the
// right edge where the time sits. Battery stems normalize into the sentence.
// Opening a row is the presto: the data takes the pane. The box is the
// column picker (four at most), the star pins.

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
  wordingOf,
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
  onQuery,
  loading,
  error,
}: {
  info: Map<string, MetricInfo>
  metricIds: string[]
  label: (id: string) => string
  /** The question's verbatim wording where the bank carries one. */
  wordingOf: (id: string) => string | null
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
  /** The search's filter; empty shows everything. */
  query?: string
  onQuery: (q: string) => void
  loading: boolean
  error: string | null
}) {
  const q = query.trim().toLowerCase()
  const shown = metricIds
    .filter((id) => !q || label(id).toLowerCase().includes(q) || id.toLowerCase().includes(q) || (wordingOf(id) ?? "").toLowerCase().includes(q))
    .filter((id) => tab === "all" || pinned.includes(id))
  const ordered = [...shown.filter((id) => pinned.includes(id)), ...shown.filter((id) => !pinned.includes(id))]
  const [depth, setDepth] = React.useState(PER_READ)
  React.useEffect(() => setDepth(PER_READ), [query, tab, metricIds])
  const listed = ordered.slice(0, depth)
  const more = React.useCallback(() => setDepth((d) => d + PER_READ), [])
  const allChecked = ordered.length > 0 && ordered.slice(0, MAX_COLS).every((id) => checked.includes(id))

  // The chevrons walk the questions: the one before and after the open one.
  const at = selected ? ordered.indexOf(selected) : -1
  const prevId = at > 0 ? ordered[at - 1] : null
  const nextId = at === -1 ? (ordered[0] ?? null) : at < ordered.length - 1 ? ordered[at + 1] : null

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* The search row stands 52px like the toggle bar beside it; the toolbar
          under it stands 44px like the filter row beside it — the borders line up. */}
      <div className="flex h-[52px] shrink-0 items-center border-b px-3">
        <div className="flex w-full items-center gap-2 rounded-lg border px-3 py-1.5">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search wording or label…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div className="flex h-11 shrink-0 items-center gap-1 border-b px-3">
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
          <Button variant="ghost" size="icon-sm" aria-label="Previous question" disabled={!prevId} onClick={() => prevId && onOpen(prevId)}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Next question" disabled={!nextId} onClick={() => nextId && onOpen(nextId)}>
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
            const scale = scaleOf(c?.options ?? [])
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
                  "group/row relative flex h-10 cursor-pointer items-center gap-3 px-3 text-sm transition-[background-color,box-shadow] hover:z-10 hover:bg-accent/60 hover:shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]",
                  active && "z-10 bg-muted shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]"
                )}
                onClick={() => onOpen(id)}
              >
                <span className="flex shrink-0 items-center gap-2" onClick={(event) => event.stopPropagation()}>
                  <Checkbox aria-label={`A column for ${label(id)}`} checked={checked.includes(id)} disabled={atCap} title={atCap ? "Four at most" : undefined} onCheckedChange={() => onCheck(id)} />
                  {star}
                </span>
                {/* The mnemonic where Gmail's sender sits: plain text, fixed width, truncating — a pill overflowed ANES's long ids. */}
                <span className="w-44 shrink-0 truncate font-medium" title={mnemonicOf(id)}>
                  {mnemonicOf(id)}
                </span>
                <span className="min-w-0 flex-1 truncate" title={wordingOf(id) ?? label(id)}>
                  <span className="font-semibold">
                    {normalizeWording(wordingOf(id) ?? label(id))}
                    {WEB_GRID.has(id) && <span className="font-normal text-muted-foreground"> (web grid)</span>}
                  </span>
                  {foot && (
                    <span className="text-muted-foreground">
                      {" "}
                      - {scale ? `${scale} · ` : ""}
                      {foot.waves} {foot.waves === 1 ? "wave" : "waves"}
                    </span>
                  )}
                </span>
                {foot && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{foot.span}</span>}
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
