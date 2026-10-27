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
import { buildInfo, fetchQuestionRows, groupSources, mnemonicOf, normalizeWording, shortSource, topicOf, UNTAGGED, TOPIC_GROUPS, WORDING, type AudienceIndex, type MetricInfo, type QuestionSummary, type SourceRow } from "../audience/audience-data"
import { SourceRail } from "./source-rail"
import { QuestionTable } from "./question-table"
import { MAX_COLS, SegmentList, type ListTab, type Split } from "./segment-list"
import { SegmentGrid } from "./segment-grid"

// /inbox-2 — the audience database wearing the Agentic Inbox's frame whole,
// the Gmail recreate repurposed (Brendan, 2026-10-26): the sources are the
// folders, the segments are the threads, and the list opens full width the
// way the inbox does with no split on. Opening a segment is the presto — the
// results grid takes the pane — and a cell hands its row to the About panel.
// /audience keeps the earlier shape for comparison while this one settles.

export function AudienceInbox() {
  const [index, setIndex] = React.useState<AudienceIndex | null>(null)
  // One thing is open in the rail at a time: a topic (the lead view) or a folder.
  const [source, setSource] = React.useState<string | null>(null)
  const [topic, setTopic] = React.useState<string | null>(null)
  // The questions read so far, each from its own file (Brief S), keyed source/id.
  const [cache, setCache] = React.useState<Record<string, SourceRow[]>>({})
  const pending = React.useRef(new Set<string>())
  const [error, setError] = React.useState<string | null>(null)
  const [rowsError, setRowsError] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState("")
  const [searching, setSearching] = React.useState(false)
  const [split, setSplit] = React.useState<Split>("none")
  const [tab, setTab] = React.useState<ListTab>("all")
  const [focus, setFocus] = React.useState<string | null>(null)
  // The compare grid's columns, four at most, added from a row's kebab.
  const [columns, setColumns] = React.useState<string[]>([])
  const [pinned, setPinned] = React.useState<string[]>([])
  // The Blocks panel's contents: questions pressed into it from the list.
  const [blocks, setBlocks] = React.useState<string[]>([])
  const [blocksOpen, setBlocksOpen] = React.useState(false)
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

  // Each question's publisher tags, by id, for the topic collapse.
  const topicsByQ = React.useMemo(() => new Map((index?.constructs ?? []).filter((c) => c.topics).map((c) => [c.construct, c.topics as string[]])), [index])
  // The rail's topics: the collapse counted across the whole bank, the
  // untagged remainder last — honest until ANES and CES tags land (Brief T).
  const topicRows = React.useMemo(() => {
    const out = new Set(["LIFT_ARCHIVE", "PAX_TEST"])
    const counts = new Map<string, number>()
    for (const q of index?.questions ?? []) {
      if (out.has(q.source)) continue
      const t = topicOf(topicsByQ.get(q.question)) ?? UNTAGGED
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    // A–Z (Brendan, 2026-10-27); the untagged remainder holds the last row.
    const rows = TOPIC_GROUPS.map((g) => ({ topic: g.topic, count: counts.get(g.topic) ?? 0 }))
      .filter((r) => r.count > 0)
      .sort((a, b) => a.topic.localeCompare(b.topic, "en", { sensitivity: "base" }))
    const un = counts.get(UNTAGGED)
    if (un) rows.push({ topic: UNTAGGED, count: un })
    return rows
  }, [index, topicsByQ])

  // The rail's first topic opens first; the folders wait at the bottom.
  React.useEffect(() => {
    if (!source && !topic && topicRows.length) setTopic(topicRows[0].topic)
  }, [topicRows, source, topic])

  // The list comes from the index alone (Brief S): a topic's questions across
  // every source, or an open folder's, each with its span, waves and bands.
  const summaries = React.useMemo(() => {
    const out = new Set(["LIFT_ARCHIVE", "PAX_TEST"])
    const qs = (index?.questions ?? []).filter((q) =>
      topic ? !out.has(q.source) && (topicOf(topicsByQ.get(q.question)) ?? UNTAGGED) === topic : q.source === source
    )
    return new Map(qs.map((q) => [q.question, q] as const))
  }, [index, source, topic, topicsByQ])
  // Every source that asks a question: opening it reads all of them, so the
  // About panel can set the same question beside its other sources.
  const homes = React.useMemo(() => {
    const m = new Map<string, string[]>()
    for (const q of index?.questions ?? []) m.set(q.question, [...(m.get(q.question) ?? []), q.source])
    return m
  }, [index])
  // The questions on screen: the open one, the focused one, the grid's columns.
  const wanted = React.useMemo(
    () => [...new Set([tableMetric, focus, ...columns].filter((x): x is string => !!x))].sort(),
    [tableMetric, focus, columns]
  )

  React.useEffect(() => {
    if (!source && !topic) return
    for (const id of wanted) {
      const home = summaries.get(id)?.source ?? source
      for (const s of homes.get(id) ?? (home ? [home] : [])) {
        const key = `${s}/${id}`
        if (cache[key] || pending.current.has(key)) continue
        pending.current.add(key)
        fetchQuestionRows(s, id)
          .then((data) => setCache((prev) => ({ ...prev, [key]: data })))
          .catch((e: Error) => {
            if (s === home) setRowsError(e.message)
          })
          .finally(() => pending.current.delete(key))
      }
    }
  }, [wanted, source, topic, homes, summaries, cache])

  // A new topic or folder starts the read over.
  React.useEffect(() => {
    setRowsError(null)
    setFocus(null)
    setColumns([])
    setAbout(null)
    setTab("all")
    setTableMetric(null)
  }, [source, topic])

  const labels = React.useMemo(() => new Map((index?.constructs ?? []).map((c) => [c.construct, c.label])), [index])
  // The export's verbatim wording first (Brief P), the hand seeds second, nothing third.
  const wordings = React.useMemo(() => new Map((index?.constructs ?? []).filter((c) => c.wording).map((c) => [c.construct, c.wording as string])), [index])
  const defs = React.useMemo(() => new Map((index?.constructs ?? []).map((c) => [c.construct, c.definition])), [index])
  const geoName = React.useMemo(() => new Map((index?.geographies ?? []).map((g) => [g.code, g.name])), [index])
  const geoLevel = React.useMemo(() => new Map((index?.geographies ?? []).map((g) => [g.code, g.level])), [index])
  const label = React.useCallback((id: string) => labels.get(id) ?? id, [labels])
  const wordingOf = React.useCallback((id: string) => wordings.get(id) ?? WORDING[id] ?? null, [wordings])
  /** The row chip's topic: the question's tags through the collapse. */
  const topicChipOf = React.useCallback((id: string) => topicOf(topicsByQ.get(id)), [topicsByQ])
  const place = React.useCallback((code: string) => geoName.get(code) ?? code, [geoName])

  // A question's home source: its own (a topic spans sources), the open folder's otherwise.
  const srcOf = React.useCallback((id: string) => summaries.get(id)?.source ?? source, [summaries, source])
  // The rows of the questions on screen that have arrived, in the source file's order.
  const rows = React.useMemo(
    () =>
      wanted.flatMap((id): SourceRow[] => {
        const s = srcOf(id)
        return s ? (cache[`${s}/${id}`] ?? []) : []
      }),
    [srcOf, wanted, cache]
  )
  const loaded = (id: string | null) => {
    const s = id ? srcOf(id) : null
    return !!id && !!s && !!cache[`${s}/${id}`]
  }
  // Every question read so far, grouped by source, for the About panel's comparison.
  const files = React.useMemo(() => {
    const by: Record<string, SourceRow[]> = {}
    for (const [key, data] of Object.entries(cache)) {
      const s = key.slice(0, key.indexOf("/"))
      by[s] = by[s] ? by[s].concat(data) : data
    }
    return by
  }, [cache])
  const metricIds = React.useMemo(() => {
    const all = [...summaries.keys()]
    if (source !== "GSS" && !topic) return all
    // The full library (the review slice retired once Brief P's wordings
    // landed), A–Z by what the card shows — the wording where one exists — so
    // the reading order matches the visible text, not the hidden label.
    const text = (id: string) => normalizeWording(wordingOf(id) ?? label(id))
    return all
      .map((id) => [text(id), id] as const)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, id]) => id)
  }, [summaries, source, topic, label, wordingOf])
  const info = React.useMemo(() => buildInfo(rows, geoLevel), [rows, geoLevel])

  // A clicked question opens the flat table scoped to its rows (Brendan,
  // 2026-10-26). A row's "Add as column" builds the compare grid, and brings
  // it up: the list folded beside it, the grid in the pane.
  const open = (id: string) => {
    setTableMetric(id)
    setMode("table")
  }
  const toggleColumn = (id: string) => {
    if (columns.includes(id)) {
      setColumns((prev) => prev.filter((x) => x !== id))
      return
    }
    if (columns.length >= MAX_COLS) return
    setColumns((prev) => [...prev, id])
    setTableMetric(null)
    setMode("list")
    setSplit("vertical")
  }
  // The pane's refresh reads the open question's files again, every source's.
  const refresh = (id: string) => {
    setRowsError(null)
    setCache((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => !key.endsWith(`/${id}`))))
  }

  // A segment joins the survey draft as a question — its wording verbatim
  // where the source carries one (polls and results do), its label where it
  // does not — with the segment's bands as the answer options.
  const addToSurvey = React.useCallback(
    (id: string) => {
      const wording = rows.find((r) => r[0] === id && r[10])?.[10] ?? wordingOf(id)
      const draft = addToDraft([{ text: wording ?? label(id), options: summaries.get(id)?.options ?? [] }])
      setDrafted(draft.questions.length)
      window.setTimeout(() => setDrafted((current) => (current === draft.questions.length ? null : current)), 6000)
    },
    [rows, summaries, label, wordingOf]
  )

  const showList = split === "vertical" || !focus
  const showPane = split === "vertical" || !!focus

  const blocksPanel = blocksOpen && blocks.length > 0 && (
    <BlocksPanel ids={blocks} summaries={summaries} label={label} wordingOf={wordingOf} onRemove={(id) => setBlocks((prev) => prev.filter((x) => x !== id))} onClose={() => setBlocksOpen(false)} />
  )

  // The list keeps its place beside the crosstab (Brendan, 2026-10-26: "don't
  // close the middle panel"), stacked the way the split folds it.
  const listFor = (s: Split) => (
    <SegmentList
      summaries={summaries}
      metricIds={metricIds}
      label={label}
      wordingOf={wordingOf}
      topicOf={topicChipOf}
      selected={tableMetric ?? focus}
      columns={columns}
      pinned={pinned}
      onBlock={(id) => {
        setBlocks((prev) => (prev.includes(id) ? prev : [...prev, id]))
        setBlocksOpen(true)
      }}
      onSurvey={addToSurvey}
      tab={tab}
      onTab={setTab}
      onOpen={open}
      onColumn={toggleColumn}
      onPin={(id) => setPinned((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}
      split={s}
      onSplit={setSplit}
      query={query}
      onQuery={setQuery}
      loading={!index && !error}
      error={error}
    />
  )
  const list = listFor(split)

  const railNode = (
    <SourceRail
      topics={topicRows}
      topic={topic}
      groups={groups}
      source={source}
      onTopic={(t) => {
        setTopic(t)
        setSource(null)
        setMode("list")
      }}
      onSource={(s) => {
        setSource(s)
        setTopic(null)
        setMode("list")
      }}
    />
  )

  const empty = (
    <div className="flex h-full flex-col items-center px-8 py-16 text-center">
      <p className="text-lg">No segment selected</p>
      <p className="mt-3 text-sm text-muted-foreground">
        {source || topic ? `${metricIds.length.toLocaleString("en-US")} questions in ${source ? shortSource(source) : topic}.` : "Pick a topic from the rail."}
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
          {mode === "table" && tableMetric ? (
            <div className="relative flex h-full min-h-0 min-w-0">
              <ResizablePanelGroup orientation="horizontal" className="min-h-0 min-w-0 flex-1">
                <ResizablePanel defaultSize={380} minSize={300} maxSize={560} className="min-w-0">
                  {listFor("vertical")}
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel className="min-w-0">
                  {loaded(tableMetric) && info.get(tableMetric) ? (
                    <QuestionTable
                      rows={rows.filter((r) => r[0] === tableMetric)}
                      title={label(tableMetric)}
                      def={defs.get(tableMetric)}
                      metric={tableMetric}
                      place={place}
                      info={info.get(tableMetric) as MetricInfo}
                      short={srcOf(tableMetric) ? shortSource(srcOf(tableMetric) as string) : ""}
                      source={srcOf(tableMetric)}
                      wording={wordingOf(tableMetric)}
                      about={about}
                      onPick={setAbout}
                      query={query}
                      onQuery={setQuery}
                      onRefresh={() => refresh(tableMetric)}
                    />
                  ) : (
                    <Reading error={rowsError} />
                  )}
                </ResizablePanel>
              </ResizablePanelGroup>
              {about && <AboutPanel about={about} onClose={() => setAbout(null)} source={tableMetric ? srcOf(tableMetric) : source} groups={groups} files={files} info={info} label={label} place={place} geoLevel={geoLevel} />}
              {blocksPanel}
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
                    {(focus || columns.length) && (focus ? !loaded(focus) : !columns.some(loaded)) ? (
                      <Reading error={rowsError} />
                    ) : focus || columns.length ? (
                      <SegmentGrid
                        key={source ?? topic ?? ""}
                        rows={rows}
                        info={info}
                        columns={columns}
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
              {about && <AboutPanel about={about} onClose={() => setAbout(null)} source={focus ? srcOf(focus) : source} groups={groups} files={files} info={info} label={label} place={place} geoLevel={geoLevel} />}
              {blocksPanel}
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

/** The pane while a question's own file is on its way. */
function Reading({ error }: { error: string | null }) {
  return error ? <p className="p-6 text-center text-sm text-pax2-red">The question did not load: {error}</p> : <p className="p-6 text-center text-sm text-muted-foreground">Reading the question…</p>
}

/** The right side's Blocks panel: the questions pressed into it, each with its data's shape. */
function BlocksPanel({
  ids,
  summaries,
  label,
  wordingOf,
  onRemove,
  onClose,
}: {
  ids: string[]
  summaries: Map<string, QuestionSummary>
  label: (id: string) => string
  wordingOf: (id: string) => string | null
  onRemove: (id: string) => void
  onClose: () => void
}) {
  return (
    <div className="relative w-[420px] shrink-0 overflow-y-auto border-l p-5">
      <button type="button" onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
        <X className="size-4" />
      </button>
      <h3 className="pr-7 text-sm font-semibold text-pax2-blue">Blocks</h3>
      <ul className="mt-4 space-y-3">
        {ids.map((id) => {
          const c = summaries.get(id)
          const span = c ? (c.first === c.last ? String(c.first) : `${c.first}–${c.last}`) : ""
          return (
            <li key={id} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-medium tracking-wide text-muted-foreground">{mnemonicOf(id)}</p>
                <button type="button" aria-label={`Remove ${label(id)}`} onClick={() => onRemove(id)} className="shrink-0 text-muted-foreground/60 hover:text-foreground">
                  <X className="size-3.5" />
                </button>
              </div>
              <p className="mt-1 text-sm font-semibold">{normalizeWording(wordingOf(id) ?? label(id))}</p>
              <p className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                {span}
                {span && " · "}
                {c?.waves ?? 0} {c?.waves === 1 ? "wave" : "waves"} · {c?.options.length ?? 0} bands
              </p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
