"use client"

import * as React from "react"

import { TableBody, TableCell, TableRow } from "@/ui/components/nova/table"
import { cn } from "@/ui/lib/utils"

import type { DictionaryRow } from "./dictionary-data"

// The glossary's rows (glossary-rows.tsx): uniform, one line each; a long
// definition unfolds in place when its row is clicked.
export function DictionaryRows({ rows }: { rows: DictionaryRow[] }) {
  const [open, setOpen] = React.useState<string | null>(null)
  return (
    <TableBody>
      {rows.map((t) => {
        const on = open === t.id
        return (
          <TableRow
            key={t.id}
            id={t.id}
            data-find={`${t.term} ${t.definition}`}
            onClick={() => setOpen(on ? null : t.id)}
            className="scroll-mt-24 cursor-pointer target:bg-pax2-lavender/50"
          >
            <TableCell className="py-2.5 align-top">
              <p className="truncate font-semibold text-slate-900">{t.term}</p>
            </TableCell>
            <TableCell className={cn("py-2.5 align-top text-sm leading-relaxed text-slate-600", on ? "whitespace-normal" : "overflow-hidden text-ellipsis whitespace-nowrap")}>
              {t.definition}
            </TableCell>
            <TableCell className="py-2.5 align-top text-slate-800">{t.section}</TableCell>
          </TableRow>
        )
      })}
    </TableBody>
  )
}
