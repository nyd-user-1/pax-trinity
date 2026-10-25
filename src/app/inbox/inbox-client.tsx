"use client"

import dynamic from "next/dynamic"

// The Agentic Inbox renders only in the browser: its store is this browser's
// localStorage (lib/agents/inbox.ts), so a server render would paint an inbox
// the reader doesn't have.
const AgentInbox = dynamic(() => import("@/registry/blocks/sidebar-09/page"), { ssr: false })

export function InboxClient() {
  return <AgentInbox />
}
