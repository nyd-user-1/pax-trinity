import type { Metadata } from "next"

import { adminOrSignin } from "../message-tests/admin"
import { DeliveryBoard } from "./delivery-board"

export const metadata: Metadata = { title: "Dashboard" }

// /dashboard — the Delivery Board (Brendan, 2026-10-29, from a reference
// screenshot): the account's four facts, the week's worklogs, and the apps,
// workflows and checks under them. Sample data throughout. Under Admin in
// the sidebar, so admins only, as Tests is.
export default async function DashboardPage() {
  await adminOrSignin("/dashboard")
  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto bg-background">
      <DeliveryBoard />
    </div>
  )
}
