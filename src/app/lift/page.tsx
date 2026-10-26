import type { Metadata } from "next"

import { LiftClient } from "./lift-client"

export const metadata: Metadata = { title: "Lift", description: "Message tests read the way I report them: each treatment against its control group, in percentage points, by segment." }

export default function LiftPage() {
  return <LiftClient />
}
