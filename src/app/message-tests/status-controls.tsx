"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import type { LifeState } from "@/lib/lifecycle/rules"
import { Button } from "@/ui/components/nova/button"

import { moveTestAction } from "./actions"

type Step = { to: LifeState | "Approve and open"; label: string; primary?: boolean }

/** A test's next step in its lifecycle (lib/lifecycle): one direction only, and Approved before Open. */
function stepsFrom(state: LifeState, superAdmin: boolean): Step[] {
  if (state === "Draft") return superAdmin ? [{ to: "Approved", label: "Approve" }, { to: "Approve and open", label: "Approve and open", primary: true }] : []
  if (state === "Approved") return [{ to: "Open", label: "Open", primary: true }]
  if (state === "Open") return [{ to: "Closed", label: "Close" }]
  if (state === "Closed") return [{ to: "Reported", label: "File the report" }]
  return []
}

export function StatusControls({ id, state, superAdmin }: { id: string; state: LifeState; superAdmin: boolean }) {
  const router = useRouter()
  const [pending, start] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const go = (to: Step["to"]) =>
    start(async () => {
      const r = await moveTestAction(id, to)
      setError(r.errors[0] ?? null)
      if (!r.errors.length) router.refresh()
    })
  return (
    <>
      {error && <span className="text-xs text-pax2-red">{error}</span>}
      {state === "Draft" && !superAdmin && <span className="text-xs text-slate-500">Waiting for the super admin&apos;s approval</span>}
      {stepsFrom(state, superAdmin).map((s) => (
        <Button key={s.label} size="sm" variant={s.primary ? "default" : "outline"} disabled={pending} onClick={() => go(s.to)}>
          {s.label}
        </Button>
      ))}
    </>
  )
}
