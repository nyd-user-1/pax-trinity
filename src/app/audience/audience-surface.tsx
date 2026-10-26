"use client"

import * as React from "react"
import { Search, X } from "lucide-react"

import { BlockShell } from "@/components/policy/block-shell"
import { PathBar } from "@/components/create/path-bar"
import { Button } from "@govblock/ui/components/nova/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@govblock/ui/components/ny4/resizable"

import { AudienceRail } from "./audience-rail"
import { MetricList, type ListTab, type Split } from "./audience-list"
import { AboutPanel, AudiencePane, BackButton, type About } from "./audience-pane"
import { AudienceRows } from "./audience-rows"
import { buildInfo, groupSources, metricIdsOf, shortSource, type AudienceIndex, type SourceRow } from "./audience-data"

// /audience — the audience database in the Agentic Inbox's frame
// (registry/blocks/sidebar-09): the shared block shell with the sources in
// its sidebar where the folders sit, the metric list and the reading pane
// sharing the inset pane beside it, and the About panel arriving as the
// fourth column. The index names the sources, metrics and geographies; a
// source's files (every part of a split one) load only when it is picked,
// the smallest source first, each kept once read.

export function AudienceSurface() {
  const [index, setIndex] = React.useState<AudienceIndex | null>(null)
  const [source, setSource] = React.useState<string | null>(null)
  const [files, setFiles] = React.useState<Record<string, SourceRow[]>>({})
  const [error, setError] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState("")
  const [searching, setSearching] = React.useState(false)
  const [split, setSplit] = React.useState<Split>("vertical")
  const [tab, setTab] = React.useState<ListTab>("all")
  const [focus, setFocus] = React.useState<string | null>(null)
  const [checked, setChecked] = React.useState<string[]>([])
  const [pinned, setPinned] = React.useState<string[]>([])
  const [about, setAbout] = React.useState<About | null>(null)
  const [mode, setMode] = React.useState<"list" | "table">("list")

  const groups = React.useMemo(() => (index ? groupSources(index.sources) : []), [index])

  React.useEffect(() => {
    let on = true
    fetch("/audience-data/index.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`index.json answered ${r.status}`))))
      .then((idx: AudienceIndex) => {
        if (!on) return
        setIndex(idx)
        setSource([...groupSources(idx.sources)].sort((a, b) => a.rows - b.rows)[0]?.source ?? null)
      })
      .catch((e: Error) => on && setError(e.message))
    return () => {
      on = false
    }
  }, [])

  React.useEffect(() => {
    // Once a source's parts are kept, the early return keeps this effect idle.
    if (!index || !source || files[source]) return
    const g = groupSources(index.sources).find((x) => x.source === source)
    if (!g) return
    let on = true
    Promise.all(g.files.map((f) => fetch(`/audience-data/${f}`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${f} answered ${r.status}`))))))
      .then((parts: SourceRow[][]) => {
        if (!on) return
        const data = parts.flat()
        if (data.length !== g.rows) console.warn(`audience: ${source} concatenated to ${data.length} rows; the index says ${g.rows}`)
        setFiles((prev) => ({ ...prev, [source]: data }))
      })
      .catch((e: Error) => on && setError(e.message))
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
  }, [source])

  const labels = React.useMemo(() => new Map((index?.constructs ?? []).map((c) => [c.construct, c.label])), [index])
  const defs = React.useMemo(() => new Map((index?.constructs ?? []).map((c) => [c.construct, c.definition])), [index])
  const geoName = React.useMemo(() => new Map((index?.geographies ?? []).map((g) => [g.code, g.name])), [index])
  const geoLevel = React.useMemo(() => new Map((index?.geographies ?? []).map((g) => [g.code, g.level])), [index])
  const label = React.useCallback((id: string) => labels.get(id) ?? id, [labels])
  const place = React.useCallback((code: string) => geoName.get(code) ?? code, [geoName])

  const rows = source ? files[source] : undefined
  const metricIds = React.useMemo(() => (rows ? metricIdsOf(rows) : []), [rows])
  const info = React.useMemo(() => (rows ? buildInfo(rows, geoLevel) : new Map()), [rows, geoLevel])

  const open = (id: string) => {
    setFocus(id)
    setChecked((prev) => (prev.includes(id) || prev.length >= 4 ? prev : [...prev, id]))
  }
  const check = (id: string) => setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 4 ? prev : [...prev, id]))

  const showList = split === "vertical" || !focus
  const showPane = split === "vertical" || !!focus

  const list = (
    <MetricList
      info={info}
      metricIds={metricIds}
      label={label}
      place={place}
      selected={focus}
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
      onFlatTable={() => setMode("table")}
      split={split}
      onSplit={setSplit}
      query={query}
      loading={!!source && !rows && !error}
      error={error}
    />
  )

  const empty = (
    <div className="flex h-full flex-col items-center px-8 py-16 text-center">
      <p className="text-lg">No metric selected</p>
      <p className="mt-3 text-sm text-muted-foreground">
        {source ? `${metricIds.length.toLocaleString("en-US")} metrics in ${shortSource(source)}; the box on a row is its column, the star pins it.` : "Pick a source from the rail."}
      </p>
    </div>
  )

  return (
    <BlockShell
      defaultOpen={false}
      title={
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
                placeholder="Search metrics"
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
            <Button variant="ghost" size="sm" aria-label="Search metrics" className="ml-1" onClick={() => setSearching(true)}>
              <Search className="size-4" />
            </Button>
          )}
        </div>
      }
      sidebarWidth="calc(var(--spacing) * 56)"
      contentClassName="overflow-hidden"
      rail={
        <AudienceRail
          groups={groups}
          source={source}
          onSource={(s) => {
            setSource(s)
            setMode("list")
          }}
        />
      }
    >
      {mode === "table" ? (
        <AudienceRows rows={rows} short={source ? shortSource(source) : ""} label={label} place={place} query={query} onBack={() => setMode("list")} error={error} />
      ) : (
        <div className="relative flex min-h-0 min-w-0 flex-1">
          <ResizablePanelGroup orientation="horizontal" className="min-h-0 min-w-0 flex-1">
            {/* react-resizable-panels v4 reads bare numbers as pixels. */}
            {showList && (
              <ResizablePanel defaultSize={split === "vertical" ? 420 : 100000} minSize={320} maxSize={split === "vertical" ? 640 : undefined} className="min-w-0">
                {list}
              </ResizablePanel>
            )}
            {showList && showPane && <ResizableHandle withHandle />}
            {showPane && (
              <ResizablePanel className="min-w-0">
                {rows && (focus || checked.length) ? (
                  <AudiencePane
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
    </BlockShell>
  )
}
