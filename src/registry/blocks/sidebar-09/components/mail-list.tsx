"use client"

import * as React from "react"
import { ChevronDown, ChevronLeftIcon, ChevronRightIcon, Clock, Columns2, EllipsisVertical, GripVertical, MailOpen, RotateCcw, RotateCw, Rows2, Square, Star, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { RailToggle } from "@/components/bank/bank-frame"
import { SearchField } from "@/components/bank/pane-bars"
import { ImportantIcon } from "@/components/bank/marks"
import { KebabMenu, MenuRow } from "@/components/kebab-menu"

// The Inbox's thread list, Gmail's own (Brendan, 2026-11-02: "literally a Google knock off"; his
// screenshots 93–96 and 103–104 in scratchpad/gmail-parity). Its colours are pax2.css's --mail-*,
// measured off those screenshots:
//
//   unread    white; sender, subject and time bold near-black; snippet grey; the box left, the star
//             right of the snippet line. Bold on white is the unread signal: no bar, no tint.
//   read      Gmail's blue-grey wash; regular weight throughout.
//   hover     the row keeps its own ground (white if unread, the wash if read) and lifts: Gmail's
//             shadow with its 1px edges. The time gives way to archive, delete, mark read (unread
//             rows) or mark unread (read rows), and snooze; the drag grip shows left of the box.
//   picked    the pale selected blue over the whole row, for a checked row and for the row open in
//             a split; it holds through hover, and the weight still follows read or unread.
//
// One line at full width and under a horizontal split, Gmail's: grip, box, star, importance,
// sender, the subject and the snippet after a dash, the time. Stacked beside a vertical split, as
// 93 has it: the box, the importance arrow, the sender and the time; the subject; the snippet with
// the star. The bar above is Gmail's: the select box and its menu, then refresh and the kebab, or,
// with rows checked, what can be done to them; the chevrons at the right.

export type MailRowView = {
  id: string
  /** Who, as Gmail's list says it: "Pax", "Pax, me", "To: Pollster". */
  sender: string
  /** The thread's message count, shown past one. */
  count?: number
  subject: string
  snippet: string
  /** The right edge: the time, or a snooze's. */
  span: string
  unread: boolean
  starred: boolean
  important: boolean
  /** Out of the Inbox by hand: Move to Inbox stands in Archive's place. */
  archived?: boolean
  /** In Trash: Restore stands in Delete's place. */
  trashed?: boolean
  /** Snoozed: its snooze menu can unsnooze it. */
  snoozed?: boolean
  /** One of this browser's drafts: it can only be opened or discarded. */
  draft?: boolean
}

export type MailActions = {
  onOpen: (id: string) => void
  onCheck: (id: string) => void
  onStar: (id: string) => void
  onImportant: (id: string) => void
  onArchive: (id: string) => void
  onTrash: (id: string) => void
  onRead: (id: string, read: boolean) => void
  /** Present, the clock shows: the snooze menu opens from its button. */
  snooze?: (id: string, trigger: React.ReactNode) => React.ReactNode
  onDragStart?: (id: string, event: React.DragEvent<HTMLLIElement>) => void
}

export type Layout = "line" | "stacked"

/** Gmail's reading pane: none (the list, or the open message in its place), beside the list, or under it. */
export type Split = "none" | "vertical" | "horizontal"

const SPLITS: { split: Split; label: string; icon: typeof Square }[] = [
  { split: "none", label: "No split", icon: Square },
  { split: "vertical", label: "Vertical split", icon: Columns2 },
  { split: "horizontal", label: "Horizontal split", icon: Rows2 },
]

/** Gmail's split toggle: the mode's own icon and its caret, opening the three. */
export function SplitToggle({ split, onSplit }: { split: Split; onSplit: (split: Split) => void }) {
  const Icon = SPLITS.find((s) => s.split === split)!.icon
  return (
    <KebabMenu
      label="Split pane mode"
      width="w-48"
      trigger={
        <>
          <Icon className="size-[18px]" />
          <ChevronDown className="size-3" />
        </>
      }
      triggerClassName="flex h-8 shrink-0 items-center gap-0.5 rounded-full px-2 text-(--mail-icon) transition-colors hover:bg-(--mail-ink)/8 aria-expanded:bg-(--mail-ink)/8"
    >
      {SPLITS.map((s) => (
        <MenuRow key={s.split} icon={<s.icon />} label={s.label} checked={split === s.split} onClick={() => onSplit(s.split)} />
      ))}
    </KebabMenu>
  )
}

/** Gmail's row colours and type, by state. Exported for the tests. */
export function rowClass({ unread, picked, layout }: { unread: boolean; picked: boolean; layout: Layout }) {
  return cn(
    "group/mail relative flex cursor-pointer border-b border-(--mail-rule) text-sm text-(--mail-ink)",
    // Its own ground through hover; the lift is the shadow alone.
    picked ? "bg-(--mail-picked)" : unread ? "bg-(--mail-unread)" : "bg-(--mail-read)",
    "hover:z-10 hover:[box-shadow:var(--mail-lift)]",
    layout === "line" ? "h-10 items-center gap-3 pr-4 pl-7" : "flex-col gap-0.5 py-2.5 pr-4 pl-7"
  )
}

/** Gmail's archive: a box with the arrow down into it. */
export function ArchiveIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <rect x="3" y="3.5" width="18" height="4.5" rx="1" />
      <path d="M5 8v11a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8" />
      <path d="M12 11v6" />
      <path d="m9 14 3 3 3-3" />
    </svg>
  )
}

/** Gmail's Move to Inbox: the box with the arrow up out of it. */
export function UnarchiveIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <rect x="3" y="3.5" width="18" height="4.5" rx="1" />
      <path d="M5 8v11a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8" />
      <path d="M12 17v-6" />
      <path d="m9 14 3-3 3 3" />
    </svg>
  )
}

/** Gmail's mark as unread: the envelope with the dot at its corner. */
export function MarkUnreadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <path d="M14.5 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-7.5" />
      <path d="m2 8 8.97 5.7a1.94 1.94 0 0 0 2.06 0L17.5 10.8" />
      <circle cx="19.5" cy="5.5" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Gmail's square box: outlined at rest, filled when checked. */
function Box({ checked, label, onToggle }: { checked: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      className={cn(
        "relative flex size-[18px] shrink-0 items-center justify-center rounded-[2px] border-2 transition-colors after:absolute after:-inset-2.5",
        checked ? "border-(--mail-icon) bg-(--mail-icon) text-(--mail-unread)" : "border-(--mail-rest) group-hover/mail:border-(--mail-icon)"
      )}
    >
      {checked && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5} aria-hidden className="size-3.5">
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      )}
    </button>
  )
}

const ICON_BUTTON = "flex size-8 shrink-0 items-center justify-center rounded-full text-(--mail-icon) transition-colors hover:bg-(--mail-ink)/8"

/** One of the hover row's icon buttons. */
function Act({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={ICON_BUTTON}
    >
      {children}
    </button>
  )
}

function StarMark({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "Starred" : "Not starred"}
      title={on ? "Starred" : "Not starred"}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      className="relative shrink-0 after:absolute after:-inset-2"
    >
      <Star className={cn("size-[18px]", on ? "fill-[#f4b400] text-[#f4b400]" : "text-(--mail-rest) group-hover/mail:text-(--mail-icon)")} strokeWidth={1.75} />
    </button>
  )
}

function ImportantMark({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const label = on ? "Important" : "Not important"
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      className="relative shrink-0 after:absolute after:-inset-2"
    >
      <ImportantIcon className={cn("size-5", on ? "fill-[#f4b400] text-[#f4b400]" : "fill-transparent text-(--mail-rest) group-hover/mail:text-(--mail-icon)")} />
    </button>
  )
}

/** The hover row's four, in Gmail's order: archive, delete, mark read or unread, snooze. */
function HoverActions({ row, actions }: { row: MailRowView; actions: MailActions }) {
  if (row.draft)
    return (
      <Act label="Discard draft" onClick={() => actions.onTrash(row.id)}>
        <Trash2 className="size-[18px]" />
      </Act>
    )
  return (
    <>
      {!row.trashed &&
        (row.archived ? (
          <Act label="Move to Inbox" onClick={() => actions.onArchive(row.id)}>
            <UnarchiveIcon className="size-[18px]" />
          </Act>
        ) : (
          <Act label="Archive" onClick={() => actions.onArchive(row.id)}>
            <ArchiveIcon className="size-[18px]" />
          </Act>
        ))}
      <Act label={row.trashed ? "Restore" : "Delete"} onClick={() => actions.onTrash(row.id)}>
        {row.trashed ? <RotateCcw className="size-[18px]" /> : <Trash2 className="size-[18px]" />}
      </Act>
      {row.unread ? (
        <Act label="Mark as read" onClick={() => actions.onRead(row.id, true)}>
          <MailOpen className="size-[18px]" />
        </Act>
      ) : (
        <Act label="Mark as unread" onClick={() => actions.onRead(row.id, false)}>
          <MarkUnreadIcon className="size-[18px]" />
        </Act>
      )}
      {actions.snooze &&
        !row.trashed &&
        actions.snooze(
          row.id,
          <span className={ICON_BUTTON} title="Snooze">
            <Clock className="size-[18px]" />
          </span>
        )}
    </>
  )
}

/** The right edge: the time, and on hover (or with the snooze menu open) the four in its place. Both stand
 *  in the row's flow, each shown or gone, never laid over the text: the icons take their own ground at
 *  the row's end, as Gmail's do, and the snippet's ellipsis lands before them at any width (Brendan,
 *  2026-11-02, 119 against 120). */
function RowEnd({ row, actions }: { row: MailRowView; actions: MailActions }) {
  return (
    <>
      <span data-row-time className={cn("shrink-0 text-xs tabular-nums group-hover/mail:hidden group-has-[[aria-expanded=true]]/mail:hidden", row.unread ? "font-bold text-(--mail-ink)" : "text-(--mail-ink-2)")}>{row.span}</span>
      <span data-hover-actions className="hidden shrink-0 items-center gap-2 group-hover/mail:flex group-has-[[aria-expanded=true]]/mail:flex">
        <HoverActions row={row} actions={actions} />
      </span>
    </>
  )
}

function MailRow({ row, checked, open, layout, actions }: { row: MailRowView; checked: boolean; open: boolean; layout: Layout; actions: MailActions }) {
  const picked = checked || open
  const weight = row.unread ? "font-bold" : "font-normal"
  const grip = (
    <span aria-hidden className={cn("absolute left-1.5 hidden text-(--mail-grip) group-hover/mail:block", layout === "line" ? "top-1/2 -translate-y-1/2" : "top-3")}>
      <GripVertical className="size-4" />
    </span>
  )
  const box = <Box checked={checked} label={`Select ${row.subject}`} onToggle={() => actions.onCheck(row.id)} />
  const sender = (
    <span className={cn("min-w-0 truncate", weight)}>
      {row.sender}
      {row.count && row.count > 1 ? <span className="ml-1 text-xs font-normal text-(--mail-ink-2)">{row.count}</span> : null}
    </span>
  )
  return (
    <li
      data-state={row.unread ? "unread" : "read"}
      data-picked={picked || undefined}
      data-open={open || undefined}
      data-active={open}
      draggable={actions.onDragStart ? true : undefined}
      onDragStart={actions.onDragStart && ((event) => actions.onDragStart!(row.id, event))}
      onClick={() => actions.onOpen(row.id)}
      className={rowClass({ unread: row.unread, picked, layout })}
    >
      {grip}
      {layout === "line" ? (
        <>
          <span className="flex shrink-0 items-center gap-3">
            {box}
            {!row.draft && <StarMark on={row.starred} onToggle={() => actions.onStar(row.id)} />}
            {!row.draft && <ImportantMark on={row.important} onToggle={() => actions.onImportant(row.id)} />}
          </span>
          <span className="flex w-[168px] shrink-0">{sender}</span>
          {/* The snippet gives way first (its basis is nothing), then the subject truncates; the box clips at its own edge. */}
          <span data-row-text className="flex min-w-0 flex-1 items-baseline overflow-hidden">
            <span className={cn("max-w-[68ch] min-w-0 truncate", weight)} title={row.subject}>
              {row.subject}
            </span>
            {row.snippet && <span className="min-w-0 flex-1 truncate text-(--mail-ink-2)">&nbsp;-&nbsp;{row.snippet}</span>}
          </span>
          <RowEnd row={row} actions={actions} />
        </>
      ) : (
        <>
          <span className="flex h-6 min-w-0 items-center gap-3">
            {box}
            {!row.draft && <ImportantMark on={row.important} onToggle={() => actions.onImportant(row.id)} />}
            <span data-row-text className="flex min-w-0 flex-1 overflow-hidden">{sender}</span>
            <RowEnd row={row} actions={actions} />
          </span>
          <span className={cn("truncate pl-[30px]", weight)} title={row.subject}>
            {row.subject}
          </span>
          <span className="flex min-w-0 items-center gap-3 pl-[30px]">
            <span className="min-w-0 flex-1 truncate text-(--mail-ink-2)">{row.snippet}</span>
            {!row.draft && <StarMark on={row.starred} onToggle={() => actions.onStar(row.id)} />}
          </span>
        </>
      )}
    </li>
  )
}

/** The select box's menu, Gmail's: select by state. */
export type SelectBy = "all" | "none" | "read" | "unread" | "starred" | "unstarred"

export function MailList({
  rows,
  open,
  checked,
  layout,
  actions,
  onSelect,
  onBulk,
  onRefresh,
  menu,
  query,
  onQuery,
  loading,
  error,
  empty,
  bulkSnooze,
  split,
  onSplit,
}: {
  rows: MailRowView[]
  /** The thread open beside the list, picked in its blue. */
  open: string | null
  checked: Set<string>
  layout: Layout
  actions: MailActions
  onSelect: (by: SelectBy) => void
  /** What the bar does to the checked rows. */
  onBulk: (act: "archive" | "trash" | "read" | "unread") => void
  onRefresh: () => void
  /** The kebab's rows, in the house menu's parts. */
  menu?: React.ReactNode
  query: string
  onQuery: (q: string) => void
  loading: boolean
  error: string | null
  empty: string
  /** The bar's snooze for the checked rows, when snoozing is on. */
  bulkSnooze?: (trigger: React.ReactNode) => React.ReactNode
  /** The reading pane's mode, toggled at the bar's right end. */
  split: Split
  onSplit: (split: Split) => void
}) {
  const [searching, setSearching] = React.useState(false)
  const any = checked.size > 0
  const every = rows.length > 0 && rows.every((r) => checked.has(r.id))
  const anyUnread = rows.some((r) => checked.has(r.id) && r.unread)
  const at = open ? rows.findIndex((r) => r.id === open) : -1
  const prev = at > 0 ? rows[at - 1] : null
  const next = at !== -1 && at < rows.length - 1 ? rows[at + 1] : null
  return (
    <div className="relative flex h-full min-h-0 flex-col bg-(--mail-unread)">
      {/* A press on the bar's empty run opens the search; its buttons and menus keep their own. */}
      <div
        className={cn("flex h-[52px] shrink-0 items-center gap-1 border-b px-3", !(searching || query) && "cursor-text")}
        onClick={(event) => {
          const target = event.target as HTMLElement
          if (!target.closest("button")) setSearching(true)
        }}
      >
        <RailToggle />
        <span className="flex items-center rounded-md px-1 hover:bg-(--mail-ink)/8">
          <Box checked={every} label={every ? "Select none" : "Select all"} onToggle={() => onSelect(every || any ? "none" : "all")} />
          <KebabMenu label="Select" align="left" width="w-40" trigger={<ChevronDown className="size-3.5" />} triggerClassName="flex h-8 w-5 items-center justify-center text-(--mail-icon)">
            <MenuRow label="All" onClick={() => onSelect("all")} />
            <MenuRow label="None" onClick={() => onSelect("none")} />
            <MenuRow label="Read" onClick={() => onSelect("read")} />
            <MenuRow label="Unread" onClick={() => onSelect("unread")} />
            <MenuRow label="Starred" onClick={() => onSelect("starred")} />
            <MenuRow label="Unstarred" onClick={() => onSelect("unstarred")} />
          </KebabMenu>
        </span>
        {any ? (
          <span className="flex items-center gap-1" data-bulk>
            <Act label="Archive" onClick={() => onBulk("archive")}>
              <ArchiveIcon className="size-[18px]" />
            </Act>
            <Act label="Delete" onClick={() => onBulk("trash")}>
              <Trash2 className="size-[18px]" />
            </Act>
            {anyUnread ? (
              <Act label="Mark as read" onClick={() => onBulk("read")}>
                <MailOpen className="size-[18px]" />
              </Act>
            ) : (
              <Act label="Mark as unread" onClick={() => onBulk("unread")}>
                <MarkUnreadIcon className="size-[18px]" />
              </Act>
            )}
            {bulkSnooze?.(
              <span className={ICON_BUTTON} title="Snooze">
                <Clock className="size-[18px]" />
              </span>
            )}
          </span>
        ) : (
          <Act label="Refresh" onClick={onRefresh}>
            <RotateCw className="size-[18px]" />
          </Act>
        )}
        {menu && (
          <KebabMenu label="More" align="left" width="w-56" trigger={<EllipsisVertical className="size-[18px]" />} triggerClassName={ICON_BUTTON}>
            {menu}
          </KebabMenu>
        )}
        {(searching || query) && (
          <div className="min-w-0 flex-1">
            <SearchField
              query={query}
              onQuery={onQuery}
              placeholder="Search mail"
              autoFocus={searching}
              onClose={() => {
                onQuery("")
                setSearching(false)
              }}
            />
          </div>
        )}
        <div className="ml-auto flex items-center gap-1">
          <Act label="Newer" onClick={() => prev && actions.onOpen(prev.id)}>
            <ChevronLeftIcon className={cn("size-[18px]", !prev && "opacity-40")} />
          </Act>
          <Act label="Older" onClick={() => next && actions.onOpen(next.id)}>
            <ChevronRightIcon className={cn("size-[18px]", !next && "opacity-40")} />
          </Act>
          <SplitToggle split={split} onSplit={onSplit} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && <p className="p-6 text-center text-sm text-pax2-red">{error}</p>}
        {!error && loading && !rows.length && <p className="p-6 text-center text-sm text-(--mail-ink-2)">Loading</p>}
        {!error && !loading && !rows.length && <p className="p-6 text-center text-sm text-(--mail-ink-2)">{empty}</p>}
        <ul>
          {rows.map((row) => (
            <MailRow key={row.id} row={row} checked={checked.has(row.id)} open={open === row.id} layout={layout} actions={actions} />
          ))}
        </ul>
      </div>
    </div>
  )
}

