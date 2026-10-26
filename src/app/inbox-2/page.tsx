import type { Metadata } from "next"

import { InboxClient2 } from "./inbox-client"

export const metadata: Metadata = { title: "Inbox 2", description: "A working duplicate of the Agentic Inbox." }

export default function Inbox2Page() {
  return <InboxClient2 />
}
