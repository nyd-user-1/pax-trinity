"use client"

import * as React from "react"
import { ChevronDown, ChevronUp, FlaskConical, Folder, Loader2, PanelLeftIcon, Search, TrendingUp, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { PathBar } from "@/components/create/path-bar"
import { Button } from "@govblock/ui/components/nova/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@govblock/ui/components/ny4/resizable"
import { ScrollArea } from "@govblock/ui/components/ny4/scroll-area"
import { Separator } from "@govblock/ui/components/ny4/separator"
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader } from "@govblock/ui/components/ny4/sidebar"
import { TooltipProvider } from "@govblock/ui/components/ny4/tooltip"

import { groupSources, latestRow, num, period, type AudienceIndex, type SourceRow } from "../audience/audience-data"

// /lift — the message tests in the results grid's shape (the Swayable
// references in /public/Reference Images): treatments down the left, one
// column per metric, each cell the treatment's lift against its control
// group as a pennant that fades inside its own margin. The frame is the
// audience instrument's: the rail of folders on the resizable handle, the
// header at its right edge, the About panel arriving as the right column
// when a cell is clicked. The archive's five hundred treatments read
// twenty-five at a time, the flat table's way.

const SOURCES: Record<string, string> = { PAX_TEST: "Tests", LIFT_ARCHIVE: "Archive" }
const METRIC_SHORT: Record<string, string> = {
  lift_comprehension: "Comprehension",
  lift_support: "Support",
  lift_favorability: "Favorability",
  lift_vote_choice: "Vote choice",
  lift_vote_choice_dichotomized: "Vote choice (two-way)",
}
const metricShort = (id: string) => METRIC_SHORT[id] ?? id
const PER_READ = 25

/** An archive treatment's row label; the study id stays for the About panel. */
const treatmentName = (option: string) => option.replace(/\s*\(study[^)]*\)/, "")

type Pick = { option: string; metric: string; r: SourceRow }

export function LiftSurface() {
  const [index, setIndex] = React.useState<AudienceIndex | null>(null)
  const [source, setSource] = React.useState<string>("PAX_TEST")
  const [branchOpen, setBranchOpen] = React.useState(true)
  const [files, setFiles] = React.useState<Record<string, SourceRow[]>>({})
  const [error, setError] = React.useState<string | null>(null)
  const [focusMetric, setFocusMetric] = React.useState<string | null>(null)
  const [about, setAbout] = React.useState<Pick | null>(null)
  const [query, setQuery] = React.useState("")
  const [searching, setSearching] = React.useState(false)
  const [railOpen, setRailOpen] = React.useState(true)
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
    setFocusMetric(null)
    setAbout(null)
    setDepth(PER_READ)
  }, [source])
  React.useEffect(() => setDepth(PER_READ), [query, focusMetric])

  const labels = React.useMemo(() => new Map((index?.constructs ?? []).map((c) => [c.construct, c.label])), [index])
  const geoName = React.useMemo(() => new Map((index?.geographies ?? []).map((g) => [g.code, g.name])), [index])
  const label = React.useCallback((id: string) => labels.get(id) ?? id, [labels])
  const place = React.useCallback((code: string) => geoName.get(code) ?? code, [geoName])

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
    const sortBy = focusMetric ?? metrics[0]
    const q = query.trim().toLowerCase()
    const treatments = [...byTreatment.keys()]
      .filter((option) => !q || option.toLowerCase().includes(q))
      .sort((a, b) => (byTreatment.get(b)!.get(sortBy)?.[7] ?? -Infinity) - (byTreatment.get(a)!.get(sortBy)?.[7] ?? -Infinity))
    const respondents = treatments.reduce((total, option) => total + (byTreatment.get(option)!.get(sortBy)?.[11] ?? 0), 0)
    // The widest pennant is the grid's own largest effect; everything scales to it.
    let maxAbs = 0
    for (const per of byTreatment.values()) for (const r of per.values()) maxAbs = Math.max(maxAbs, Math.abs(r[7]))
    return { metrics, byTreatment, treatments, sortBy, respondents, maxAbs }
  }, [rows, focusMetric, query])

  const shown = grid ? grid.treatments.slice(0, depth) : []
  const canLoad = grid ? depth < grid.treatments.length : false
  const more = React.useCallback(() => setDepth((d) => d + PER_READ), [])

  const rail = (
    <>
      <SidebarHeader className="flex-row items-center gap-2.5 p-4">
        <p className="text-xl font-semibold">Lift</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Folders</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav className="flex flex-col gap-0.5 px-1">
              {Object.entries(SOURCES).map(([key, name]) => {
                const open = source === key && branchOpen
                const holds = !open && source === key && !!focusMetric
                const Chevron = open ? ChevronUp : ChevronDown
                const metrics = source === key && rows ? (grid?.metrics ?? []) : []
                return (
                  <React.Fragment key={key}>
                    <button
                      type="button"
                      onClick={() => {
                        if (key === source) setBranchOpen((v) => !v)
                        else {
                          setSource(key)
                          setBranchOpen(true)
                        }
                      }}
                      aria-expanded={open}
                      className={cn(
                        "group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm outline-none transition-[color,background-color,box-shadow] hover:bg-white/70 hover:text-pax2-blue hover:shadow-e1 focus-visible:bg-white/70",
                        holds ? "font-semibold text-pax2-blue" : "text-slate-500"
                      )}
                    >
                      <Folder className={cn("icon-pop size-[18px] shrink-0 transition-colors", holds ? "fill-pax2-lavender text-pax2-blue" : "group-hover:fill-pax2-lavender group-hover:text-pax2-blue")} strokeWidth={holds ? 2.25 : 1.75} />
                      <span className="min-w-0 flex-1 truncate">{name}</span>
                      <Chevron className="size-4 shrink-0 text-slate-400 transition-colors group-hover:text-pax2-blue" />
                    </button>
                    {open && (
                      <div className="flex flex-col">
                        {!rows && (
                          <div className="relative pl-8">
                            <span aria-hidden className="absolute left-[21px] top-0 h-4 w-5 rounded-bl-[10px] border-b-[1.5px] border-l-[1.5px] border-slate-300" />
                            <span className="flex items-center rounded-xl px-3 py-1.5 text-[13px] text-slate-400">Reading…</span>
                          </div>
                        )}
                        {metrics.map((id, k) => {
                          const on = focusMetric === id
                          const Icon = key === "PAX_TEST" ? FlaskConical : TrendingUp
                          return (
                            <div key={id} className="relative pl-8">
                              {k < metrics.length - 1 && <span aria-hidden className="absolute bottom-0 left-[21px] top-0 w-px bg-slate-300" />}
                              <span aria-hidden className="absolute left-[21px] top-0 h-4 w-5 rounded-bl-[10px] border-b-[1.5px] border-l-[1.5px] border-slate-300" />
                              <button
                                type="button"
                                onClick={() => setFocusMetric(on ? null : id)}
                                className={cn(
                                  "relative flex w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left text-[13px] outline-none transition-[color,background-color,box-shadow]",
                                  on ? "bg-white font-semibold text-pax2-blue shadow-e1" : "text-slate-500 hover:bg-white/70 hover:text-pax2-blue hover:shadow-e1"
                                )}
                              >
                                {on && <span aria-hidden className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-pax2-light-blue" />}
                                <Icon className={cn("icon-pop size-3.5 shrink-0 transition-colors", on ? "fill-pax2-lavender text-pax2-blue" : "group-hover:fill-pax2-lavender group-hover:text-pax2-blue")} strokeWidth={on ? 2.25 : 1.75} />
                                <span className="min-w-0 flex-1 truncate">{metricShort(id)}</span>
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </React.Fragment>
                )
              })}
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </>
  )

  return (
    <TooltipProvider delayDuration={0}>
      <div className="relative flex h-full min-h-0 w-full overflow-hidden bg-sidebar [--sidebar:var(--pax2-mist)] [--header-height:calc(var(--spacing)*12)]">
        <ResizablePanelGroup orientation="horizontal" className="min-h-0 min-w-0 flex-1">
          {/* react-resizable-panels v4 reads bare numbers as pixels. */}
          {railOpen && (
            <ResizablePanel defaultSize={224} minSize={192} maxSize={420} className="flex min-w-0 flex-col bg-sidebar **:data-[slot=sidebar-content]:no-scrollbar">
              {rail}
            </ResizablePanel>
          )}
          {railOpen && <ResizableHandle withHandle />}
          <ResizablePanel className="min-w-0">
            <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
              <header className="relative z-10 flex h-(--header-height) shrink-0 items-center gap-2 border-b">
                <div className="flex w-full min-w-0 items-center gap-1 px-4 lg:gap-2 lg:px-6">
                  <Button variant="ghost" size="icon-sm" aria-label="Toggle sidebar" className="-ml-1 size-7" onClick={() => setRailOpen((v) => !v)}>
                    <PanelLeftIcon className="size-4" />
                  </Button>
                  <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
                  <div className="flex min-w-0 flex-1 items-center gap-2 text-base font-medium">
                    <div className="flex min-w-0 flex-1 items-center gap-1">
                      <PathBar crumbs={[{ label: "Lift" }]} folder onGo={() => {}} />
                      {searching ? (
                        <div className="ml-2 flex min-w-0 flex-1 items-center gap-2 rounded-full bg-muted px-3 py-1.5">
                          <Search className="size-4 shrink-0 text-muted-foreground" />
                          <input
                            autoFocus
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Escape") {
                                setQuery("")
                                setSearching(false)
                              }
                            }}
                            placeholder="Search treatments"
                            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                          />
                          <button
                            type="button"
                            aria-label="Close the search"
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setQuery("")
                              setSearching(false)
                            }}
                          >
                            <X className="size-4" />
                          </button>
                        </div>
                      ) : (
                        <Button variant="ghost" size="sm" aria-label="Search treatments" className="ml-1" onClick={() => setSearching(true)}>
                          <Search className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </header>
              <div className="flex min-h-0 flex-1 overflow-hidden">
                <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
                  <div className="flex h-[52px] shrink-0 items-center gap-2 border-b px-4">
                    <span className="rounded-[10px] border px-2.5 py-1.5 text-xs">
                      Treatments <b className="font-semibold text-pax2-blue">{grid?.treatments.length ?? 0}</b>
                    </span>
                    <span className="rounded-[10px] border px-2.5 py-1.5 text-xs">
                      Metrics <b className="font-semibold text-pax2-blue">{grid?.metrics.length ?? 0}</b>
                    </span>
                    {grid && grid.respondents > 0 && <span className="ml-auto text-xs text-muted-foreground tabular-nums">{grid.respondents.toLocaleString("en-US")} respondents</span>}
                  </div>
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
                                <button type="button" onClick={() => setFocusMetric(m)} className="hover:text-pax2-blue">
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
                          {canLoad && <MoreRow span={2 + (grid?.metrics.length ?? 0)} onMore={more} />}
                        </tbody>
                      </table>
                    )}
                    {grid && !shown.length && <p className="p-6 text-center text-sm text-muted-foreground">{query.trim() ? `Nothing matching “${query.trim()}”.` : "Nothing on file."}</p>}
                  </ScrollArea>
                </div>
                {about && (
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
                )}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </TooltipProvider>
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
