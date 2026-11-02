"use client"

import * as React from "react"
import { Search } from "lucide-react"

import { ModelCard } from "@/components/models/model-card"
import { FIELD } from "@/components/settings/blocks"
import type { CommercialCard } from "@/lib/model-cards"
import { cn } from "@/ui/lib/utils"

/** Every model card A to Z under a search, which matches a name, a maker, a tagline or any fact's value. */
export function ModelList({ cards }: { cards: CommercialCard[] }) {
  const [q, setQ] = React.useState("")
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const shown = words.length ? cards.filter((m) => words.every((w) => [m.name, m.maker, m.sub ?? "", ...m.facts.map(([, v]) => v)].join(" ").toLowerCase().includes(w))) : cards
  return (
    <>
      <label className={cn(FIELD, "flex h-10 items-center gap-2 px-3")}>
        <Search className="size-4 shrink-0 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${cards.length} models…`} aria-label="Search models" className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400" />
      </label>
      {shown.length ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {shown.map((m) => (
            <ModelCard key={`${m.kind}:${m.id}`} m={m} />
          ))}
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-slate-500">No model matches “{q.trim()}”.</p>
      )}
    </>
  )
}
