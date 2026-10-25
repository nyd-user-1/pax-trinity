import { HOME_BLOCK } from "@/app/_home/height"
import { TableBlock } from "@/components/blocks"
import { GLOSSARY } from "@/lib/glossary"
import { Table, TableHead, TableHeader, TableRow } from "@/ui/components/nova/table"

import { GlossaryRows } from "./glossary-rows"

export const metadata = { title: "Glossary" }

/** A to Z by the term's full name, letters only: "e² (end to end)" files under E. */
const SORTED = [...GLOSSARY].sort((a, b) => a.full.replace(/[^\p{L}\p{N} ]/gu, "").localeCompare(b.full.replace(/[^\p{L}\p{N} ]/gu, ""), "en", { sensitivity: "base" }))

export default function GlossaryPage() {
  return (
    <TableBlock title="Glossary" search="Search terms…" rows={SORTED.map((t) => ({ term: t.full, definition: t.definition, section: t.group }))} name="glossary" height={HOME_BLOCK}>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="bg-muted/60">
            <TableHead className="w-[26%]">Term</TableHead>
            <TableHead className="w-[60%]">Definition</TableHead>
            <TableHead className="w-[14%]">Section</TableHead>
          </TableRow>
        </TableHeader>
        <GlossaryRows rows={SORTED} />
      </Table>
    </TableBlock>
  )
}
