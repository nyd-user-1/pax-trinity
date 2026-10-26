"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { TableBlock } from "@/components/blocks"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/components/nova/table"
import { cn } from "@/ui/lib/utils"

import { AudienceBrowse } from "./audience-browse"
import { groupSources, num, period, shortSource, value, type AudienceIndex, type SourceGroup, type SourceRow } from "./audience-data"

// /audience: the audience database. Browse is the primary read — the inbox
// dress over the store's committed JSON exports (public/audience-data/) —
// and Rows keeps the flat table behind the view toggle. The index names the
// sources, metrics and geographies; a source's files (every part of a split
// one) load only when it is picked, the smallest source first, each kept
// once read.

const PER_READ = 12
const VIEWS = [
  { value: "browse", label: "Browse" },
  { value: "rows", label: "Rows" },
] as const

export function AudienceBlock() {
  const [index, setIndex] = React.useState<AudienceIndex | null>(null)
  const [source, setSource] = React.useState<string | null>(null)
  const [files, setFiles] = React.useState<Record<string, SourceRow[]>>({})
  const [view, setView] = React.useState<string>("browse")
  const [query, setQuery] = React.useState("")
  const [depth, setDepth] = React.useState(PER_READ)
  const [error, setError] = React.useState<string | null>(null)

  const groups = React.useMemo<SourceGroup[]>(() => (index ? groupSources(index.sources) : []), [index])

  React.useEffect(() => {
    let on = true
    fetch("/audience-data/index.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`index.json answered ${r.status}`))))
      .then((idx: AudienceIndex) => {
        if (!on) return
        setIndex(idx)
        setSource([...groupSources(idx.sources)].sort((a, b) => a.rows - b.rows)[0]?.source ?? null)
      })
      .catch((e: Error) => on && setError(e.message))
    return () => {
      on = false
    }
  }, [])

  React.useEffect(() => {
    // Once a source's parts are kept, the early return keeps this effect idle.
    if (!index || !source || files[source]) return
    const g = groupSources(index.sources).find((x) => x.source === source)
    if (!g) return
    let on = true
    Promise.all(g.files.map((f) => fetch(`/audience-data/${f}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${f} answered ${r.status}`))))))
      .then((parts: SourceRow[][]) => {
        if (!on) return
        const data = parts.flat()
        if (data.length !== g.rows) console.warn(`audience: ${source} concatenated to ${data.length} rows; the index says ${g.rows}`)
        setFiles((prev) => ({ ...prev, [source]: data }))
      })
      .catch((e: Error) => on && setError(e.message))
    return () => {
      on = false
    }
  }, [index, source, files])

  // A new source or a new needle starts the flat read over.
  React.useEffect(() => setDepth(PER_READ), [source, query])

  const metricLabel = React.useMemo(() => new Map((index?.constructs ?? []).map((c) => [c.construct, c.label])), [index])
  const geographies = React.useMemo(() => new Map((index?.geographies ?? []).map((g) => [g.code, g.name])), [index])
  const rows = source ? files[source] : undefined
  const short = source ? shortSource(source) : ""

  const matched = React.useMemo(() => {
    if (!rows) return []
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => [metricLabel.get(r[0]) ?? r[0], geographies.get(r[1]) ?? r[1], r[4] ?? "", r[10] ?? ""].some((s) => s.toLowerCase().includes(q)))
  }, [rows, query, metricLabel, geographies])
  const shown = query.trim() ? matched : matched.slice(0, depth)
  const canLoad = view === "rows" && !query.trim() && depth < matched.length
  const more = React.useCallback(() => setDepth((d) => d + PER_READ), [])

  // What Download writes: every matched row, rendered the way the table shows it.
  const records = React.useMemo(
    () =>
      matched.map((r) => ({
        metric: metricLabel.get(r[0]) ?? r[0],
        option: r[4] ?? "",
        value: value(r[7], r[8], r[9]),
        geography: geographies.get(r[1]) ?? r[1],
        subgroup: r[5] ? `${r[5]}: ${r[6]}` : "All",
        period: period(r[2], r[3]),
        n: r[11] ?? "",
        source: short,
      })),
    [matched, metricLabel, geographies, short]
  )

  return (
    <TableBlock
      fill
      panel={view === "browse"}
      title="Audience"
      search={view === "browse" ? "Search metrics…" : "Search metrics, places, options…"}
      searchValue={query}
      onSearch={setQuery}
      rows={records}
      name="audience"
      views={VIEWS}
      view={view}
      onView={setView}
      tools={
        <div className="ml-1 flex items-center gap-0.5 rounded-full bg-slate-100/80 p-0.5 text-xs">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => setView(v.value)}
              aria-pressed={view === v.value}
              className={cn("rounded-full px-2.5 py-1 transition-colors", view === v.value ? "bg-white font-semibold text-pax2-blue shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              {v.label}
            </button>
          ))}
        </div>
      }
    >
      {view === "browse" && index ? (
        <AudienceBrowse index={index} groups={groups} source={source} onSource={setSource} files={files} query={query} error={error} />
      ) : view === "browse" ? (
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-slate-500">
          {error ? <span className="text-pax2-red">The data did not load: {error}</span> : <Loader2 aria-label="Loading" className="size-4 animate-spin" />}
        </div>
      ) : (
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/60">
              <TableHead className="w-[26%]">Metric</TableHead>
              <TableHead className="w-[16%]">Value</TableHead>
              <TableHead className="w-[16%]">Geography</TableHead>
              <TableHead className="w-[14%]">Segment</TableHead>
              <TableHead className="w-[9%]">Period</TableHead>
              <TableHead className="w-[9%]">n</TableHead>
              <TableHead className="w-[10%]">Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error && (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-sm text-pax2-red">
                  The data did not load: {error}
                </TableCell>
              </TableRow>
            )}
            {!error && !rows && (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-sm text-slate-500">
                  <Loader2 aria-hidden className="mr-2 inline size-4 animate-spin" />
                  Reading {short}…
                </TableCell>
              </TableRow>
            )}
            {rows && !shown.length && (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-sm text-slate-500">
                  {query.trim() ? `Nothing matching “${query.trim()}”.` : "Nothing on file."}
                </TableCell>
              </TableRow>
            )}
            {shown.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="py-2.5 align-top">
                  <p className="truncate font-semibold text-slate-900">{metricLabel.get(r[0]) ?? r[0]}</p>
                  {r[4] && <p className="truncate text-xs text-slate-400">{r[4]}</p>}
                </TableCell>
                <TableCell className="py-2.5 align-top text-sm text-slate-900 tabular-nums">{value(r[7], r[8], r[9])}</TableCell>
                <TableCell className="truncate py-2.5 align-top text-sm text-slate-600">{geographies.get(r[1]) ?? r[1]}</TableCell>
                <TableCell className="truncate py-2.5 align-top text-sm text-slate-600">{r[5] ? `${r[5]}: ${r[6]}` : "All"}</TableCell>
                <TableCell className="py-2.5 align-top text-sm text-slate-600 tabular-nums">{period(r[2], r[3])}</TableCell>
                <TableCell className="py-2.5 align-top text-sm text-slate-600 tabular-nums">{r[11] != null ? num(r[11], 0) : ""}</TableCell>
                <TableCell className="truncate py-2.5 align-top text-sm text-slate-600">{short}</TableCell>
              </TableRow>
            ))}
            {canLoad && <MoreRow onMore={more} />}
          </TableBody>
        </Table>
      )}
    </TableBlock>
  )
}

/** The end of the flat table: reaching it reads twelve more. */
function MoreRow({ onMore }: { onMore: () => void }) {
  const mark = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const el = mark.current
    if (!el) return
    const o = new IntersectionObserver((xs) => xs.some((x) => x.isIntersecting) && onMore())
    o.observe(el)
    return () => o.disconnect()
  }, [onMore])
  return (
    <TableRow>
      <TableCell colSpan={7} className="py-3 text-center text-slate-400">
        <div ref={mark}>
          <Loader2 aria-label="Loading more" className="inline size-4 animate-spin" />
        </div>
      </TableCell>
    </TableRow>
  )
}
