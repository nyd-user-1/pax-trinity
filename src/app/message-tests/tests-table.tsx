"use client"

import * as React from "react"
import Link from "next/link"

import { TableBlock } from "@/components/blocks"
import type { Status } from "@/lib/tests/types"
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
          <Link href="/message-tests/new" className={buttonVariants({ size: "sm" })}>
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
            {tests.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="py-2.5">
                  <Link href={`/message-tests/${t.id}`} className="block truncate font-semibold text-slate-900 hover:text-pax2-blue">
                    {t.title || t.id}
                  </Link>
                  <p className="truncate font-mono text-xs text-slate-400">{t.id}</p>
                </TableCell>
                <TableCell>
                  <StatusChip status={t.status} />
                </TableCell>
                <TableCell className="tabular-nums text-sm text-slate-600">{t.arms}</TableCell>
                <TableCell className="tabular-nums text-sm text-slate-600">
                  {done[t.id] == null ? "—" : done[t.id]!.toLocaleString("en-US")} / {(t.targetPerArm * t.arms).toLocaleString("en-US")}
                </TableCell>
                <TableCell className="text-sm text-slate-500">{t.updatedAt ? t.updatedAt.slice(0, 10) : "Seeded"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableBlock>
    </div>
  )
}
