"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlarmClock, ChevronLeft, ChevronRight, CircleCheck, Copy, Hourglass, Layers, LayoutDashboard, Search } from "lucide-react"
import { MenuFoot, MenuHeader, MenuRow, MenuSeparator } from "@/components/kebab-menu"
import { RowMenu, TD, TR } from "@/components/row-dress"

import { Avatar, Block, FIELD } from "@/components/settings/blocks"
import { byUrgency, daysBetween, HEALTH_LABEL, healthOf, isOpen, isOverdue, KIND_LABEL, KINDS, type Account, type Health, type Item } from "@/lib/delivery/types"
import { cn } from "@/ui/lib/utils"

import { useItemPanel } from "./item-panel"
import { HealthBadge, ItemRow, NewWork, personOf, Pick, Who, type Board } from "./parts"

// The admin's Overview: every partner's work in one queue, most urgent first, and every partner as a row
// with its state, so the accounts that need a hand show at the top. The four counts pick the queue's view.

type View = "open" | "overdue" | "review" | "delivered"
const VIEW_TITLE: Record<View, string> = { open: "Open work", overdue: "Overdue", review: "With partners", delivered: "Delivered" }
const PER = 10

export function AdminOverview({ accounts, board }: { accounts: Account[]; board: Board }) {
  const { today } = board
  const all = React.useMemo(() => accounts.flatMap((a) => a.items), [accounts])
  const nameOf = React.useCallback((id: string) => accounts.find((a) => a.id === id)?.name ?? id, [accounts])
  const panel = useItemPanel(all, board, nameOf)

  const open = all.filter(isOpen)
  const overdue = open.filter((it) => isOverdue(it, today))
  const review = open.filter((it) => it.stage === "review")
  const delivered = all.filter((it) => it.stage === "delivered" && daysBetween(it.stagedAt, today) <= 30)
  const latest = [...overdue].sort(byUrgency(today))[0]
  const longest = [...review].sort((a, b) => a.stagedAt.localeCompare(b.stagedAt))[0]
  const [view, setView] = React.useState<View>("open")

  const tiles: { view: View; label: string; icon: React.ComponentType<{ className?: string }>; n: number; sub: string }[] = [
    { view: "open", label: "Open work", icon: Layers, n: open.length, sub: `across ${new Set(open.map((it) => it.partner)).size} of ${accounts.length} partners` },
    { view: "overdue", label: "Overdue", icon: AlarmClock, n: overdue.length, sub: latest ? `${nameOf(latest.partner)}, ${daysBetween(latest.due!, today)} day${daysBetween(latest.due!, today) === 1 ? "" : "s"} late` : "Nothing late" },
    { view: "review", label: "With partners", icon: Hourglass, n: review.length, sub: longest ? `Longest waiting ${daysBetween(longest.stagedAt, today)} days` : "Nothing waiting" },
    { view: "delivered", label: "Delivered", icon: CircleCheck, n: delivered.length, sub: "Last 30 days" },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-1 rounded-[18px] border border-slate-200 bg-slate-50 p-1 shadow-e1 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t) => (
          <button
            key={t.view}
            type="button"
            aria-pressed={view === t.view}
            onClick={() => setView(t.view)}
            className={cn("flex min-h-36 flex-col justify-between rounded-[14px] border bg-pax2-surface p-5 text-left shadow-e1 transition-colors", view === t.view ? "border-pax2-light-blue" : "border-slate-200 hover:border-slate-300")}
          >
            <span className="flex items-center justify-between text-slate-500">
              <span className="text-[15px]">{t.label}</span>
              <t.icon className={cn("size-5", t.view === "overdue" && t.n > 0 && "text-pax2-red")} />
            </span>
            <span>
              <span className={cn("block text-3xl font-semibold tabular-nums", t.view === "overdue" && t.n > 0 ? "text-pax2-red-deep" : "text-slate-900")}>{t.n}</span>
              <span className="mt-1 block truncate text-[13px] text-slate-500">{t.sub}</span>
            </span>
          </button>
        ))}
      </div>

      <Queue view={view} items={view === "open" ? open : view === "overdue" ? overdue : view === "review" ? review : delivered} accounts={accounts} board={board} onOpen={panel.open} openId={panel.openId} />
      <Partners accounts={accounts} board={board} />
    </div>
  )
}

function Queue({ view, items, accounts, board, onOpen, openId }: { view: View; items: Item[]; accounts: Account[]; board: Board; onOpen: (id: string) => void; openId: string | null }) {
  const { today } = board
  const [q, setQ] = React.useState("")
  const [partner, setPartner] = React.useState("all")
  const [owner, setOwner] = React.useState("any")
  const [kind, setKind] = React.useState("all")
  const [page, setPage] = React.useState(0)
  React.useEffect(() => setPage(0), [view, q, partner, owner, kind])

  const needle = q.trim().toLowerCase()
  const nameOf = (id: string) => accounts.find((a) => a.id === id)?.name ?? id
  const sort = view === "review" ? (a: Item, b: Item) => a.stagedAt.localeCompare(b.stagedAt) : view === "delivered" ? (a: Item, b: Item) => b.stagedAt.localeCompare(a.stagedAt) : byUrgency(today)
  const rows = items
    .filter(
      (it) =>
        (partner === "all" || it.partner === partner) &&
        (kind === "all" || it.type === kind) &&
        (owner === "any" || (owner === "me" ? it.owner === board.me : owner === "none" ? !it.owner : it.owner === owner)) &&
        (!needle || it.title.toLowerCase().includes(needle) || nameOf(it.partner).toLowerCase().includes(needle)),
    )
    .sort(sort)
  const pages = Math.max(1, Math.ceil(rows.length / PER))
  const shown = rows.slice(page * PER, page * PER + PER)
  const partners = accounts.map((a) => ({ id: a.id, name: a.name, owner: a.owner }))

  return (
    <Block title={VIEW_TITLE[view]} action={<NewWork board={board} partners={partners} label="New work" />}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <label className={cn(FIELD, "flex h-9 w-64 items-center gap-2 px-3")}>
          <Search className="size-4 shrink-0 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search work or partners" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400" />
        </label>
        <Pick label="Partner" value={partner} onChange={setPartner} options={[{ value: "all", label: "All partners" }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]} className="w-48" />
        <Pick label="Owner" value={owner} onChange={setOwner} options={[{ value: "any", label: "Anyone" }, { value: "me", label: "Mine" }, { value: "none", label: "Unassigned" }, ...board.staff.map((s) => ({ value: s.email, label: s.name }))]} className="w-48" />
        <Pick label="Kind" value={kind} onChange={setKind} options={[{ value: "all", label: "Any kind" }, ...KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))]} className="w-44" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] table-fixed border-collapse text-sm">
          <colgroup>
            <col />
            <col className="w-44" />
            <col className="w-44" />
            <col className="w-52" />
            <col className="w-32" />
            <col className="w-44" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 text-left text-[13px] text-slate-500">
              <th className="px-4 py-2 font-normal">Work</th>
              <th className="px-3 py-2 font-normal">Partner</th>
              <th className="px-3 py-2 font-normal">Stage</th>
              <th className="px-3 py-2 font-normal">Owner</th>
              <th className="px-3 py-2 font-normal">When</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {shown.map((it) => {
              const a = accounts.find((x) => x.id === it.partner)
              return <ItemRow key={it.id} it={it} board={board} partner={{ name: a?.name ?? it.partner, image: a?.image ?? null }} open={openId === it.id} onOpen={onOpen} />
            })}
            {!shown.length && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[13px] text-slate-500">
                  {items.length ? "Nothing matches." : view === "overdue" ? "Nothing is late." : view === "review" ? "Nothing is waiting on a partner." : view === "delivered" ? "Nothing delivered in the last 30 days." : "No open work."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pages page={page} pages={pages} total={rows.length} onPage={setPage} />
    </Block>
  )
}

function Pages({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  if (total <= PER) return null
  return (
    <div className="flex items-center justify-end gap-2 px-4 py-2.5 text-[13px] text-slate-500">
      <span className="mr-2 tabular-nums">
        {page * PER + 1}–{Math.min(total, page * PER + PER)} of {total}
      </span>
      <button type="button" aria-label="Previous page" disabled={page === 0} onClick={() => onPage(page - 1)} className="flex size-8 items-center justify-center rounded-full hover:bg-slate-100 disabled:opacity-30">
        <ChevronLeft className="size-4" />
      </button>
      <button type="button" aria-label="Next page" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} className="flex size-8 items-center justify-center rounded-full hover:bg-slate-100 disabled:opacity-30">
        <ChevronRight className="size-4" />
      </button>
    </div>
  )
}

const HEALTH_RANK: Record<Health, number> = { overdue: 0, risk: 1, track: 2, idle: 3 }
type Sort = "attention" | "name" | "open"

function Partners({ accounts, board }: { accounts: Account[]; board: Board }) {
  const { today } = board
  const router = useRouter()
  const [q, setQ] = React.useState("")
  const [sort, setSort] = React.useState<Sort>("attention")
  const [page, setPage] = React.useState(0)
  React.useEffect(() => setPage(0), [q, sort])

  const rows = accounts
    .map((a) => {
      const open = a.items.filter(isOpen)
      return {
        a,
        health: healthOf(a.items, today),
        open: open.length,
        review: open.filter((it) => it.stage === "review").length,
        late: open.filter((it) => isOverdue(it, today)).length,
        delivered: a.items.filter((it) => it.stage === "delivered" && daysBetween(it.stagedAt, today) <= 30).length,
        fielding: a.tests.filter((t) => t.status === "fielding").length,
      }
    })
    .filter((r) => !q.trim() || r.a.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((x, y) => (sort === "name" ? x.a.name.localeCompare(y.a.name) : sort === "open" ? y.open - x.open || x.a.name.localeCompare(y.a.name) : HEALTH_RANK[x.health] - HEALTH_RANK[y.health] || y.late - x.late || y.open - x.open))
  const pages = Math.max(1, Math.ceil(rows.length / PER))
  const shown = rows.slice(page * PER, page * PER + PER)
  const num = (n: number, tone?: string) => <span className={cn("tabular-nums", n ? (tone ?? "text-slate-700") : "text-slate-300")}>{n}</span>

  return (
    <Block title="Partners">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3">
        <label className={cn(FIELD, "flex h-9 w-64 items-center gap-2 px-3")}>
          <Search className="size-4 shrink-0 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search partners" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400" />
        </label>
        <Pick
          label="Sort"
          value={sort}
          onChange={(v) => setSort(v as Sort)}
          options={[
            { value: "attention", label: "Needs attention" },
            { value: "open", label: "Most open work" },
            { value: "name", label: "A to Z" },
          ]}
          className="w-48"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] table-fixed border-collapse text-sm">
          <colgroup>
            <col />
            <col className="w-52" />
            <col className="w-28" />
            <col className="w-20" />
            <col className="w-24" />
            <col className="w-20" />
            <col className="w-40" />
            <col className="w-20" />
            <col className="w-32" />
            <col className="w-16" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 text-left text-[13px] text-slate-500">
              <th className="px-4 py-2 font-normal">Partner</th>
              <th className="px-3 py-2 font-normal">Owner</th>
              <th className="px-3 py-2 font-normal">State</th>
              <th className="px-3 py-2 text-right font-normal">Open</th>
              <th className="px-3 py-2 text-right font-normal">In review</th>
              <th className="px-3 py-2 text-right font-normal">Late</th>
              <th className="px-3 py-2 text-right font-normal">Delivered, 30 days</th>
              <th className="px-3 py-2 text-right font-normal">Videos</th>
              <th className="px-3 py-2 text-right font-normal">Tests in field</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const href = `/dashboard?partner=${encodeURIComponent(r.a.id)}`
              return (
                // The house row (components/row-dress.tsx, Brendan, 2026-10-31).
                <tr key={r.a.id} onClick={() => router.push(href)} className={cn(TR, "cursor-pointer")}>
                  <td className={cn(TD, "truncate px-4")}>
                    <Link href={href} onClick={(e) => e.stopPropagation()} className="flex min-w-0 items-center gap-3 font-medium">
                      <Avatar name={r.a.name} fallback={r.a.image ?? undefined} size={24} />
                      <span className="truncate">{r.a.name}</span>
                    </Link>
                  </td>
                  <td className={cn(TD, "px-3")}>{r.a.owner ? <Who person={personOf(board, r.a.owner)} /> : <span className="text-[13px] text-amber-700 dark:text-amber-300">Unassigned</span>}</td>
                  <td className={cn(TD, "px-3")}>
                    <HealthBadge health={r.health} />
                  </td>
                  <td className={cn(TD, "px-3 text-right")}>{num(r.open)}</td>
                  <td className={cn(TD, "px-3 text-right")}>{num(r.review)}</td>
                  <td className={cn(TD, "px-3 text-right")}>{num(r.late, "font-semibold text-pax2-red-deep")}</td>
                  <td className={cn(TD, "px-3 text-right")}>{num(r.delivered)}</td>
                  <td className={cn(TD, "px-3 text-right")}>{num(r.a.desk)}</td>
                  <td className={cn(TD, "px-3 text-right")}>{num(r.fielding)}</td>
                  <td className={cn(TD, "pr-5 pl-2 text-right")}>
                    <RowMenu label={`${r.a.name} options`}>
                      <MenuHeader text={r.a.id} copy={r.a.id} />
                      <MenuSeparator />
                      <MenuRow icon={<LayoutDashboard />} label="Open the board" onClick={() => router.push(href)} />
                      <MenuRow icon={<Copy />} label="Copy link" onClick={() => void navigator.clipboard.writeText(`${window.location.origin}${href}`)} />
                      <MenuSeparator />
                      <MenuFoot title={r.a.name} sub={HEALTH_LABEL[r.health]} />
                    </RowMenu>
                  </td>
                </tr>
              )
            })}
            {!shown.length && (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-[13px] text-slate-500">
                  No partner matches.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pages page={page} pages={pages} total={rows.length} onPage={setPage} />
    </Block>
  )
}
