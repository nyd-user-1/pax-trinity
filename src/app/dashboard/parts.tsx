"use client"

import * as React from "react"
import { ChartLine, ChevronDown, ExternalLink, FileText, Film, FlaskConical, ListChecks, Plus } from "lucide-react"

import { Avatar, Badge, FIELD, SMALL, SMALL_PRIMARY } from "@/components/settings/blocks"
import { HEALTH_LABEL, isOverdue, KIND_LABEL, KINDS, STAGE_LABEL, STAGES, daysBetween, type Health, type Item, type ItemEvent, type Kind, type Person, type Stage } from "@/lib/delivery/types"
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/components/nova/popover"
import { cn } from "@/ui/lib/utils"

import { assignItem, dueItem, linkItem, moveItem, noteItem, openItem, type Result } from "./actions"

// The parts both boards are built from: the stage track, the kind's icon, dates, the owner picker, the
// new-work form and the item's panel. The panel renders in the shell's right column, outside the
// board's tree, so everything it reads comes in as props.

export type Board = { today: string; people: Person[]; staff: Person[]; admin: boolean; me: string }

export const KIND_ICON: Record<Kind, React.ComponentType<{ className?: string }>> = { video: Film, test: FlaskConical, survey: ListChecks, report: FileText, analysis: ChartLine }

export const personOf = (b: Board, email: string | null) => (email ? (b.people.find((p) => p.email === email.toLowerCase()) ?? { email, name: email.split("@")[0]! }) : null)
export const firstName = (p: Person | null) => p?.name.split(" ")[0] ?? ""

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
/** Oct 31; with the year when it isn't this one. */
export function day(ymd: string, today: string) {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number)
  return `${MONTHS[m - 1]} ${d}${String(y) === today.slice(0, 4) ? "" : `, ${y}`}`
}
export function ago(iso: string, today: string) {
  const n = daysBetween(iso, today)
  return n <= 0 ? "today" : n === 1 ? "yesterday" : `${n} days ago`
}

/** Where an item stands against the calendar: late, due, or waiting on the partner. */
export function when(it: Item, today: string): { text: string; tone: "red" | "amber" | "plain" | "quiet" } {
  if (it.stage === "delivered") return { text: day(it.stagedAt, today), tone: "quiet" }
  if (it.stage === "review") {
    const n = daysBetween(it.stagedAt, today)
    return { text: n <= 0 ? "Sent today" : `Waiting ${n} day${n === 1 ? "" : "s"}`, tone: n > 5 ? "amber" : "plain" }
  }
  if (!it.due) return { text: "No date", tone: "quiet" }
  const n = daysBetween(today, it.due)
  if (isOverdue(it, today)) return { text: `${-n} day${n === -1 ? "" : "s"} late`, tone: "red" }
  return { text: n === 0 ? "Due today" : n === 1 ? "Due tomorrow" : `Due ${day(it.due, today)}`, tone: n <= 2 ? "amber" : "plain" }
}

export function When({ it, today }: { it: Item; today: string }) {
  const w = when(it, today)
  return <span className={cn("whitespace-nowrap text-[13px] tabular-nums", w.tone === "red" ? "font-medium text-pax2-red-deep" : w.tone === "amber" ? "font-medium text-amber-700 dark:text-amber-300" : w.tone === "quiet" ? "text-slate-400" : "text-slate-600")}>{w.text}</span>
}

const STAGE_FILL: Record<Stage, string> = { requested: "bg-slate-400", production: "bg-pax2-blue", review: "bg-amber-500", delivered: "bg-emerald-500" }

/** Four steps, filled to the item's stage, in the stage's colour. */
export function StageTrack({ stage, wide }: { stage: Stage; wide?: boolean }) {
  const at = STAGES.indexOf(stage)
  return (
    <div className={cn("flex flex-col gap-1.5", wide ? "w-full" : "w-32")}>
      <div className="flex gap-1">
        {STAGES.map((s, i) => (
          <span key={s} className={cn("h-1.5 flex-1 rounded-full", i <= at ? STAGE_FILL[stage] : "bg-slate-200")} />
        ))}
      </div>
      {!wide && <span className="text-[12px] text-slate-500">{STAGE_LABEL[stage]}</span>}
    </div>
  )
}

export function HealthBadge({ health }: { health: Health }) {
  if (health === "overdue") return <span className="inline-flex shrink-0 items-center rounded-md bg-pax2-red-soft px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-pax2-red-deep ring-1 ring-pax2-red/25 ring-inset">{HEALTH_LABEL[health]}</span>
  return <Badge tone={health === "risk" ? "amber" : health === "track" ? "green" : "slate"}>{HEALTH_LABEL[health]}</Badge>
}

export function KindTile({ kind }: { kind: Kind }) {
  const Icon = KIND_ICON[kind]
  return (
    <span title={KIND_LABEL[kind]} className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
      <Icon className="size-4" />
    </span>
  )
}

export function Who({ person, size = 24, quiet }: { person: Person | null; size?: number; quiet?: boolean }) {
  if (!person) return <span className="text-[13px] text-slate-400">Unassigned</span>
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar name={person.name} email={person.email} fallback={person.photo} size={size} />
      <span className={cn("truncate text-[13px]", quiet ? "text-slate-500" : "text-slate-700")}>{person.name}</span>
    </span>
  )
}

/** A select in the house field's dress, its chevron drawn over the right edge. */
export function Pick({ value, onChange, options, label, className, disabled }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; label: string; className?: string; disabled?: boolean }) {
  return (
    <span className={cn("relative inline-flex", className)}>
      <select aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={cn(FIELD, "h-9 w-full min-w-0 appearance-none truncate pr-8 pl-3 outline-none disabled:opacity-50")}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-slate-400" />
    </span>
  )
}

/** Runs a board write, holding its pending state and its error. */
export function useWrite() {
  const [pending, start] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const run = (fn: () => Promise<Result>, done?: () => void) =>
    start(async () => {
      setError(null)
      const r = await fn()
      if (r.error) setError(r.error)
      else done?.()
    })
  return { pending, error, run }
}

export function ErrorLine({ error }: { error: string | null }) {
  return error ? <p className="text-[13px] text-pax2-red-deep">{error}</p> : null
}

/** New work: what kind, its title, what it should be, and when it's wanted. An admin also sets the owner and may file it further along. */
export function NewWork({ board, partners, partner, owner, label }: { board: Board; partners?: { id: string; name: string; owner: string | null }[]; partner?: string; owner?: string | null; label: string }) {
  const [open, setOpen] = React.useState(false)
  const [to, setTo] = React.useState(partner ?? partners?.[0]?.id ?? "")
  const [type, setType] = React.useState<Kind>("video")
  const [title, setTitle] = React.useState("")
  const [detail, setDetail] = React.useState("")
  const [due, setDue] = React.useState("")
  const defaultOwner = partner ? owner : partners?.find((p) => p.id === to)?.owner
  const [who, setWho] = React.useState<string>("")
  const [stage, setStage] = React.useState<Stage>("requested")
  const w = useWrite()
  const reset = () => {
    setTitle("")
    setDetail("")
    setDue("")
    setWho("")
    setStage("requested")
    setOpen(false)
  }
  const submit = () =>
    w.run(
      () => openItem(to, { type, title, detail, due: due || null, ...(board.admin ? { owner: (who || defaultOwner) ?? null, stage } : {}) }),
      reset,
    )
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className={SMALL_PRIMARY}>
        <Plus className="size-3.5" /> {label}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[400px] space-y-3 rounded-xl border border-slate-200 bg-pax2-surface p-4 shadow-e2 ring-0">
        {partners && (
          <Pick label="Partner" value={to} onChange={setTo} options={partners.map((p) => ({ value: p.id, label: p.name }))} className="w-full" />
        )}
        <Pick label="Kind of work" value={type} onChange={(v) => setType(v as Kind)} options={KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} className="w-full" />
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" aria-label="Title" className={cn(FIELD, "h-9 w-full px-3 outline-none")} />
        <textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="What it should be" aria-label="Details" rows={3} className={cn(FIELD, "w-full resize-none px-3 py-2 outline-none")} />
        <label className="flex items-center justify-between gap-3 text-[13px] text-slate-600">
          Wanted by
          <input type="date" value={due} min={board.today} onChange={(e) => setDue(e.target.value)} className={cn(FIELD, "h-9 px-3 outline-none")} />
        </label>
        {board.admin && (
          <div className="flex gap-2">
            <Pick label="Owner" value={who || defaultOwner || ""} onChange={setWho} options={[{ value: "", label: "Unassigned" }, ...board.staff.map((s) => ({ value: s.email, label: s.name }))]} className="min-w-0 flex-1" />
            <Pick label="Stage" value={stage} onChange={(v) => setStage(v as Stage)} options={STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))} className="min-w-0 flex-1" />
          </div>
        )}
        <ErrorLine error={w.error} />
        <div className="flex justify-end">
          <button type="button" disabled={w.pending || !title.trim() || !to} onClick={submit} className={cn(SMALL_PRIMARY, "disabled:opacity-40")}>
            {board.admin ? "Add" : "Send request"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** The partner's answer to work in review: approve it, or send it back saying what should change. */
export function ReviewAnswer({ it, compact }: { it: Item; compact?: boolean }) {
  const [changes, setChanges] = React.useState(false)
  const [note, setNote] = React.useState("")
  const w = useWrite()
  if (changes)
    return (
      <div className="flex w-full flex-col gap-2">
        <textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} placeholder="What should change" aria-label="What should change" rows={2} className={cn(FIELD, "w-full resize-none px-3 py-2 outline-none")} />
        <ErrorLine error={w.error} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setChanges(false)} className={SMALL}>
            Cancel
          </button>
          <button type="button" disabled={w.pending || !note.trim()} onClick={() => w.run(() => moveItem(it.partner, it.id, "production", note))} className={cn(SMALL_PRIMARY, "disabled:opacity-40")}>
            Send back
          </button>
        </div>
      </div>
    )
  return (
    <div className={cn("flex items-center gap-2", !compact && "flex-wrap")}>
      <button type="button" onClick={() => setChanges(true)} className={SMALL}>
        Request changes
      </button>
      <button type="button" disabled={w.pending} onClick={() => w.run(() => moveItem(it.partner, it.id, "delivered"))} className={cn(SMALL_PRIMARY, "disabled:opacity-40")}>
        Approve
      </button>
      <ErrorLine error={w.error} />
    </div>
  )
}

/** The admin's next step for an item, one button. */
export const NEXT: Record<Stage, { stage: Stage; label: string } | null> = {
  requested: { stage: "production", label: "Start" },
  production: { stage: "review", label: "Send for review" },
  review: null,
  delivered: null,
}

export function NextStep({ it }: { it: Item }) {
  const w = useWrite()
  const next = NEXT[it.stage]
  if (!next) return null
  return (
    <button
      type="button"
      title={w.error ?? undefined}
      disabled={w.pending}
      onClick={(e) => {
        e.stopPropagation()
        w.run(() => moveItem(it.partner, it.id, next.stage))
      }}
      className={cn(SMALL, "disabled:opacity-40", w.error && "border-pax2-red text-pax2-red-deep")}
    >
      {next.label}
    </button>
  )
}

const href = (h: string) => ({ href: h, ...(h.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {}) })

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 py-1.5">
      <span className="shrink-0 text-[13px] text-slate-500">{label}</span>
      <div className="flex min-w-0 items-center justify-end">{children}</div>
    </div>
  )
}

function eventLine(e: ItemEvent, b: Board): string | null {
  const name = firstName(personOf(b, e.by))
  switch (e.ev) {
    case "open":
      return `${name} opened it`
    case "stage":
      return `${name} moved it to ${STAGE_LABEL[e.stage]}`
    case "assign":
      return e.owner ? `${name} gave it to ${firstName(personOf(b, e.owner))}` : `${name} unassigned it`
    case "due":
      return e.due ? `${name} set it due ${day(e.due, b.today)}` : `${name} cleared the date`
    case "link":
      return `${name} linked where it lives`
    case "note":
      return null
  }
}

/** The item in the right panel: where it stands, its facts, the moves open to the reader, and its history with the notes in it. */
export function ItemPanel({ it, partnerName, board }: { it: Item; partnerName: string; board: Board }) {
  const w = useWrite()
  const [note, setNote] = React.useState("")
  const [link, setLink] = React.useState(it.href ?? "")
  React.useEffect(() => setLink(it.href ?? ""), [it.href])
  const owner = personOf(board, it.owner)
  const canAnswer = !board.admin && it.stage === "review"
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="slate">{KIND_LABEL[it.type]}</Badge>
        {board.admin && <Badge tone="blue">{partnerName}</Badge>}
        <span className="ml-auto">
          <When it={it} today={board.today} />
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <StageTrack stage={it.stage} wide />
        <div className="grid grid-cols-4 gap-1 text-[12px]">
          {STAGES.map((s) =>
            board.admin ? (
              <button key={s} type="button" disabled={w.pending || s === it.stage} onClick={() => w.run(() => moveItem(it.partner, it.id, s))} className={cn("rounded-md px-1 py-1 text-left transition-colors", s === it.stage ? "font-semibold text-slate-900" : "text-slate-500 hover:bg-pax2-lift hover:text-pax2-blue")}>
                {STAGE_LABEL[s]}
              </button>
            ) : (
              <span key={s} className={cn("px-1 py-1", s === it.stage ? "font-semibold text-slate-900" : "text-slate-400")}>
                {STAGE_LABEL[s]}
              </span>
            ),
          )}
        </div>
      </div>

      {canAnswer && (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50/60 p-3 dark:bg-amber-400/10">
          <ReviewAnswer it={it} />
        </div>
      )}

      {it.detail && <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700">{it.detail}</p>}

      <div className="divide-y divide-slate-200 border-y border-slate-200">
        <Line label="Owner">
          {board.admin ? (
            <Pick label="Owner" value={it.owner ?? ""} disabled={w.pending} onChange={(v) => w.run(() => assignItem(it.partner, it.id, v || null))} options={[{ value: "", label: "Unassigned" }, ...board.staff.map((s) => ({ value: s.email, label: s.name }))]} className="w-52" />
          ) : (
            <Who person={owner} />
          )}
        </Line>
        <Line label="Due">
          {board.admin ? (
            <input type="date" aria-label="Due" value={it.due ?? ""} disabled={w.pending} onChange={(e) => w.run(() => dueItem(it.partner, it.id, e.target.value || null))} className={cn(FIELD, "h-9 w-52 px-3 outline-none")} />
          ) : (
            <span className="text-[13px] text-slate-700">{it.due ? day(it.due, board.today) : "No date"}</span>
          )}
        </Line>
        <Line label="Opened">
          <span className="text-[13px] text-slate-700">
            {personOf(board, it.openedBy)?.name}, {day(it.openedAt, board.today)}
          </span>
        </Line>
        {(board.admin || it.href) && (
          <Line label="Lives at">
            {board.admin ? (
              <span className="flex w-52 items-center gap-1">
                <input value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === "Enter" && link.trim() && link !== it.href && w.run(() => linkItem(it.partner, it.id, link))} onBlur={() => link.trim() && link !== it.href && w.run(() => linkItem(it.partner, it.id, link))} placeholder="/clips?c=…" aria-label="Where it lives" className={cn(FIELD, "h-9 min-w-0 flex-1 px-3 outline-none")} />
                {it.href && (
                  <a {...href(it.href)} aria-label="Open" className="flex size-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-pax2-lift hover:text-pax2-blue">
                    <ExternalLink className="size-4" />
                  </a>
                )}
              </span>
            ) : (
              <a {...href(it.href!)} className="flex items-center gap-1.5 text-[13px] font-medium text-pax2-blue hover:underline">
                Open <ExternalLink className="size-3.5" />
              </a>
            )}
          </Line>
        )}
      </div>
      <ErrorLine error={w.error} />

      <ol className="flex flex-col gap-3">
        {it.history.map((e, i) => {
          const by = personOf(board, e.by)
          const text = e.ev === "note" ? e.text : e.ev === "stage" ? e.note : null
          const line = eventLine(e, board)
          return (
            <li key={i} className="flex gap-3">
              <Avatar name={by?.name ?? "?"} email={by?.email} fallback={by?.photo} size={24} />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-slate-500">
                  {line ?? <span className="font-medium text-slate-700">{by?.name}</span>}
                  <span className="text-slate-400"> · {day(e.at, board.today)}</span>
                </p>
                {text && <p className="mt-1 rounded-xl bg-slate-50 px-3 py-2 text-sm whitespace-pre-wrap text-slate-800">{text}</p>}
              </div>
            </li>
          )
        })}
      </ol>

      <div className="flex flex-col gap-2">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={board.admin ? `A note ${partnerName} will see` : "A note for the PAX team"} aria-label="Note" rows={2} className={cn(FIELD, "w-full resize-none px-3 py-2 outline-none")} />
        <div className="flex justify-end">
          <button type="button" disabled={w.pending || !note.trim()} onClick={() => w.run(() => noteItem(it.partner, it.id, note), () => setNote(""))} className={cn(SMALL_PRIMARY, "disabled:opacity-40")}>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
