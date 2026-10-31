"use client"

import * as React from "react"
import Link from "next/link"

import { TableBlock } from "@/components/blocks"
import type { Status } from "@/lib/tests/types"
import { editTestHref, newTestHref, testHref } from "@/lib/survey-links"
import { useRouter } from "next/navigation"
import { Maximize2, Pencil } from "lucide-react"
import { MenuFoot, MenuHeader, MenuRow, MenuSeparator } from "@/components/kebab-menu"
import { RowMenu, TD, TR } from "@/components/row-dress"
import { cn } from "@/ui/lib/utils"
import { buttonVariants } from "@/ui/components/nova/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/components/nova/table"

import { StatusChip } from "./status-chip"

type Row = { id: string; title: string; status: Status; arms: number; targetPerArm: number; updatedAt: string | null }

/** Finished completes per test, from the collector's monitor; null until it answers or if it can't. */
function useCompletes(ids: string[]) {
  const [done, setDone] = React.useState<Record<string, number | null>>({})
  React.useEffect(() => {
    let on = true
    for (const id of ids) {
      fetch(`/api/tests/${id}/monitor`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((m) => on && setDone((d) => ({ ...d, [id]: typeof m?.totals?.finished === "number" ? m.totals.finished : null })))
        .catch(() => on && setDone((d) => ({ ...d, [id]: null })))
    }
    return () => {
      on = false
    }
  }, [ids])
  return done
}

export function TestsTable({ tests, reachable }: { tests: Row[]; reachable: boolean }) {
  const router = useRouter()
  const ids = React.useMemo(() => tests.map((t) => t.id), [tests])
  const done = useCompletes(ids)
  return (
    <div className="flex flex-col gap-4">
      {!reachable && <p className="text-sm text-pax2-red">The tests table could not be read, so only the seeded test is listed.</p>}
      <TableBlock
        title="Tests"
        name="message-tests"
        rows={tests.map((t) => ({ id: t.id, title: t.title, status: t.status, arms: t.arms, completes: done[t.id] ?? "", target: t.targetPerArm * t.arms }))}
        actions={
          <Link href={newTestHref()} className={buttonVariants({ size: "sm" })}>
            New test
          </Link>
        }
      >
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/60">
              <TableHead className="w-[40%]">Test</TableHead>
              <TableHead className="w-[14%]">Status</TableHead>
              <TableHead className="w-[12%]">Arms</TableHead>
              <TableHead className="w-[18%]">Completes</TableHead>
              <TableHead className="w-[16%]">Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* The house row (components/row-dress.tsx, Brendan, 2026-10-31): one line, the id after the title. */}
            {tests.map((t) => (
              <TableRow key={t.id} onClick={() => router.push(testHref(t.id))} className={cn(TR, "cursor-pointer")}>
                <TableCell className={cn(TD, "truncate")}>
                  <Link href={testHref(t.id)} onClick={(e) => e.stopPropagation()} className="font-semibold">
                    {t.title || t.id}
                  </Link>
                  <span className="font-mono text-xs text-slate-400">&nbsp;- {t.id}</span>
                </TableCell>
                <TableCell className={TD}>
                  <StatusChip status={t.status} />
                </TableCell>
                <TableCell className={cn(TD, "tabular-nums text-sm text-slate-600")}>{t.arms}</TableCell>
                <TableCell className={cn(TD, "tabular-nums text-sm text-slate-600")}>
                  {done[t.id] == null ? "—" : done[t.id]!.toLocaleString("en-US")} / {(t.targetPerArm * t.arms).toLocaleString("en-US")}
                </TableCell>
                <TableCell className={cn(TD, "text-sm text-slate-500")}>{t.updatedAt ? t.updatedAt.slice(0, 10) : "Seeded"}</TableCell>
                <td className="absolute top-1/2 right-5 -translate-y-1/2 border-0 p-0">
                  <RowMenu label={`${t.title || t.id} options`} className="rounded-lg bg-pax2-lift">
                    <MenuHeader text={t.id} copy={t.id} />
                    <MenuSeparator />
                    <MenuRow icon={<Maximize2 />} label="Open" onClick={() => router.push(testHref(t.id))} />
                    <MenuRow icon={<Pencil />} label="Edit" onClick={() => router.push(editTestHref(t.id))} />
                    <MenuSeparator />
                    <MenuFoot title={t.title || t.id} sub={t.status[0].toUpperCase() + t.status.slice(1)} />
                  </RowMenu>
                </td>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableBlock>
    </div>
  )
}
