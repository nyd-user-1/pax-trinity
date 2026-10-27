"use client"

import * as React from "react"
import { EllipsisVerticalIcon, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"
import { PaneTitleRow } from "@/components/bank/pane-bars"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@govblock/ui/components/ny4/dropdown-menu"

import { num, weightOf, year, type SourceRow } from "./audience-data"
import { type About } from "./audience-pane"

// The Rows view — the raw rows exactly as the source reported them, the
// instrument's default read: newest wave first, the total before its
// subgroups, bands in the order the latest total ranks them, and the three
// filters as chips. Sixty rows to a read on the house mark. The export
// carries no weight column yet, so none prints.

const PER_READ = 60

export function RowsView({
  rows,
  id,
  source,
  header,
  leading,
  trailing,
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
  // The filters live in one kebab after the trailing control (Brendan,
  // 2026-10-27: the chips crowded the question off the row). A group prints
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
        <Button variant="ghost" size="icon-sm" aria-label="Filters" title="Filters" className="-mr-1.5 shrink-0">
          <EllipsisVerticalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 w-max min-w-44 overflow-y-auto">
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
      {/* The mount's title row: the heading truncating at the left, the
          trailing control then the filters kebab at the right. */}
      <PaneTitleRow title={header} leading={leading}>
        {trailing}
        {kebab}
      </PaneTitleRow>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              {["Wave", "Segment", "Band", "Est. %", "MoE", "n", "Geo", "Weight"].map((h, i) => (
                <th key={h} className={cn("sticky top-0 z-10 border-b bg-background px-4 py-2 text-xs font-medium text-muted-foreground", i >= 3 && i <= 5 ? "text-right" : "text-left")}>
                  {h}
                </th>
              ))}
              <th aria-label="Row actions" className="sticky top-0 z-10 w-10 border-b bg-background" />
            </tr>
          </thead>
          <tbody>
            {listed.map((r, i) => {
              const c = rowCells(r, source)
              const pick = onPick ? () => onPick({ r, metric: id, segment: r[5] ? `${r[5]}: ${r[6]}` : "All" }) : undefined
              return (
                <tr
                  key={i}
                  onClick={pick}
                  className={cn(
                    "group/row",
                    !r[5] && "bg-muted/40",
                    onPick && "cursor-pointer transition-[background-color,box-shadow] hover:bg-accent/60 hover:shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]",
                    onPick && about?.r === r && "bg-muted shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]"
                  )}
                >
                  <td className="border-b px-4 py-2 text-muted-foreground tabular-nums">{c.wave}</td>
                  <td className="border-b px-4 py-2">{c.segment}</td>
                  <td className="border-b px-4 py-2">{c.band}</td>
                  {/* The cell knows its estimate's type: a count prints whole, a lift signed in points, a share one-decimal. */}
                  <td className="border-b px-4 py-2 text-right font-semibold tabular-nums">{c.est}</td>
                  <td className="border-b px-4 py-2 text-right text-muted-foreground tabular-nums">{c.moe}</td>
                  <td className="border-b px-4 py-2 text-right text-muted-foreground tabular-nums">{c.n}</td>
                  <td className="border-b px-4 py-2 text-muted-foreground">{c.geo}</td>
                  <td className="border-b px-4 py-2 text-muted-foreground">{c.weight}</td>
                  <td className="w-10 border-b px-1 py-1 text-right">
                    <RowKebab onOpen={pick} copy={[c.wave, c.segment, c.band, c.est, c.moe, c.n, c.geo, c.weight].join("\t")} />
                  </td>
                </tr>
              )
            })}
            {!sorted.length && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">
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

/** A row's cells as they print, for the table and for Copy row alike. */
function rowCells(r: SourceRow, source: string | null) {
  return {
    wave: year(r[3]),
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
function RowKebab({ onOpen, copy }: { onOpen?: () => void; copy: string }) {
  const [open, setOpen] = React.useState(false)
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Row actions"
          onClick={(event) => event.stopPropagation()}
          className={cn("opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100", open && "opacity-100")}
        >
          <EllipsisVerticalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      {/* The menu portals out, but React bubbles its clicks to the row: stop them here. */}
      <DropdownMenuContent align="end" className="w-max min-w-40" onClick={(event) => event.stopPropagation()}>
        {onOpen && <DropdownMenuItem onClick={onOpen}>Open in the panel</DropdownMenuItem>}
        <DropdownMenuItem onClick={() => void navigator.clipboard.writeText(copy)}>Copy row</DropdownMenuItem>
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
      <td colSpan={9} className="py-3 text-center text-muted-foreground">
        <div ref={mark}>
          <Loader2 aria-label="Loading more" className="inline size-4 animate-spin" />
        </div>
      </td>
    </tr>
  )
}
