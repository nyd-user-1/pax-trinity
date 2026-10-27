import { redirect } from "next/navigation"

// /erd became the ERD tab on /data-dictionary (2026-10-27); the proxy answers first.
export default function ErdPage() {
  redirect("/data-dictionary?tab=erd")
}
