import { notFound } from "next/navigation"

import { currentUser } from "@/lib/auth"
import { recordedSrcs } from "@/lib/clips/recorded"
import { armForPid } from "@/lib/fielding/engine"
import { getTest } from "@/lib/tests/store"

import { Flow } from "./flow"

// /test/<id>: the page a test respondent walks — bare, outside the shell, with nothing of the
// product around it. The test comes from the tests table (src/lib/tests/store.ts); an id nobody
// set up is a 404, and a closed test says so. A draft is a preview for admins and reads as closed
// to everyone else (the collector records only fielding tests either way). The arm is drawn here,
// on the server, one per page load from the test's own arms, so the assignment is settled before
// the first card renders.
// A panel vendor's link carries ?pid=<their respondent id>, handed to the flow as is. A Pollster's
// link carries a fielding's pid, whose arm was settled when the links were made (balanced within
// the group, lib/fielding/engine.ts); that arm is used, and the open is recorded.

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ pid?: string | string[] }> }

export async function generateMetadata({ params }: Props) {
  const test = await getTest((await params).id)
  return { title: test?.title ?? "Survey" }
}

export default async function RespondentPage({ params, searchParams }: Props) {
  const test = await getTest((await params).id)
  if (!test) notFound()
  const raw = (await searchParams).pid
  const pid = typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 128) : null
  const assigned = await armForPid(pid).catch(() => null)
  if (test.status === "closed" || assigned?.closed || (test.status === "draft" && !(await currentUser())?.admin)) {
    return (
      <main className="min-h-dvh bg-surface">
        <div className="mx-auto flex min-h-dvh w-full max-w-[773px] flex-col justify-center px-6 py-10">
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-8">
            <h1 className="text-2xl font-semibold tracking-tight text-pax2-blue">{test.title}</h1>
            <p className="text-sm text-slate-600">This survey is closed.</p>
          </div>
        </div>
      </main>
    )
  }
  const arm = assigned?.arm && test.arms.includes(assigned.arm) ? assigned.arm : test.arms[Math.floor(Math.random() * test.arms.length)]
  // A recording kept in Clips plays from its own row; a catalog clip's video is the catalog's.
  const kept = (await recordedSrcs([arm]).catch(() => new Map<string, string>())).get(arm)
  return <Flow arm={arm} pid={pid} test={test} armSrc={kept} />
}
