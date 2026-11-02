import type { Metadata } from "next"

import { previewFontVariables } from "@/app/preview/fonts"
import { ClipsApp } from "@/components/clips/clips-app"
import { PUBLISHED } from "@/components/clips/catalog"
import { currentUser } from "@/lib/auth"
import { clipOrgs, lensOf, sees } from "@/lib/partners/sponsors"
import { RESULT_SETS } from "@/lib/results"

// Short vertical video, recorded in the browser and kept in it: the mock of
// the Clips experience, 2026-09-07. See components/clips/store.ts for where
// Cloudflare Stream plugs in once it is wired.
export const metadata: Metadata = { title: "Clips", description: "Short video from the record, and your own." }

export const dynamic = "force-dynamic"

export default async function ClipsPage() {
  // The published stock, through the reader's lens (lib/partners/sponsors.ts, 2026-11-02): a partner's own sponsor's
  // clips alone, the ones it made and the ones its studies tested; everything for staff.
  const lens = lensOf(await currentUser())
  const catalog = lens === null ? PUBLISHED : PUBLISHED.filter((c) => sees(lens, clipOrgs(c, RESULT_SETS)))
  // Studio clips set their own faces.
  return (
    <div className={`${previewFontVariables} contents`}>
      <ClipsApp catalog={catalog} scoped={lens !== null} />
    </div>
  )
}
