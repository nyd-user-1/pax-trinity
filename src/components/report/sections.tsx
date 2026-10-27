import * as React from "react"

import { PUBLISHED } from "@/components/clips/catalog"
import type { Arm, Pairing, ResultSet, Story, SubgroupDimension } from "@/lib/results/types"
import { cn } from "@/lib/utils"

import { LevelTrack, LiftBar, marksLine, SubgroupPanels } from "./charts"
import { Box, ProducerChip, StoryBox, VerdictChip, WaveChip } from "./report-bits"
import { approx, axis, count, dateRange, isCampaign, pct, placeboOf, signed, toplineOf, treatmentsOf, word } from "./report-math"

type Axis = ReturnType<typeof axis>

// ── Facts ────────────────────────────────────────────────────────────────

export function FactBoxes({ rs }: { rs: ResultSet }) {
  const placebo = placeboOf(rs)
  const facts: [string, React.ReactNode][] = [
    ["Population", rs.population],
    ["Fielded", dateRange(rs.fielded.start, rs.fielded.end)],
    ["Sample", `${count(rs.sample.raw)} respondents · ${count(rs.sample.weighted)} weighted`],
    ...(placebo ? ([["Control", `Placebo video · ${count(placebo.nWeighted)} weighted`]] as [string, React.ReactNode][]) : []),
    ["Threshold", rs.threshold.label],
  ]
  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-[var(--paper-rule)]/20 sm:grid-cols-3 lg:grid-cols-5">
      {facts.map(([k, v]) => (
        <div key={k} className="border-r border-b border-[var(--paper-rule)]/10 px-4 py-3">
          <dt className="text-[10px] font-semibold tracking-[0.14em] text-[var(--paper-muted)] uppercase">{k}</dt>
          <dd className="mt-1 text-[13px] leading-snug">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** "six treatment videos plus placebo" */
export const armsLine = (rs: ResultSet) => `${word(treatmentsOf(rs).length)} treatment videos${placeboOf(rs) ? " plus placebo" : ""}`

// ── Video cards ──────────────────────────────────────────────────────────

export function VideoCard({ rs, arm, index, a }: { rs: ResultSet; arm: Arm; index: number; a: Axis }) {
  const placebo = placeboOf(rs)
  const clip = arm.clipId ? PUBLISHED.find((c) => c.id === arm.clipId) : undefined
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-[var(--paper-rule)]/20 bg-[var(--paper)]">
      {clip?.src && (
        // The clip's opening frame: metadata only, nothing plays until the reader opens it.
        <video src={`${clip.src}#t=0.5`} preload="metadata" muted playsInline className="aspect-video w-full bg-black object-cover" aria-label={clip.title} />
      )}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ProducerChip arm={arm} />
          {(arm.sourceTitle || arm.durationSeconds != null) && (
            <span className="text-[11px] text-[var(--paper-muted)]">
              {arm.sourceTitle && `Source title “${arm.sourceTitle}”`}
              {arm.sourceTitle && arm.durationSeconds != null && " · "}
              {arm.durationSeconds != null && `${arm.durationSeconds} s`}
            </span>
          )}
        </div>
        <div>
          <h4 className="text-[15px] font-bold tracking-wide uppercase">
            {String(index + 1).padStart(2, "0")} · {arm.name}
          </h4>
          {arm.note && <p className="mt-0.5 text-[13px] text-[var(--paper-muted)] italic">{arm.note}</p>}
        </div>
        <div className="flex flex-col gap-3">
          {rs.outcomes.map((o) => {
            const t = toplineOf(rs, arm.id, o.id)
            const p = placebo ? toplineOf(rs, placebo.id, o.id) : undefined
            if (!t) return null
            return (
              <div key={o.id}>
                <div className="flex items-baseline justify-between gap-2 text-[12px]">
                  <span>{o.name}</span>
                  <span className="font-semibold tabular-nums">{t.levelPct != null ? pct(t.levelPct) : t.liftPp != null ? `${approx(t.derivation)}${signed(t.liftPp)}` : <span className="font-normal text-[var(--paper-muted)]">{arm.nWeighted === 0 ? "No respondents" : "—"}</span>}</span>
                </div>
                <div className="mt-1">
                  {t.levelPct != null ? (
                    <LevelTrack level={t.levelPct} placebo={p?.levelPct} tone={t.verdict === "detectable" ? (isCampaign(arm) ? "campaign" : "detect") : "quiet"} height={10} />
                  ) : t.liftPp != null ? (
                    <LiftBar value={t.liftPp} a={a} tone={t.verdict === "detectable" ? (isCampaign(arm) ? "campaign" : "detect") : "quiet"} height={10} />
                  ) : null}
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-end gap-2 text-[11px] text-[var(--paper-muted)] tabular-nums">
                  {t.levelPct != null && p?.levelPct != null && t.liftPp != null && (
                    <span>
                      vs {pct(p.levelPct)} placebo · <span className="font-semibold text-[var(--paper-text)]">{approx(t.derivation)}{signed(t.liftPp)} pp</span>
                    </span>
                  )}
                  {t.verdict && <VerdictChip verdict={t.verdict} />}
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--paper-rule)]/10 pt-3 text-[12px]">
          <span className="text-[var(--paper-muted)] tabular-nums">n = {count(arm.nWeighted)} weighted</span>
          <span className="ml-auto flex gap-4">
            {arm.watchUrl && (
              <a href={arm.watchUrl} target="_blank" rel="noreferrer" className="font-medium text-[var(--paper-strong)] underline underline-offset-4">
                Watch video
              </a>
            )}
            {arm.reviewUrl && (
              <a href={arm.reviewUrl} target="_blank" rel="noreferrer" className="font-medium text-[var(--paper-strong)] underline underline-offset-4">
                Review copy
              </a>
            )}
          </span>
        </div>
      </div>
    </article>
  )
}

// ── Pairings ─────────────────────────────────────────────────────────────

export function PairingCard({ rs, p }: { rs: ResultSet; p: Pairing }) {
  const treat = treatmentsOf(rs)
  const arms = p.armIds.map((id) => rs.arms.find((a) => a.id === id)).filter((a): a is Arm => !!a)
  const all = arms.length > 1 && arms.length === treat.length
  return (
    <article className="rounded-xl border border-[var(--paper-rule)]/20 bg-[var(--paper)] p-4">
      <div className="flex items-baseline gap-3">
        <span className="text-[22px] leading-none font-semibold text-[var(--paper-strong)] tabular-nums">{p.rank}</span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold tracking-[0.1em] uppercase">
          {arms.length === 0 ? (
            <ArmTag label="No clear match" quiet />
          ) : all ? (
            <ArmTag label={`All ${word(arms.length)} videos`} />
          ) : (
            arms.map((a, i) => (
              <React.Fragment key={a.id}>
                {i > 0 && <span className="text-[var(--paper-muted)]">+</span>}
                <ArmTag label={a.name} campaign={isCampaign(a)} />
              </React.Fragment>
            ))
          )}
        </span>
      </div>
      <h4 className="mt-2 text-[15px] leading-snug font-semibold">{p.audience}</h4>
      <p className="mt-1 text-[13px] leading-relaxed">{p.finding}</p>
      {p.caveat && <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--paper-muted)] italic">{p.caveat}</p>}
    </article>
  )
}

function ArmTag({ label, quiet, campaign }: { label: string; quiet?: boolean; campaign?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block size-2 rounded-[2px]", quiet ? "bg-[var(--r-quiet)]" : campaign ? "bg-[var(--r-campaign)]" : "bg-[var(--r-detect)]")} />
      {label}
    </span>
  )
}

// ── Self-selected shares ─────────────────────────────────────────────────

/** A self-selected question's distribution, one bar per wave per answer. */
export function ShareBars({ waves, latest }: { waves: { rs: ResultSet; d: SubgroupDimension }[]; latest: number }) {
  const cats = waves[waves.length - 1]?.d.categories ?? []
  return (
    <div className="flex flex-col gap-4">
      {cats.map((cat) => (
        <div key={cat.id} className="grid grid-cols-[minmax(140px,220px)_minmax(0,1fr)] items-center gap-x-4">
          <span className="text-[14px] font-semibold">{cat.name}</span>
          <div className="flex flex-col gap-1.5">
            {waves.map(({ rs, d }) => {
              const c = d.categories.find((x) => x.id === cat.id)
              if (c?.sharePct == null) return null
              return (
                <div key={rs.id} className="flex items-center gap-3">
                  <WaveChip wave={rs.wave} latest={rs.wave === latest} />
                  <span className="relative h-3 min-w-0 flex-1 rounded-full bg-[var(--r-track)]">
                    <span className={cn("absolute inset-y-0 left-0 rounded-full", rs.wave === latest ? "bg-[var(--paper-strong)]" : "bg-[var(--paper-strong)]/45")} style={{ width: `${c.sharePct}%` }} />
                  </span>
                  <span className="w-24 shrink-0 text-right text-[14px] font-semibold tabular-nums">
                    {approx(d.shareDerivation)}
                    {pct(c.sharePct)}
                    {c.nWeighted != null && <span className="ml-1.5 text-[11px] font-normal text-[var(--paper-muted)]">{count(c.nWeighted)}</span>}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── A subgroup dimension ─────────────────────────────────────────────────

export function DimensionBlock({ rs, d, stories }: { rs: ResultSet; d: SubgroupDimension; stories: Story[] }) {
  return (
    <div className="border-t border-[var(--paper-rule)]/25 pt-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h4 className="text-[19px] font-semibold tracking-tight">{d.name}</h4>
        <span className="text-[12px] text-[var(--paper-muted)]">{marksLine(rs, d)}</span>
      </div>
      {(d.selfSelected || d.needsVerification) && (
        <div className="mb-3 flex flex-wrap gap-2">
          {d.selfSelected && (
            <span className="inline-flex h-6 items-center rounded-full bg-[var(--paper-text)] px-3 text-[11px] font-semibold tracking-wide text-[var(--paper)] uppercase">
              Self-selected{d.askedBeforeExposure ? " · asked before exposure" : ""} · stated trust, not an outcome
            </span>
          )}
          {d.needsVerification && (
            <span className="inline-flex h-6 items-center rounded-full border border-dashed border-[var(--paper-strong)] px-3 text-[11px] font-medium text-[var(--paper-strong)]">
              Needs verification · {d.needsVerification}
            </span>
          )}
        </div>
      )}
      {d.selfSelected && d.categories.some((c) => c.sharePct != null) && (
        <div className="mb-4 grid gap-1.5 sm:grid-cols-3">
          {d.categories.map((c) =>
            c.sharePct != null ? (
              <div key={c.id} className="rounded-lg bg-[var(--r-tint)] px-3 py-2 text-[12px]">
                <span className="block text-[var(--paper-muted)]">{c.name}</span>
                <span className="font-semibold tabular-nums">
                  {approx(d.shareDerivation)}
                  {pct(c.sharePct)}
                </span>
                {c.nWeighted != null && <span className="ml-1.5 text-[var(--paper-muted)] tabular-nums">{count(c.nWeighted)}</span>}
                <span className="block text-[11px] text-[var(--paper-muted)]">share of the weighted sample</span>
              </div>
            ) : null
          )}
        </div>
      )}
      <SubgroupPanels rs={rs} d={d} />
      {(d.whatItShows || d.howToRead) && (
        <div className="mt-4 grid gap-4 rounded-xl bg-[var(--r-tint)] p-4 text-[13px] leading-relaxed md:grid-cols-2">
          {d.whatItShows && (
            <div>
              <p className="mb-1 text-[11px] font-semibold tracking-[0.12em] text-[var(--paper-muted)] uppercase">What the chart shows</p>
              {d.whatItShows}
            </div>
          )}
          {d.howToRead && (
            <div>
              <p className="mb-1 text-[11px] font-semibold tracking-[0.12em] text-[var(--paper-muted)] uppercase">How to read it</p>
              {d.howToRead}
            </div>
          )}
        </div>
      )}
      {stories.length > 0 && (
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {stories.map((s) => (
            <StoryBox key={s.id} story={s} />
          ))}
        </div>
      )}
    </div>
  )
}

/** The key every subgroup page carries: these bars are levels, and what each mark means. */
export function LevelsKey({ rs }: { rs: ResultSet }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-[var(--paper-rule)]/20 px-4 py-3 text-[12px]">
      <span className="font-semibold">Bars are levels — the % selecting Yes in one subgroup and arm — not lifts.</span>
      <span className="inline-flex items-center gap-2">
        <span className="inline-block h-3 w-5 rounded-[2px] bg-[var(--r-detect)] ring-[1.5px] ring-[var(--r-detect-edge)] ring-inset" /> Significant vs placebo inside that subgroup ({rs.threshold.label})
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="inline-block h-3 w-5 rounded-[2px] bg-[var(--r-quiet)]" /> Not marked
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="report-hatch inline-block h-3 w-5 rounded-[2px] bg-[var(--r-quiet)]" /> <span className="italic">Hatched, italic</span> = source small-sample flag
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="inline-block h-3 border-l border-dashed border-[var(--paper-text)]" /> Placebo level in that subgroup
      </span>
    </div>
  )
}

// ── What the study can and cannot establish ──────────────────────────────

export function Methodology({ rs }: { rs: ResultSet }) {
  const n = rs.notes
  const sum = rs.arms.reduce((s, a) => s + a.nWeighted, 0)
  const lists: [string, string[]][] = [
    ["Supported by this study", n.supported],
    ["What it cannot establish", n.notSupported],
  ]
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        {lists.map(([title, xs]) =>
          xs.length ? (
            <Box key={title} title={title} tone="line">
              <ul className="list-disc space-y-1 pl-5">
                {xs.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </Box>
          ) : null
        )}
      </div>
      {(n.comprehensionCaveat || n.noEffectMeaning) && (
        <div className="grid gap-4 md:grid-cols-2">
          {n.comprehensionCaveat && <Box title="Comprehension caveat">{n.comprehensionCaveat}</Box>}
          {n.noEffectMeaning && <Box title="What “no measurable effect” means">{n.noEffectMeaning}</Box>}
        </div>
      )}
      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex flex-col gap-6">
          {n.methodology.length > 0 && <NoteList title="Methodology notes" items={n.methodology} />}
          {n.limitations.length > 0 && <NoteList title="Limitations" items={n.limitations} />}
          {rs.weightingFactors.length > 0 && <p className="text-[13px] text-[var(--paper-muted)]">Weighted on {rs.weightingFactors.join(", ")}.</p>}
        </div>
        <div>
          <h4 className="mb-2 text-[14px] font-semibold">Weighted counts by arm</h4>
          <table className="w-full text-[13px] tabular-nums">
            <tbody>
              {rs.arms.map((a) => (
                <tr key={a.id} className="border-b border-[var(--paper-rule)]/10">
                  <td className="py-1.5">{a.name}</td>
                  <td className="py-1.5 text-right font-semibold">{count(a.nWeighted)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[12px] text-[var(--paper-muted)]">
            {Math.round(sum) === Math.round(rs.sample.weighted)
              ? `Arm counts sum to the reported weighted total, ${count(sum)}.`
              : `Rounded arm counts sum to ${count(sum)}; the reported weighted total is ${count(rs.sample.weighted)}. Both are shown as published.`}
          </p>
        </div>
      </div>
      {n.debriefQuestions.length > 0 && (
        <div className="border-t border-[var(--paper-rule)]/40 pt-4">
          <h4 className="mb-2 text-[17px] font-semibold">Questions for the research debrief</h4>
          <ol className="list-decimal space-y-1 pl-5 text-[13px]">
            {n.debriefQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        </div>
      )}
      {rs.sources.length > 0 && <p className="text-[12px] text-[var(--paper-muted)]">Source: {rs.sources.join(" ")}</p>}
    </div>
  )
}

function NoteList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h4 className="mb-2 text-[14px] font-semibold">{title}</h4>
      <ul className="list-disc space-y-1 pl-5 text-[13px] leading-relaxed">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  )
}
