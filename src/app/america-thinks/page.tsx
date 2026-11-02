import type { Metadata } from "next"
import { preload } from "react-dom"

import { AudienceClient } from "./audience-client"

export const metadata: Metadata = { title: "America Thinks", description: "The reference instrument: what America thinks, in what wording, measured by whom." }

export default function AudiencePage() {
  // The question list reads index.json on mount, after the page's code has loaded and hydrated; the hint starts
  // its fetch with the HTML instead, and the mount's fetch takes the same response.
  preload("/audience-data/index.json", { as: "fetch", crossOrigin: "anonymous" })
  return <AudienceClient />
}
