import type { Metadata } from "next"

import { AudienceClient } from "./audience-client"

export const metadata: Metadata = { title: "America Thinks", description: "The reference instrument: what America thinks, in what wording, measured by whom." }

export default function AudiencePage() {
  return <AudienceClient />
}
