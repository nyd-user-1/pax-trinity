import { redirect } from "next/navigation"

// /schema became the schema tab on /data-dictionary (2026-10-27); the proxy answers first.
export default function SchemaPage() {
  redirect("/data-dictionary?tab=schema")
}
