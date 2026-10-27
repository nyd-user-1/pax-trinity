import type { Metadata } from "next"

import { ElectorateSlice } from "./electorate-slice"

export const metadata: Metadata = { title: "Population & electorate" }

export default async function ElectoratePage({ searchParams }: { searchParams: Promise<{ source?: string | string[] }> }) {
  const { source } = await searchParams
  return <ElectorateSlice initial={(Array.isArray(source) ? source[0] : (source ?? "ACS")).toUpperCase()} />
}
