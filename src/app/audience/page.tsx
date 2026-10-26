import type { Metadata } from "next"

import { AudienceSurface } from "./audience-surface"

export const metadata: Metadata = { title: "Audience", description: "The audience database: sources in the rail, metrics as the list, segments read against their baselines." }

export default function AudiencePage() {
  return <AudienceSurface />
}
