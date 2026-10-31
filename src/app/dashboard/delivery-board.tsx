"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { Avatar } from "@/components/settings/blocks"
import type { Account, Person } from "@/lib/delivery/types"
import { cn } from "@/ui/lib/utils"

import { AdminOverview } from "./admin-overview"
import { PartnerOverview } from "./partner-overview"
import type { Board } from "./parts"

// The Delivery Board's frame (Brendan's reference, 2026-10-29; scoped by role 2026-10-31): the title, the
// crumbs, the tabs and the people on the account. An admin's board is every partner (AdminOverview) or one
// partner's, opened from it; a partner's is their own (PartnerOverview).

const TABS = ["Overview", "Worklog", "Files", "Reports"] as const

export function DeliveryBoard({ accounts, focus, board, team, reachable }: { accounts: Account[]; focus: Account | null; board: Board; team: Person[]; reachable: boolean }) {
  const [tab, setTab] = React.useState<(typeof TABS)[number]>("Overview")
  return (
    <div className="mx-auto w-full max-w-[1560px] px-6 py-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Delivery Board</h1>
      <nav aria-label="Breadcrumb" className="mt-2 flex min-w-0 items-center gap-2 text-[15px]">
        {board.admin && (
          <>
            {focus ? (
              <Link href="/dashboard" className="text-slate-500 hover:text-pax2-blue">
                Partners
              </Link>
            ) : (
              <span className="text-slate-900">Partners</span>
            )}
            {focus && <ChevronRight className="size-4 text-slate-400" />}
          </>
        )}
        {focus && (
          <span className="flex min-w-0 items-center gap-2 text-slate-900">
            <Avatar name={focus.name} fallback={focus.image ?? undefined} size={22} />
            <span className="truncate">{focus.name}</span>
          </span>
        )}
      </nav>

      <div className="mt-4 flex items-center justify-between border-b border-slate-200">
        <div role="tablist" className="flex gap-5">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn("-mb-px border-b-2 pb-3 text-[17px] transition-colors", tab === t ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900")}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center pb-2">
          {team.slice(0, 4).map((p, i) => (
            <span key={p.email} title={p.name} className={cn("rounded-full ring-2 ring-pax2-surface", i > 0 && "-ml-2.5")}>
              <Avatar name={p.name} email={p.email} fallback={p.photo} size={34} />
            </span>
          ))}
          {team.length > 4 && <span className="-ml-2.5 flex size-[34px] items-center justify-center rounded-full bg-slate-100 text-[13px] text-slate-500 ring-2 ring-pax2-surface">+{team.length - 4}</span>}
        </div>
      </div>

      {!reachable && <p className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50/60 px-4 py-2.5 text-[13px] text-amber-800 dark:bg-amber-400/10 dark:text-amber-300">The board&apos;s store can&apos;t be reached, so changes won&apos;t save.</p>}

      {tab === "Overview" ? (
        <div className="mt-8">{focus ? <PartnerOverview account={focus} board={board} /> : <AdminOverview accounts={accounts} board={board} />}</div>
      ) : (
        <p className="mt-16 text-center text-sm text-slate-500">Nothing here yet.</p>
      )}
    </div>
  )
}
