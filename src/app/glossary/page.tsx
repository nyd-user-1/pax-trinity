import { redirect } from "next/navigation"

// /glossary became the glossary tab on /data-dictionary (2026-10-27); the proxy answers first.
export default function GlossaryPage() {
  redirect("/data-dictionary?tab=glossary")
}
