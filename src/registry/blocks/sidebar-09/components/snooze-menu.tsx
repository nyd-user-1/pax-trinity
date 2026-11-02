"use client"

import * as React from "react"
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { snoozeChoices, snoozeTime } from "@/lib/mail/client"
import { KebabMenu, MenuRow, MenuSeparator } from "@/components/kebab-menu"
import { Button } from "@/ui/components/nova/button"
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/ui/components/nova/dialog"

// Gmail's snooze (Brendan, 2026-11-02): the clock opens "Snooze until…" with its presets, each with
// the time it means (later today at 6 PM, tomorrow at 8 AM, Saturday at 8 AM, next Monday at 8 AM),
// then Pick date & time, which opens a calendar and a time. The thread sits in Snoozed until its time
// passes (the server's inbox leaves out a thread snoozed past now). A snoozed thread's menu can
// unsnooze it. Everything here stops at its own edge: a click inside never opens the row it sits in.

export function SnoozeMenu({
  trigger,
  snoozed = false,
  onSnooze,
  onUnsnooze,
  align = "right",
}: {
  trigger: React.ReactNode
  snoozed?: boolean
  onSnooze: (at: Date) => void
  onUnsnooze?: () => void
  align?: "left" | "right"
}) {
  const [picking, setPicking] = React.useState(false)
  const now = new Date()
  return (
    <span className="contents" onClick={(event) => event.stopPropagation()}>
      <KebabMenu label="Snooze" align={align} width="w-64" trigger={trigger} triggerClassName="flex rounded-full outline-none">
        <p className="px-2.5 pt-1.5 pb-1 text-[13px] font-medium text-slate-900">Snooze until…</p>
        {snoozeChoices(now).map((choice) => (
          <MenuRow key={choice.key} label={choice.label} hint={snoozeTime(choice.at, now)} onClick={() => onSnooze(choice.at)} />
        ))}
        <MenuSeparator />
        <MenuRow icon={<CalendarClock />} label="Pick date & time" onClick={() => setPicking(true)} />
        {snoozed && onUnsnooze && (
          <>
            <MenuSeparator />
            <MenuRow label="Unsnooze" onClick={onUnsnooze} />
          </>
        )}
      </KebabMenu>
      {picking && <SnoozePicker onClose={() => setPicking(false)} onPick={onSnooze} />}
    </span>
  )
}

/** A time as typed: "8", "8am", "8:30 pm", "20:15", "8:00 AM". */
export function parseTime(text: string): { h: number; m: number } | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, "")
  const match = t.match(/^(\d{1,2})(?::(\d{2}))?(am|pm|a|p)?$/)
  if (!match) return null
  let h = Number(match[1])
  const m = Number(match[2] ?? 0)
  const half = match[3]?.[0]
  if (m > 59) return null
  if (half) {
    if (h < 1 || h > 12) return null
    if (half === "p" && h < 12) h += 12
    if (half === "a" && h === 12) h = 0
  } else if (h > 23) return null
  return { h, m }
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** Pick date & time: a month to pick the day from, and the time typed. Save takes a moment still to come. */
export function SnoozePicker({ onClose, onPick, now = new Date() }: { onClose: () => void; onPick: (at: Date) => void; now?: Date }) {
  const tomorrow = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1))
  const [day, setDay] = React.useState(tomorrow)
  const [month, setMonth] = React.useState(new Date(tomorrow.getFullYear(), tomorrow.getMonth(), 1))
  const [time, setTime] = React.useState("8:00 AM")
  const parsed = parseTime(time)
  const at = parsed ? new Date(day.getFullYear(), day.getMonth(), day.getDate(), parsed.h, parsed.m) : null
  const valid = !!at && at.getTime() > now.getTime()
  const today = startOfDay(now)
  const lead = month.getDay()
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: (Date | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))]
  const field = "h-9 w-full rounded-md border border-slate-200 bg-transparent px-3 text-sm outline-none focus:border-pax2-light-blue"
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[520px]" showCloseButton={false} data-snooze-picker>
        <DialogTitle>Pick date & time</DialogTitle>
        <div className="flex gap-6">
          <div className="w-[238px] shrink-0">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium">{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
              <span className="flex">
                <button type="button" aria-label="Previous month" disabled={month <= new Date(today.getFullYear(), today.getMonth(), 1)} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="flex size-7 items-center justify-center rounded-full hover:bg-slate-100 disabled:opacity-30">
                  <ChevronLeft className="size-4" />
                </button>
                <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="flex size-7 items-center justify-center rounded-full hover:bg-slate-100">
                  <ChevronRight className="size-4" />
                </button>
              </span>
            </div>
            <div className="grid grid-cols-7 text-center text-xs text-slate-500">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <span key={i} className="py-1">
                  {d}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 text-center text-sm" role="grid">
              {cells.map((d, i) =>
                d ? (
                  <button
                    key={i}
                    type="button"
                    data-day={d.getDate()}
                    disabled={d < today}
                    aria-pressed={sameDay(d, day)}
                    onClick={() => setDay(d)}
                    className={cn(
                      "mx-auto flex size-8 items-center justify-center rounded-full disabled:text-slate-300",
                      sameDay(d, day) ? "bg-pax2-light-blue text-white" : "hover:bg-slate-100",
                      sameDay(d, today) && !sameDay(d, day) && "text-pax2-light-blue font-semibold"
                    )}
                  >
                    {d.getDate()}
                  </button>
                ) : (
                  <span key={i} />
                )
              )}
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3 pt-9">
            <label className="flex flex-col gap-1 text-xs text-slate-500">
              Date
              <input readOnly value={day.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-500">
              Time
              <input value={time} onChange={(event) => setTime(event.target.value)} aria-invalid={!parsed} className={cn(field, !parsed && "border-pax2-red")} />
            </label>
            {at && !valid && parsed && <p className="text-xs text-pax2-red">That time has passed.</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            onClick={() => {
              if (!at || !valid) return
              onPick(at)
              onClose()
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
