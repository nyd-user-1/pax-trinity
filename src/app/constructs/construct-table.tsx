"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { cn } from "@/lib/utils"

import { shortSource, topicOf, type QuestionSummary } from "../america-thinks/audience-data"
import { Absent, Gap } from "../_wire/wire-bits"
import { BASE_YEAR, bandOf, dossierHref, fmt, loadRows, one, seededBand, seriesOf, signed, useWireIndex, type Band, type Family, type Point } from "../_wire/wire-data"

// /constructs — one row per construct in the export's families, grouped
// under its subject, as Brendan drew it (docs/wireframes/construct-table.png).
// The lead question's rows supply every number; a row reads its rows only
// once it scrolls near the screen, a few files at a time.

const MA = "25"
const NO_SUBJECT = "No subject yet"

type Item = {
  fam: Family
  group: string
  lead: string
  /** Sources asking the lead question, the longest series first. */
  leadSources: string[]
  /** Every source a member is asked in, each with its last wave where that trails the source's own. */
  sources: { source: string; stale: number | null }[]
  /** The seeded band's label, known before a row is read where the index's options carry it. */
  seedLabel: string | null
}

type Read = { band: Band; us: Point[]; ma: Point[]; maSource: string | null }

// A few files in flight at a time, however many rows scroll past at once.
const IN_FLIGHT = 6
let active = 0
const waiting: (() => void)[] = []
function throttled<T>(f: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      active++
      f()
        .then(resolve, reject)
        .finally(() => {
          active--
          waiting.shift()?.()
        })
    }
    if (active < IN_FLIGHT) run()
    else waiting.push(run)
  })
}

export function ConstructTable() {
  const { index, error } = useWireIndex()
  const router = useRouter()
  const [reads, setReads] = React.useState<Record<string, Read | "error">>({})
  const asked = React.useRef(new Set<string>())

  const items = React.useMemo<Item[]>(() => {
    if (!index) return []
    const qs = index.questions ?? []
    const bySummary = new Map<string, QuestionSummary[]>()
    // A source's usual last wave: the one most of its questions end on (one stray later item does not move it).
    const lastCounts = new Map<string, Map<number, number>>()
    for (const q of qs) {
      bySummary.set(q.question, [...(bySummary.get(q.question) ?? []), q])
      const c = lastCounts.get(q.source) ?? new Map<number, number>()
      c.set(q.last, (c.get(q.last) ?? 0) + 1)
      lastCounts.set(q.source, c)
    }
    const sourceLast = new Map([...lastCounts].map(([s, c]) => [s, [...c].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0]]))
    const tags = new Map(index.constructs.map((c) => [c.construct, c.topics]))
    const out: Item[] = []
    for (const fam of index.families ?? []) {
      const members = fam.members.filter((m) => bySummary.has(m.question))
      if (!members.length) continue
      const lead = (members.find((m) => m.relation === "core") ?? members[0]).question
      const leadMember = members.find((m) => m.question === lead)!
      const leadSummaries = (bySummary.get(lead) ?? []).filter((q) => !leadMember.source || q.source === leadMember.source)
      const leadSources = [...leadSummaries].sort((a, b) => b.waves - a.waves || b.last - a.last).map((q) => q.source)
      const src = new Map<string, number>()
      for (const m of members)
        for (const q of bySummary.get(m.question) ?? [])
          if (!m.source || m.source === q.source) src.set(q.source, Math.max(src.get(q.source) ?? 0, q.last))
      const sources = [...src.entries()]
        .sort(([a], [b]) => (a === leadSources[0] ? -1 : b === leadSources[0] ? 1 : shortSource(a).localeCompare(shortSource(b))))
        .map(([source, last]) => ({ source, stale: last < (sourceLast.get(source) ?? last) ? last : null }))
      const seed = seededBand(lead, leadSummaries.flatMap((q) => q.options))
      out.push({
        fam,
        group: fam.subject || topicOf(tags.get(lead)) || NO_SUBJECT,
        lead,
        leadSources,
        sources,
        seedLabel: seed?.label ?? null,
      })
    }
    return out
  }, [index])

  const groups = React.useMemo(() => {
    const by = new Map<string, Item[]>()
    for (const it of items) by.set(it.group, [...(by.get(it.group) ?? []), it])
    return [...by.entries()]
      .sort(([a], [b]) => (a === NO_SUBJECT ? 1 : b === NO_SUBJECT ? -1 : a.localeCompare(b, "en", { sensitivity: "base" })))
      .map(([group, its]) => ({ group, items: its.sort((a, b) => a.fam.label.localeCompare(b.fam.label, "en", { sensitivity: "base" })) }))
  }, [items])

  const request = React.useCallback((it: Item) => {
    const key = it.fam.id
    if (asked.current.has(key) || !it.leadSources.length) return
    asked.current.add(key)
    Promise.allSettled(it.leadSources.map((s) => throttled(() => loadRows(s, it.lead))))
      .then((settled) => {
        const got = settled.map((r, i) => ({ source: it.leadSources[i], rows: r.status === "fulfilled" ? r.value : null }))
        const head = got[0].rows
        if (!head) throw new Error("lead rows")
        const band = bandOf(it.lead, head, "US")
        const us = seriesOf(head, band, "US")
        let ma: Point[] = []
        let maSource: string | null = null
        for (const g of got) {
          if (!g.rows) continue
          const s = seriesOf(g.rows, band, MA)
          if (s.length) {
            ma = s
            maSource = g.source
            break
          }
        }
        setReads((prev) => ({ ...prev, [key]: { band, us, ma, maSource } }))
      })
      .catch(() => setReads((prev) => ({ ...prev, [key]: "error" })))
  }, [])

  return (
    <div className="w-full min-w-0" data-constructs="">
      <table className="w-full border-collapse text-[13px]">
        <thead className="sticky top-0 z-10 bg-background">
          <tr className="border-b-2 border-foreground/20 text-left text-[13px] text-foreground/80">
            <th className="px-3 py-2 font-medium">Construct</th>
            <th className="px-3 py-2 font-medium">Headline band</th>
            <th className="px-3 py-2 text-right font-medium">US latest</th>
            <th className="px-3 py-2 text-right font-medium">MA</th>
            <th className="px-3 py-2 font-medium">Trend</th>
            <th className="px-3 py-2 text-right font-medium">Δ since {BASE_YEAR}</th>
            <th className="px-3 py-2 font-medium">Sources</th>
          </tr>
        </thead>
        {error && (
          <tbody>
            <tr>
              <td colSpan={7} className="px-3 py-6 text-sm text-muted-foreground">
                {error}
              </td>
            </tr>
          </tbody>
        )}
        {!index && !error && (
          <tbody>
            <tr>
              <td colSpan={7} className="px-3 py-6">
                <div className="h-24 animate-pulse rounded-md bg-muted/50" />
              </td>
            </tr>
          </tbody>
        )}
        {groups.map((g) => (
          <tbody key={g.group}>
            <tr className="border-b bg-muted/40">
              <th colSpan={7} className="px-3 py-1.5 text-left text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                {g.group}
              </th>
            </tr>
            {g.items.map((it) => (
              <Row key={it.fam.id} item={it} read={reads[it.fam.id]} onNear={request} onOpen={(href) => router.push(href)} />
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}

function Row({ item, read, onNear, onOpen }: { item: Item; read: Read | "error" | undefined; onNear: (it: Item) => void; onOpen: (href: string) => void }) {
  const ref = React.useRef<HTMLTableRowElement>(null)
  React.useEffect(() => {
    const el = ref.current
    if (!el || read) return
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          onNear(item)
          io.disconnect()
        }
      },
      { rootMargin: "300px 0px" }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [item, read, onNear])

  const href = item.leadSources[0] ? dossierHref(item.leadSources[0], item.lead) : null
  const r = read && read !== "error" ? read : null
  const us = r?.us[r.us.length - 1] ?? null
  const ma = r?.ma[r.ma.length - 1] ?? null
  const then = r?.us.find((p) => p.year === BASE_YEAR) ?? null
  const failed = read === "error"
  return (
    <tr ref={ref} className={cn("border-b align-middle", href && "cursor-pointer hover:bg-muted/50")} onClick={() => href && onOpen(href)}>
      <td className="px-3 py-2.5 font-semibold">
        {href ? (
          <Link href={href} onClick={(e) => e.stopPropagation()} className="hover:underline">
            {item.fam.label}
          </Link>
        ) : (
          item.fam.label
        )}
      </td>
      <td className="px-3 py-2.5 text-foreground/80">{r ? r.band.label : item.seedLabel}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        {us ? (
          <span title={`${us.span}${us.n != null ? `, n ${us.n.toLocaleString("en-US")}` : ""}`}>
            <span className="font-semibold">{fmt(us.v, us.type)}</span>
            {us.moe != null && <span className="ml-1 text-[11px] text-muted-foreground">±{one(us.moe)}</span>}
          </span>
        ) : r || failed ? (
          <Absent />
        ) : (
          <Gap />
        )}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        {ma ? (
          <span className="font-semibold" title={`${r?.maSource ? shortSource(r.maSource) : ""} ${ma.span}`.trim()}>
            {fmt(ma.v, ma.type)}
          </span>
        ) : r || failed ? (
          <Absent />
        ) : (
          <Gap />
        )}
      </td>
      <td className="px-3 py-2.5">{r && r.us.length > 1 ? <Spark points={r.us} /> : r || failed ? <Absent /> : <SparkSkeleton />}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">{us && then && then !== us ? signed(us.v - then.v) : r || failed ? <Absent /> : <Gap />}</td>
      <td className="px-3 py-2.5 whitespace-nowrap text-foreground/80">
        {item.sources.map((s, i) => (
          <React.Fragment key={s.source}>
            {i > 0 && " · "}
            {shortSource(s.source)}
            {s.stale != null && ` ${s.stale}`}
          </React.Fragment>
        ))}
      </td>
    </tr>
  )
}

/** The trend in a cell: one bar a wave, the latest dark. */
function Spark({ points }: { points: Point[] }) {
  const recent = points.slice(-18)
  const top = Math.max(...recent.map((p) => p.v)) || 1
  return (
    <span className="flex h-[18px] w-[72px] items-end gap-px" role="img" aria-label={`${recent[0].year}–${recent[recent.length - 1].year}`}>
      {recent.map((p, i) => (
        <span key={p.year} className={cn("w-[3px] shrink-0 rounded-[1px]", i === recent.length - 1 ? "bg-zinc-800" : "bg-zinc-400")} style={{ height: `${Math.max(8, (p.v / top) * 100)}%` }} />
      ))}
    </span>
  )
}

function SparkSkeleton() {
  return <span className="block h-[18px] w-[72px] animate-pulse rounded-sm bg-muted" />
}
