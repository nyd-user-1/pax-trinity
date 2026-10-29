"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon, EllipsisVerticalIcon, PanelLeftClose, PanelLeftOpen, StarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@govblock/ui/components/ny4/dropdown-menu"
import { ScrollArea } from "@govblock/ui/components/ny4/scroll-area"
import { KebabMenu } from "@/components/kebab-menu"

import { BankRail, BankTone } from "./bank-frame"
import { Marks, type MarkState } from "./marks"
import { SearchField } from "./pane-bars"

// The middle list in Gmail's anatomy, as Brendan restyled it by hand
// (2026-10-27, docs/wireframes/inbox-row-changes.png and his later row edit):
// 16px either side. Full width, one line: where the surface gives them, the
// three marks (box, importance arrow, star) lead the row; the title in bold
// clamped at 68ch, then after Gmail's dash the snippet (or the detail) taking
// what width is left; the chip; the span at the right edge in the inbox
// date's weight. Folded beside an open item, the card:
// the title, then the one chip and the span under it at a 16px gap. On hover
// the row's kebab takes the chip's and the span's place, Gmail's own swap; the
// folded card's star stands beside it (Brendan, 2026-10-28). Two 52px
// bars on top — the search, then the chevrons and the kebab — flush with the
// pane's two beside them. The split lives in the kebab (No split, Vertical
// split, the Agentic Inbox's own words), before the list's menu. Compact
// (America Thinks, Brendan's DevTools pass of 2026-10-28), one bar: the kebab,
// which carries the rail toggle too, the frame's header row being gone; the
// sidebar's toggle beside it, where the search icon was; the search opening
// on a press on the bar's empty run (Brendan, 2026-10-29); the chevrons at
// the right.

export type Split = "none" | "vertical"

export type Card = {
  /** The bold line: the question's wording, the metric's name. */
  title: React.ReactNode
  /** The full text behind a truncated one-line title. */
  hint?: string
  /** The card's one chip — on /audience the topic. */
  chip?: string | null
  /** The right edge, where the time sits. */
  span?: string | null
  /** The one-line row's grey text after the dash. */
  detail?: string | null
  /** Gmail's snippet: when present it stands after the dash in the detail's place. */
  snippet?: string | null
  pinned?: boolean
  /** The three marks leading the one-line row; absent, the row goes without. */
  marks?: MarkState
  /** The row kebab's menu, in the house menu's parts (kebab-menu.tsx); none leaves the span alone. */
  menu?: React.ReactNode
}

/** Sixty rows to a read, sixty more on reaching the end — a bulk folder holds thousands. */
const PER_READ = 60

export function CardList({
  ids,
  card,
  selected,
  onOpen,
  onVisible,
  split,
  onSplit,
  query,
  onQuery,
  placeholder,
  menu,
  compact = false,
  onSearch,
  loading,
  error,
  empty,
}: {
  /** The items in reading order, already filtered — memoize it: a new array resets the paging. */
  ids: string[]
  card: (id: string) => Card
  selected: string | null
  onOpen: (id: string) => void
  /** Told the ids the list renders (its window), as the window changes — memoize it. */
  onVisible?: (ids: string[]) => void
  split: Split
  /** The kebab's split choice; absent where the list always folds beside an open item. */
  onSplit?: (split: Split) => void
  query: string
  onQuery: (q: string) => void
  placeholder: string
  /** The toolbar kebab's own items, after the split's. */
  menu?: React.ReactNode
  /** One bar: the search an icon until picked, the rail toggle in the kebab. */
  compact?: boolean
  /** The search lives elsewhere (America Thinks' open question carries it in
   *  its title row): the bar's empty run opens that one, and the bar shows no field. */
  onSearch?: () => void
  loading: boolean
  error: string | null
  /** What an empty list says. */
  empty: string
}) {
  const [depth, setDepth] = React.useState(PER_READ)
  React.useEffect(() => setDepth(PER_READ), [ids])
  const listed = ids.slice(0, depth)
  React.useEffect(() => onVisible?.(ids.slice(0, depth)), [ids, depth, onVisible])
  const more = React.useCallback(() => setDepth((d) => d + PER_READ), [])
  // Opening an item (a click, a chevron) brings its row into view in the
  // folded list: the window deepens to reach it, then the active row scrolls in.
  const rootRef = React.useRef<HTMLDivElement>(null)
  const idsRef = React.useRef(ids)
  idsRef.current = ids
  React.useEffect(() => {
    if (!selected) return
    const at = idsRef.current.indexOf(selected)
    if (at === -1) return
    setDepth((d) => (at >= d ? Math.ceil((at + 1) / PER_READ) * PER_READ : d))
    const t = window.setTimeout(() => rootRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" }), 50)
    return () => window.clearTimeout(t)
  }, [selected])
  // Gmail's own behavior: the one-line anatomy at full width, the stacked
  // anatomy when the list is folded beside an open item.
  const stacked = split === "vertical"

  // The chevrons walk the items: the one before and after the open one.
  const at = selected ? ids.indexOf(selected) : -1
  const prevId = at > 0 ? ids[at - 1] : null
  const nextId = at === -1 ? (ids[0] ?? null) : at < ids.length - 1 ? ids[at + 1] : null

  // The compact bar's search: an icon until picked, closing back to it.
  const [searching, setSearching] = React.useState(false)
  const closeSearch = () => {
    onQuery("")
    setSearching(false)
  }
  // The frame's rail toggle, carried here where the frame has no header row.
  const rail = React.useContext(BankRail)
  const railCtl = compact ? rail : null
  // The rail tone: rows in the rail's own dress, inset and rounded, the open one white and raised with the left bar.
  const railTone = React.useContext(BankTone) === "rail"

  const chevrons = (
    <>
      <Button variant="ghost" size="icon-sm" aria-label="Previous" disabled={!prevId} onClick={() => prevId && onOpen(prevId)}>
        <ChevronLeftIcon className="size-4" />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Next" disabled={!nextId} onClick={() => nextId && onOpen(nextId)}>
        <ChevronRightIcon className="size-4" />
      </Button>
    </>
  )
  const kebab = (onSplit || railCtl || menu) && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="More">
          <EllipsisVerticalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? "start" : "end"} className="w-max min-w-48">
        {onSplit && (
          <DropdownMenuRadioGroup value={split} onValueChange={(v) => onSplit(v as Split)}>
            <DropdownMenuRadioItem value="none">No split</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="vertical">Vertical split</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        )}
        {railCtl && (
          <>
            {onSplit && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={railCtl.toggle}>{railCtl.open ? "Hide sidebar" : "Show sidebar"}</DropdownMenuItem>
          </>
        )}
        {menu && (
          <>
            {(onSplit || railCtl) && <DropdownMenuSeparator />}
            {menu}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col">
      {compact ? (
        // A press on the bar's empty run opens the search; its buttons, and the kebab's menu (a portal), keep their own.
        <div
          className={cn("flex h-[52px] shrink-0 items-center gap-1 border-b px-3", !(searching || query) && "cursor-text")}
          onClick={(event) => {
            const target = event.target as HTMLElement
            if (event.currentTarget.contains(target) && !target.closest("button")) (onSearch ? onSearch() : setSearching(true))
          }}
        >
          {kebab}
          {/* The sidebar's own toggle where the search icon was (Brendan, 2026-10-29); the bar's empty run still opens the search. */}
          {railCtl && (
            <Button variant="ghost" size="icon-sm" aria-label={railCtl.open ? "Hide sidebar" : "Show sidebar"} title={railCtl.open ? "Hide sidebar" : "Show sidebar"} onClick={railCtl.toggle}>
              {railCtl.open ? <PanelLeftClose className="size-4" /> : <PanelLeftOpen className="size-4" />}
            </Button>
          )}
          {!onSearch && (searching || query) && (
            <div className="min-w-0 flex-1">
              {/* Focused when picked from the bar, not when the rail's search fills it. */}
              <SearchField query={query} onQuery={onQuery} placeholder={placeholder} autoFocus={searching} onClose={closeSearch} />
            </div>
          )}
          <div className="ml-auto flex items-center gap-1">{chevrons}</div>
        </div>
      ) : (
        <>
          <div className="flex h-[52px] shrink-0 items-center border-b px-3">
            <SearchField query={query} onQuery={onQuery} placeholder={placeholder} />
          </div>
          <div className="flex h-[52px] shrink-0 items-center gap-1 border-b px-3">
            <div className="ml-auto flex items-center gap-1">
              {chevrons}
              {kebab}
            </div>
          </div>
        </>
      )}

      <ScrollArea className="min-h-0 flex-1">
        {error && <p className="p-6 text-center text-sm text-pax2-red">The data did not load: {error}</p>}
        {!error && loading && <p className="p-6 text-center text-sm text-muted-foreground">Reading the index…</p>}
        {!error && !loading && ids.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">{empty}</p>}
        <ul className={railTone ? "flex flex-col gap-0.5 p-2" : "divide-y"}>
          {listed.map((id) => {
            const c = card(id)
            const active = selected === id
            const chip = c.chip && (
              <span
                className={cn(
                  "max-w-44 shrink-0 truncate rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  railTone ? "border-slate-200 bg-white/70 text-slate-500" : "bg-muted text-muted-foreground"
                )}
                title={c.chip}
              >
                {c.chip}
              </span>
            )
            const end = stacked ? (
              <RowEnd span={c.span ?? null} menu={c.menu} star={c.marks && { on: c.marks.pinned, onToggle: c.marks.onPin }} quiet={railTone} />
            ) : (
              <RowEnd chip={chip} span={c.span ?? null} menu={c.menu} strong={!railTone} quiet={railTone} />
            )
            // The rail's weights: the open row semibold, the rest medium.
            const weight = railTone && !active ? "font-medium" : "font-semibold"
            const title = (
              <span className={weight}>
                {c.pinned && <StarIcon aria-label="Pinned" className="mr-1.5 inline size-3.5 -translate-y-px fill-yellow-400 text-yellow-500" />}
                {c.title}
              </span>
            )
            const after = c.snippet ?? c.detail
            return (
              <li
                key={id}
                data-active={active}
                className={cn(
                  "group/row relative flex cursor-pointer gap-3 text-sm",
                  railTone
                    ? cn(
                        "rounded-xl px-3 transition-[color,background-color,box-shadow]",
                        active ? "bg-white text-pax2-blue shadow-e1" : "text-slate-600 hover:bg-white/70 hover:text-pax2-blue hover:shadow-e1"
                      )
                    : cn(
                        "px-4 transition-[background-color,box-shadow] hover:z-10 hover:bg-accent/60 hover:shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]",
                        active && "z-10 bg-muted shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]"
                      ),
                  stacked ? "py-2.5" : "h-10 items-center"
                )}
                onClick={() => onOpen(id)}
              >
                {railTone && active && <span aria-hidden className="absolute top-1/2 left-0 h-4 w-[3px] -translate-y-1/2 rounded-full bg-pax2-light-blue" />}
                {stacked ? (
                  <span className="flex min-w-0 flex-1 flex-col gap-4">
                    {title}
                    <span className="flex items-center gap-2">
                      {chip}
                      <span className="ml-auto flex shrink-0">{end}</span>
                    </span>
                  </span>
                ) : (
                  <>
                    {c.marks && (
                      // The marks act in place: their clicks never open the row.
                      <span className="flex shrink-0 items-center gap-2" onClick={(event) => event.stopPropagation()}>
                        <Marks {...c.marks} />
                      </span>
                    )}
                    <span className="flex min-w-0 flex-1 items-baseline">
                      <span className={cn("max-w-[68ch] min-w-0 truncate", weight)} title={c.hint}>
                        {!c.marks && c.pinned && <StarIcon aria-label="Pinned" className="mr-1.5 inline size-3.5 -translate-y-px fill-yellow-400 text-yellow-500" />}
                        {c.title}
                      </span>
                      {after && <span className="min-w-0 flex-1 truncate text-muted-foreground">&nbsp;- {after}</span>}
                    </span>
                    {end}
                  </>
                )}
              </li>
            )
          })}
        </ul>
        {depth < ids.length && <MoreMark onMore={more} />}
      </ScrollArea>
    </div>
  )
}

/** On hover, focus, or with its menu open, the row's controls show and what they cover hides. */
const COVERED = "group-hover/row:invisible group-has-focus-visible/row:invisible group-has-[[aria-expanded=true]]/row:invisible"
const SHOWN = "opacity-0 group-hover/row:opacity-100 group-has-focus-visible/row:opacity-100 group-has-[[aria-expanded=true]]/row:opacity-100"
/** The kebab, drawn as the ghost icon button it was. */
const KEBAB =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-lg outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-muted aria-expanded:text-foreground"

/** The row's right edge: the chip (one-line) and the span, and on hover the
 *  row's kebab over both, the folded card's star beside it. */
function RowEnd({
  chip,
  span,
  menu,
  star,
  strong = false,
  quiet = false,
}: {
  chip?: React.ReactNode
  span: string | null
  menu?: React.ReactNode
  star?: { on: boolean; onToggle: () => void }
  strong?: boolean
  /** The rail tone's count grey. */
  quiet?: boolean
}) {
  // The one-line row's span in the /inbox thread list's unread date weight.
  const tone = quiet ? "text-slate-400" : strong ? "font-semibold" : "text-muted-foreground"
  if (!menu)
    return (
      <>
        {chip}
        <span className={cn("shrink-0 text-xs tabular-nums", tone)}>{span}</span>
      </>
    )
  return (
    <span className="relative flex min-w-7 shrink-0 items-center justify-end gap-3">
      {chip && <span className={cn("flex", COVERED)}>{chip}</span>}
      <span className={cn("text-xs tabular-nums", tone, COVERED)}>{span}</span>
      <span className={cn("absolute top-1/2 right-0 flex -translate-y-1/2 items-center", SHOWN)}>
        {star && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-pressed={star.on}
            aria-label={star.on ? "Unfavorite" : "Favorite"}
            onClick={(event) => {
              event.stopPropagation()
              star.onToggle()
            }}
          >
            <StarIcon className={cn("size-4", star.on && "fill-yellow-400 text-yellow-500")} />
          </Button>
        )}
        <KebabMenu label="Actions" width="w-56" trigger={<EllipsisVerticalIcon className="size-4" />} triggerClassName={KEBAB}>
          {menu}
        </KebabMenu>
      </span>
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
