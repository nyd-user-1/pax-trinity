import type { Metadata } from "next"

import { ConstructTable } from "./construct-table"

export const metadata: Metadata = { title: "Constructs" }

export default function ConstructsPage() {
  return <ConstructTable />
}
