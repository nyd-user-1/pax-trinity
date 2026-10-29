"use client"

import * as React from "react"

import { TableBlock } from "@/components/blocks"
import { Table, TableHead, TableHeader, TableRow } from "@/ui/components/nova/table"

import type { DictionaryRow } from "./dictionary-data"
import { DictionaryRows } from "./dictionary-rows"

// All 8,028 rows at once made the page too large for Amplify to serve (413) and
// seconds slow to switch to (2026-10-29), so the table filters in state and renders
// a window, adding rows as the reader nears the end. Search still covers every row,
// matching the term, definition and sources as the block's own search did.
const STEP = 100

/** The nearest scrolling ancestor, so rows load ahead of the block's own scroll. */
function scroller(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) if (/(auto|scroll)/.test(getComputedStyle(p).overflowY)) return p
  return null
}

export function DictionaryTable({ rows }: { rows: DictionaryRow[] }) {
  const [q, setQ] = React.useState("")
  const [shown, setShown] = React.useState(STEP)
  const hay = React.useMemo(() => rows.map((r) => `${r.term} ${r.definition} ${r.section}`.toLowerCase()), [rows])
  const matched = React.useMemo(() => {
    const needle = q.trim().toLowerCase()
    return needle ? rows.filter((_, i) => hay[i].includes(needle)) : rows
  }, [rows, hay, q])
  const search = React.useCallback((v: string) => {
    setQ(v)
    setShown(STEP)
  }, [])

  const end = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const el = end.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setShown((n) => n + STEP), { root: scroller(el), rootMargin: "800px 0px" })
    io.observe(el)
    return () => io.disconnect()
  }, [matched, shown])

  return (
    <TableBlock fill title="" search="Search the dictionary…" searchValue={q} onSearch={search} rows={rows} name="data-dictionary">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="bg-muted/60">
            <TableHead className="w-[26%]">Term</TableHead>
            <TableHead className="w-[60%]">Definition</TableHead>
            <TableHead className="w-[14%]">Section</TableHead>
          </TableRow>
        </TableHeader>
        <DictionaryRows rows={matched.slice(0, shown)} />
      </Table>
      {shown < matched.length && <div ref={end} className="h-px" />}
    </TableBlock>
  )
}
