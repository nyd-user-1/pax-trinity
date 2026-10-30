"use client"

import * as React from "react"
import { RefreshCw } from "lucide-react"

import { CardBlock, TableBlock } from "@/components/blocks"
import { PUBLISHED } from "@/components/clips/store"
import { Reveal } from "@/components/reveal"
import { PLACEBO, type Choice } from "@/lib/tests/types"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/components/nova/table"

// The field, read from the collector's monitor (GET /api/tests/<id>/monitor, admins only). The
// shape this page reads, as the collector documents it:
//
//   { test, generatedAt,
//     totals: { started, finished, screenouts?, quotaFull? },
//     arms: [{ arm, started, finished, completionRate, balance: { party: { <value>: { n, share } }, vote2024: {...} } }],
//     note? }
//
// screenouts and quotaFull show once the collector counts them.

type Cell = { n: number; share: number | null }
type ArmField = { arm: string; started: number; finished: number; completionRate: number | null; balance: Record<string, Record<string, Cell>> }
type Field = { test: string; generatedAt: string; totals: { started: number; finished: number; screenouts?: number; quotaFull?: number }; arms: ArmField[]; note?: string }
type State = { kind: "loading" } | { kind: "live"; data: Field } | { kind: "absent"; why: string }

const pct = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`)

function useField(id: string): [State, () => void] {
  const [state, setState] = React.useState<State>({ kind: "loading" })
  const load = React.useCallback(() => {
    fetch(`/api/tests/${id}/monitor`, { cache: "no-store" })
      .then(async (r) => {
        const body = r.headers.get("content-type")?.includes("json") ? await r.json() : null
        if (r.ok && body?.arms) return setState({ kind: "live", data: body })
        if (r.status === 403) return setState({ kind: "absent", why: "The collector's monitor answers admins only." })
        if (body?.error) return setState({ kind: "absent", why: `The collector is live but has no record of this test yet (${body.error}).` })
        setState({ kind: "absent", why: `Collector not yet live: GET /api/tests/${id}/monitor isn't answering.` })
      })
      .catch(() => setState({ kind: "absent", why: `Collector not yet live: GET /api/tests/${id}/monitor isn't answering.` }))
  }, [id])
  React.useEffect(() => {
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [load])
  return [state, load]
}

const TITLES = new Map(PUBLISHED.map((c) => [c.id, c.title]))

export function Monitor({ id, arms: armIds, titles, targetPerArm, balance }: { id: string; arms: string[]; titles?: Record<string, string>; targetPerArm: number; balance: { key: string; choices: Choice[] }[] }) {
  const [state, reload] = useField(id)
  const arms = armIds.map((a) => ({ id: a, label: a === PLACEBO ? "Placebo" : (TITLES.get(a) ?? titles?.[a] ?? a) }))
  const label = new Map(arms.map((a) => [a.id, a.label]))
  const refresh = (
    <button type="button" onClick={reload} aria-label="Refresh" className="flex size-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-pax2-blue">
      <RefreshCw className="size-3.5" />
    </button>
  )

  if (state.kind !== "live") {
    return (
      <CardBlock title="Monitor" tools={refresh}>
        <p className="p-1 text-sm text-slate-500">{state.kind === "loading" ? "Reading the field…" : state.why}</p>
      </CardBlock>
    )
  }

  const { data } = state
  // Arms the test names come first, in its order; anything else the collector reports follows.
  const rows = [...arms.map((a) => data.arms.find((r) => r.arm === a.id) ?? { arm: a.id, started: 0, finished: 0, completionRate: null, balance: {} }), ...data.arms.filter((r) => !label.has(r.arm))]
  const target = targetPerArm * arms.length
  const counted = (n: number | undefined) => (typeof n === "number" ? n.toLocaleString("en-US") : "Not counted yet")

  return (
    <>
      <TableBlock
        title="Monitor"
        tools={refresh}
        name={`${id}-monitor`}
        rows={rows.map((r) => ({ arm: label.get(r.arm) ?? r.arm, finished: r.finished, target: targetPerArm, started: r.started, completion: r.completionRate ?? "" }))}
      >
        <div className="grid grid-cols-2 gap-4 px-1 pb-4 sm:grid-cols-4">
          {[
            ["Finished", `${data.totals.finished.toLocaleString("en-US")} / ${target.toLocaleString("en-US")}`],
            ["Started", data.totals.started.toLocaleString("en-US")],
            ["Screenouts", counted(data.totals.screenouts)],
            ["Quota-full", counted(data.totals.quotaFull)],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5">
              <span className="text-xs text-slate-500">{k}</span>
              <span className="text-lg font-semibold tabular-nums text-slate-900">{v}</span>
            </div>
          ))}
        </div>
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/60">
              <TableHead className="w-[32%]">Arm</TableHead>
              <TableHead className="w-[38%]">Finished of target</TableHead>
              <TableHead className="w-[15%]">Started</TableHead>
              <TableHead className="w-[15%]">Completion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, k) => (
              <TableRow key={r.arm} style={{ "--i": k } as React.CSSProperties}>
                <TableCell className="truncate py-2.5 font-medium text-slate-900">{label.get(r.arm) ?? r.arm}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {/* Grows in on arrival; a new count after that eases to its width. */}
                    <Reveal className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div className="grow-x h-full rounded-full bg-pax2-blue transition-[width] duration-500" style={{ width: `${Math.min(100, (100 * r.finished) / targetPerArm)}%` }} />
                    </Reveal>
                    <span className="w-24 text-right text-sm tabular-nums text-slate-600">
                      {r.finished.toLocaleString("en-US")} / {targetPerArm.toLocaleString("en-US")}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm tabular-nums text-slate-600">{r.started.toLocaleString("en-US")}</TableCell>
                <TableCell className="text-sm tabular-nums text-slate-600">{pct(r.completionRate)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="px-1 pt-3 text-xs text-slate-400">As of {new Date(data.generatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}{data.note ? `. ${data.note}` : ""}</p>
      </TableBlock>
      {balance.map((q) => (
        <TableBlock key={q.key} title={`Balance: ${q.key === "vote2024" ? "2024 vote" : q.key[0].toUpperCase() + q.key.slice(1)}`} name={`${id}-${q.key}`}>
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead className="w-[28%]">Arm</TableHead>
                {q.choices.map((c) => (
                  <TableHead key={c.value} className="truncate">
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.arm}>
                  <TableCell className="truncate py-2.5 font-medium text-slate-900">{label.get(r.arm) ?? r.arm}</TableCell>
                  {q.choices.map((c) => {
                    const cell = r.balance[q.key]?.[c.value]
                    return (
                      <TableCell key={c.value} className="text-sm tabular-nums text-slate-600">
                        {cell ? `${pct(cell.share)} (${cell.n})` : "—"}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableBlock>
      ))}
    </>
  )
}
