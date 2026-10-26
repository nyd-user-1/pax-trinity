"use client"

import * as React from "react"
import { Folder, PanelLeftIcon, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { PathBar } from "@/components/create/path-bar"
import { Button } from "@govblock/ui/components/nova/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@govblock/ui/components/ny4/resizable"
import { Separator } from "@govblock/ui/components/ny4/separator"
import { SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader } from "@govblock/ui/components/ny4/sidebar"

import { groupSources, mnemonicOf, shortSource, WORDING, year, type AudienceIndex, type SourceRow } from "./audience-data"
import { RowsView } from "./rows-view"

// /audience — the normative database: the reference instrument a pollster
// opens to ask what America thinks, in what wording, measured by whom. The
// grammar is source → question → data: the rail is the datasets, the middle
// panel every question as the source asked it, the main panel the raw rows
// exactly as reported. This is the representative slice (Brendan,
// 2026-10-26): two GSS questions asked in every wave, so the shape proves
// out before the full library mounts. The rail carries no counts and the
// datasets it lists are the ones the slice reads.

const SLICE_SOURCE = "GSS"
/** The slice, widened 2026-10-26: party identification beside every form of
 *  confidence in Congress — the flagship battery item, the 1984 Version Z
 *  experiment, the 1991-2018 second form, and the two recent trust
 *  rewordings — so the versions of one construct sit side by side. */
const SLICE = new Set(["party_id_7", "confidence_congress", "concong", "conlegiy", "trcong", "trlegis"])

type Question = { id: string; label: string; def: string; wording?: string; span: string; waves: number; rows: SourceRow[] }

export function BankSurface() {
  const [index, setIndex] = React.useState<AudienceIndex | null>(null)
  const [rows, setRows] = React.useState<SourceRow[] | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState("")
  const [open, setOpen] = React.useState<string | null>(null)
  const [railOpen, setRailOpen] = React.useState(true)

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
    if (!index || rows) return
    const g = groupSources(index.sources).find((x) => x.source === SLICE_SOURCE)
    if (!g) {
      setError(`the index carries no ${SLICE_SOURCE}`)
      return
    }
    let on = true
    // The parts download in parallel but parse one at a time with the main
    // thread handed back between each; only the slice's rows are kept, so the
    // source's seventy megabytes never sit in memory.
    ;(async () => {
      try {
        const responses = await Promise.all(
          g.files.map(async (f) => {
            const r = await fetch(`/audience-data/${f}`)
            if (!r.ok) throw new Error(`${f} answered ${r.status}`)
            return r
          })
        )
        const kept: SourceRow[] = []
        for (const r of responses) {
          const part: SourceRow[] = await r.json()
          for (const row of part) if (SLICE.has(row[0])) kept.push(row)
          if (!on) return
          await new Promise((settle) => setTimeout(settle, 0))
        }
        if (on) setRows(kept)
      } catch (e) {
        if (on) setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      on = false
    }
  }, [index, rows])

  const questions = React.useMemo<Question[]>(() => {
    if (!rows || !index) return []
    const defs = new Map(index.constructs.map((c) => [c.construct, c]))
    const by = new Map<string, SourceRow[]>()
    for (const r of rows) {
      const g = by.get(r[0])
      if (g) g.push(r)
      else by.set(r[0], [r])
    }
    const qs: Question[] = []
    for (const [id, rs] of by) {
      const ys = new Set<string>()
      for (const r of rs) ys.add(year(r[3]))
      const span = [...ys].sort()
      const last = span[span.length - 1]
      qs.push({ id, label: defs.get(id)?.label ?? id, def: defs.get(id)?.definition ?? "", wording: WORDING[id], span: span[0] === last ? span[0] : `${span[0]}–${last}`, waves: ys.size, rows: rs })
    }
    return qs.sort((a, b) => a.label.localeCompare(b.label))
  }, [rows, index])

  React.useEffect(() => {
    if (!open && questions.length) setOpen(questions[0].id)
  }, [questions, open])

  const q = query.trim().toLowerCase()
  const shown = questions.filter((x) => !q || x.label.toLowerCase().includes(q) || x.def.toLowerCase().includes(q) || x.id.toLowerCase().includes(q) || (x.wording ?? "").toLowerCase().includes(q))
  const openQ = questions.find((x) => x.id === open)

  const rail = (
    <>
      <SidebarHeader className="flex-row items-center gap-2.5 p-4">
        <p className="text-xl font-semibold">Audience</p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Sources</SidebarGroupLabel>
          <SidebarGroupContent>
            <nav className="flex flex-col gap-0.5 px-1">
              <button
                type="button"
                aria-current="true"
                className="group relative flex w-full items-center gap-3 rounded-xl bg-white px-3 py-2 text-left text-sm font-semibold text-pax2-blue shadow-e1 outline-none"
              >
                <span aria-hidden className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-pax2-light-blue" />
                <Folder className="icon-pop size-[18px] shrink-0 fill-pax2-lavender text-pax2-blue" strokeWidth={2.25} />
                <span className="min-w-0 flex-1 truncate">{shortSource(SLICE_SOURCE)}</span>
              </button>
            </nav>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </>
  )

  const middle = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 p-3">
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search wording or label…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && <p className="p-6 text-center text-sm text-pax2-red">The data did not load: {error}</p>}
        {!error && !rows && <p className="p-6 text-center text-sm text-muted-foreground">Reading {shortSource(SLICE_SOURCE)}…</p>}
        {!error && rows && !shown.length && <p className="p-6 text-center text-sm text-muted-foreground">Nothing matching “{query.trim()}”.</p>}
        <ul className="divide-y">
          {shown.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                onClick={() => setOpen(x.id)}
                aria-current={open === x.id ? "true" : undefined}
                className={cn("w-full px-4 py-3 text-left transition-colors hover:bg-accent/60", open === x.id && "bg-muted")}
              >
                <p className="text-sm font-semibold">{x.wording ?? x.label}</p>
                {!x.wording && x.def && x.def !== x.label && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">“{x.def}”</p>}
                <div className="mt-1.5 flex items-end justify-between gap-2">
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {x.span} · {x.waves} {x.waves === 1 ? "wave" : "waves"}
                  </p>
                  <span className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wider text-muted-foreground">{mnemonicOf(x.id)}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )

  return (
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
                <PathBar crumbs={[{ label: "Audience" }]} folder onGo={() => {}} />
              </div>
            </header>
            <div className="flex min-h-0 flex-1 overflow-hidden">
              <ResizablePanelGroup orientation="horizontal" className="min-h-0 min-w-0 flex-1">
                <ResizablePanel defaultSize={380} minSize={300} maxSize={560} className="min-w-0">
                  {middle}
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel className="min-w-0">
                  {openQ ? (
                    <RowsView rows={openQ.rows} title={openQ.label} id={openQ.id} short={shortSource(SLICE_SOURCE)} />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <p className="text-sm text-muted-foreground">{error ? `The data did not load: ${error}` : "Reading the source…"}</p>
                    </div>
                  )}
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
