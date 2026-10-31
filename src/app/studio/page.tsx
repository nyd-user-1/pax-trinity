import type { Metadata } from "next"

import { StudioFrame } from "@/components/studio-frame"
import { adminOrSignin } from "../message-tests/admin"

export const metadata: Metadata = { title: "Studio" }

// /studio — Remotion Studio inside PAX (Brendan, 2026-10-30): the templates, the Enhance flow's graphics
// and every saved version, full-bleed under the header. In the sidebar's list for admins only;
// the Studio's own files (/studio-app) refuse anyone else too. ?v=<id> opens that
// composition, a saved version (v-lift-card-2) or any template.
export default async function StudioPage({ searchParams }: { searchParams: Promise<{ v?: string | string[] }> }) {
  const v = (await searchParams).v
  const id = typeof v === "string" ? v : null
  await adminOrSignin(id ? `/studio?v=${encodeURIComponent(id)}` : "/studio")
  return <StudioFrame id={id} />
}
