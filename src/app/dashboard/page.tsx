import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { currentUser } from "@/lib/auth"
import { accounts, isPartner, PEOPLE, STAFF } from "@/lib/delivery/accounts"
import { memberByEmail } from "@/lib/roles"
import { listTodos } from "@/lib/todos"

import { DeliveryBoard } from "./delivery-board"
import type { Board } from "./parts"

export const metadata: Metadata = { title: "Dashboard" }
export const dynamic = "force-dynamic"

// /dashboard — the Delivery Board, scoped by role (Brendan, 2026-10-31). An admin sees every partner's
// work and every partner, and opens one partner's board with ?partner=<id>; a partner (lib/roles.ts, a
// member with role "partner" and their organization) sees their own and nothing else, whatever the address
// says. Anyone else goes to sign in.

/** Today in New York, so "late" turns over at the office's midnight. */
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date())

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ partner?: string }> }) {
  const user = await currentUser()
  const member = user ? memberByEmail(user.email) : undefined
  const own = member?.role === "partner" && isPartner(member.partner) ? member.partner! : null
  if (!user || (!user.admin && !own)) redirect("/signin?next=%2Fdashboard")

  const asked = (await searchParams).partner
  const focusId = user.admin ? (isPartner(asked) ? asked! : null) : own
  // A partner's page reads only their own account, so nothing of another partner's reaches the browser.
  const { accounts: list, reachable } = await accounts(user.admin ? undefined : [own!])
  const focus = focusId ? (list.find((a) => a.id === focusId) ?? null) : null

  // A partner's page names only the PAX team and their own people.
  const people = user.admin ? PEOPLE : [...STAFF, ...(focus?.contacts ?? [])]
  const board: Board = { today: today(), people, staff: STAFF, admin: user.admin, me: (member?.email ?? user.email).toLowerCase() }
  const team = user.admin && !focus ? STAFF : [...(focus?.owner ? STAFF.filter((s) => s.email === focus.owner) : []), ...(focus?.contacts ?? [])]
  // The admins' to-do list, read for an admin's own board alone.
  const todos = user.admin && !focus ? await listTodos() : []

  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto bg-background">
      <DeliveryBoard key={focusId ?? "all"} accounts={user.admin ? list : []} focus={focus} board={board} team={team} reachable={reachable} todos={todos} />
    </div>
  )
}
