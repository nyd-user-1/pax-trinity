"use client"

import * as React from "react"

import { TableBody, TableCell, TableRow } from "@/ui/components/nova/table"
import { cn } from "@/ui/lib/utils"
import { ChevronsDownUp, ChevronsUpDown, Copy } from "lucide-react"
import { MenuFoot, MenuHeader, MenuRow, MenuSeparator } from "@/components/kebab-menu"
import { ON, RowMenu, TD, TR } from "@/components/row-dress"

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
            className={cn(TR, "scroll-mt-24 cursor-pointer target:bg-pax2-lavender/50", on && ON)}
          >
            <TableCell className={cn(TD, on && "py-2.5 align-top")}>
              <p className="truncate font-semibold">{t.full}</p>
              {on && t.short !== t.full && <p className="text-xs text-slate-400">Shown as “{t.short}”</p>}
            </TableCell>
            <TableCell className={cn(TD, "text-sm text-slate-600", on ? "py-2.5 align-top leading-relaxed whitespace-normal" : "overflow-hidden text-ellipsis")}>
              {t.definition}
            </TableCell>
            <TableCell className={cn(TD, "text-slate-800", on && "py-2.5 align-top")}>{t.group}</TableCell>
            {/* The house row's kebab (components/row-dress.tsx, Brendan, 2026-10-31), over the row's end. */}
            <td className="absolute top-1/2 right-5 -translate-y-1/2 border-0 p-0">
              <RowMenu label={`${t.full} options`} className="rounded-lg bg-pax2-lift">
                <MenuHeader text={t.full} copy={t.full} />
                <MenuSeparator />
                <MenuRow icon={on ? <ChevronsDownUp /> : <ChevronsUpDown />} label={on ? "Fold the definition" : "Unfold the definition"} onClick={() => setOpen(on ? null : t.id)} />
                <MenuRow icon={<Copy />} label="Copy the definition" onClick={() => void navigator.clipboard.writeText(t.definition)} />
                <MenuRow icon={<Copy />} label="Copy link" onClick={() => void navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}${window.location.search}#${t.id}`)} />
                <MenuSeparator />
                <MenuFoot title={t.full} sub={t.group} />
              </RowMenu>
            </td>
          </TableRow>
        )
      })}
    </TableBody>
  )
}
