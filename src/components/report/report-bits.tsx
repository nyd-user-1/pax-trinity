import * as React from "react"

import type { Arm, Story, Verdict } from "@/lib/results/types"
import { cn } from "@/lib/utils"

import { isCampaign, verdictWord } from "./report-math"

// The readout's small pieces: chips, verdicts, boxes, the section heads.

export function WaveChip({ wave, latest }: { wave: number; latest?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[10px] font-bold tracking-wide",
        latest ? "bg-[var(--paper-text)] text-[var(--paper)]" : "border border-[var(--paper-rule)]/30 text-[var(--paper-muted)]"
      )}
    >
      W{wave}
    </span>
  )
}

export function VerdictMark({ verdict }: { verdict: Verdict }) {
  const on = verdict === "detectable"
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap", on ? "text-[var(--r-detect)]" : "text-[var(--paper-muted)]")}>
      <span aria-hidden className={cn("inline-block size-2 rounded-full", on ? "bg-[var(--r-detect)]" : "border border-current")} />
      {verdictWord(verdict)}
    </span>
  )
}

export function VerdictChip({ verdict }: { verdict: Verdict }) {
  const on = verdict === "detectable"
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center rounded-full px-2 text-[11px] font-medium",
        on ? "bg-[var(--r-detect)]/15 text-[var(--r-detect)]" : "bg-[var(--r-quiet)]/25 text-[var(--paper-muted)]"
      )}
    >
      {verdictWord(verdict)}
    </span>
  )
}

export function ProducerChip({ arm }: { arm: Arm }) {
  if (!arm.producer) return null
  const camp = isCampaign(arm)
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-full px-2.5 text-[11px] font-medium",
        camp ? "border border-[var(--r-campaign)] text-[var(--r-campaign)]" : "bg-[var(--r-tint)] text-[var(--paper-muted)]"
      )}
    >
      {arm.producer}
    </span>
  )
}

/** A tinted box holding printed language: a caution, a definition, a caveat. */
export function Box({ title, children, className, tone = "tint" }: { title?: React.ReactNode; children: React.ReactNode; className?: string; tone?: "tint" | "line" }) {
  return (
    <div className={cn("rounded-xl p-4 text-[13px] leading-relaxed", tone === "tint" ? "bg-[var(--r-tint)]" : "border border-[var(--paper-rule)]/25", className)}>
      {title && <p className="mb-1 text-[11px] font-semibold tracking-[0.12em] text-[var(--paper-muted)] uppercase">{title}</p>}
      <div className="whitespace-pre-line text-[var(--paper-text)]">{children}</div>
    </div>
  )
}

/** A printed story, title over body, verbatim. */
export function StoryBox({ story, tone }: { story: Story; tone?: "tint" | "line" }) {
  return (
    <Box title={story.title || undefined} tone={tone}>
      {story.body}
    </Box>
  )
}

export function Part({ id, kicker, title, children }: { id: string; kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-[var(--paper-rule)] pt-8">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-[var(--paper-strong)] uppercase">{kicker}</p>
      <h2 className="mt-1 text-[34px] leading-tight font-semibold tracking-tight text-[var(--paper-text)]">{title}</h2>
      <div className="mt-8 flex flex-col gap-14">{children}</div>
    </section>
  )
}

export function Block({ title, aside, children }: { title: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h3 className="text-[22px] leading-snug font-semibold tracking-tight text-[var(--paper-text)]">{title}</h3>
        {aside && <span className="text-[12px] text-[var(--paper-muted)]">{aside}</span>}
      </div>
      {children}
    </div>
  )
}

/** The small caps over a chart: what is plotted and on what scale. */
export function ChartHead({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 border-b border-[var(--paper-rule)]/20 pb-1.5 text-[11px] tracking-[0.1em] text-[var(--paper-muted)] uppercase">
      <span className="font-semibold">{left}</span>
      {right && <span className="tracking-normal normal-case">{right}</span>}
    </div>
  )
}

export function Footnote({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-[12px] leading-relaxed text-[var(--paper-muted)]">{children}</p>
}
