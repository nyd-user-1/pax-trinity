"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import type { Status } from "@/lib/tests/types"
import { Button } from "@/ui/components/nova/button"

import { setStatusAction } from "./actions"

const NEXT: Record<Status, { to: Status; label: string }[]> = {
  draft: [{ to: "fielding", label: "Start fielding" }],
  fielding: [{ to: "closed", label: "Close" }],
  closed: [{ to: "fielding", label: "Reopen" }],
}

export function StatusControls({ id, status }: { id: string; status: Status }) {
  const router = useRouter()
  const [pending, start] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const move = (to: Status) =>
    start(async () => {
      const r = await setStatusAction(id, to)
      setError(r.errors[0] ?? null)
      if (!r.errors.length) router.refresh()
    })
  return (
    <>
      {error && <span className="text-xs text-pax2-red">{error}</span>}
      {NEXT[status].map((n) => (
        <Button key={n.to} size="sm" variant={n.to === "closed" ? "outline" : "default"} disabled={pending} onClick={() => move(n.to)}>
          {n.label}
        </Button>
      ))}
    </>
  )
}
