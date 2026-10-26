"use client"

import * as React from "react"
import Link from "next/link"
import { PanelLeftIcon, Search, X } from "lucide-react"

import { addToDraft } from "@/lib/consensus/draft"
import { PathBar } from "@/components/create/path-bar"
import { Button } from "@govblock/ui/components/nova/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@govblock/ui/components/ny4/resizable"
import { Separator } from "@govblock/ui/components/ny4/separator"
import { TooltipProvider } from "@govblock/ui/components/ny4/tooltip"

import { AboutPanel, BackButton, type About } from "../audience/audience-pane"
import { AudienceRows } from "../audience/audience-rows"
import { buildInfo, groupSources, metricIdsOf, shortSource, WORDING, type AudienceIndex, type MetricInfo, type SourceRow } from "../audience/audience-data"
import { SourceRail } from "./source-rail"
import { QuestionTable } from "./question-table"
import { SegmentList, type ListTab, type Split } from "./segment-list"
import { SegmentGrid } from "./segment-grid"

// /inbox-2 — the audience database wearing the Agentic Inbox's frame whole,
// the Gmail recreate repurposed (Brendan, 2026-10-26): the sources are the
// folders, the segments are the threads, and the list opens full width the
// way the inbox does with no split on. Opening a segment is the presto — the
// results grid takes the pane — and a cell hands its row to the About panel.
// /audience keeps the earlier shape for comparison while this one settles.

export function AudienceInbox() {
  const [index, setIndex] = React.useState<AudienceIndex | null>(null)
  const [source, setSource] = React.useState<string | null>(null)
  const [files, setFiles] = React.useState<Record<string, SourceRow[]>>({})
  const [error, setError] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState("")
  const [searching, setSearching] = React.useState(false)
  const [split, setSplit] = React.useState<Split>("none")
  const [tab, setTab] = React.useState<ListTab>("all")
  const [focus, setFocus] = React.useState<string | null>(null)
  const [checked, setChecked] = React.useState<string[]>([])
  const [pinned, setPinned] = React.useState<string[]>([])
  const [about, setAbout] = React.useState<About | null>(null)
  const [mode, setMode] = React.useState<"list" | "table">("list")
  // The question whose rows the flat table is scoped to; null is the whole source.
  const [tableMetric, setTableMetric] = React.useState<string | null>(null)
  // The rail rides in the resizable row, not the shell's fixed sidebar, so it
  // drags on the same handle the panes share; the header trigger still folds it.
  const [railOpen, setRailOpen] = React.useState(true)
  // The survey-draft bar, Gmail's "Message sent": the draft's size for a few
  // seconds after an add, with View opening the consensus admin that holds it.
  const [drafted, setDrafted] = React.useState<number | null>(null)

  // The rail reads A to Z by display name; the tests and the lift archive
  // have their own surfaces (/lift) and stay out of the normative bank.
  const groups = React.useMemo(
    () =>
      index
        ? groupSources(index.sources)
            .filter((g) => g.source !== "LIFT_ARCHIVE" && g.source !== "PAX_TEST")
            .sort((a, b) => shortSource(a.source).localeCompare(shortSource(b.source), "en", { sensitivity: "base" }))
        : [],
    [index]
  )

  React.useEffect(() => {
    let on = true
    fetch("/audience-data/index.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`index.json answered ${r.status}`))))
      .then((idx: AudienceIndex) => {
        if (!on) return
        setIndex(idx)
      })
      .catch((e: Error) => on && setError(e.message))
    return () => {
      on = false
    }
  }, [])

  // The rail's first folder opens first. (Until 2026-10-26 the smallest
  // source did, a load-cost habit the performance scoping retired.)
  React.useEffect(() => {
    if (!source && groups.length) setSource(groups[0].source)
  }, [groups, source])

  React.useEffect(() => {
    // Once a source's parts are kept, the early return keeps this effect idle.
    if (!index || !source || files[source]) return
    const g = groupSources(index.sources).find((x) => x.source === source)
    if (!g) return
    let on = true
    // The parts download in parallel but parse one at a time, the main thread
    // handed back between each — a bulk source is twenty files and seventy
    // megabytes, and parsing them in one gulp froze the tab.
    ;(async () => {
      try {
        const responses = await Promise.all(
          g.files.map(async (f) => {
            const r = await fetch(`/audience-data/${f}`)
            if (!r.ok) throw new Error(`${f} answered ${r.status}`)
            return r
          })
        )
        const data: SourceRow[] = []
        for (const r of responses) {
          const part: SourceRow[] = await r.json()
          for (const row of part) data.push(row)
          if (!on) return
          await new Promise((settle) => setTimeout(settle, 0))
        }
        if (data.length !== g.rows) console.warn(`audience: ${source} concatenated to ${data.length} rows; the index says ${g.rows}`)
        if (on) setFiles((prev) => ({ ...prev, [source]: data }))
      } catch (e) {
        if (on) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      on = false
    }
  }, [index, source, files])

  // A new source starts the read over.
  React.useEffect(() => {
    setFocus(null)
    setChecked([])
    setAbout(null)
    setTab("all")
    setTableMetric(null)
  }, [source])

  const labels = React.useMemo(() => new Map((index?.constructs ?? []).map((c) => [c.construct, c.label])), [index])
  // The export's verbatim wording first (Brief P), the hand seeds second, nothing third.
  const wordings = React.useMemo(() => new Map((index?.constructs ?? []).filter((c) => c.wording).map((c) => [c.construct, c.wording as string])), [index])
  const defs = React.useMemo(() => new Map((index?.constructs ?? []).map((c) => [c.construct, c.definition])), [index])
  const geoName = React.useMemo(() => new Map((index?.geographies ?? []).map((g) => [g.code, g.name])), [index])
  const geoLevel = React.useMemo(() => new Map((index?.geographies ?? []).map((g) => [g.code, g.level])), [index])
  const label = React.useCallback((id: string) => labels.get(id) ?? id, [labels])
  const wordingOf = React.useCallback((id: string) => wordings.get(id) ?? WORDING[id] ?? null, [wordings])
  const place = React.useCallback((code: string) => geoName.get(code) ?? code, [geoName])

  const rows = source ? files[source] : undefined
  const metricIds = React.useMemo(() => {
    const all = rows ? metricIdsOf(rows) : []
    if (source !== "GSS") return all
    // The full GSS library (the review slice retired once Brief P's wordings
    // landed), A–Z by what the card shows — the wording where one exists — so
    // the reading order matches the visible text, not the hidden label.
    const text = (id: string) => wordingOf(id) ?? label(id)
    return all
      .map((id) => [text(id), id] as const)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, id]) => id)
  }, [rows, source, label, wordingOf])
  // The rail's counts correct themselves as sources read.
  const segCounts = React.useMemo(() => {
    const m: Record<string, number> = {}
    for (const [s, data] of Object.entries(files)) m[s] = metricIdsOf(data).length
    return m
  }, [files])
  const info = React.useMemo(() => (rows ? buildInfo(rows, geoLevel) : new Map()), [rows, geoLevel])

  // A clicked question opens the flat table scoped to its rows (Brendan,
  // 2026-10-26); the checkbox still builds grid columns.
  const open = (id: string) => {
    setTableMetric(id)
    setMode("table")
  }
  const check = (id: string) => setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 4 ? prev : [...prev, id]))

  // A segment joins the survey draft as a question — its wording verbatim
  // where the source carries one (polls and results do), its label where it
  // does not — with the segment's bands as the answer options.
  const addToSurvey = React.useCallback(
    (id: string) => {
      const wording = (rows ?? []).find((r) => r[0] === id && r[10])?.[10] ?? null
      const c = info.get(id) as MetricInfo | undefined
      const draft = addToDraft([{ text: wording ?? label(id), options: c?.options ?? [] }])
      setDrafted(draft.questions.length)
      window.setTimeout(() => setDrafted((current) => (current === draft.questions.length ? null : current)), 6000)
    },
    [rows, info, label]
  )

  const showList = split === "vertical" || !focus
  const showPane = split === "vertical" || !!focus

  // The list keeps its place beside the crosstab (Brendan, 2026-10-26: "don't
  // close the middle panel"), stacked the way the split folds it.
  const listFor = (s: Split) => (
    <SegmentList
      info={info}
      metricIds={metricIds}
      label={label}
      wordingOf={wordingOf}
      selected={tableMetric ?? focus}
      checked={checked}
      pinned={pinned}
      tab={tab}
      onTab={setTab}
      onOpen={open}
      onCheck={check}
      onPin={(id) => setPinned((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}
      onCheckAll={(ids) => setChecked(ids.slice(0, 4))}
      onRefresh={() =>
        setFiles((prev) => {
          if (!source) return prev
          const next = { ...prev }
          delete next[source]
          return next
        })
      }
      onFlatTable={() => {
        setTableMetric(null)
        setMode("table")
      }}
      split={s}
      onSplit={setSplit}
      query={query}
      onQuery={setQuery}
      loading={!!source && !rows && !error}
      error={error}
    />
  )
  const list = listFor(split)

  const railNode = (
    <SourceRail
      groups={groups}
      source={source}
      segments={segCounts}
      onSource={(s) => {
        setSource(s)
        setMode("list")
      }}
    />
  )

  const empty = (
    <div className="flex h-full flex-col items-center px-8 py-16 text-center">
      <p className="text-lg">No segment selected</p>
      <p className="mt-3 text-sm text-muted-foreground">
        {source ? `${metricIds.length.toLocaleString("en-US")} segments in ${shortSource(source)}; the box on a row is its column, the star pins it.` : "Pick a source from the rail."}
      </p>
    </div>
  )

  // The inbox's exact frame — BlockShell's geometry, laid by hand so the rail
  // can ride a resizable handle: the rail full height on the left where the
  // shell's sidebar stands, the header starting at its right edge, the panes
  // below the header. BlockShell itself cannot resize its sidebar.
  return (
    <TooltipProvider delayDuration={0}>
    <div className="relative flex h-full min-h-0 w-full overflow-hidden bg-sidebar [--sidebar:var(--pax2-mist)] [--header-height:calc(var(--spacing)*12)]">
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 min-w-0 flex-1">
        {/* react-resizable-panels v4 reads bare numbers as pixels. */}
        {railOpen && (
          <ResizablePanel defaultSize={224} minSize={192} maxSize={420} className="flex min-w-0 flex-col bg-sidebar **:data-[slot=sidebar-content]:no-scrollbar">
            {railNode}
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
          <PathBar crumbs={[{ label: "Audience" }]} folder onGo={() => {}} />
          {/* The header search, trinity's pattern: an icon until picked, then the bar's remaining width; the x folds it back and clears the filter. */}
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
                placeholder="Search segments"
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
            <Button variant="ghost" size="sm" aria-label="Search segments" className="ml-1" onClick={() => setSearching(true)}>
              <Search className="size-4" />
            </Button>
          )}
        </div>
                </div>
              </div>
            </header>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {mode === "table" && tableMetric && rows && info.get(tableMetric) ? (
            <div className="relative flex h-full min-h-0 min-w-0">
              <ResizablePanelGroup orientation="horizontal" className="min-h-0 min-w-0 flex-1">
                <ResizablePanel defaultSize={380} minSize={300} maxSize={560} className="min-w-0">
                  {listFor("vertical")}
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel className="min-w-0">
                  <QuestionTable
                    rows={rows.filter((r) => r[0] === tableMetric)}
                    title={label(tableMetric)}
                    def={defs.get(tableMetric)}
                    metric={tableMetric}
                    place={place}
                    info={info.get(tableMetric) as MetricInfo}
                    short={source ? shortSource(source) : ""}
                    source={source}
                    wording={wordingOf(tableMetric)}
                    about={about}
                    onPick={setAbout}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
              {about && <AboutPanel about={about} onClose={() => setAbout(null)} source={source} groups={groups} files={files} info={info} label={label} place={place} geoLevel={geoLevel} />}
            </div>
          ) : mode === "table" ? (
            <AudienceRows
              rows={rows}
              short={source ? shortSource(source) : ""}
              label={label}
              place={place}
              query={query}
              onBack={() => setMode("list")}
              error={error}
            />
          ) : (
            <div className="relative flex h-full min-h-0 min-w-0">
              <ResizablePanelGroup orientation="horizontal" className="min-h-0 min-w-0 flex-1">
                {showList && (
                  <ResizablePanel defaultSize={split === "vertical" ? 420 : 100000} minSize={320} maxSize={split === "vertical" ? 640 : undefined} className="min-w-0">
                    {list}
                  </ResizablePanel>
                )}
                {showList && showPane && <ResizableHandle withHandle />}
                {showPane && (
                  <ResizablePanel className="min-w-0">
                    {rows && (focus || checked.length) ? (
                      <SegmentGrid
                        key={source}
                        rows={rows}
                        info={info}
                        checked={checked}
                        focus={focus}
                        label={label}
                        defs={defs}
                        place={place}
                        geoLevel={geoLevel}
                        about={about}
                        onPick={setAbout}
                        back={split === "none" ? <BackButton onBack={() => setFocus(null)} /> : undefined}
                        onAddToSurvey={focus ? () => addToSurvey(focus) : undefined}
                      />
                    ) : (
                      empty
                    )}
                  </ResizablePanel>
                )}
              </ResizablePanelGroup>
              {about && <AboutPanel about={about} onClose={() => setAbout(null)} source={source} groups={groups} files={files} info={info} label={label} place={place} geoLevel={geoLevel} />}
            </div>
          )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
      {drafted != null && (
        <div role="status" className="absolute bottom-4 left-4 z-20 flex items-center gap-4 rounded-md bg-foreground px-4 py-2.5 text-sm text-background shadow-lg">
          <span>
            In the survey draft: {drafted} {drafted === 1 ? "question" : "questions"}
          </span>
          <Link href="/consensus/admin?c=audience-draft" className="font-medium text-background/80 hover:text-background">
            View
          </Link>
        </div>
      )}
    </div>
    </TooltipProvider>
  )
}
