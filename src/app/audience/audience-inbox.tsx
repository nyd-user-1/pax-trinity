"use client"

import * as React from "react"
import Link from "next/link"
import { X } from "lucide-react"

import { addToDraft } from "@/lib/consensus/draft"
import { BankFrame, BankSplit } from "@/components/bank/bank-frame"
import { CardList, type Card, type Split } from "@/components/bank/card-list"
import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@govblock/ui/components/ny4/dropdown-menu"

import { AboutPanel, type About } from "./audience-pane"
import { buildInfo, fetchQuestionRows, groupSources, mnemonicOf, normalizeWording, scaleOf, shortSource, topicOf, UNTAGGED, TOPIC_GROUPS, WEB_GRID, WORDING, type AudienceIndex, type MetricInfo, type QuestionSummary, type SourceRow } from "./audience-data"
import { SourceRail } from "./source-rail"
import { QuestionTable } from "./question-table"
import { SegmentGrid } from "./segment-grid"

// /audience — the audience database wearing the Agentic Inbox's frame whole,
// the Gmail recreate repurposed (Brendan, 2026-10-26; it took the /audience
// address from the earlier browse surface 2026-10-27): topics and source
// folders in the rail, questions as the threads, and the list opens full
// width the way the inbox does with no split on. Opening a question is the
// presto — its table takes the pane — and a cell hands its row to the About
// panel. ?source=<KEY> or ?topic=<name> opens on that folder or topic.

type ListTab = "all" | "pinned"
/** The compare grid's columns, at most. */
const MAX_COLS = 4

export function AudienceInbox() {
  const [index, setIndex] = React.useState<AudienceIndex | null>(null)
  // One thing is open in the rail at a time: a topic (the lead view) or a
  // folder, the address's ?source= or ?topic= first (this mounts browser-side).
  const [source, setSource] = React.useState<string | null>(() => new URLSearchParams(window.location.search).get("source"))
  const [topic, setTopic] = React.useState<string | null>(() => {
    const at = new URLSearchParams(window.location.search)
    return at.get("source") ? null : at.get("topic")
  })
  // The questions read so far, each from its own file (Brief S), keyed source/id.
  const [cache, setCache] = React.useState<Record<string, SourceRow[]>>({})
  const pending = React.useRef(new Set<string>())
  const [error, setError] = React.useState<string | null>(null)
  const [rowsError, setRowsError] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState("")
  const [split, setSplit] = React.useState<Split>("none")
  const [tab, setTab] = React.useState<ListTab>("all")
  // The compare grid's columns, four at most, added from a row's kebab.
  const [columns, setColumns] = React.useState<string[]>([])
  const [pinned, setPinned] = React.useState<string[]>([])
  // The Blocks panel's contents: questions pressed into it from the list.
  const [blocks, setBlocks] = React.useState<string[]>([])
  const [blocksOpen, setBlocksOpen] = React.useState(false)
  const [about, setAbout] = React.useState<About | null>(null)
  const [mode, setMode] = React.useState<"list" | "table">("list")
  // The open question, its table in the pane; null leaves the list alone.
  const [tableMetric, setTableMetric] = React.useState<string | null>(null)
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

  // The rail's first topic opens first; the folders wait at the bottom. An
  // address naming a folder or topic the bank doesn't carry falls back to it.
  React.useEffect(() => {
    if (!index) return
    if (source && !groups.some((g) => g.source === source)) setSource(null)
    else if (topic && !topicRows.some((r) => r.topic === topic)) setTopic(null)
    else if (!source && !topic && topicRows.length) setTopic(topicRows[0].topic)
  }, [index, groups, topicRows, source, topic])

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
  // The questions on screen: the open one and the grid's columns.
  const wanted = React.useMemo(() => [...new Set([tableMetric, ...columns].filter((x): x is string => !!x))].sort(), [tableMetric, columns])

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

  // The list's reading order: the search and the pinned-only tab, pins first.
  const ordered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const shown = metricIds
      .filter((id) => !q || label(id).toLowerCase().includes(q) || id.toLowerCase().includes(q) || (wordingOf(id) ?? "").toLowerCase().includes(q))
      .filter((id) => tab === "all" || pinned.includes(id))
    return [...shown.filter((id) => pinned.includes(id)), ...shown.filter((id) => !pinned.includes(id))]
  }, [metricIds, query, tab, pinned, label, wordingOf])

  // A question as a card: its wording, the topic chip, the mnemonic, the span;
  // the scale family and wave count after the dash on the one-line row.
  const cardOf = (id: string): Card => {
    const c = summaries.get(id)
    const scale = scaleOf(c?.options ?? [])
    const isColumn = columns.includes(id)
    const atCap = !isColumn && columns.length >= MAX_COLS
    return {
      title: (
        <>
          {normalizeWording(wordingOf(id) ?? label(id))}
          {WEB_GRID.has(id) && <span className="font-normal text-muted-foreground"> (web grid)</span>}
        </>
      ),
      hint: wordingOf(id) ?? label(id),
      chip: topicChipOf(id),
      tag: mnemonicOf(id),
      span: c ? (c.first === c.last ? String(c.first) : `${c.first}–${c.last}`) : null,
      detail: c ? `${scale ? `${scale} · ` : ""}${c.waves} ${c.waves === 1 ? "wave" : "waves"}` : null,
      pinned: pinned.includes(id),
      actions: [
        { label: isColumn ? "Remove column" : atCap ? "Four columns at most" : "Add as column", onSelect: () => toggleColumn(id), disabled: atCap },
        { label: pinned.includes(id) ? "Unpin" : "Pin", onSelect: () => setPinned((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])) },
        {
          label: "Add to blocks",
          onSelect: () => {
            setBlocks((prev) => (prev.includes(id) ? prev : [...prev, id]))
            setBlocksOpen(true)
          },
        },
        { label: "Add to survey", onSelect: () => addToSurvey(id) },
      ],
    }
  }

  const blocksPanel = blocksOpen && blocks.length > 0 && (
    <BlocksPanel ids={blocks} summaries={summaries} label={label} wordingOf={wordingOf} onRemove={(id) => setBlocks((prev) => prev.filter((x) => x !== id))} onClose={() => setBlocksOpen(false)} />
  )

  // The list keeps its place beside the open question (Brendan, 2026-10-26:
  // "don't close the middle panel"), stacked the way the split folds it.
  const listFor = (s: Split) => (
    <CardList
      ids={ordered}
      card={cardOf}
      selected={tableMetric}
      onOpen={open}
      split={s}
      onSplit={setSplit}
      query={query}
      onQuery={setQuery}
      placeholder="Search wording or label…"
      menu={
        <DropdownMenuRadioGroup value={tab} onValueChange={(value) => setTab(value as ListTab)}>
          <DropdownMenuRadioItem value="all">All questions</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="pinned">Pinned only</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      }
      loading={!index && !error}
      error={error}
      empty={tab === "pinned" ? "Nothing pinned." : query.trim() ? `Nothing matching “${query.trim()}”.` : "Nothing on file."}
    />
  )

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
      <p className="text-lg">No question open</p>
      <p className="mt-3 text-sm text-muted-foreground">
        {source || topic ? `${metricIds.length.toLocaleString("en-US")} questions in ${source ? shortSource(source) : topic}.` : "Pick a topic from the rail."}
      </p>
    </div>
  )

  const aboutPanel = (from: string | null) =>
    about && <AboutPanel about={about} onClose={() => setAbout(null)} source={from} groups={groups} files={files} info={info} label={label} place={place} geoLevel={geoLevel} />

  const drafting = drafted != null && (
    <div role="status" className="absolute bottom-4 left-4 z-20 flex items-center gap-4 rounded-md bg-foreground px-4 py-2.5 text-sm text-background shadow-lg">
      <span>
        In the survey draft: {drafted} {drafted === 1 ? "question" : "questions"}
      </span>
      <Link href="/consensus/admin?c=audience-draft" className="font-medium text-background/80 hover:text-background">
        View
      </Link>
    </div>
  )

  return (
    <BankFrame rail={railNode} crumb="Audience" search={{ query, onQuery: setQuery, placeholder: "Search questions" }} overlay={drafting}>
      {mode === "table" && tableMetric ? (
        <BankSplit
          list={listFor("vertical")}
          pane={
            loaded(tableMetric) && info.get(tableMetric) ? (
              <QuestionTable
                rows={rows.filter((r) => r[0] === tableMetric)}
                title={label(tableMetric)}
                def={defs.get(tableMetric)}
                metric={tableMetric}
                place={place}
                info={info.get(tableMetric) as MetricInfo}
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
            )
          }
          aside={
            <>
              {aboutPanel(srcOf(tableMetric))}
              {blocksPanel}
            </>
          }
        />
      ) : (
        <BankSplit
          list={listFor(split)}
          pane={
            split === "vertical" &&
            (columns.length && !columns.some(loaded) ? (
              <Reading error={rowsError} />
            ) : columns.length ? (
              <SegmentGrid key={source ?? topic ?? ""} rows={rows} info={info} columns={columns} label={label} place={place} geoLevel={geoLevel} about={about} onPick={setAbout} />
            ) : (
              empty
            ))
          }
          fold={{ size: 420, min: 320, max: 640 }}
          aside={
            <>
              {aboutPanel(source)}
              {blocksPanel}
            </>
          }
        />
      )}
    </BankFrame>
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
