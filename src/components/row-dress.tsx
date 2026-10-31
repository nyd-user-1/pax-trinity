"use client"

import * as React from "react"
import { EllipsisVerticalIcon } from "lucide-react"

import { KebabMenu } from "@/components/kebab-menu"
import { cn } from "@/lib/utils"

// The house row (Brendan, 2026-10-31): America Thinks' list row, made the one every wide list and table wears.
// 40px tall on one line, a line above and below, and on hover the raised fill, the blue type and Gmail's lift,
// with the row's kebab at its end opening the house menu (kebab-menu.tsx). A list's rows take ROW; a table's
// rows take TR and their cells TD, since a table draws its lines on its cells. An open or picked row adds ON.

/** A list row (li, div). */
export const ROW =
  "group/row relative h-10 border-b border-slate-200 transition-[color,background-color,box-shadow] hover:z-10 hover:bg-pax2-lift hover:text-pax2-blue hover:shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]"
/** A table row: the hover, without the line (its cells draw it). */
export const TR =
  "group/row relative transition-[color,background-color,box-shadow] hover:z-10 hover:bg-pax2-lift hover:text-pax2-blue hover:shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]"
/** A table row's cell: the row's 40px on one line, and its line. */
export const TD = "h-10 border-b border-slate-200 py-0 align-middle whitespace-nowrap"
/** The open or picked row. */
export const ON = "z-10 bg-pax2-lift text-pax2-blue shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]"

/** The kebab's button, CardList's own. */
const KEBAB =
  "inline-flex size-7 shrink-0 items-center justify-center rounded-lg outline-none transition-colors hover:bg-foreground/8 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-expanded:bg-foreground/8 aria-expanded:text-foreground"

/** The row's kebab: shown on the row's hover, on focus, or with its menu open (KebabMenu keeps its clicks from the row). */
export function RowMenu({ label = "Row actions", children, className }: { label?: string; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex opacity-0 group-hover/row:opacity-100 group-has-focus-visible/row:opacity-100 group-has-[[aria-expanded=true]]/row:opacity-100", className)}>
      <KebabMenu label={label} width="w-56" trigger={<EllipsisVerticalIcon className="size-4" />} triggerClassName={KEBAB}>
        {children}
      </KebabMenu>
    </span>
  )
}
