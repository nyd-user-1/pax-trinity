import "@xyflow/react/dist/style.css"

import { TableBlock } from "@/components/blocks"
import { FactoryCanvas } from "@/components/factory-canvas"
import { TabRail, type RailTab } from "@/components/tab-rail"
import { currentUser } from "@/lib/auth"
import { GLOSSARY } from "@/lib/glossary"
import { Table, TableHead, TableHeader, TableRow } from "@/ui/components/nova/table"

import { dictionaryRows } from "./dictionary-data"
import { DictionaryRows } from "./dictionary-rows"
import { GlossaryRows } from "./glossary-rows"
import { SchemaCanvas } from "./schema-canvas"

export const metadata = { title: "Data dictionary" }

// The audience index is served from S3 and changes when the bank is re-exported.
export const dynamic = "force-dynamic"

// /data-dictionary — the reference, four into one (the 2026-10-27
// consolidation): the bank's constructs as terms, the glossary, the audience
// store's schema and the whole factory's ERD, as tabs; the two canvases for
// admins only, as their pages were. /glossary, /schema and /erd answer a
// redirect into their tab. Only the open tab renders, so a canvas's chunk
// loads only when its tab is picked.

const TABS = [
  { key: "dictionary", label: "Dictionary" },
  { key: "glossary", label: "Glossary" },
  { key: "schema", label: "Schema", admin: true },
  { key: "erd", label: "ERD", admin: true },
] as const
type Tab = (typeof TABS)[number]["key"]

/** A to Z by the term's full name, letters only: "e² (end to end)" files under E. */
const SORTED = [...GLOSSARY].sort((a, b) => a.full.replace(/[^\p{L}\p{N} ]/gu, "").localeCompare(b.full.replace(/[^\p{L}\p{N} ]/gu, ""), "en", { sensitivity: "base" }))

export default async function DataDictionaryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  const admin = !!(await currentUser())?.admin
  const open = TABS.filter((t) => !("admin" in t) || admin)
  const current: Tab = open.find((t) => t.key === tab)?.key ?? "dictionary"
  const tabs: RailTab[] = open.map((t) => ({ key: t.key, label: t.label, href: t.key === "dictionary" ? "/data-dictionary" : `/data-dictionary?tab=${t.key}` }))

  return (
    // The Block standard (Brendan, 2026-10-25): header 20px under the AppShellHeader,
    // footer 20px above the AppShell bottom — by filling the shell's fixed-height
    // column, never by viewport arithmetic.
    <div className="flex min-h-0 flex-1 flex-col px-5 pt-5 pb-5 md:px-10">
      <TabRail tabs={tabs} active={current} className="mb-5 shrink-0" />
      {current === "dictionary" && <Dictionary />}
      {current === "glossary" && (
        <TableBlock fill title="" search="Search terms…" rows={SORTED.map((t) => ({ term: t.full, definition: t.definition, section: t.group }))} name="glossary">
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
      )}
      {current === "schema" && (
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border">
          <SchemaCanvas />
        </div>
      )}
      {current === "erd" && (
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border">
          <FactoryCanvas />
        </div>
      )}
    </div>
  )
}

/** The bank's constructs as the terms, the glossary's table shape. */
async function Dictionary() {
  // One array for the rows and the menu's Download, so the payload carries them once.
  const rows = await dictionaryRows()
  return (
    <TableBlock fill title="" search="Search the dictionary…" rows={rows} name="data-dictionary">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="bg-muted/60">
            <TableHead className="w-[26%]">Term</TableHead>
            <TableHead className="w-[60%]">Definition</TableHead>
            <TableHead className="w-[14%]">Section</TableHead>
          </TableRow>
        </TableHeader>
        <DictionaryRows rows={rows} />
      </Table>
    </TableBlock>
  )
}
