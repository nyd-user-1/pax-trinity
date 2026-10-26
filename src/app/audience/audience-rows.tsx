"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import { ScrollArea } from "@govblock/ui/components/ny4/scroll-area"

import { BackButton } from "./audience-pane"
import { num, period, value, type SourceRow } from "./audience-data"

// The flat table, behind the list toolbar's menu: every row of the picked
// source as one line, twelve to a read with twelve more on reaching the end.

const PER_READ = 12

export function AudienceRows({
  rows,
  short,
  label,
  place,
  query,
  onBack,
  error,
}: {
  rows: SourceRow[] | undefined
  short: string
  label: (id: string) => string
  place: (code: string) => string
  query: string
  onBack: () => void
  error: string | null
}) {
  const [depth, setDepth] = React.useState(PER_READ)
  React.useEffect(() => setDepth(PER_READ), [query, rows])
  const matched = React.useMemo(() => {
    if (!rows) return []
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => [label(r[0]), place(r[1]), r[4] ?? "", r[10] ?? ""].some((s) => s.toLowerCase().includes(q)))
  }, [rows, query, label, place])
  const shown = query.trim() ? matched : matched.slice(0, depth)
  const canLoad = !query.trim() && depth < matched.length
  const more = React.useCallback(() => setDepth((d) => d + PER_READ), [])

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex h-[52px] shrink-0 items-center gap-2 border-b px-4">
        <BackButton onBack={onBack} />
        <span className="text-sm font-medium">Flat table</span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {matched.length.toLocaleString("en-US")} rows · {short}
        </span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className="bg-muted/60">
              <th className="w-[26%] px-2.5 py-2 text-left text-xs font-medium text-muted-foreground">Metric</th>
              <th className="w-[16%] px-2.5 py-2 text-left text-xs font-medium text-muted-foreground">Value</th>
              <th className="w-[16%] px-2.5 py-2 text-left text-xs font-medium text-muted-foreground">Geography</th>
              <th className="w-[14%] px-2.5 py-2 text-left text-xs font-medium text-muted-foreground">Segment</th>
              <th className="w-[9%] px-2.5 py-2 text-left text-xs font-medium text-muted-foreground">Period</th>
              <th className="w-[9%] px-2.5 py-2 text-left text-xs font-medium text-muted-foreground">n</th>
              <th className="w-[10%] px-2.5 py-2 text-left text-xs font-medium text-muted-foreground">Source</th>
            </tr>
          </thead>
          <tbody>
            {error && (
              <tr>
                <td colSpan={7} className="px-2.5 py-6 text-sm text-pax2-red">
                  The data did not load: {error}
                </td>
              </tr>
            )}
            {!error && !rows && (
              <tr>
                <td colSpan={7} className="px-2.5 py-6 text-sm text-muted-foreground">
                  <Loader2 aria-hidden className="mr-2 inline size-4 animate-spin" />
                  Reading {short}…
                </td>
              </tr>
            )}
            {rows && !shown.length && (
              <tr>
                <td colSpan={7} className="px-2.5 py-6 text-sm text-muted-foreground">
                  {query.trim() ? `Nothing matching “${query.trim()}”.` : "Nothing on file."}
                </td>
              </tr>
            )}
            {shown.map((r, i) => (
              <tr key={i} className="border-b">
                <td className="px-2.5 py-2.5 align-top">
                  <p className="truncate text-sm font-semibold">{label(r[0])}</p>
                  {r[4] && <p className="truncate text-xs text-muted-foreground">{r[4]}</p>}
                </td>
                <td className="px-2.5 py-2.5 align-top text-sm tabular-nums">{value(r[7], r[8], r[9])}</td>
                <td className="truncate px-2.5 py-2.5 align-top text-sm text-muted-foreground">{place(r[1])}</td>
                <td className="truncate px-2.5 py-2.5 align-top text-sm text-muted-foreground">{r[5] ? `${r[5]}: ${r[6]}` : "All"}</td>
                <td className="px-2.5 py-2.5 align-top text-sm text-muted-foreground tabular-nums">{period(r[2], r[3])}</td>
                <td className="px-2.5 py-2.5 align-top text-sm text-muted-foreground tabular-nums">{r[11] != null ? num(r[11], 0) : ""}</td>
                <td className="truncate px-2.5 py-2.5 align-top text-sm text-muted-foreground">{short}</td>
              </tr>
            ))}
            {canLoad && <MoreRow onMore={more} />}
          </tbody>
        </table>
      </ScrollArea>
    </div>
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
    <tr>
      <td colSpan={7} className="py-3 text-center text-muted-foreground">
        <div ref={mark}>
          <Loader2 aria-label="Loading more" className="inline size-4 animate-spin" />
        </div>
      </td>
    </tr>
  )
}
