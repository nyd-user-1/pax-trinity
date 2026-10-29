import Link from "next/link"
import { headers } from "next/headers"
import { notFound } from "next/navigation"

import { armRecordings } from "@/lib/clips/recorded"
import { getTest } from "@/lib/tests/store"
import { buttonVariants } from "@/ui/components/nova/button"

import { adminOrSignin } from "../admin"
import { FieldKit } from "../field-kit"
import { Monitor } from "../monitor"
import { StatusChip } from "../status-chip"
import { StatusControls } from "../status-controls"

export const dynamic = "force-dynamic"
export const metadata = { title: "Message test" }

/** The entry questions whose balance across arms the monitor shows. */
const BALANCE = ["party", "vote2024"]

export default async function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await adminOrSignin(`/message-tests/${id}`)
  const test = await getTest(id)
  if (!test) notFound()
  // A recording kept in Clips names its own arm on the monitor.
  const kept = Object.fromEntries((await armRecordings(user).catch(() => [])).filter((c) => test.arms.includes(c.id)).map((c) => [c.id, c.title]))
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.)/.test(host) ? "http" : "https")
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">{test.title}</h2>
        <StatusChip status={test.status} />
        <span className="font-mono text-xs text-slate-400">{test.id}</span>
        <div className="ml-auto flex items-center gap-2">
          <StatusControls id={test.id} status={test.status} />
          <Link href={`/message-tests/${test.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Edit
          </Link>
        </div>
      </div>
      <FieldKit entryUrl={`${proto}://${host}/test/${test.id}?pid={PID}`} panel={test.panel} />
      <Monitor
        id={test.id}
        arms={test.arms}
        titles={kept}
        targetPerArm={test.targetPerArm}
        balance={test.entry.filter((q) => BALANCE.includes(q.key)).map((q) => ({ key: q.key, choices: q.choices }))}
      />
    </div>
  )
}
