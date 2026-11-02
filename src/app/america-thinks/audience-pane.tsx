"use client"

import * as React from "react"
import { X } from "lucide-react"

import { latestRow, levelRank, num, period, shortSource, value, year, type MetricInfo, type SourceGroup, type SourceRow } from "./audience-data"

// The About panel — everything a clicked value carries, the same question set
// beside its other sources. Beside the compare grid it stands as the fourth
// column at 420; over an open question it is a layer in the pane (pass 2,
// 2026-10-27), its X returning the view it covered.

export type About = { r: SourceRow; metric: string; segment: string }

/** Compilers a source label names whose license asks for a linked credit: VoteHub's
 *  polls are CC BY 4.0 (the lead's ruling, 2026-11-02: the link sits where the data shows). */
const CREDITS: Record<string, string> = { VoteHub: "https://votehub.com/polls/" }
const CREDIT_NAMES = new RegExp(`(${Object.keys(CREDITS).join("|")})`)

function credited(label: string): React.ReactNode {
  return label.split(CREDIT_NAMES).map((part, i) =>
    CREDITS[part] ? (
      <a key={i} href={CREDITS[part]} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
        {part}
      </a>
    ) : (
      part
    )
  )
}

export function AboutPanel({
  layer = false,
  about,
  onClose,
  source,
  groups,
  files,
  info,
  label,
  place,
  geoLevel,
}: {
  /** In the pane, full width with the reading capped, rather than the 420 column. */
  layer?: boolean
  about: About
  onClose: () => void
  source: string | null
  groups: SourceGroup[]
  files: Record<string, SourceRow[]>
  info: Map<string, MetricInfo>
  label: (id: string) => string
  place: (code: string) => string
  geoLevel: Map<string, string>
}) {
  // The same metric and option, read from every other source opened so far,
  // each at its own baseline geography.
  const bench = React.useMemo(() => {
    const out: { name: string; v: string; year: string }[] = []
    for (const [key, data] of Object.entries(files)) {
      if (key === source) continue
      const rs = data.filter((r) => r[0] === about.metric && !r[5])
      if (!rs.length) continue
      let base = rs[0][1]
      for (const r of rs) if (levelRank(geoLevel.get(r[1])) < levelRank(geoLevel.get(base))) base = r[1]
      const opt = about.r[4] ?? null
      const t = latestRow(rs.filter((r) => r[1] === base && (opt === null || (r[4] ?? null) === opt)))
      if (t) out.push({ name: `${shortSource(key)} · ${place(base)}`, v: value(t[7], t[8], null), year: year(t[3]) })
    }
    return out
  }, [about, files, source, geoLevel, place])

  const c = info.get(about.metric)
  const body = (
    <>
      <button type="button" onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
        <X className="size-4" />
      </button>
      <h3 className="pr-7 text-sm font-semibold text-pax2-blue">
        {label(about.metric)} — {about.segment}
      </h3>
      <p className="mt-0.5 mb-3.5 text-xs text-muted-foreground">
        {credited(groups.find((g) => g.source === source)?.label ?? "")} · {period(about.r[2], about.r[3])}
      </p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 border-t py-2.5 text-[13px]">
        <dt className="text-muted-foreground">Estimate</dt>
        <dd className="text-right font-semibold tabular-nums">{value(about.r[7], about.r[8], null)}</dd>
        {about.r[9] != null && (
          <>
            <dt className="text-muted-foreground">Margin of error</dt>
            <dd className="text-right font-semibold tabular-nums">± {num(about.r[9])}</dd>
          </>
        )}
        {about.r[11] != null && (
          <>
            <dt className="text-muted-foreground">Respondents</dt>
            <dd className="text-right font-semibold tabular-nums">{num(about.r[11], 0)}</dd>
          </>
        )}
        {c?.topline && about.r !== c.topline && c.type === "pct" && (
          <>
            <dt className="text-muted-foreground">Baseline</dt>
            <dd className="text-right font-semibold tabular-nums">
              {value(c.topline[7], c.topline[8], null)} · {place(c.baseGeo)}
            </dd>
          </>
        )}
      </dl>
      {about.r[10] && <p className="my-2.5 rounded-[10px] bg-pax2-mist px-3 py-2.5 text-xs leading-5">{about.r[10]}</p>}
      {about.r[12] && (
        <a href={about.r[12]} target="_blank" rel="noreferrer" className="text-[11.5px] break-all text-muted-foreground underline-offset-2 hover:underline">
          {about.r[12]}
        </a>
      )}
      <div className="mt-3.5 border-t pt-2.5">
        <p className="mb-2 text-[11px] font-semibold tracking-[0.05em] text-muted-foreground uppercase">Same metric, other sources</p>
        {bench.length ? (
          bench.map((b) => (
            <div key={b.name} className="flex justify-between py-1 text-xs">
              <span className="min-w-0 truncate text-muted-foreground">
                {b.name} · {b.year}
              </span>
              <span className="ml-2 shrink-0 font-semibold tabular-nums">{b.v}</span>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground/70">Other sources join here as they are read from the rail.</p>
        )}
      </div>
    </>
  )
  return layer ? (
    <div className="min-h-0 w-full flex-1 overflow-y-auto">
      <div className="relative max-w-2xl p-5">{body}</div>
    </div>
  ) : (
    <div className="relative w-[420px] shrink-0 overflow-y-auto border-l p-5">{body}</div>
  )
}
