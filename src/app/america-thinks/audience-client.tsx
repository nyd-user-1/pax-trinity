"use client"

import dynamic from "next/dynamic"

// The audience surface loads browser-side: the split preference and the read
// sources live in this browser, and the address's ?source= is read on mount.
const AudienceInbox = dynamic(() => import("./audience-inbox").then((m) => m.AudienceInbox), { ssr: false })

export function AudienceClient() {
  return <AudienceInbox />
}
