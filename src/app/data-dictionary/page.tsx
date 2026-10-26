import { TableBlock } from "@/components/blocks"
import { Table, TableHead, TableHeader, TableRow } from "@/ui/components/nova/table"

import { dictionaryRows } from "./dictionary-data"
import { DictionaryRows } from "./dictionary-rows"

export const metadata = { title: "Data dictionary" }

// The audience index is served from S3 and changes when the bank is re-exported.
export const dynamic = "force-dynamic"

export default async function DataDictionaryPage() {
  // One array for the rows and the menu's Download, so the payload carries them once.
  const rows = await dictionaryRows()
  return (
    // The glossary's page (src/app/glossary/page.tsx) with the bank's constructs as its terms.
    <div className="flex min-h-0 flex-1 flex-col px-5 pt-5 pb-5 md:px-10">
    <TableBlock fill title="Data dictionary" search="Search the dictionary…" rows={rows} name="data-dictionary">
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
    </div>
  )
}
