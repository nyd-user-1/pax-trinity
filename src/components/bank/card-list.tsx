"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon, EllipsisVerticalIcon, PanelRightIcon, RowsIcon, StarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"
import { ScrollArea } from "@govblock/ui/components/ny4/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/ny4/tooltip"

import { SearchField } from "./pane-bars"

// The middle list in Gmail's anatomy, as Brendan restyled it by hand
// (2026-10-27, docs/wireframes/inbox-row-changes.png): no grip, box, star or
// importance arrow leading the row — 16px either side and the words start.
// Full width, one line: the title in bold truncating at whatever width the
// row has, the detail after Gmail's dash, the chip and the tag, the span at
// the right edge where the time sits. Folded beside an open item, the card:
// the title, then the one chip and the span under it at a 16px gap. The
// row's kebab takes the span's place on hover, Gmail's own swap. Two 52px
// bars on top — the search, then the split toggle, the chevrons and the
// list's menu — flush with the pane's two beside them.

export type Split = "none" | "vertical"

export type CardAction = { label: string; onSelect: () => void; disabled?: boolean }

export type Card = {
  /** The bold line: the question's wording, the metric's name. */
  title: React.ReactNode
  /** The full text behind a truncated one-line title. */
  hint?: string
  /** The card's one chip — on /audience the topic. */
  chip?: string | null
  /** The one-line row's second chip, before the span. */
  tag?: string | null
  /** The right edge, where the time sits. */
  span?: string | null
  /** The one-line row's grey text after the dash. */
  detail?: string | null
  pinned?: boolean
  /** The row kebab's items; none leaves the span alone. */
  actions?: CardAction[]
}

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

export function CardList({
  ids,
  card,
  selected,
  onOpen,
  split,
  onSplit,
  query,
  onQuery,
  placeholder,
  menu,
  loading,
  error,
  empty,
}: {
  /** The items in reading order, already filtered — memoize it: a new array resets the paging. */
  ids: string[]
  card: (id: string) => Card
  selected: string | null
  onOpen: (id: string) => void
  split: Split
  /** The split toggle; absent where the list always folds beside an open item. */
  onSplit?: (split: Split) => void
  query: string
  onQuery: (q: string) => void
  placeholder: string
  /** The toolbar kebab's contents; absent, no kebab. */
  menu?: React.ReactNode
  loading: boolean
  error: string | null
  /** What an empty list says. */
  empty: string
}) {
  const [depth, setDepth] = React.useState(PER_READ)
  React.useEffect(() => setDepth(PER_READ), [ids])
  const listed = ids.slice(0, depth)
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

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col">
      <div className="flex h-[52px] shrink-0 items-center border-b px-3">
        <SearchField query={query} onQuery={onQuery} placeholder={placeholder} />
      </div>
      <div className="flex h-[52px] shrink-0 items-center gap-1 border-b px-3">
        {onSplit && (
          <Tip label={stacked ? "Turn off the vertical split" : "Vertical split"}>
            <Button variant="ghost" size="icon-sm" aria-label="Toggle vertical split" aria-pressed={stacked} onClick={() => onSplit(stacked ? "none" : "vertical")}>
              {stacked ? <PanelRightIcon className="size-4" /> : <RowsIcon className="size-4" />}
            </Button>
          </Tip>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Previous" disabled={!prevId} onClick={() => prevId && onOpen(prevId)}>
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Next" disabled={!nextId} onClick={() => nextId && onOpen(nextId)}>
            <ChevronRightIcon className="size-4" />
          </Button>
          {menu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="More">
                  <EllipsisVerticalIcon className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-max min-w-48">
                {menu}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {error && <p className="p-6 text-center text-sm text-pax2-red">The data did not load: {error}</p>}
        {!error && loading && <p className="p-6 text-center text-sm text-muted-foreground">Reading the index…</p>}
        {!error && !loading && ids.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">{empty}</p>}
        <ul className="divide-y">
          {listed.map((id) => {
            const c = card(id)
            const active = selected === id
            const chip = c.chip && (
              <span className="max-w-44 shrink-0 truncate rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground" title={c.chip}>
                {c.chip}
              </span>
            )
            const end = <RowEnd span={c.span ?? null} actions={c.actions} />
            const title = (
              <span className="font-semibold">
                {c.pinned && <StarIcon aria-label="Pinned" className="mr-1.5 inline size-3.5 -translate-y-px fill-yellow-400 text-yellow-500" />}
                {c.title}
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
                    {title}
                    <span className="flex items-center gap-2">
                      {chip}
                      <span className="ml-auto flex shrink-0">{end}</span>
                    </span>
                  </span>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate" title={c.hint}>
                      {title}
                      {c.detail && <span className="text-muted-foreground"> - {c.detail}</span>}
                    </span>
                    {chip}
                    {c.tag && (
                      <span className="max-w-40 shrink-0 truncate rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wider text-muted-foreground" title={c.tag}>
                        {c.tag}
                      </span>
                    )}
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

/** The row's right edge: the span, and on hover the row's kebab in its place. */
function RowEnd({ span, actions }: { span: string | null; actions?: CardAction[] }) {
  const [open, setOpen] = React.useState(false)
  if (!actions?.length) return <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{span}</span>
  return (
    <span className="relative flex min-w-7 shrink-0 items-center justify-end">
      <span className={cn("text-xs text-muted-foreground tabular-nums group-hover/row:invisible group-has-focus-visible/row:invisible", open && "invisible")}>{span}</span>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Actions"
            onClick={(event) => event.stopPropagation()}
            className={cn("absolute top-1/2 right-0 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100", open && "opacity-100")}
          >
            <EllipsisVerticalIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        {/* The menu portals out, but React bubbles its clicks to the row: stop them here. */}
        <DropdownMenuContent align="end" className="w-max min-w-44" onClick={(event) => event.stopPropagation()}>
          {actions.map((a) => (
            <DropdownMenuItem key={a.label} disabled={a.disabled} onClick={a.onSelect}>
              {a.label}
            </DropdownMenuItem>
          ))}
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
