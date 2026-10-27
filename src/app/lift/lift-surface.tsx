"use client"

import * as React from "react"
import { Folder, Loader2, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { BankFrame, BankSplit } from "@/components/bank/bank-frame"
import { BankRail, RailGroup, RailRow } from "@/components/bank/bank-rail"
import { CardList, type Card } from "@/components/bank/card-list"
import { PaneSearchRow, PaneTitleRow, RefreshButton } from "@/components/bank/pane-bars"
import { ScrollArea } from "@govblock/ui/components/ny4/scroll-area"

import { groupSources, num, period, type AudienceIndex, type SourceRow } from "../audience/audience-data"

// /lift — the message tests on /audience's anatomy (2026-10-27): the folders
// in the rail (the PAX tests, the archive of campaigns' own experiments), the
// open folder's metrics as the middle cards, and the pane the results grid in
// the Swayable shape (/public/Reference Images) — treatments down the left,
// one column per metric, sorted by the open card's, each cell the
// treatment's lift against its control group as a pennant that fades inside
// its own margin. A clicked cell brings the About panel in at the right. The
// archive's five hundred treatments read twenty-five at a time.
// ?source=PAX_TEST or ?source=LIFT_ARCHIVE opens on that folder.

const SOURCES: Record<string, string> = { PAX_TEST: "Tests", LIFT_ARCHIVE: "Archive" }
const PER_READ = 25

/** An archive treatment's row label; the study id stays for the About panel. */
const treatmentName = (option: string) => option.replace(/\s*\(study[^)]*\)/, "")
const METRIC_SHORT: Record<string, string> = {
  lift_comprehension: "Comprehension",
  lift_support: "Support",
  lift_favorability: "Favorability",
  lift_vote_choice: "Vote choice",
  lift_vote_choice_dichotomized: "Vote choice (two-way)",
}
const metricShort = (id: string) => METRIC_SHORT[id] ?? id

type Pick = { option: string; metric: string; r: SourceRow }

export function LiftSurface() {
  const [index, setIndex] = React.useState<AudienceIndex | null>(null)
  const [source, setSource] = React.useState<string>(() => {
    const at = new URLSearchParams(window.location.search).get("source")
    return at && at in SOURCES ? at : "PAX_TEST"
  })
  const [files, setFiles] = React.useState<Record<string, SourceRow[]>>({})
  const [error, setError] = React.useState<string | null>(null)
  // The open card: the metric the grid sorts by. A folder opens on its first.
  const [metric, setMetric] = React.useState<string | null>(null)
  const [about, setAbout] = React.useState<Pick | null>(null)
  // The list's search filters the metrics; the pane's and the header's, the treatments.
  const [listQuery, setListQuery] = React.useState("")
  const [query, setQuery] = React.useState("")
  const [depth, setDepth] = React.useState(PER_READ)

  React.useEffect(() => {
    let on = true
    fetch("/audience-data/index.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`index.json answered ${r.status}`))))
      .then((idx: AudienceIndex) => on && setIndex(idx))
      .catch((e: Error) => on && setError(e.message))
    return () => {
      on = false
    }
  }, [])

  React.useEffect(() => {
    if (!index || files[source]) return
    const g = groupSources(index.sources).find((x) => x.source === source)
    if (!g) return
    let on = true
    Promise.all(g.files.map((f) => fetch(`/audience-data/${f}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${f} answered ${r.status}`))))))
      .then((parts: SourceRow[][]) => on && setFiles((prev) => ({ ...prev, [source]: parts.flat() })))
      .catch((e: Error) => on && setError(e.message))
    return () => {
      on = false
    }
  }, [index, source, files])

  React.useEffect(() => {
    setMetric(null)
    setAbout(null)
    setDepth(PER_READ)
  }, [source])
  React.useEffect(() => setDepth(PER_READ), [query, metric])

  const labels = React.useMemo(() => new Map((index?.constructs ?? []).map((c) => [c.construct, c.label])), [index])
  const defs = React.useMemo(() => new Map((index?.constructs ?? []).map((c) => [c.construct, c.definition])), [index])
  const geoName = React.useMemo(() => new Map((index?.geographies ?? []).map((g) => [g.code, g.name])), [index])
  const label = React.useCallback((id: string) => labels.get(id) ?? id, [labels])
  const place = React.useCallback((code: string) => geoName.get(code) ?? code, [geoName])

  // Each folder's metrics from the index alone, with their spans and treatment counts.
  const questions = React.useMemo(() => (index?.questions ?? []).filter((q) => q.source in SOURCES), [index])
  const folderMetrics = React.useMemo(() => questions.filter((q) => q.source === source).map((q) => q.question), [questions, source])
  React.useEffect(() => {
    if (!metric && folderMetrics.length) setMetric(folderMetrics[0])
  }, [metric, folderMetrics])
  const shownMetrics = React.useMemo(() => {
    const q = listQuery.trim().toLowerCase()
    return folderMetrics.filter((id) => !q || label(id).toLowerCase().includes(q) || metricShort(id).toLowerCase().includes(q) || id.includes(q))
  }, [folderMetrics, listQuery, label])

  const rows = files[source]

  const grid = React.useMemo(() => {
    if (!rows) return null
    const metrics: string[] = []
    for (const r of rows) if (!metrics.includes(r[0])) metrics.push(r[0])
    // The latest row per treatment and metric; a treatment is a response option.
    const byTreatment = new Map<string, Map<string, SourceRow>>()
    for (const r of rows) {
      if (r[4] == null) continue
      const per = byTreatment.get(r[4]) ?? new Map<string, SourceRow>()
      const had = per.get(r[0])
      if (!had || r[3] > had[3]) per.set(r[0], r)
      byTreatment.set(r[4], per)
    }
    const sortBy = metric && metrics.includes(metric) ? metric : metrics[0]
    const q = query.trim().toLowerCase()
    const treatments = [...byTreatment.keys()]
      .filter((option) => !q || option.toLowerCase().includes(q))
      .sort((a, b) => (byTreatment.get(b)!.get(sortBy)?.[7] ?? -Infinity) - (byTreatment.get(a)!.get(sortBy)?.[7] ?? -Infinity))
    const respondents = treatments.reduce((total, option) => total + (byTreatment.get(option)!.get(sortBy)?.[11] ?? 0), 0)
    // The widest pennant is the grid's own largest effect; everything scales to it.
    let maxAbs = 0
    for (const per of byTreatment.values()) for (const r of per.values()) maxAbs = Math.max(maxAbs, Math.abs(r[7]))
    return { metrics, byTreatment, treatments, sortBy, respondents, maxAbs }
  }, [rows, metric, query])

  const shown = grid ? grid.treatments.slice(0, depth) : []
  const canLoad = grid ? depth < grid.treatments.length : false
  const more = React.useCallback(() => setDepth((d) => d + PER_READ), [])

  // A metric as a card: its name, its treatment count as the chip, its span.
  const cardOf = (id: string): Card => {
    const q = questions.find((x) => x.source === source && x.question === id)
    const n = q?.options.length ?? 0
    return {
      title: label(id),
      hint: defs.get(id),
      chip: `${n.toLocaleString("en-US")} ${n === 1 ? "treatment" : "treatments"}`,
      span: q ? (q.first === q.last ? String(q.first) : `${q.first}–${q.last}`) : null,
      detail: defs.get(id) ?? null,
    }
  }

  const rail = (
    <BankRail title="Lift">
      <RailGroup label="Folders">
        {Object.entries(SOURCES).map(([key, name]) => (
          <RailRow key={key} on={source === key} onClick={() => setSource(key)} icon={Folder} label={name} count={questions.filter((q) => q.source === key).length || null} />
        ))}
      </RailGroup>
    </BankRail>
  )

  const list = (
    <CardList
      ids={shownMetrics}
      card={cardOf}
      selected={metric}
      onOpen={setMetric}
      split="vertical"
      query={listQuery}
      onQuery={setListQuery}
      placeholder="Search metrics…"
      loading={!index && !error}
      error={error}
      empty={listQuery.trim() ? `Nothing matching “${listQuery.trim()}”.` : "Nothing on file."}
    />
  )

  const pane = (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <PaneSearchRow query={query} onQuery={setQuery} placeholder="Search treatments…" />
      <PaneTitleRow title={grid ? label(grid.sortBy) : SOURCES[source]}>
        {grid && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {grid.treatments.length.toLocaleString("en-US")} {grid.treatments.length === 1 ? "treatment" : "treatments"}
            {grid.respondents > 0 && ` · ${grid.respondents.toLocaleString("en-US")} respondents`}
          </span>
        )}
        <RefreshButton
          onRefresh={() => {
            setError(null)
            setFiles((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => key !== source)))
          }}
        />
      </PaneTitleRow>
      <ScrollArea className="min-h-0 flex-1">
        {error && <p className="p-6 text-center text-sm text-pax2-red">The data did not load: {error}</p>}
        {!error && !rows && (
          <p className="p-6 text-center text-sm text-muted-foreground">
            <Loader2 aria-hidden className="mr-2 inline size-4 animate-spin" />
            Reading {SOURCES[source]}…
          </p>
        )}
        {grid && (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="w-[260px] border-b px-4 py-2 text-left text-xs font-medium text-muted-foreground">Treatment</th>
                <th className="w-[110px] border-b px-2.5 py-2 text-left text-xs font-medium text-muted-foreground">Segment</th>
                {grid.metrics.map((m) => (
                  <th key={m} className={cn("border-b px-2.5 py-2 text-left text-xs font-medium text-muted-foreground", m === grid.sortBy && "text-pax2-blue")}>
                    <button type="button" onClick={() => setMetric(m)} className="hover:text-pax2-blue">
                      {metricShort(m)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((option) => {
                const per = grid.byTreatment.get(option)!
                return (
                  <tr key={option}>
                    <td className="border-b px-4 py-2.5 text-[13px] font-medium">
                      <span className="line-clamp-1" title={option}>
                        {treatmentName(option)}
                      </span>
                    </td>
                    <td className="border-b px-2.5 py-2.5 text-[13px] text-muted-foreground">Everyone</td>
                    {grid.metrics.map((m) => {
                      const r = per.get(m)
                      if (!r)
                        return (
                          <td key={m} className="border-b px-2.5 py-2.5 text-xs text-muted-foreground/40">
                            —
                          </td>
                        )
                      const sel = about?.r === r
                      return (
                        <td key={m} className="border-b px-2.5 py-2.5">
                          <button
                            type="button"
                            onClick={() => setAbout({ option, metric: m, r })}
                            className={cn("flex w-full items-center rounded-[3px] text-left tabular-nums", sel && "outline-2 outline-offset-2 outline-pax2-light-blue")}
                          >
                            <Pennant delta={r[7]} moe={r[9]} max={grid.maxAbs} />
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
              {canLoad && <MoreRow span={2 + grid.metrics.length} onMore={more} />}
            </tbody>
          </table>
        )}
        {grid && !shown.length && <p className="p-6 text-center text-sm text-muted-foreground">{query.trim() ? `Nothing matching “${query.trim()}”.` : "Nothing on file."}</p>}
      </ScrollArea>
    </div>
  )

  const aside = about && (
    <div className="relative w-[420px] shrink-0 overflow-y-auto border-l p-5">
      <button type="button" onClick={() => setAbout(null)} aria-label="Close" className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
        <X className="size-4" />
      </button>
      <h3 className="pr-7 text-sm font-semibold text-pax2-blue">{treatmentName(about.option)}</h3>
      <p className="mt-0.5 mb-3.5 text-xs text-muted-foreground">
        {label(about.metric)} · {period(about.r[2], about.r[3])}
      </p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 border-t py-2.5 text-[13px]">
        <dt className="text-muted-foreground">Lift against the control group</dt>
        <dd className="text-right font-semibold tabular-nums">
          {about.r[7] >= 0 ? "+" : "−"}
          {num(Math.abs(about.r[7]))} pp
        </dd>
        {about.r[9] != null && (
          <>
            <dt className="text-muted-foreground">Margin of error</dt>
            <dd className="text-right font-semibold tabular-nums">± {num(about.r[9])}</dd>
          </>
        )}
        {about.r[11] != null && (
          <>
            <dt className="text-muted-foreground">Respondents</dt>
            <dd className="text-right font-semibold tabular-nums">{num(about.r[11]!, 0)}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Geography</dt>
        <dd className="text-right font-semibold">{place(about.r[1])}</dd>
      </dl>
      {about.option !== treatmentName(about.option) && <p className="my-2.5 rounded-[10px] bg-pax2-mist px-3 py-2.5 text-xs leading-5">{about.option}</p>}
      {about.r[12] &&
        (about.r[12].startsWith("http") ? (
          <a href={about.r[12]} target="_blank" rel="noreferrer" className="text-[11.5px] break-all text-muted-foreground underline-offset-2 hover:underline">
            {about.r[12]}
          </a>
        ) : (
          <p className="text-[11.5px] break-all text-muted-foreground">{about.r[12]}</p>
        ))}
    </div>
  )

  return (
    <BankFrame rail={rail} crumb="Lift" search={{ query, onQuery: setQuery, placeholder: "Search treatments" }}>
      <BankSplit list={list} pane={pane} aside={aside} />
    </BankFrame>
  )
}

function Pennant({ delta, moe, max }: { delta: number; moe: number | null; max: number }) {
  // Inside its own margin the pennant fades; the figures stand in the panel.
  const weak = moe != null && Math.abs(delta) <= moe
  const w = max > 0 ? Math.max(4, (Math.abs(delta) / max) * 110) : 4
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

/** The end of the table: reaching it reads twenty-five more. */
function MoreRow({ span, onMore }: { span: number; onMore: () => void }) {
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
