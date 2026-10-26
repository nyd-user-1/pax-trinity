"use client"

import * as React from "react"

import type { Conversation } from "@/lib/consensus/data"
import { clearDraft, readDraft } from "@/lib/consensus/draft"
import { Button } from "@govblock/ui/components/nova/button"

// The drafted survey the audience Questions view wrote, held here until it is
// wired into a live conversation or discarded. Lives in this browser only.

export function DraftCard() {
  const [draft, setDraft] = React.useState<Conversation | null>(null)
  React.useEffect(() => setDraft(readDraft()), [])
  if (!draft) return null
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-pax2-blue/25 bg-pax2-lavender/30 p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight">{draft.title}</h2>
        <span className="text-xs text-muted-foreground">
          {draft.statements.length} {draft.statements.length === 1 ? "statement" : "statements"} · held in this browser
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{draft.description}</p>
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
        {draft.statements.map((s) => (
          <li key={s.tid}>{s.text}</li>
        ))}
      </ol>
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => {
          clearDraft()
          setDraft(null)
        }}
      >
        Discard draft
      </Button>
    </section>
  )
}
