"use client"

import * as React from "react"
import { Star, X } from "lucide-react"

import { KebabMenu, MenuRow } from "@/components/kebab-menu"
import { cn } from "@/ui/lib/utils"

import { dimLabel, levelRank, num, period, shortSource, value, year, type AudienceIndex, type SourceGroup, type SourceRow } from "./audience-data"

// /audience's primary view, the inbox dress (sketches/audience-inbox.html):
// sources as the rail's folders, metrics as the list, a metric as the read.
// The grid holds one column per checked metric; the Geography band reads each
// place against the metric's baseline geography, the breakdown bands read
// each segment against the topline; a cell inside its own margin fades rather
// than vanishes. Clicking a cell summons the About panel at 420px.

const MAX_COLS = 4
const latest = (rs: SourceRow[]) => rs.reduce<SourceRow | null>((b, r) => (!b || r[3] > b[3] ? r : b), null)

type Info = {
  id: string
  option: string | null
  type: string
  baseGeo: string
  topline: SourceRow | null
  rs: SourceRow[]
  median: { v: number; n: number } | null
}

type About = { r: SourceRow; metric: string; segment: string }

export function AudienceBrowse({
  index,
  groups,
  source,
  onSource,
  files,
  query,
  error,
}: {
  index: AudienceIndex
  groups: SourceGroup[]
  source: string | null
  onSource: (s: string) => void
  files: Record<string, SourceRow[]>
  query: string
  error: string | null
}) {
  const rows = source ? files[source] : undefined
  const [focus, setFocus] = React.useState<string | null>(null)
  const [checked, setChecked] = React.useState<string[]>([])
  const [pinned, setPinned] = React.useState<string[]>([])
  const [geoSel, setGeoSel] = React.useState<string[] | null>(null)
  const [dimsOff, setDimsOff] = React.useState<string[]>([])
  const [about, setAbout] = React.useState<About | null>(null)

  const labels = React.useMemo(() => new Map(index.constructs.map((c) => [c.construct, c.label])), [index])
  const defs = React.useMemo(() => new Map(index.constructs.map((c) => [c.construct, c.definition])), [index])
  const geoName = React.useMemo(() => new Map(index.geographies.map((g) => [g.code, g.name])), [index])
  const geoLevel = React.useMemo(() => new Map(index.geographies.map((g) => [g.code, g.level])), [index])
  const label = (id: string) => labels.get(id) ?? id
  const place = (code: string) => geoName.get(code) ?? code

  const metricIds = React.useMemo(() => {
    const seen: string[] = []
    if (rows) for (const r of rows) if (!seen.includes(r[0])) seen.push(r[0])
    return seen
  }, [rows])

  // A new source starts the read over: its first two metrics as columns, the first open.
  React.useEffect(() => {
    setChecked(metricIds.slice(0, 2))
    setFocus(metricIds[0] ?? null)
    setGeoSel(null)
    setDimsOff([])
    setAbout(null)
  }, [source, metricIds])

  const info = React.useMemo(() => {
    const m = new Map<string, Info>()
    if (!rows) return m
    for (const id of metricIds) {
      const all = rows.filter((r) => r[0] === id)
      const option = all.find((r) => r[4] != null)?.[4] ?? null
      const rs = all.filter((r) => (r[4] ?? null) === option)
      const type = rs[0]?.[8] ?? "pct"
      // The baseline geography is the highest level the metric reaches: US
      // before a state, a state before its towns.
      let baseGeo = rs[0]?.[1] ?? "US"
      for (const r of rs) if (levelRank(geoLevel.get(r[1])) < levelRank(geoLevel.get(baseGeo))) baseGeo = r[1]
      const topline = latest(rs.filter((r) => !r[5] && r[1] === baseGeo))
      // An archive of one-shot lifts reads as their median, not a baseline.
      let median: Info["median"] = null
      if (type === "lift_pp") {
        const perOpt = new Map<string, SourceRow>()
        for (const r of all) {
          const k = r[4] ?? ""
          const had = perOpt.get(k)
          if (!had || r[3] > had[3]) perOpt.set(k, r)
        }
        const vals = [...perOpt.values()].map((r) => r[7]).sort((a, b) => a - b)
        if (vals.length) median = { v: vals[Math.floor(vals.length / 2)], n: vals.length }
      }
      m.set(id, { id, option, type, baseGeo, topline, rs, median })
    }
    return m
  }, [rows, metricIds, geoLevel])

  const q = query.trim().toLowerCase()
  const listed = React.useMemo(() => {
    const hit = (id: string) => !q || (labels.get(id) ?? id).toLowerCase().includes(q) || id.toLowerCase().includes(q) || (defs.get(id) ?? "").toLowerCase().includes(q)
    const ids = metricIds.filter(hit)
    return [...ids.filter((i) => pinned.includes(i)), ...ids.filter((i) => !pinned.includes(i))]
  }, [metricIds, q, pinned, labels, defs])

  const grid = React.useMemo(() => {
    const cols = checked.map((id) => info.get(id)).filter((c): c is Info => !!c)
    if (!rows || !cols.length) return null
    const geoRows = new Map<string, number>()
    for (const c of cols) for (const r of c.rs) if (!r[5]) geoRows.set(r[1], (geoRows.get(r[1]) ?? 0) + 1)
    const geosAll = [...geoRows.keys()].sort((a, b) => levelRank(geoLevel.get(a)) - levelRank(geoLevel.get(b)) || geoRows.get(b)! - geoRows.get(a)!)
    const geos = geoSel ? geosAll.filter((g) => geoSel.includes(g)) : geosAll.slice(0, 9)
    const dimsAll: string[] = []
    for (const c of cols) for (const r of c.rs) if (r[5] && !dimsAll.includes(r[5])) dimsAll.push(r[5])
    const bands = dimsAll
      .filter((d) => !dimsOff.includes(d))
      .map((d) => {
        const values: string[] = []
        for (const c of cols) for (const r of c.rs) if (r[5] === d && r[6] && !values.includes(r[6])) values.push(r[6])
        return { dim: d, values }
      })
    return { cols, geosAll, geos, dimsAll, bands }
  }, [rows, checked, info, geoSel, dimsOff, geoLevel])

  const snippet = (c: Info | undefined) => {
    if (!c) return ""
    if (c.median) return `median ${c.median.v >= 0 ? "+" : "−"}${num(Math.abs(c.median.v))} pp · ${c.median.n.toLocaleString("en-US")} entries`
    const t = c.topline
    if (!t) return ""
    const head = t[8] === "count" ? num(t[7], 0) : `${num(t[7])}%${c.option ? ` ${c.option}` : ""}`
    return `${head} · ${place(c.baseGeo)} · ${year(t[3])}`
  }

  const open = (id: string) => {
    setFocus(id)
    setChecked((prev) => (prev.includes(id) || prev.length >= MAX_COLS ? prev : [...prev, id]))
  }
  const toggleCol = (id: string) => setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= MAX_COLS ? prev : [...prev, id]))
  const togglePin = (id: string) => setPinned((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  // The About panel's far rows: the same metric and option, read from every
  // other source opened so far, each at its own baseline geography.
  const bench = React.useMemo(() => {
    if (!about) return []
    const out: { name: string; v: string; year: string }[] = []
    for (const [key, data] of Object.entries(files)) {
      if (key === source) continue
      const rs = data.filter((r) => r[0] === about.metric && !r[5])
      if (!rs.length) continue
      let base = rs[0][1]
      for (const r of rs) if (levelRank(geoLevel.get(r[1])) < levelRank(geoLevel.get(base))) base = r[1]
      const opt = about.r[4] ?? null
      const t = latest(rs.filter((r) => r[1] === base && (opt === null || (r[4] ?? null) === opt)))
      if (t) out.push({ name: `${shortSource(key)} · ${place(base)}`, v: value(t[7], t[8], null), year: year(t[3]) })
    }
    return out
  }, [about, files, source, geoLevel, geoName])

  const focused = focus ? info.get(focus) : undefined

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <div className="w-[210px] shrink-0 overflow-y-auto border-r border-slate-200 p-3">
        <p className="px-2.5 pt-1 pb-2 text-[11px] font-medium tracking-[0.06em] text-slate-500 uppercase">Sources</p>
        {groups.map((g) => (
          <button
            key={g.source}
            type="button"
            onClick={() => onSource(g.source)}
            className={cn("flex w-full items-center justify-between gap-2 rounded-[10px] px-2.5 py-1.5 text-left text-[13px] text-slate-600 hover:bg-slate-50", g.source === source && "bg-pax2-lavender font-semibold text-pax2-blue hover:bg-pax2-lavender")}
          >
            <span className="truncate">{shortSource(g.source)}</span>
            <span className="shrink-0 text-[11px] text-slate-400 tabular-nums">{g.rows.toLocaleString("en-US")}</span>
          </button>
        ))}
      </div>

      <div className="w-[290px] shrink-0 overflow-y-auto border-r border-slate-200 p-3">
        <p className="px-2.5 pt-1 pb-2 text-[11px] font-medium tracking-[0.06em] text-slate-500 uppercase">Metrics</p>
        {error && <p className="px-2.5 py-2 text-xs text-pax2-red">The data did not load: {error}</p>}
        {!error && !rows && <p className="px-2.5 py-2 text-xs text-slate-500">Reading {source ? shortSource(source) : ""}…</p>}
        {rows && !listed.length && <p className="px-2.5 py-2 text-xs text-slate-500">{q ? `Nothing matching “${query.trim()}”.` : "Nothing on file."}</p>}
        {listed.map((id) => {
          const on = focus === id
          return (
            <div key={id} className={cn("group rounded-[10px] px-2.5 py-2", on && "bg-pax2-mist")}>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checked.includes(id)}
                  disabled={!checked.includes(id) && checked.length >= MAX_COLS}
                  onChange={() => toggleCol(id)}
                  aria-label={`A column for ${label(id)}`}
                  className="shrink-0 accent-pax2-blue"
                />
                <button type="button" onClick={() => open(id)} className={cn("min-w-0 flex-1 truncate text-left text-[13px] font-semibold", on ? "text-pax2-blue" : "text-slate-800")}>
                  {label(id)}
                </button>
                <button
                  type="button"
                  onClick={() => togglePin(id)}
                  aria-label={pinned.includes(id) ? `Unpin ${label(id)}` : `Pin ${label(id)}`}
                  className={cn("shrink-0 transition-opacity", pinned.includes(id) ? "text-amber-500" : "text-slate-300 opacity-0 group-hover:opacity-100 hover:text-amber-500")}
                >
                  <Star className={cn("size-3.5", pinned.includes(id) && "fill-current")} />
                </button>
              </div>
              <p className="mt-0.5 truncate pl-6 text-xs text-slate-500">{snippet(info.get(id))}</p>
            </div>
          )
        })}
      </div>

      <div className="min-w-0 flex-1 overflow-auto p-5">
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-[10px] border border-slate-200 px-2.5 py-1.5 text-xs">
            Sources <b className="font-semibold text-pax2-blue">1</b>
          </span>
          <span className="rounded-[10px] border border-slate-200 px-2.5 py-1.5 text-xs">
            Metrics <b className="font-semibold text-pax2-blue">{checked.length}</b>
          </span>
          {grid && grid.dimsAll.length > 0 && (
            <KebabMenu
              label="Pick the breakdowns"
              align="left"
              trigger={
                <span className="text-xs">
                  Segments <b className="font-semibold text-pax2-blue">{dimsOff.length ? grid.dimsAll.length - dimsOff.length : "All"} ▾</b>
                </span>
              }
              triggerClassName="rounded-[10px] border border-slate-200 px-2.5 py-1.5 outline-none hover:bg-slate-50 aria-expanded:bg-slate-50"
            >
              {grid.dimsAll.map((d) => (
                <MenuRow key={d} label={dimLabel(d)} checked={!dimsOff.includes(d)} onClick={() => setDimsOff((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))} />
              ))}
            </KebabMenu>
          )}
          {grid && grid.geosAll.length > 1 && (
            <KebabMenu
              label="Pick the geographies"
              align="left"
              trigger={
                <span className="text-xs">
                  Filter <b className="font-semibold text-pax2-blue">{geoSel ? `${geoSel.length} places` : "All"} ▾</b>
                </span>
              }
              triggerClassName="rounded-[10px] border border-slate-200 px-2.5 py-1.5 outline-none hover:bg-slate-50 aria-expanded:bg-slate-50"
            >
              <div className="max-h-80 overflow-y-auto">
                <MenuRow label="The first nine" checked={!geoSel} onClick={() => setGeoSel(null)} />
                {grid.geosAll.map((g) => (
                  <MenuRow
                    key={g}
                    label={place(g)}
                    checked={!!geoSel && geoSel.includes(g)}
                    onClick={() => setGeoSel((prev) => (prev ? (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]) : [g]))}
                  />
                ))}
              </div>
            </KebabMenu>
          )}
          {rows && <span className="ml-auto text-xs text-slate-500 tabular-nums">{rows.length.toLocaleString("en-US")} rows</span>}
        </div>

        {focused && (
          <>
            <h2 className="text-[17px] font-semibold text-pax2-blue">{label(focused.id)}</h2>
            <p className="mb-4 text-xs text-slate-500">
              {defs.get(focused.id)}
              {focused.option ? ` · ${focused.option}` : ""}
            </p>
          </>
        )}

        {grid ? (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="w-[150px] border-b border-slate-200 px-2.5 py-2 text-left text-xs font-medium text-slate-500">Segment</th>
                {grid.cols.map((c) => (
                  <th key={c.id} className="border-b border-slate-200 px-2.5 py-2 text-left text-xs font-medium text-slate-500">
                    {label(c.id)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={grid.cols.length + 1} className="bg-pax2-mist px-2.5 py-1.5 text-xs font-semibold text-slate-500">
                  Geography
                </td>
              </tr>
              {grid.geos.map((g) => (
                <tr key={g}>
                  <td className="w-[150px] border-b border-slate-200 px-2.5 py-2 text-[13px]">{place(g)}</td>
                  {grid.cols.map((c) => (
                    <Cell key={c.id} r={latest(c.rs.filter((r) => !r[5] && r[1] === g))} c={c} segment={place(g)} about={about} onPick={setAbout} />
                  ))}
                </tr>
              ))}
              {grid.bands.map((b) => (
                <React.Fragment key={b.dim}>
                  <tr>
                    <td colSpan={grid.cols.length + 1} className="bg-pax2-mist px-2.5 py-1.5 text-xs font-semibold text-slate-500">
                      {dimLabel(b.dim)}
                    </td>
                  </tr>
                  {b.values.map((v) => (
                    <tr key={v}>
                      <td className="w-[150px] border-b border-slate-200 px-2.5 py-2 text-[13px]">{v}</td>
                      {grid.cols.map((c) => (
                        <Cell key={c.id} r={latest(c.rs.filter((r) => r[5] === b.dim && r[6] === v && r[1] === c.baseGeo))} c={c} segment={v} about={about} onPick={setAbout} />
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        ) : (
          rows && <p className="py-8 text-sm text-slate-500">No metric is checked.</p>
        )}
      </div>

      {about && (
        <div className="relative w-[420px] shrink-0 overflow-y-auto border-l border-slate-200 p-5">
          <button type="button" onClick={() => setAbout(null)} aria-label="Close" className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
            <X className="size-4" />
          </button>
          <h3 className="pr-7 text-sm font-semibold text-pax2-blue">
            {label(about.metric)} — {about.segment}
          </h3>
          <p className="mt-0.5 mb-3.5 text-xs text-slate-500">
            {groups.find((g) => g.source === source)?.label} · {period(about.r[2], about.r[3])}
          </p>
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 border-t border-slate-200 py-2.5 text-[13px]">
            <dt className="text-slate-500">Estimate</dt>
            <dd className="text-right font-semibold tabular-nums">{value(about.r[7], about.r[8], null)}</dd>
            {about.r[9] != null && (
              <>
                <dt className="text-slate-500">Margin of error</dt>
                <dd className="text-right font-semibold tabular-nums">± {num(about.r[9])}</dd>
              </>
            )}
            {about.r[11] != null && (
              <>
                <dt className="text-slate-500">Respondents</dt>
                <dd className="text-right font-semibold tabular-nums">{num(about.r[11], 0)}</dd>
              </>
            )}
            {(() => {
              const c = info.get(about.metric)
              return c?.topline && about.r !== c.topline && c.type === "pct" ? (
                <>
                  <dt className="text-slate-500">Baseline</dt>
                  <dd className="text-right font-semibold tabular-nums">
                    {value(c.topline[7], c.topline[8], null)} · {place(c.baseGeo)}
                  </dd>
                </>
              ) : null
            })()}
          </dl>
          {about.r[10] && <p className="my-2.5 rounded-[10px] bg-pax2-mist px-3 py-2.5 text-xs leading-5">{about.r[10]}</p>}
          {about.r[12] && (
            <a href={about.r[12]} target="_blank" rel="noreferrer" className="text-[11.5px] break-all text-slate-500 underline-offset-2 hover:underline">
              {about.r[12]}
            </a>
          )}
          <div className="mt-3.5 border-t border-slate-200 pt-2.5">
            <p className="mb-2 text-[11px] font-semibold tracking-[0.05em] text-slate-500 uppercase">Same metric, other sources</p>
            {bench.length ? (
              bench.map((b) => (
                <div key={b.name} className="flex justify-between py-1 text-xs">
                  <span className="min-w-0 truncate text-slate-600">
                    {b.name} · {b.year}
                  </span>
                  <span className="ml-2 shrink-0 font-semibold tabular-nums">{b.v}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400">Other sources join here as they are read from the rail.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** A value cell: a count prints, a baseline anchors, everything else is a pennant against it. */
function Cell({ r, c, segment, about, onPick }: { r: SourceRow | null; c: Info; segment: string; about: About | null; onPick: (a: About) => void }) {
  if (!r) return <td className="border-b border-slate-200 px-2.5 py-2 text-xs text-slate-300">—</td>
  const pick = () => onPick({ r, metric: c.id, segment })
  const sel = about?.r === r
  const frame = cn("flex w-full items-center gap-1.5 rounded-[3px] text-left tabular-nums", sel && "outline-2 outline-offset-2 outline-pax2-light-blue")
  let body: React.ReactNode
  if (r[8] === "count") body = <span className="text-[13px] font-semibold">{num(r[7], 0)}</span>
  else if (r[8] === "lift_pp") body = <Pennant delta={r[7]} moe={r[9]} />
  else if (c.topline && r === c.topline)
    body = (
      <>
        <span className="w-[34px] text-right text-xs text-slate-500">{num(r[7])}</span>
        <span className="text-xs text-slate-500">baseline</span>
      </>
    )
  else if (c.topline == null) body = <span className="text-[13px] font-semibold">{num(r[7])}%</span>
  else
    body = (
      <>
        <span className="w-[34px] shrink-0 text-right text-xs text-slate-500">{num(c.topline[7])}</span>
        <Pennant delta={r[7] - c.topline[7]} moe={r[9]} />
      </>
    )
  return (
    <td className="border-b border-slate-200 px-2.5 py-2">
      <button type="button" onClick={pick} className={frame}>
        {body}
      </button>
    </td>
  )
}

function Pennant({ delta, moe }: { delta: number; moe: number | null }) {
  // Inside its own margin the pennant fades; the figures stand in the panel.
  const weak = moe != null && Math.abs(delta) <= moe
  const w = Math.min(110, Math.max(4, Math.abs(delta) * 6))
  return (
    <span className={cn("flex items-center gap-1.5", weak && "opacity-35")}>
      <span
        aria-hidden
        className={cn("h-[13px] shrink-0 bg-pax2-light-blue", delta < 0 && "-scale-x-100")}
        style={{ width: w, clipPath: "polygon(0 0, calc(100% - 7px) 0, 100% 50%, calc(100% - 7px) 100%, 0 100%)" }}
      />
      <span className="text-[13px] font-semibold">
        {delta >= 0 ? "+" : "−"}
        {num(Math.abs(delta))}
      </span>
    </span>
  )
}
