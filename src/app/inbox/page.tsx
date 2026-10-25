import type { Metadata } from "next"

import { InboxClient } from "./inbox-client"

export const metadata: Metadata = { title: "Inbox", description: "Mail between you and the agents: send a task, the report arrives as a reply on the thread." }

export default function InboxPage() {
  return <InboxClient />
}
