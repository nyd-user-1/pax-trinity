"use client"

import * as React from "react"
import { Copy, EllipsisVerticalIcon, Loader2, PanelRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { MenuFoot, MenuRow, MenuSeparator } from "@/components/kebab-menu"
import { ON, RowMenu, TD, TR } from "@/components/row-dress"
import { Button } from "@govblock/ui/components/nova/button"
import { PaneTitleRow, type PaneSearch } from "@/components/bank/pane-bars"
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"

import { fieldDates, num, weightOf, year, type SourceRow } from "./audience-data"
import { type About } from "./audience-pane"

// The Rows view — the raw rows exactly as the source reported them, the
// instrument's default read: newest wave first, the total before its
// subgroups, bands in the order the latest total ranks them, and the three
// filters as chips. Sixty rows to a read on the house mark.

const PER_READ = 60

export function RowsView({
  rows,
  id,
  source,
  header,
  leading,
  trailing,
  search,
  about,
  onPick,
}: {
  /** The open question's rows alone. */
  rows: SourceRow[]
  id: string
  /** The source's key, for the weight mapping. */
  source: string | null
  /** The mount's own title-row content: it takes the row's left, the filter
   *  chips and `trailing` its right. */
  header: React.ReactNode
  /** The open question's own controls, before the heading. */
  leading?: React.ReactNode
  trailing?: React.ReactNode
  /** The title row's search, after the filters kebab. */
  search?: PaneSearch
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
    // Newest first by the field period's end, a poll's rows kept together, then segment and band.
    return kept.sort((a, b) => b[3].localeCompare(a[3]) || (a[10] ?? "").localeCompare(b[10] ?? "") || seg(a) - seg(b) || bnd(a) - bnd(b))
  }, [rows, wave, segment, band, order])

  // The columns this question's rows fill (Brendan, 2026-11-02): one that would print a dash
  // on every row isn't drawn. Where the rows come from several polls, a Poll column names each
  // (pollster, sponsor, population, the margin its release states), and where a year can't
  // tell two rows apart the wave prints its field dates.
  const shape = React.useMemo(() => {
    const polls = new Set(rows.map((r) => r[10] ?? "")).size > 1
    const seen = new Set<string>()
    let dated = false
    for (const r of rows) {
      const k = [year(r[3]), r[1], r[4], r[5], r[6]].join("|")
      if (seen.has(k)) {
        dated = true
        break
      }
      seen.add(k)
    }
    return {
      polls,
      dated,
      moe: rows.some((r) => r[9] != null),
      n: rows.some((r) => r[11] != null),
      weight: rows.some((r) => weightOf(source, year(r[3])) != null),
    }
  }, [rows, source])
  type Cells = ReturnType<typeof rowCells>
  const cols: { key: keyof Cells; label: string; right?: boolean; className: string }[] = [
    { key: "wave", label: "Wave", className: "text-muted-foreground tabular-nums whitespace-nowrap" },
    ...(shape.polls ? [{ key: "poll" as const, label: "Poll", className: "text-muted-foreground" }] : []),
    { key: "segment", label: "Segment", className: "" },
    { key: "band", label: "Band", className: "" },
    { key: "est", label: "Est. %", right: true, className: "font-semibold tabular-nums" },
    ...(shape.moe ? [{ key: "moe" as const, label: "MoE", right: true, className: "text-muted-foreground tabular-nums" }] : []),
    ...(shape.n ? [{ key: "n" as const, label: "n", right: true, className: "text-muted-foreground tabular-nums" }] : []),
    { key: "geo", label: "Geo", className: "text-muted-foreground" },
    ...(shape.weight ? [{ key: "weight" as const, label: "Weight", className: "text-muted-foreground" }] : []),
  ]

  const listed = sorted.slice(0, depth)
  const more = React.useCallback(() => setDepth((d) => d + PER_READ), [])
  // The filters live in one kebab, leading the title row before the search
  // (Brendan, 2026-10-29; at the right after the toggle since 2026-10-27,
  // when the chips crowded the question off the row). A group prints
  // only where there is something to pick: one wave, one band or no subgroups
  // leaves nothing to filter, and nothing at all leaves no kebab.
  const groups: { label: string; value: string; onPick: (v: string) => void; items: { value: string; label: string }[] }[] = []
  if (order.waves.length > 1) groups.push({ label: "Wave", value: wave, onPick: setWave, items: order.waves.map((w) => ({ value: w, label: w })) })
  if (order.segments.length > 0)
    groups.push({
      label: "Segment",
      value: segment,
      onPick: setSegment,
      items: [{ value: "total", label: "Total only" }, ...order.segments.map((s) => ({ value: s, label: s }))],
    })
  if (order.bands.length > 1) groups.push({ label: "Band", value: band, onPick: setBand, items: order.bands.map((b) => ({ value: b, label: b })) })
  const kebab = groups.length > 0 && (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Filters" title="Filters" className={cn("shrink-0", !leading && "-ml-1.5")}>
          <EllipsisVerticalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-96 w-max min-w-44 overflow-y-auto">
        {groups.map((g, i) => (
          <React.Fragment key={g.label}>
            {i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>{g.label}</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={g.value} onValueChange={g.onPick}>
              <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
              {g.items.map((it) => (
                <DropdownMenuRadioItem key={it.value} value={it.value}>
                  {it.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      {/* The mount's title row: Back where the list is hidden, the filters
          kebab, the search, the heading truncating, the trailing control at the right. */}
      <PaneTitleRow
        title={header}
        leading={
          leading || kebab ? (
            <>
              {leading}
              {kebab}
            </>
          ) : undefined
        }
        search={search}
      >
        {trailing}
      </PaneTitleRow>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {cols.map((col) => (
                <th key={col.key} className={cn("sticky top-0 z-10 border-b bg-background px-4 py-2 text-xs font-medium text-muted-foreground", col.right ? "text-right" : "text-left")}>
                  {col.label}
                </th>
              ))}
              <th aria-label="Row actions" className="sticky top-0 z-10 w-14 border-b bg-background" />
            </tr>
          </thead>
          <tbody>
            {listed.map((r, i) => {
              const c = rowCells(r, source, shape.dated)
              const pick = onPick ? () => onPick({ r, metric: id, segment: r[5] ? `${r[5]}: ${r[6]}` : "All" }) : undefined
              return (
                <tr
                  key={i}
                  onClick={pick}
                  // The house row (components/row-dress.tsx, Brendan, 2026-10-31).
                  className={cn(TR, !r[5] && "bg-muted/40", onPick && "cursor-pointer", onPick && about?.r === r && ON)}
                >
                  {/* The estimate cell knows its type: a count prints whole, a lift signed in points, a share one-decimal. */}
                  {cols.map((col) => (
                    <td key={col.key} className={cn(TD, "px-4", col.right && "text-right", col.className)}>
                      {c[col.key]}
                    </td>
                  ))}
                  <td className={cn(TD, "w-14 pr-5 pl-1 text-right")}>
                    <RowMenu>
                      {pick && <MenuRow icon={<PanelRight />} label="Open in the panel" onClick={pick} />}
                      <MenuRow icon={<Copy />} label="Copy row" onClick={() => void navigator.clipboard.writeText(cols.map((col) => c[col.key]).join("\t"))} />
                      <MenuSeparator />
                      <MenuFoot title={String(c.segment)} sub={`${c.wave} · ${c.band}`} />
                    </RowMenu>
                  </td>
                </tr>
              )
            })}
            {!sorted.length && (
              <tr>
                <td colSpan={cols.length + 1} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nothing matches the filters.
                </td>
              </tr>
            )}
            {depth < sorted.length && <MoreRow onMore={more} span={cols.length + 1} />}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** A row's cells as they print, for the table and for Copy row alike. */
function rowCells(r: SourceRow, source: string | null, dated = false) {
  return {
    wave: dated ? fieldDates(r[2], r[3]) : year(r[3]),
    poll: r[10] ?? "",
    segment: r[5] ? `${r[5]}: ${r[6]}` : "All",
    band: r[4] ?? "",
    est: r[8] === "count" ? num(r[7], 0) : r[8] === "lift_pp" ? `${r[7] >= 0 ? "+" : "−"}${num(Math.abs(r[7]))}` : num(r[7]),
    moe: r[9] != null ? `±${num(r[9], r[8] === "count" ? 0 : 1)}` : "—",
    n: r[11] != null ? num(r[11], 0) : "—",
    geo: r[1],
    weight: weightOf(source, year(r[3])) ?? "—",
  }
}

/** The row's kebab, shown on hover (held while open): the row into the panel, or onto the clipboard. */
/** The end of the table: reaching it reads sixty more. */
function MoreRow({ onMore, span }: { onMore: () => void; span: number }) {
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
      <td colSpan={span} className="py-3 text-center text-muted-foreground">
        <div ref={mark}>
          <Loader2 aria-label="Loading more" className="inline size-4 animate-spin" />
        </div>
      </td>
    </tr>
  )
}
