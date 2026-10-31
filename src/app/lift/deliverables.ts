"use client"

import * as React from "react"

import type { AudienceIndex, SourceRow } from "../america-thinks/audience-data"
import { fielding, metricShort, periodKey, segOf, signed, treatmentName } from "./lift-data"

// Tools > Lift Analysis' cards (Brendan, 2026-10-31): every deliverable the PAX waves tested, each opening its
// analysis on the table's lead metric among everyone. Newest wave first, the strongest lift first within it.

export type Deliverable = {
  /** Lift's address for the analysis (?source and at=). */
  href: string
  source: string
  /** The pick as Lift's at= list: option, metric, segment ("" is everyone), fielding. */
  at: string[]
  title: string
  /** The metric and its lift, and the wave. */
  sub: string
}

const SOURCE = "PAX_TEST"
// The table's lead metric first; a deliverable without it opens on its first other.
const LEAD = ["lift_support", "lift_comprehension"]
const part = (x: string) => encodeURIComponent(x || "all")

let cached: Promise<Deliverable[]> | null = null

async function load(): Promise<Deliverable[]> {
  const idx = (await fetch("/audience-data/index.json").then((r) => r.json())) as AudienceIndex
  const files = idx.sources.filter((s) => s.source === SOURCE).map((s) => s.file)
  const rows = (await Promise.all(files.map((f) => fetch(`/audience-data/${f}`).then((r) => r.json())))).flat() as SourceRow[]
  const by = new Map<string, SourceRow[]>()
  for (const r of rows) {
    if (r[8] !== "lift_pp" || !r[4] || segOf(r) !== "") continue
    const k = `${r[4]}\u0002${periodKey(r)}`
    by.set(k, [...(by.get(k) ?? []), r])
  }
  const out: { d: Deliverable; end: string; lift: number }[] = []
  for (const rs of by.values()) {
    const r = LEAD.map((m) => rs.find((x) => x[0] === m)).find(Boolean) ?? rs[0]
    const at = [r[4]!, r[0], "", periodKey(r)]
    out.push({
      d: { href: `/lift?source=${SOURCE}&at=${at.map(part).join(",")}`, source: SOURCE, at, title: treatmentName(r[4]!), sub: `${metricShort(r[0])} ${signed(r[7])} · ${fielding(r[2], r[3])}` },
      end: r[3],
      lift: r[7],
    })
  }
  return out.sort((a, b) => b.end.localeCompare(a.end) || b.lift - a.lift).map((x) => x.d)
}

export function useDeliverables() {
  const [list, setList] = React.useState<Deliverable[] | null>(null)
  React.useEffect(() => {
    let on = true
    ;(cached ??= load().catch((e) => ((cached = null), Promise.reject(e))))
      .then((d) => on && setList(d))
      .catch(() => on && setList([]))
    return () => {
      on = false
    }
  }, [])
  return list
}
