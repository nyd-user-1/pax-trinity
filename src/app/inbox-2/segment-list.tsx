"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon, EllipsisVerticalIcon, PanelRightIcon, RowsIcon, Search, StarIcon, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"
import { ScrollArea } from "@govblock/ui/components/ny4/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/ny4/tooltip"

import { mnemonicOf, normalizeWording, scaleOf, WEB_GRID, type QuestionSummary } from "../audience/audience-data"

// The question list in Gmail's anatomy, as Brendan restyled it by hand
// (2026-10-27, docs/wireframes/inbox-row-changes.png): no grip, box, star or
// importance arrow leading the row — 16px either side and the words start.
// Full width, one line: the wording in bold truncating at whatever width the
// row has, the scale family and wave count after Gmail's dash, the topic and
// mnemonic chips, the span at the right edge where the time sits. Folded
// beside an open question, the card: the wording, then the topic chip and
// the span under it. The row's kebab takes the span's place on hover, Gmail's
// own swap: a grid column (four at most), the pin, Blocks, the survey draft.

export type Split = "none" | "vertical"
export type ListTab = "all" | "pinned"
export const MAX_COLS = 4
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

/** The card's foot: the question's span and wave count, from the index's summary of it. */
function spanOf(c: QuestionSummary | undefined) {
  if (!c) return null
  return { span: c.first === c.last ? String(c.first) : `${c.first}–${c.last}`, waves: c.waves }
}

export function SegmentList({
  summaries,
  metricIds,
  label,
  wordingOf,
  topicOf,
  selected,
  columns,
  pinned,
  tab,
  onTab,
  onOpen,
  onColumn,
  onPin,
  onBlock,
  onSurvey,
  split,
  onSplit,
  query = "",
  onQuery,
  loading,
  error,
}: {
  /** The index's read of each question: span, waves and bands, no rows needed. */
  summaries: Map<string, QuestionSummary>
  metricIds: string[]
  label: (id: string) => string
  /** The question's verbatim wording where the bank carries one. */
  wordingOf: (id: string) => string | null
  /** The question's collapsed topic — the rail's vocabulary, worn as the row's tag. */
  topicOf: (id: string) => string | null
  selected: string | null
  /** The questions standing as the compare grid's columns. */
  columns: string[]
  pinned: string[]
  tab: ListTab
  onTab: (tab: ListTab) => void
  onOpen: (id: string) => void
  /** Adds the question to the compare grid's columns, or takes it out. */
  onColumn: (id: string) => void
  onPin: (id: string) => void
  /** Hands the question and its data to the right side's Blocks panel. */
  onBlock: (id: string) => void
  /** Hands the question to the survey draft. */
  onSurvey: (id: string) => void
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
  // Opening a question (a click, a chevron) brings its row into view in the
  // folded list: the window deepens to reach it, then the active row scrolls in.
  const rootRef = React.useRef<HTMLDivElement>(null)
  const orderedRef = React.useRef(ordered)
  orderedRef.current = ordered
  React.useEffect(() => {
    if (!selected) return
    const at = orderedRef.current.indexOf(selected)
    if (at === -1) return
    setDepth((d) => (at >= d ? Math.ceil((at + 1) / PER_READ) * PER_READ : d))
    const t = window.setTimeout(() => rootRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" }), 50)
    return () => window.clearTimeout(t)
  }, [selected])
  // Gmail's own behavior: the one-line anatomy at full width, the stacked
  // anatomy when the list is folded beside an open question.
  const stacked = split === "vertical"

  // The chevrons walk the questions: the one before and after the open one.
  const at = selected ? ordered.indexOf(selected) : -1
  const prevId = at > 0 ? ordered[at - 1] : null
  const nextId = at === -1 ? (ordered[0] ?? null) : at < ordered.length - 1 ? ordered[at + 1] : null

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col">
      {/* Both bars stand 52px, like the pane's search row and title row
          beside them — the borders run flush across the split. */}
      <div className="flex h-[52px] shrink-0 items-center border-b px-3">
        <SearchField query={query} onQuery={onQuery} />
      </div>
      <div className="flex h-[52px] shrink-0 items-center gap-1 border-b px-3">
        <Tip label={stacked ? "Turn off the vertical split" : "Vertical split"}>
          <Button variant="ghost" size="icon-sm" aria-label="Toggle vertical split" aria-pressed={stacked} onClick={() => onSplit(stacked ? "none" : "vertical")}>
            {stacked ? <PanelRightIcon className="size-4" /> : <RowsIcon className="size-4" />}
          </Button>
        </Tip>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Previous question" disabled={!prevId} onClick={() => prevId && onOpen(prevId)}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Next question" disabled={!nextId} onClick={() => nextId && onOpen(nextId)}>
            <ChevronRightIcon className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="More">
                <EllipsisVerticalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-max min-w-48">
              <DropdownMenuRadioGroup value={tab} onValueChange={(value) => onTab(value as ListTab)}>
                <DropdownMenuRadioItem value="all">All questions</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="pinned">Pinned only</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {error && <p className="p-6 text-center text-sm text-pax2-red">The data did not load: {error}</p>}
        {!error && loading && <p className="p-6 text-center text-sm text-muted-foreground">Reading the index…</p>}
        {!error && !loading && ordered.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">{tab === "pinned" ? "Nothing pinned." : q ? `Nothing matching “${query.trim()}”.` : "Nothing on file."}</p>}
        <ul className="divide-y">
          {listed.map((id) => {
            const c = summaries.get(id)
            const active = selected === id
            const foot = spanOf(c)
            const scale = scaleOf(c?.options ?? [])
            const topicName = topicOf(id)
            // The topic chip, Gmail's label: the rail's word on the row.
            const topicChip = topicName && (
              <span className="max-w-44 shrink-0 truncate rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground" title={topicName}>
                {topicName}
              </span>
            )
            const end = (
              <RowEnd
                span={foot?.span ?? null}
                column={columns.includes(id)}
                atCap={!columns.includes(id) && columns.length >= MAX_COLS}
                pinned={pinned.includes(id)}
                onColumn={() => onColumn(id)}
                onPin={() => onPin(id)}
                onBlock={() => onBlock(id)}
                onSurvey={() => onSurvey(id)}
              />
            )
            const wording = (
              <span className="font-semibold">
                {pinned.includes(id) && <StarIcon aria-label="Pinned" className="mr-1.5 inline size-3.5 -translate-y-px fill-yellow-400 text-yellow-500" />}
                {normalizeWording(wordingOf(id) ?? label(id))}
                {WEB_GRID.has(id) && <span className="font-normal text-muted-foreground"> (web grid)</span>}
              </span>
            )
            return (
              <li
                key={id}
                data-active={active}
                className={cn(
                  "group/row relative flex cursor-pointer gap-3 px-4 text-sm transition-[background-color,box-shadow] hover:z-10 hover:bg-accent/60 hover:shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]",
                  stacked ? "py-2.5" : "h-10 items-center",
                  active && "z-10 bg-muted shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]"
                )}
                onClick={() => onOpen(id)}
              >
                {stacked ? (
                  <span className="flex min-w-0 flex-1 flex-col gap-4">
                    {wording}
                    <span className="flex items-center gap-2">
                      {topicChip}
                      <span className="ml-auto flex shrink-0">{end}</span>
                    </span>
                  </span>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate" title={wordingOf(id) ?? label(id)}>
                      {wording}
                      {foot && (
                        <span className="text-muted-foreground">
                          {" "}
                          - {scale ? `${scale} · ` : ""}
                          {foot.waves} {foot.waves === 1 ? "wave" : "waves"}
                        </span>
                      )}
                    </span>
                    {topicChip}
                    {/* The mnemonic as a chip just before the year (Brendan, 2026-10-26). */}
                    <span className="max-w-40 shrink-0 truncate rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wider text-muted-foreground" title={mnemonicOf(id)}>
                      {mnemonicOf(id)}
                    </span>
                    {end}
                  </>
                )}
              </li>
            )
          })}
        </ul>
        {depth < ordered.length && <MoreMark onMore={more} />}
      </ScrollArea>
    </div>
  )
}

/** The bordered search box the list's search row and the pane's both carry. */
export function SearchField({ query, onQuery }: { query: string; onQuery: (q: string) => void }) {
  return (
    <div className="flex w-full min-w-0 items-center gap-2 rounded-lg border px-3 py-1.5">
      <Search className="size-4 shrink-0 text-muted-foreground" />
      <input
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="Search wording or label…"
        className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
      {query && (
        <button type="button" aria-label="Clear the search" onClick={() => onQuery("")} className="shrink-0 text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

/** The row's right edge: the span, and on hover the row's kebab in its place. */
function RowEnd({
  span,
  column,
  atCap,
  pinned,
  onColumn,
  onPin,
  onBlock,
  onSurvey,
}: {
  span: string | null
  column: boolean
  atCap: boolean
  pinned: boolean
  onColumn: () => void
  onPin: () => void
  onBlock: () => void
  onSurvey: () => void
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <span className="relative flex min-w-7 shrink-0 items-center justify-end">
      <span className={cn("text-xs text-muted-foreground tabular-nums group-hover/row:invisible group-has-focus-visible/row:invisible", open && "invisible")}>{span}</span>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Question actions"
            onClick={(event) => event.stopPropagation()}
            className={cn("absolute top-1/2 right-0 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100", open && "opacity-100")}
          >
            <EllipsisVerticalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        {/* The menu portals out, but React bubbles its clicks to the row: stop them here. */}
        <DropdownMenuContent align="end" className="w-max min-w-44" onClick={(event) => event.stopPropagation()}>
          <DropdownMenuItem disabled={atCap} onClick={onColumn}>
            {column ? "Remove column" : atCap ? "Four columns at most" : "Add as column"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onPin}>{pinned ? "Unpin" : "Pin"}</DropdownMenuItem>
          <DropdownMenuItem onClick={onBlock}>Add to blocks</DropdownMenuItem>
          <DropdownMenuItem onClick={onSurvey}>Add to survey</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
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
