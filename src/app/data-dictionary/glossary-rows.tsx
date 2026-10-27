"use client"

import * as React from "react"

import { TableBody, TableCell, TableRow } from "@/ui/components/nova/table"
import { cn } from "@/ui/lib/utils"

type Row = { id: string; full: string; short: string; group: string; definition: string }

// Uniform rows, one line each; a long definition unfolds in place when its row
// is clicked (Brendan, 2026-10-25).
export function GlossaryRows({ rows }: { rows: Row[] }) {
  const [open, setOpen] = React.useState<string | null>(null)
  return (
    <TableBody>
      {rows.map((t) => {
        const on = open === t.id
        return (
          <TableRow
            key={t.id}
            id={t.id}
            data-find={`${t.full} ${t.definition}`}
            onClick={() => setOpen(on ? null : t.id)}
            className="scroll-mt-24 cursor-pointer target:bg-pax2-lavender/50"
          >
            <TableCell className="py-2.5 align-top">
              <p className="truncate font-semibold text-slate-900">{t.full}</p>
              {on && t.short !== t.full && <p className="text-xs text-slate-400">Shown as “{t.short}”</p>}
            </TableCell>
            <TableCell className={cn("py-2.5 align-top text-sm leading-relaxed text-slate-600", on ? "whitespace-normal" : "overflow-hidden text-ellipsis whitespace-nowrap")}>
              {t.definition}
            </TableCell>
            <TableCell className="py-2.5 align-top text-slate-800">{t.group}</TableCell>
          </TableRow>
        )
      })}
    </TableBody>
  )
}
