"use client"

import * as React from "react"
import { Combobox } from "@base-ui/react/combobox"
import { Trash2Icon, X } from "lucide-react"

import { ADDRESS_GROUPS, addressFor, nameOf, type Address } from "@/lib/agents/inbox"
import { cn } from "@/lib/utils"
import { DEFAULT_REPORT_TYPE, REPORT_TYPES } from "@/lib/agents/report-modes"
import { Button } from "@govblock/ui/components/nova/button"
import { Input } from "@govblock/ui/components/ny4/input"
import {
  TaskSurface,
  TaskToolbar,
  useTaskEditor,
} from "@/registry/blocks/sidebar-09/components/rich-body"

// Compose. The recipient fields are the agent picker, because "who do I send
// this to" is a question mail already answers well and a row of buttons is a
// worse version of it. A chosen agent becomes a chip; typing filters the rest
// by name, address or speciality.
//
// Cc means what it means: every agent on the line runs the task and replies on
// the thread. Bcc is the same run whose recipient line the thread does not
// show. The bottom bar says nothing about models or runs (Brendan,
// 2026-09-07: "remove this 'One run on Claude'"): mail does not tell you what
// the other end will do with your message, and the thread's header carries the
// bill once there is one.

export type Draft = { to: string[]; cc: string[]; bcc: string[]; subject: string; body: string; reportType?: string; from?: string }

// The report the Clerk should write. Picked from the subject line; absent means
// the default, a Traditional Report (Brendan, 2026-09-08). The list and what
// each name instructs the agent to do live together in lib/agents/report-modes,
// so adding a format is one file and the composer picks it up.
export { REPORT_TYPES, DEFAULT_REPORT_TYPE }

export const EMPTY_DRAFT: Draft = { to: [], cc: [], bcc: [], subject: "", body: "" }

type Line = "to" | "cc" | "bcc"

/** Distinct background colours for each agent's monogram dot, matching the thread view. */
const AGENT_COLORS: Record<string, string> = {
  "bill-reader":          "bg-[#4285F4] text-white",
  "jurisdiction-guide":   "bg-[#EA4335] text-white",
  "money-follower":       "bg-[#FBBC05] text-white",
  "tracker":              "bg-[#34A853] text-white",
  "researcher":           "bg-[#9C27B0] text-white",
  "reporter":             "bg-[#FF6D00] text-white",
  "strategist":           "bg-[#00897B] text-white",
  "producer":             "bg-[#5C6BC0] text-white",
  "assistant":            "bg-[#F4511E] text-white",
}

/** A recipient's face: a staff photo, a partner's channel art, a channel's logo, or an agent's monogram. */
export function Face({ address, className = "size-8" }: { address: Address; className?: string }) {
  if (address.image)
    return <img src={address.image} alt="" className={cn("shrink-0 rounded-full bg-surface", address.kind === "channel" ? "object-contain p-1 ring-1 ring-border" : "object-cover", className)} />
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full text-[10px] font-medium", AGENT_COLORS[address.agent] ?? (address.kind === "group" ? "bg-pax2-lavender text-pax2-blue" : "bg-muted text-foreground"), className)}>
      {address.monogram}
    </span>
  )
}

const unknown = (handle: string): Address => ({ agent: handle, name: nameOf(handle), email: handle, monogram: handle.slice(0, 2).toUpperCase(), speciality: "", kind: "person" })
const plain = (a: Address) => a.kind === "channel" || a.kind === "group"
const shown = (a: Address) => (plain(a) ? a.email : `<${a.email}>`)

/** Gmail's matching: the start of a name's word or of the address; what an agent does once the query is a word long. */
const matchesQuery = (a: Address, query: string) => {
  const q = query.trim().toLowerCase().replace(/^@/, "")
  if (!q) return true
  const words = a.name.toLowerCase().split(/\s+/)
  return words.some((w) => w.startsWith(q)) || a.name.toLowerCase().startsWith(q) || a.email.toLowerCase().replace(/^@/, "").startsWith(q) || (q.length >= 4 && a.speciality.toLowerCase().includes(q))
}

// A recipient line is a combobox (Brendan, 2026-10-29): the chosen are chips in
// the field, typing narrows the list, arrow keys and Enter (or a click) add one,
// Backspace in an empty field takes the last back off. The list is grouped:
// the agents, the staff, the partners, the channels.
function Recipients({
  line,
  label,
  chips,
  onChange,
  trailing,
}: {
  line: Line
  label: string
  chips: string[]
  onChange: (next: string[]) => void
  trailing?: React.ReactNode
}) {
  const id = `task-${line}`
  const anchor = React.useRef<HTMLDivElement>(null)
  const [open, setOpen] = React.useState(false)
  const chosen = chips.map((handle) => addressFor(handle) ?? unknown(handle))
  return (
    <Combobox.Root
      items={ADDRESS_GROUPS}
      multiple
      autoHighlight
      open={open}
      onOpenChange={setOpen}
      value={chosen}
      onValueChange={(next) => onChange((next as Address[]).map((a) => a.agent))}
      itemToStringLabel={(a: Address) => a.name}
      isItemEqualToValue={(a: Address, b: Address) => a.agent === b.agent}
      filter={matchesQuery}
    >
      <div className="flex w-full items-center gap-3 border-b pb-2">
        <label htmlFor={id} className="w-12 shrink-0 text-sm text-muted-foreground">
          {label}
        </label>
        <Combobox.Chips ref={anchor} className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <Combobox.Value>
            {(value: Address[]) => (
              <>
                {value.map((a) => (
                  <Combobox.Chip key={a.agent} aria-label={a.name} title={plain(a) ? `${a.name} · ${a.email}` : `${a.name} <${a.email}>`} className="flex items-center gap-1.5 rounded-full bg-muted py-0.5 pr-1 pl-0.5 text-sm outline-none data-[highlighted]:ring-2 data-[highlighted]:ring-ring/50">
                    <Face address={a} className="size-5" />
                    {a.name}
                    <Combobox.ChipRemove aria-label={`Remove ${a.name}`} className="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground">
                      <X className="size-3" />
                    </Combobox.ChipRemove>
                  </Combobox.Chip>
                ))}
                {/* No mail-ish token in the id or name, so Chrome keeps its own address autofill off a list this page owns. */}
                <Combobox.Input
                  id={id}
                  name={id}
                  autoComplete="off"
                  spellCheck={false}
                  // Escape closes the list; with the list already shut, Base UI would clear every chip, which mail never does.
                  onKeyDown={(event) => {
                    if (event.key === "Escape" && !open) (event as unknown as { preventBaseUIHandler?: () => void }).preventBaseUIHandler?.()
                  }}
                  className="h-7 min-w-16 flex-1 bg-transparent text-sm outline-none"
                />
              </>
            )}
          </Combobox.Value>
        </Combobox.Chips>
        {trailing}
      </div>
      <Combobox.Portal>
        <Combobox.Positioner anchor={anchor} align="start" sideOffset={6} className="z-[70]">
          <Combobox.Popup className="max-h-[min(26rem,var(--available-height))] w-[var(--anchor-width)] min-w-80 overflow-y-auto rounded-lg border bg-popover py-1 text-popover-foreground shadow-md">
            <Combobox.Empty className="px-3 py-2 text-sm text-muted-foreground empty:hidden">Nobody matching.</Combobox.Empty>
            <Combobox.List>
              {(group: { value: string; items: Address[] }) => (
                <Combobox.Group key={group.value} items={group.items} className="py-1">
                  <Combobox.GroupLabel className="px-3 pt-1 pb-1.5 text-xs font-medium text-muted-foreground">{group.value}</Combobox.GroupLabel>
                  <Combobox.Collection>
                    {(a: Address) => (
                      <Combobox.Item key={a.agent} value={a} className="flex cursor-default items-center gap-3 px-3 py-1.5 outline-none select-none data-[highlighted]:bg-accent">
                        <Face address={a} />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-sm">
                            {a.name} <span className="text-muted-foreground">{shown(a)}</span>
                          </span>
                          {a.speciality && <span className="truncate text-xs text-muted-foreground">{a.speciality}</span>}
                        </span>
                      </Combobox.Item>
                    )}
                  </Combobox.Collection>
                </Combobox.Group>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}

export function Compose({
  draft,
  onChange,
  onSend,
  onDiscard,
  onSaveDraft,
  inline = false,
  reply = false,
  placeholder,
}: {
  draft: Draft
  onChange: (draft: Draft) => void
  onSend: (draft: Draft) => void
  onDiscard: () => void
  onSaveDraft?: () => void
  /** A reply at the bottom of a thread: compact body, no subject line. */
  inline?: boolean
  /** Gmail's reply with the recipient row opened: the To/Cc/Bcc lines show and edit, the subject stays implied. */
  reply?: boolean
  /** What the empty surface says; a reply says Reply…, a new message nothing. */
  placeholder?: string
}) {
  const [showCc, setShowCc] = React.useState(false)
  const [showBcc, setShowBcc] = React.useState(false)
  const everyone = [...draft.to, ...draft.cc, ...draft.bcc]

  const editor = useTaskEditor({
    value: draft.body,
    onChange: (body) => onChange({ ...draft, body }),
    placeholder: placeholder ?? (inline ? "Reply…" : ""),
  })

  return (
    <form
      className="flex min-h-0 w-full flex-1 flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (everyone.length && draft.body.trim()) onSend(draft)
      }}
    >
      {draft.from && !inline && (
        <div className="flex w-full items-center gap-3 border-b pb-2">
          <span className="w-12 shrink-0 text-sm text-muted-foreground">From</span>
          {(() => {
            const sender = addressFor(draft.from) ?? unknown(draft.from)
            return (
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <Face address={sender} className="size-5" />
                <span className="truncate">
                  {sender.name} <span className="text-muted-foreground">{shown(sender)}</span>
                </span>
              </span>
            )
          })()}
        </div>
      )}
      {(!inline || reply) && (
        <>
          <Recipients
            line="to"
            label="To"
            chips={draft.to}
            onChange={(to) => onChange({ ...draft, to })}
            trailing={
              <div className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                {!showCc && (
                  <button type="button" className="hover:text-foreground" onClick={() => setShowCc(true)}>
                    Cc
                  </button>
                )}
                {!showBcc && (
                  <button type="button" className="hover:text-foreground" onClick={() => setShowBcc(true)}>
                    Bcc
                  </button>
                )}
              </div>
            }
          />
          {showCc && (
            <Recipients
              line="cc"
              label="Cc"
              chips={draft.cc}
              onChange={(cc) => onChange({ ...draft, cc })}
            />
          )}
          {showBcc && (
            <Recipients
              line="bcc"
              label="Bcc"
              chips={draft.bcc}
              onChange={(bcc) => onChange({ ...draft, bcc })}
            />
          )}
        </>
      )}
      {!inline && (
        <>
          <div className="flex w-full items-center gap-3 border-b pb-2">
            <label htmlFor="task-subject" className="w-12 shrink-0 text-sm text-muted-foreground">
              Subject
            </label>
            <Input
              id="task-subject"
              name="task-subject"
              autoComplete="off"
              value={draft.subject}
              onChange={(event) => onChange({ ...draft, subject: event.target.value })}
              className="min-w-0 flex-1 border-0 shadow-none focus-visible:ring-0"
            />
          </div>
        </>
      )}

      {/* A clean writing surface with nothing above it. The body is markdown
          on the wire and formatting on the screen — the agent reads `**bold**`
          and `- item`, the reader sees bold and a bullet, and the thread
          renders the same subset back. */}
      <TaskSurface
        editor={editor}
        // A new task's surface takes the height the pane has, so the bottom
        // bar sits at the bottom of the frame — Gmail's compose — and a long
        // brief scrolls inside the surface rather than pushing Send away.
        className={inline ? "[&_.ProseMirror]:min-h-24 min-h-24" : "min-h-0 flex-1 overflow-y-auto"}
      />

      {/* The bottom bar, in Gmail's arrangement: Send first, the formatting
          row immediately beside it, and the rest pushed right. Formatting
          belongs down here with the action, not on top of the page someone is
          trying to write on. */}
      <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3">
        <Button type="submit" size="sm" disabled={!everyone.length || !draft.body.trim()}>
          Send
        </Button>
        <TaskToolbar editor={editor} />
        {onSaveDraft && (
          <Button type="button" variant="ghost" size="sm" onClick={onSaveDraft}>
            Save draft
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" aria-label={inline ? "Discard the reply" : "Discard"} className="ml-auto" onClick={onDiscard}>
          <Trash2Icon className="size-4" />
        </Button>
      </div>
    </form>
  )
}
