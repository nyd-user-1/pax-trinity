"use client"

import * as React from "react"
import { ChevronDownIcon, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"

import { num, weightOf, year, type SourceRow } from "./audience-data"
import { type About } from "./audience-pane"

// The Rows view — the raw rows exactly as the source reported them, the
// instrument's default read: newest wave first, the total before its
// subgroups, bands in the order the latest total ranks them, and the three
// filters as pills. Sixty rows to a read on the house mark. The export
// carries no weight column yet, so none prints.

const PER_READ = 60

export function RowsView({
  rows,
  title,
  id,
  short,
  source,
  header,
  trailing,
  about,
  onPick,
}: {
  /** The open question's rows alone. */
  rows: SourceRow[]
  title: string
  id: string
  /** The source's short name. */
  short: string
  /** The source's key, for the weight mapping. */
  source: string | null
  /** A mounting view's own bar content: it takes the title bar's left, the
   *  showing note its right, and `trailing` the filter row's right. */
  header?: React.ReactNode
  trailing?: React.ReactNode
  /** A clicked row hands itself to the About panel, where the mount has one. */
  about?: About | null
  onPick?: (a: About) => void
}) {
  const [wave, setWave] = React.useState("all")
  const [segment, setSegment] = React.useState("all")
  const [band, setBand] = React.useState("all")
  const [depth, setDepth] = React.useState(PER_READ)
  React.useEffect(() => {
    setWave("all")
    setSegment("all")
    setBand("all")
  }, [id])
  React.useEffect(() => setDepth(PER_READ), [id, wave, segment, band])

  // One pass each over the question's rows: the waves newest first, the dims
  // and their values in the file's own order, the bands by the latest
  // total's size — the order the wireframe reads in.
  const order = React.useMemo(() => {
    const yearSet = new Set<string>()
    const dims: string[] = []
    const valuesOf = new Map<string, string[]>()
    const bandSeen: string[] = []
    for (const r of rows) {
      yearSet.add(year(r[3]))
      if (r[5]) {
        let vs = valuesOf.get(r[5])
        if (!vs) {
          dims.push(r[5])
          vs = []
          valuesOf.set(r[5], vs)
        }
        if (r[6] && !vs.includes(r[6])) vs.push(r[6])
      }
      if (r[4] && !bandSeen.includes(r[4])) bandSeen.push(r[4])
    }
    const waves = [...yearSet].sort((a, b) => b.localeCompare(a))
    const latest = waves[0]
    const latestTotals = rows.filter((r) => !r[5] && year(r[3]) === latest)
    const bands = [...bandSeen].sort((a, b) => {
      const ea = latestTotals.find((r) => r[4] === a)?.[7] ?? -Infinity
      const eb = latestTotals.find((r) => r[4] === b)?.[7] ?? -Infinity
      return eb - ea
    })
    const bandRank = new Map(bands.map((b, i) => [b, i]))
    const segRank = new Map<string, number>()
    dims.forEach((d, di) => (valuesOf.get(d) ?? []).forEach((v, vi) => segRank.set(`${d}: ${v}`, di * 1000 + vi)))
    const segments = [...segRank.keys()]
    return { waves, bands, bandRank, segRank, segments }
  }, [rows])

  const sorted = React.useMemo(() => {
    const kept = rows.filter(
      (r) =>
        (wave === "all" || year(r[3]) === wave) &&
        (segment === "all" || (segment === "total" ? !r[5] : r[5] != null && `${r[5]}: ${r[6]}` === segment)) &&
        (band === "all" || r[4] === band)
    )
    const seg = (r: SourceRow) => (r[5] ? (order.segRank.get(`${r[5]}: ${r[6]}`) ?? 999999) : -1)
    const bnd = (r: SourceRow) => (r[4] ? (order.bandRank.get(r[4]) ?? 999) : 999)
    return kept.sort((a, b) => year(b[3]).localeCompare(year(a[3])) || seg(a) - seg(b) || bnd(a) - bnd(b))
  }, [rows, wave, segment, band, order])

  const listed = sorted.slice(0, depth)
  const more = React.useCallback(() => setDepth((d) => d + PER_READ), [])
  const geos = React.useMemo(() => [...new Set(rows.map((r) => r[1]))].join(" · "), [rows])

  const note = (
    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
      Showing {sorted.length ? `1–${Math.min(depth, sorted.length).toLocaleString("en-US")}` : "0"} of {sorted.length.toLocaleString("en-US")}
    </span>
  )

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      {header ? (
        <div className="flex h-[52px] shrink-0 items-center gap-2 border-b px-4">
          {header}
          {note}
        </div>
      ) : (
        <div className="flex h-[52px] shrink-0 items-center gap-2.5 border-b px-4">
          <h2 className="truncate text-[15px] font-semibold">{title}</h2>
          <span className="shrink-0 text-xs text-muted-foreground">
            {short} · {id} · {geos} · {rows.length.toLocaleString("en-US")} rows
          </span>
        </div>
      )}

      <div className="flex h-11 shrink-0 items-center gap-2 overflow-hidden border-b px-4">
        <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Filter</span>
        <Pill label="Wave" value={wave} display={wave} onPick={setWave} items={order.waves.map((w) => ({ value: w, label: w }))} />
        <Pill
          label="Segment"
          value={segment}
          display={segment === "total" ? "total" : segment}
          onPick={setSegment}
          items={[{ value: "total", label: "Total only" }, ...order.segments.map((s) => ({ value: s, label: s }))]}
        />
        <Pill label="Band" value={band} display={band} onPick={setBand} items={order.bands.map((b) => ({ value: b, label: b }))} />
        {header ? <div className="ml-auto flex shrink-0 items-center">{trailing}</div> : note}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {["Wave", "Segment", "Band", "Est. %", "MoE", "n", "Geo", "Weight"].map((h, i) => (
                <th key={h} className={cn("sticky top-0 z-10 border-b bg-background px-4 py-2 text-xs font-medium text-muted-foreground", i >= 3 && i <= 5 ? "text-right" : "text-left")}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {listed.map((r, i) => (
              <tr
                key={i}
                onClick={onPick ? () => onPick({ r, metric: id, segment: r[5] ? `${r[5]}: ${r[6]}` : "All" }) : undefined}
                className={cn(
                  !r[5] && "bg-muted/40",
                  onPick && "cursor-pointer transition-[background-color,box-shadow] hover:bg-accent/60 hover:shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]",
                  onPick && about?.r === r && "bg-muted shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]"
                )}
              >
                <td className="border-b px-4 py-2 text-muted-foreground tabular-nums">{year(r[3])}</td>
                <td className="border-b px-4 py-2">{r[5] ? `${r[5]}: ${r[6]}` : "All"}</td>
                <td className="border-b px-4 py-2">{r[4]}</td>
                {/* The cell knows its estimate's type: a count prints whole, a lift signed in points, a share one-decimal. */}
                <td className="border-b px-4 py-2 text-right font-semibold tabular-nums">{r[8] === "count" ? num(r[7], 0) : r[8] === "lift_pp" ? `${r[7] >= 0 ? "+" : "−"}${num(Math.abs(r[7]))}` : num(r[7])}</td>
                <td className="border-b px-4 py-2 text-right text-muted-foreground tabular-nums">{r[9] != null ? `±${num(r[9], r[8] === "count" ? 0 : 1)}` : "—"}</td>
                <td className="border-b px-4 py-2 text-right text-muted-foreground tabular-nums">{r[11] != null ? num(r[11], 0) : "—"}</td>
                <td className="border-b px-4 py-2 text-muted-foreground">{r[1]}</td>
                <td className="border-b px-4 py-2 text-muted-foreground">{weightOf(source, year(r[3])) ?? "—"}</td>
              </tr>
            ))}
            {!sorted.length && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nothing matches the filters.
                </td>
              </tr>
            )}
            {depth < sorted.length && <MoreRow onMore={more} />}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** A filter pill: the dark chip of the wireframe, a radio menu underneath. */
function Pill({ label, value, display, items, onPick }: { label: string; value: string; display: string; items: { value: string; label: string }[]; onPick: (v: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex items-center gap-1 rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background">
          {label}: {value === "all" ? "all" : display}
          <ChevronDownIcon className="size-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-max min-w-40 overflow-y-auto">
        <DropdownMenuRadioGroup value={value} onValueChange={onPick}>
          <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
          {items.map((it) => (
            <DropdownMenuRadioItem key={it.value} value={it.value}>
              {it.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The end of the table: reaching it reads sixty more. */
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
    <tr>
      <td colSpan={8} className="py-3 text-center text-muted-foreground">
        <div ref={mark}>
          <Loader2 aria-label="Loading more" className="inline size-4 animate-spin" />
        </div>
      </td>
    </tr>
  )
}
