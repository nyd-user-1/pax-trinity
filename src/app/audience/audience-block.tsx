"use client"

import * as React from "react"
import { ChevronDown, Loader2 } from "lucide-react"

import { TableBlock } from "@/components/blocks"
import { KebabMenu, MenuRow } from "@/components/kebab-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/components/nova/table"

// /audience: the audience database, browsable — the glossary's dress over the
// store's committed JSON exports (public/audience-data/). The index names the
// sources, constructs and geographies; a source's rows load only when it is
// picked (the smallest source opens first), and the table reads twelve at a
// time the changelog's way.

type Source = { source: string; label: string; rows: number; file: string }
type AudienceIndex = {
  sources: Source[]
  constructs: { construct: string; label: string; definition: string }[]
  geographies: { code: string; name: string; level: string; parent: string | null }[]
}
// The export's row shape: [construct, geo_code, period_start, period_end,
// response_option, subgroup_dim, subgroup_value, estimate, estimate_type, moe,
// item_text] — item_text null except polls and results.
type SourceRow = [string, string, number, number, string | null, string | null, string | null, number, string, number | null, string | null]

const PER_READ = 12

const year = (x: number) => String(x).slice(0, 4)
const period = (start: number, end: number) => (year(start) === year(end) ? year(start) : `${year(start)}–${year(end)}`)
const num = (x: number, digits = 1) => x.toLocaleString("en-US", { maximumFractionDigits: digits })
const value = (estimate: number, type: string, moe: number | null) => {
  const body = type === "pct" ? `${num(estimate)}%` : type === "lift_pp" ? `${estimate >= 0 ? "+" : "−"}${num(Math.abs(estimate))} pp` : num(estimate, 0)
  return moe == null ? body : `${body} ± ${num(moe, type === "count" ? 0 : 1)}`
}

export function AudienceBlock() {
  const [index, setIndex] = React.useState<AudienceIndex | null>(null)
  const [source, setSource] = React.useState<string | null>(null)
  const [rows, setRows] = React.useState<SourceRow[] | null>(null)
  const [query, setQuery] = React.useState("")
  const [depth, setDepth] = React.useState(PER_READ)
  const [error, setError] = React.useState<string | null>(null)
  const cache = React.useRef(new Map<string, SourceRow[]>())

  React.useEffect(() => {
    let on = true
    fetch("/audience-data/index.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`index.json answered ${r.status}`))))
      .then((idx: AudienceIndex) => {
        if (!on) return
        setIndex(idx)
        setSource([...idx.sources].sort((a, b) => a.rows - b.rows)[0]?.source ?? null)
      })
      .catch((e: Error) => on && setError(e.message))
    return () => {
      on = false
    }
  }, [])

  React.useEffect(() => {
    if (!index || !source) return
    const had = cache.current.get(source)
    if (had) {
      setRows(had)
      return
    }
    const file = index.sources.find((s) => s.source === source)?.file
    if (!file) return
    let on = true
    setRows(null)
    fetch(`/audience-data/${file}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${file} answered ${r.status}`))))
      .then((data: SourceRow[]) => {
        if (!on) return
        cache.current.set(source, data)
        setRows(data)
      })
      .catch((e: Error) => on && setError(e.message))
    return () => {
      on = false
    }
  }, [index, source])

  // A new source or a new needle starts the read over.
  React.useEffect(() => setDepth(PER_READ), [source, query])

  const constructs = React.useMemo(() => new Map((index?.constructs ?? []).map((c) => [c.construct, c.label])), [index])
  const geographies = React.useMemo(() => new Map((index?.geographies ?? []).map((g) => [g.code, g.name])), [index])
  const label = index?.sources.find((s) => s.source === source)?.label ?? source ?? ""

  const matched = React.useMemo(() => {
    if (!rows) return []
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => [constructs.get(r[0]) ?? r[0], geographies.get(r[1]) ?? r[1], r[4] ?? "", r[10] ?? ""].some((s) => s.toLowerCase().includes(q)))
  }, [rows, query, constructs, geographies])
  const shown = query.trim() ? matched : matched.slice(0, depth)
  const canLoad = !query.trim() && depth < matched.length
  const more = React.useCallback(() => setDepth((d) => d + PER_READ), [])

  // What Download writes: every matched row, rendered the way the table shows it.
  const records = React.useMemo(
    () =>
      matched.map((r) => ({
        construct: constructs.get(r[0]) ?? r[0],
        option: r[4] ?? "",
        value: value(r[7], r[8], r[9]),
        geography: geographies.get(r[1]) ?? r[1],
        subgroup: r[5] ? `${r[5]}: ${r[6]}` : "All",
        period: period(r[2], r[3]),
        source: label,
      })),
    [matched, constructs, geographies, label]
  )

  return (
    <TableBlock
      fill
      title="Audience"
      search="Search constructs, places, options…"
      searchValue={query}
      onSearch={setQuery}
      rows={records}
      name="audience"
      tools={index && source ? <SourcePicker sources={index.sources} source={source} onSource={setSource} /> : undefined}
    >
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="bg-muted/60">
            <TableHead className="w-[26%]">Construct</TableHead>
            <TableHead className="w-[16%]">Value</TableHead>
            <TableHead className="w-[18%]">Geography</TableHead>
            <TableHead className="w-[16%]">Subgroup</TableHead>
            <TableHead className="w-[10%]">Period</TableHead>
            <TableHead className="w-[14%]">Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {error && (
            <TableRow>
              <TableCell colSpan={6} className="py-6 text-sm text-pax2-red">
                The data did not load: {error}
              </TableCell>
            </TableRow>
          )}
          {!error && !rows && (
            <TableRow>
              <TableCell colSpan={6} className="py-6 text-sm text-slate-500">
                <Loader2 aria-hidden className="mr-2 inline size-4 animate-spin" />
                Reading {label}…
              </TableCell>
            </TableRow>
          )}
          {rows && !shown.length && (
            <TableRow>
              <TableCell colSpan={6} className="py-6 text-sm text-slate-500">
                {query.trim() ? `Nothing matching “${query.trim()}”.` : "Nothing on file."}
              </TableCell>
            </TableRow>
          )}
          {shown.map((r, i) => (
            <TableRow key={i}>
              <TableCell className="py-2.5 align-top">
                <p className="truncate font-semibold text-slate-900">{constructs.get(r[0]) ?? r[0]}</p>
                {r[4] && <p className="truncate text-xs text-slate-400">{r[4]}</p>}
              </TableCell>
              <TableCell className="py-2.5 align-top text-sm tabular-nums text-slate-900">{value(r[7], r[8], r[9])}</TableCell>
              <TableCell className="truncate py-2.5 align-top text-sm text-slate-600">{geographies.get(r[1]) ?? r[1]}</TableCell>
              <TableCell className="truncate py-2.5 align-top text-sm text-slate-600">{r[5] ? `${r[5]}: ${r[6]}` : "All"}</TableCell>
              <TableCell className="py-2.5 align-top text-sm tabular-nums text-slate-600">{period(r[2], r[3])}</TableCell>
              <TableCell className="truncate py-2.5 align-top text-sm text-slate-600">{label}</TableCell>
            </TableRow>
          ))}
          {canLoad && <MoreRow onMore={more} />}
        </TableBody>
      </Table>
    </TableBlock>
  )
}

/** The end of the table: reaching it reads twelve more. */
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
      <TableCell colSpan={6} className="py-3 text-center text-slate-400">
        <div ref={mark}>
          <Loader2 aria-label="Loading more" className="inline size-4 animate-spin" />
        </div>
      </TableCell>
    </TableRow>
  )
}

/** The source, picked in the header beside the title; only the picked one's file is read. */
function SourcePicker({ sources, source, onSource }: { sources: Source[]; source: string; onSource: (s: string) => void }) {
  const current = sources.find((s) => s.source === source)
  return (
    <KebabMenu
      label="Pick the source"
      align="left"
      trigger={
        <span className="flex items-center gap-1 text-[13px] font-medium">
          {current?.label ?? source}
          <ChevronDown className="size-3.5" />
        </span>
      }
      triggerClassName="ml-1 flex h-7 shrink-0 items-center rounded-full bg-slate-100/80 px-2.5 text-slate-600 outline-none hover:bg-slate-100 hover:text-slate-900 aria-expanded:bg-slate-100"
    >
      {sources.map((s) => (
        <MenuRow key={s.source} label={s.label} hint={`${s.rows.toLocaleString("en-US")} rows`} checked={s.source === source} onClick={() => onSource(s.source)} />
      ))}
    </KebabMenu>
  )
}
