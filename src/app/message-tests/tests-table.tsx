"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { EllipsisVerticalIcon, Maximize2, Pencil } from "lucide-react"

import { KebabMenu, MenuFoot, MenuHeader, MenuRow, MenuSeparator } from "@/components/kebab-menu"
import { Block, Fact } from "@/components/settings/blocks"
import type { Status } from "@/lib/tests/types"
import { editTestHref, newTestHref, testHref } from "@/lib/survey-links"
import { buttonVariants } from "@/ui/components/nova/button"

import { StatusChip } from "./status-chip"

type Row = { id: string; title: string; status: Status; arms: number; targetPerArm: number; updatedAt: string | null }

/** Finished completes per test, from the collector's monitor; null until it answers or if it can't. */
function useCompletes(ids: string[]) {
  const [done, setDone] = React.useState<Record<string, number | null>>({})
  React.useEffect(() => {
    let on = true
    for (const id of ids) {
      fetch(`/api/tests/${id}/monitor`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((m) => on && setDone((d) => ({ ...d, [id]: typeof m?.totals?.finished === "number" ? m.totals.finished : null })))
        .catch(() => on && setDone((d) => ({ ...d, [id]: null })))
    }
    return () => {
      on = false
    }
  }, [ids])
  return done
}

/** A test's card (Brendan, 2026-11-02): the model cards' and question cards' Block. Its title, status
 *  and kebab head it, its facts are the rows, and its id is the foot, where a question card keeps its code. */
function TestCard({ t, done }: { t: Row; done: number | null | undefined }) {
  const router = useRouter()
  const name = t.title || t.id
  return (
    <Block
      stretch
      id={t.id}
      className="lift"
      title={
        <Link href={testHref(t.id)} className="min-w-0 truncate transition-colors hover:text-pax2-blue">
          {name}
        </Link>
      }
      badge={<StatusChip status={t.status} />}
      action={
        // The model cards' kebab dress (components/dash/card-tools.tsx), holding the test's own menu.
        <KebabMenu label={`${name} options`} trigger={<EllipsisVerticalIcon className="size-4" />} triggerClassName="inline-flex size-8 shrink-0 self-start items-center justify-center rounded-md text-slate-800 outline-none hover:bg-foreground/8 hover:text-foreground aria-expanded:bg-foreground/8">
          <MenuHeader text={t.id} copy={t.id} />
          <MenuSeparator />
          <MenuRow icon={<Maximize2 />} label="Open" onClick={() => router.push(testHref(t.id))} />
          <MenuRow icon={<Pencil />} label="Edit" onClick={() => router.push(editTestHref(t.id))} />
          <MenuSeparator />
          <MenuFoot title={name} sub={t.status[0].toUpperCase() + t.status.slice(1)} />
        </KebabMenu>
      }
    >
      <Fact label="Arms">{t.arms}</Fact>
      <Fact label="Completes">
        <span className="tabular-nums">
          {done == null ? "—" : done.toLocaleString("en-US")} / {(t.targetPerArm * t.arms).toLocaleString("en-US")}
        </span>
      </Fact>
      <Fact label="Updated">{t.updatedAt ? t.updatedAt.slice(0, 10) : "Seeded"}</Fact>
      <p className="mt-auto px-4 py-3 text-[13px] text-slate-500 tabular-nums sm:px-5">{t.id}</p>
    </Block>
  )
}

export function TestsTable({ tests, reachable }: { tests: Row[]; reachable: boolean }) {
  const ids = React.useMemo(() => tests.map((t) => t.id), [tests])
  const done = useCompletes(ids)
  return (
    <div className="flex flex-col gap-4">
      {!reachable && <p className="text-sm text-pax2-red">The tests table could not be read, so only the seeded test is listed.</p>}
      <div className="flex justify-end">
        <Link href={newTestHref()} className={buttonVariants({ size: "sm" })}>
          New test
        </Link>
      </div>
      {/* Two to a row once the page is wide enough, as /models sets its cards; the pane, not the window, decides. */}
      <div className="@container">
        <div className="grid gap-5 @min-[40rem]:grid-cols-2">
          {tests.map((t) => (
            <TestCard key={t.id} t={t} done={done[t.id]} />
          ))}
        </div>
      </div>
    </div>
  )
}
