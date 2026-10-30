"use client"

import * as React from "react"
import { Checkbox } from "@base-ui/react/checkbox"
import { Switch } from "@base-ui/react/switch"
import { Check } from "lucide-react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/components/nova/select"
import { cn } from "@/ui/lib/utils"

import { FIELD } from "./blocks"

/** A text field; `lead` sits inside its left edge (a scheme, an @, a country code). */
export function Field({ lead, className, ...props }: React.ComponentProps<"input"> & { lead?: React.ReactNode }) {
  return (
    <label className={cn(FIELD, "flex h-9 w-full items-center", className)}>
      {lead && <span className="shrink-0 pl-3 text-slate-400">{lead}</span>}
      <input {...props} className={cn("h-full min-w-0 flex-1 rounded-xl bg-transparent pr-3 outline-none placeholder:text-slate-400", lead ? "pl-1" : "pl-3")} />
    </label>
  )
}

export function Choice({ label, options, defaultValue }: { label: string; options: string[]; defaultValue: string }) {
  return (
    <Select defaultValue={defaultValue}>
      <SelectTrigger aria-label={label} className="h-9 w-full rounded-xl border-slate-200 bg-white pl-3 shadow-e1 data-[size=default]:h-9 dark:bg-white">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="rounded-xl border border-slate-200 bg-white p-1 shadow-e2 ring-0">
        {options.map((o) => (
          <SelectItem key={o} value={o} className="rounded-lg px-2.5 py-1.5">
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function Toggle({ label, defaultOn, on, onChange }: { label: string; defaultOn?: boolean; on?: boolean; onChange?: (on: boolean) => void }) {
  return (
    <Switch.Root
      aria-label={label}
      defaultChecked={defaultOn}
      checked={on}
      onCheckedChange={onChange}
      className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full bg-slate-200 p-0.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-pax2-light-blue/30 data-checked:bg-pax2-blue"
    >
      <Switch.Thumb className="size-4 rounded-full bg-white shadow-sm transition-transform duration-150 data-checked:translate-x-4" />
    </Switch.Root>
  )
}

export function Tick({ label, defaultOn, disabled, children }: { label: string; defaultOn?: boolean; disabled?: boolean; children?: React.ReactNode }) {
  const box = (
    <Checkbox.Root
      aria-label={children ? undefined : label}
      defaultChecked={defaultOn}
      disabled={disabled}
      className="flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-slate-300 bg-white transition-colors outline-none focus-visible:ring-3 focus-visible:ring-pax2-light-blue/30 data-checked:border-pax2-blue data-checked:bg-pax2-blue data-disabled:cursor-not-allowed data-disabled:opacity-50"
    >
      <Checkbox.Indicator className="flex text-white">
        <Check className="size-3" strokeWidth={3} />
      </Checkbox.Indicator>
    </Checkbox.Root>
  )
  if (!children) return box
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
      {box}
      {children}
    </label>
  )
}

export function Ticks({ items }: { items: [string, boolean][] }) {
  return (
    <div className="space-y-2">
      {items.map(([label, on]) => (
        <Tick key={label} label={label} defaultOn={on}>
          {label}
        </Tick>
      ))}
    </div>
  )
}
