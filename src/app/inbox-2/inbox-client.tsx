"use client"

import dynamic from "next/dynamic"

// /inbox-2 — the audience database repurposing the Agentic Inbox's frame
// (Brendan, 2026-10-26: "it's just a recreate of Gmail... a lot of
// opportunity to repurpose this"). The mail duplicate this page carried
// lives on at /inbox; the audience surface loads browser-side because the
// split preference and the read sources live in this browser.
const AudienceInbox = dynamic(() => import("./audience-inbox").then((m) => m.AudienceInbox), { ssr: false })

export function InboxClient2() {
  return <AudienceInbox />
}
