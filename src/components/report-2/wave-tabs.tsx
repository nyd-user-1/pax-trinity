"use client"

import * as React from "react"

import { WaveChip } from "@/components/report/report-bits"
import { cn } from "@/lib/utils"

// One wave at a time where a section's blocks are large: chips pick the wave,
// the latest open first. On paper every panel prints (report-2.css).

export type WaveTab = { id: string; wave: number; latest: boolean; panel: React.ReactNode }

export function WaveTabs({ tabs }: { tabs: WaveTab[] }) {
  const [open, setOpen] = React.useState(tabs.find((t) => t.latest)?.id ?? tabs[tabs.length - 1]?.id)
  if (!tabs.length) return null
  const solo = tabs.length === 1
  return (
    <div>
      <div role="tablist" className={cn("mb-6 flex flex-wrap items-center gap-2", !solo && "print:hidden")}>
        {solo ? (
          <span className="flex items-center gap-3">
            <WaveChip wave={tabs[0].wave} latest={tabs[0].latest} />
            <span className="text-[18px] font-semibold">Wave {tabs[0].wave}</span>
          </span>
        ) : (
          tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === open}
              onClick={() => setOpen(t.id)}
              className={cn(
                "inline-flex h-8 items-center rounded-full px-4 text-[13px] font-semibold transition-colors",
                t.id === open ? "bg-[var(--paper-text)] text-[var(--paper)]" : "border border-[var(--paper-rule)]/30 text-[var(--paper-muted)] hover:text-[var(--paper-text)]"
              )}
            >
              Wave {t.wave}
            </button>
          ))
        )}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" data-wave-panel className={cn("report-group", !solo && t.id !== open && "hidden print:block")}>
          {!solo && (
            <p className="mb-4 hidden items-center gap-3 print:flex">
              <WaveChip wave={t.wave} latest={t.latest} />
              <span className="text-[18px] font-semibold">Wave {t.wave}</span>
            </p>
          )}
          {t.panel}
        </div>
      ))}
    </div>
  )
}
