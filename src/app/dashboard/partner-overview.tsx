"use client"

import * as React from "react"
import Link from "next/link"
import { CalendarClock, ExternalLink, Film, FlaskConical, Mail, UserRound } from "lucide-react"

import { Avatar, Badge, Block, type Tone } from "@/components/settings/blocks"
import { byUrgency, isOpen, KIND_LABEL, type Account } from "@/lib/delivery/types"
import { testHref } from "@/lib/survey-links"
import { cn } from "@/ui/lib/utils"

import { ownAccount } from "./actions"
import { useItemPanel } from "./item-panel"
import { day, ItemRow, KindTile, NewWork, personOf, Pick, ReviewAnswer, useWrite, When, type Board } from "./parts"

// One partner's Overview: who at PAX has the account, what's on their desk and in test, what's waiting
// on them, and all their work with where each piece stands. A partner sees their own; an admin opens
// any partner's from the Partners table and works it from here.

type Filter = "open" | "delivered" | "all"
const STATUS_TONE: Record<Account["tests"][number]["status"], Tone> = { draft: "slate", fielding: "green", closed: "blue" }

export function PartnerOverview({ account, board }: { account: Account; board: Board }) {
  const { today, admin } = board
  const panel = useItemPanel(account.items, board, () => account.name)
  const review = account.items.filter((it) => it.stage === "review").sort((a, b) => a.stagedAt.localeCompare(b.stagedAt))
  const next = account.items.filter((it) => (it.stage === "requested" || it.stage === "production") && it.due).sort(byUrgency(today))[0]
  const fielding = account.tests.filter((t) => t.status === "fielding")
  const owner = personOf(board, account.owner)

  const card = "flex min-h-36 flex-col justify-between rounded-[14px] border border-slate-200 bg-pax2-surface p-5 shadow-e1"
  const head = (label: string, Icon: React.ComponentType<{ className?: string }>) => (
    <span className="flex items-center justify-between text-slate-500">
      <span className="text-[15px]">{label}</span>
      <Icon className="size-5" />
    </span>
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-1 rounded-[18px] border border-slate-200 bg-slate-50 p-1 shadow-e1 sm:grid-cols-2 xl:grid-cols-4">
        <div className={card}>
          {head("PAX contact", UserRound)}
          {admin ? (
            <AccountOwner account={account} board={board} />
          ) : owner ? (
            <span className="flex items-end justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate text-[17px] font-medium text-slate-900">{owner.name}</span>
                <a href={`mailto:${owner.email}`} className="flex items-center gap-1.5 truncate text-[13px] text-pax2-blue hover:underline">
                  <Mail className="size-3.5" /> {owner.email}
                </a>
              </span>
              <Avatar name={owner.name} email={owner.email} fallback={owner.photo} size={36} />
            </span>
          ) : (
            <span className="text-[15px] text-slate-500">Not assigned yet</span>
          )}
        </div>
        <Link href="/clips" className={cn(card, "transition-colors hover:border-slate-300")}>
          {head("Videos", Film)}
          <span>
            <span className="block text-3xl font-semibold text-slate-900 tabular-nums">{account.desk}</span>
            <span className="mt-1 block text-[13px] text-slate-500">{account.results.length ? `${account.results.length} with a test result` : admin ? "On their desk in Clips" : "On your desk in Clips"}</span>
          </span>
        </Link>
        <div className={card}>
          {head("Tests", FlaskConical)}
          <span>
            <span className="block text-3xl font-semibold text-slate-900 tabular-nums">{account.tests.length}</span>
            <span className="mt-1 block truncate text-[13px] text-slate-500">{fielding.length ? `${fielding.length} in field` : account.tests.length ? "None in field" : "None yet"}</span>
          </span>
        </div>
        <button type="button" disabled={!next} onClick={() => next && panel.open(next.id)} className={cn(card, "text-left transition-colors enabled:hover:border-slate-300")}>
          {head("Next due", CalendarClock)}
          {next ? (
            <span className="min-w-0">
              <span className="block text-[17px] font-medium text-slate-900">{day(next.due!, today)}</span>
              <span className="mt-1 block truncate text-[13px] text-slate-500">{next.title}</span>
            </span>
          ) : (
            <span className="text-[15px] text-slate-500">Nothing scheduled</span>
          )}
        </button>
      </div>

      {review.length > 0 && (
        <Block title={admin ? `Waiting on ${account.name}` : "Waiting on you"}>
          {review.map((it) => (
            <div key={it.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3">
              <button type="button" onClick={() => panel.open(it.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <KindTile kind={it.type} />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-900 hover:text-pax2-blue">{it.title}</span>
                  <span className="block text-[13px] text-slate-500">
                    {firstNote(it) ?? KIND_LABEL[it.type]}
                  </span>
                </span>
              </button>
              {it.href && (
                <a href={it.href} className="flex items-center gap-1.5 text-[13px] font-medium text-pax2-blue hover:underline">
                  Open <ExternalLink className="size-3.5" />
                </a>
              )}
              <When it={it} today={today} />
              {!admin && <ReviewAnswer it={it} compact />}
            </div>
          ))}
        </Block>
      )}

      <Work account={account} board={board} onOpen={panel.open} openId={panel.openId} />

      {(account.tests.length > 0 || account.results.length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {account.tests.length > 0 && (
            <Block title="Tests">
              {account.tests.map((t) => {
                const row = (
                  <>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500">
                      <FlaskConical className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900">{t.title}</span>
                      <span className="block text-[13px] text-slate-500">
                        {t.arms} video{t.arms === 1 ? "" : "s"} against a placebo
                      </span>
                    </span>
                    <Badge tone={STATUS_TONE[t.status]}>{t.status[0].toUpperCase() + t.status.slice(1)}</Badge>
                  </>
                )
                return admin ? (
                  <Link key={t.id} href={testHref(t.id)} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50">
                    {row}
                  </Link>
                ) : (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                    {row}
                  </div>
                )
              })}
            </Block>
          )}
          {account.results.length > 0 && (
            <Block title="Results" action={<Link href="/lift" className="text-[13px] font-medium text-pax2-blue hover:underline">Lift</Link>}>
              {account.results.map((r) => (
                <Link key={r.clipId} href={`/clips?c=${encodeURIComponent(r.clipId)}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-900">{r.title}</span>
                    <span className="block truncate text-[13px] text-slate-500">{r.outcome.split(" — ")[0]}, {r.study.split(" · ").at(-1)}</span>
                  </span>
                  <span className={cn("text-[15px] font-semibold tabular-nums", r.persuasive ? "text-emerald-700 dark:text-emerald-300" : "text-slate-400")}>
                    {r.lift > 0 ? "+" : ""}
                    {r.lift} pts
                  </span>
                </Link>
              ))}
            </Block>
          )}
        </div>
      )}
    </div>
  )
}

/** The note that came with the work when it was sent for review, if one did. */
function firstNote(it: Account["items"][number]) {
  const sent = [...it.history].reverse().find((e) => e.ev === "stage" && e.stage === "review")
  return sent && sent.ev === "stage" ? sent.note : undefined
}

function AccountOwner({ account, board }: { account: Account; board: Board }) {
  const w = useWrite()
  const owner = personOf(board, account.owner)
  return (
    <span className="flex flex-col gap-2">
      <span className="flex items-center gap-2">
        {owner ? <Avatar name={owner.name} email={owner.email} fallback={owner.photo} size={28} /> : null}
        <Pick label="PAX contact" value={account.owner ?? ""} disabled={w.pending} onChange={(v) => w.run(() => ownAccount(account.id, v || null))} options={[{ value: "", label: "Unassigned" }, ...board.staff.map((s) => ({ value: s.email, label: s.name }))]} className="min-w-0 flex-1" />
      </span>
      {w.error && <span className="text-[13px] text-pax2-red-deep">{w.error}</span>}
    </span>
  )
}

function Work({ account, board, onOpen, openId }: { account: Account; board: Board; onOpen: (id: string) => void; openId: string | null }) {
  const { today, admin } = board
  const [filter, setFilter] = React.useState<Filter>("open")
  const rows = account.items
    .filter((it) => (filter === "all" ? true : filter === "open" ? isOpen(it) : !isOpen(it)))
    .sort(filter === "delivered" ? (a, b) => b.stagedAt.localeCompare(a.stagedAt) : byUrgency(today))
  const count = (f: Filter) => account.items.filter((it) => (f === "all" ? true : f === "open" ? isOpen(it) : !isOpen(it))).length
  return (
    <Block
      title="Work"
      action={
        <div className="flex items-center gap-3">
          <div role="tablist" className="flex rounded-full border border-slate-200 bg-pax2-surface p-0.5 shadow-e1">
            {(["open", "delivered", "all"] as const).map((f) => (
              <button key={f} type="button" role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={cn("rounded-full px-3 py-1 text-[13px] transition-colors", filter === f ? "bg-pax2-lavender font-medium text-pax2-blue" : "text-slate-500 hover:text-slate-800")}>
                {f === "open" ? "Open" : f === "delivered" ? "Delivered" : "All"} <span className="tabular-nums opacity-60">{count(f)}</span>
              </button>
            ))}
          </div>
          <NewWork board={board} partner={account.id} owner={account.owner} label={admin ? "New work" : "New request"} />
        </div>
      }
    >
      <div className="overflow-x-auto">
        {/* The card's own edge is the first row's top line; each row draws its own under it. */}
        <table className="w-full min-w-[860px] table-fixed border-collapse text-sm">
          <colgroup>
            <col />
            <col className="w-44" />
            <col className="w-52" />
            <col className="w-32" />
            <col className={admin ? "w-44" : "w-12"} />
          </colgroup>
          <tbody>
            {rows.map((it) => (
              <ItemRow key={it.id} it={it} board={board} open={openId === it.id} onOpen={onOpen} />
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-[13px] text-slate-500">
                  {filter === "open" ? "Nothing open." : filter === "delivered" ? "Nothing delivered yet." : "No work yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Block>
  )
}
