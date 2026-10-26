"use client"

import dynamic from "next/dynamic"

// /inbox duplicated whole: the same browser-side surface from its own copy of
// the page component (page-2.tsx), so this one can change shape without
// touching /inbox. The store is still this browser's localStorage, so a
// server render would paint an inbox the reader doesn't have.
const AgentInbox2 = dynamic(() => import("@/registry/blocks/sidebar-09/page-2"), { ssr: false })

export function InboxClient2() {
  return <AgentInbox2 />
}
