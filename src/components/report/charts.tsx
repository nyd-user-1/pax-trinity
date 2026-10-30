import * as React from "react"

import { Reveal } from "@/components/reveal"
import type { Arm, ResultSet, SubgroupDimension, Topline } from "@/lib/results/types"
import { cn } from "@/lib/utils"

import { ChartHead, VerdictChip, VerdictMark, WaveChip } from "./report-bits"
import { approx, axis, cellOf, isCampaign, marksOf, pct, placeboOf, signed, toplineOf, treatmentsOf } from "./report-math"

// The readout's charts: flex bars on a stated scale, no chart library. A
// lift bar is always against its own wave's placebo; a level bar is a level.
// Each bar grows from zero the first time it comes into view (components/reveal.tsx), staggered down
// its chart by the row's --i.

/** A row's place in its chart, for the bars' stagger. */
const nth = (i: number) => ({ "--i": i }) as React.CSSProperties

type Axis = ReturnType<typeof axis>

const span = (a: Axis) => a.max - a.min || 1
const at = (a: Axis, v: number) => ((v - a.min) / span(a)) * 100

/** One lift on a shared axis: a bar from zero, a dot where it is zero. */
export function LiftBar({ value, a, tone, height = 18 }: { value: number; a: Axis; tone: "detect" | "quiet" | "campaign"; height?: number }) {
  const zero = at(a, 0)
  const end = at(a, value)
  const fill = tone === "detect" ? "var(--r-detect)" : tone === "campaign" ? "var(--r-campaign)" : "var(--r-quiet)"
  return (
    <Reveal className="relative w-full" style={{ height }}>
      {a.ticks.map((t) => (
        <span key={t} className={cn("absolute inset-y-0 w-px", t === 0 ? "bg-[var(--paper-text)]/70" : "bg-[var(--paper-rule)]/10")} style={{ left: `${at(a, t)}%` }} />
      ))}
      {value === 0 ? (
        <span className="grow-in absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${zero}%`, background: fill }} />
      ) : (
        <span className={cn("absolute inset-y-0 rounded-[2px]", value < 0 ? "grow-x-neg" : "grow-x")} style={{ left: `${Math.min(zero, end)}%`, width: `${Math.abs(end - zero)}%`, background: fill }} />
      )}
    </Reveal>
  )
}

export function AxisTicks({ a, unit = "" }: { a: Axis; unit?: string }) {
  return (
    <div className="relative h-4 text-[11px] text-[var(--paper-muted)] tabular-nums">
      {a.ticks.map((t) => (
        <span key={t} className="absolute -translate-x-1/2" style={{ left: `${at(a, t)}%` }}>
          {t > 0 ? `+${t}` : t < 0 ? signed(t) : "0"}
          {unit}
        </span>
      ))}
    </div>
  )
}

const toneOf = (arm: Arm | undefined, t: Topline | undefined): "detect" | "quiet" | "campaign" =>
  t?.verdict !== "detectable" ? "quiet" : isCampaign(arm) ? "campaign" : "detect"

// ── The executive summary's cross-wave chart ─────────────────────────────

export function CrossWaveLift({ waves, ballot = "ballot", comprehension = "comprehension" }: { waves: ResultSet[]; ballot?: string; comprehension?: string }) {
  const latest = Math.max(...waves.map((w) => w.wave))
  const rows = waves
    .flatMap((rs) =>
      treatmentsOf(rs).map((arm, i) => ({ rs, arm, i, b: toplineOf(rs, arm.id, ballot), c: toplineOf(rs, arm.id, comprehension) }))
    )
    // An arm with no lift (no respondents to read) keeps its row, last, with nothing drawn.
    .sort((x, y) => (y.b?.liftPp ?? -Infinity) - (x.b?.liftPp ?? -Infinity) || x.rs.wave - y.rs.wave || x.i - y.i)
  const lifted = rows.filter((r) => r.b?.liftPp != null)
  const a = axis(lifted.map((r) => r.b!.liftPp!))
  // Rows sharing one rounded lift wear a band: equal displays, not shown to be equal.
  const tally = new Map<number, number>()
  for (const r of lifted) tally.set(Math.round(r.b!.liftPp!), (tally.get(Math.round(r.b!.liftPp!)) ?? 0) + 1)
  const shared = [...tally].filter(([, n]) => n > 1).map(([v]) => v)
  const anyApprox = lifted.some((r) => r.b?.derivation === "derived_from_rounded" || r.c?.derivation === "derived_from_rounded")
  const anyCampaign = rows.some((r) => isCampaign(r.arm))
  const last = waves[waves.length - 1]
  const cName = last?.outcomes.find((o) => o.id === comprehension)?.name ?? "Comprehension"
  const bName = last?.outcomes.find((o) => o.id === ballot)?.name ?? "Ballot support"
  const grid = "grid grid-cols-[40px_minmax(120px,190px)_minmax(0,1fr)_120px_190px] items-center gap-x-3"
  return (
    <div className="report-avoid overflow-x-auto">
      <div className="min-w-[760px]">
        <ChartHead left={`${bName} lift vs own-wave placebo, percentage points`} right={`Shared ${a.min} to +${a.max} scale · not ranks`} />
        <div className={cn(grid, "py-1 text-[11px] text-[var(--paper-muted)]")}>
          <span>Wave</span>
          <span>Creative</span>
          <span>% Yes, lift</span>
          <span>Ballot status</span>
          <span>{cName} lift</span>
        </div>
        {rows.map((r, k) => {
          const lift = r.b?.liftPp
          const band = lift != null && shared.includes(Math.round(lift))
          return (
            <div key={`${r.rs.id}:${r.arm.id}`} style={nth(k)} className={cn(grid, "border-t border-[var(--paper-rule)]/10 py-2", band && "bg-[var(--r-tint)]")}>
              <WaveChip wave={r.rs.wave} latest={r.rs.wave === latest} />
              <span className="line-clamp-2 font-semibold" title={r.arm.name}>
                {r.arm.watchUrl ? (
                  <a href={r.arm.watchUrl} target="_blank" rel="noreferrer" className="underline decoration-[var(--paper-rule)]/30 underline-offset-4 hover:decoration-current">
                    {r.arm.name}
                  </a>
                ) : (
                  r.arm.name
                )}
              </span>
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1">{lift != null && <LiftBar value={lift} a={a} tone={toneOf(r.arm, r.b)} />}</span>
                <span className="w-14 shrink-0 text-[13px] font-semibold tabular-nums">
                  {lift != null ? (
                    <>
                      {approx(r.b!.derivation)}
                      {signed(lift)}
                    </>
                  ) : (
                    <span className="font-normal text-[var(--paper-muted)]">—</span>
                  )}
                </span>
              </span>
              <span className="text-[13px]">{r.b?.verdict && <VerdictMark verdict={r.b.verdict} />}</span>
              <span className="text-[13px] tabular-nums">
                {r.c?.liftPp != null ? (
                  <>
                    <span className="font-semibold">
                      {approx(r.c.derivation)}
                      {signed(r.c.liftPp)} pp
                    </span>
                    {r.c.verdict && <span className={cn(r.c.verdict === "detectable" ? "text-[var(--r-detect)]" : "text-[var(--paper-muted)]")}> · {r.c.verdict}</span>}
                  </>
                ) : (
                  <span className="text-[var(--paper-muted)]">—</span>
                )}
              </span>
            </div>
          )
        })}
        <div className={cn(grid, "border-t border-[var(--paper-rule)]/40 pt-1")}>
          <span />
          <span />
          {/* The ticks sit under the bar's track alone, clear of the value beside it. */}
          <span className="pr-16">
            <AxisTicks a={a} />
          </span>
          <span />
          <span />
        </div>
        <ul className="mt-4 grid grid-cols-1 gap-x-8 gap-y-1.5 text-[12px] text-[var(--paper-muted)] sm:grid-cols-2">
          <li className="flex items-center gap-2">
            <VerdictMark verdict="detectable" /> — meets the {waves[0]?.threshold.label ?? "stated threshold"} vs placebo
          </li>
          <li className="flex items-center gap-2">
            <VerdictMark verdict="inconclusive" /> — not detected; not proof of zero effect
          </li>
          {anyCampaign && (
            <li className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-4 rounded-[2px] bg-[var(--r-campaign)]" /> {rows.find((r) => isCampaign(r.arm))?.arm.producer}
            </li>
          )}
          {anyApprox && (
            <li className="flex items-center gap-2">
              <span className="font-semibold text-[var(--paper-text)]">≈</span> lift derived from rounded percentages
            </li>
          )}
          {shared.length > 0 && (
            <li className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-4 rounded-[2px] bg-[var(--r-tint)] ring-1 ring-[var(--paper-rule)]/10" /> Same rounded {shared.map(signed).join(", ")} — not shown to be equal
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}

// ── Levels against the placebo's level ─────────────────────────────────

export function LevelChart({ rs, outcomeId }: { rs: ResultSet; outcomeId: string }) {
  const placebo = placeboOf(rs)
  const p = placebo ? toplineOf(rs, placebo.id, outcomeId) : undefined
  if (p?.levelPct == null) return null
  const outcome = rs.outcomes.find((o) => o.id === outcomeId)
  // Every arm keeps its row; one with no level (no respondents to read) draws nothing.
  const rows = [placebo!, ...treatmentsOf(rs)].map((arm) => ({ arm, t: toplineOf(rs, arm.id, outcomeId) }))
  const grid = "grid grid-cols-[minmax(140px,230px)_minmax(0,1fr)_190px] items-center gap-x-3"
  return (
    <div className="report-avoid overflow-x-auto">
      <div className="min-w-[620px]">
        <ChartHead left={`Wave ${rs.wave} · ${outcome?.name ?? outcomeId}, % level`} right={`0–100% scale · dashed line = placebo level (${pct(p.levelPct)})`} />
        {rows.map(({ arm, t }, k) => {
          const isP = arm.role === "placebo"
          return (
            <div key={arm.id} style={nth(k)} className={cn(grid, "border-t border-[var(--paper-rule)]/10 py-2")}>
              <span className={cn("line-clamp-3", isP ? "text-[var(--paper-muted)]" : "font-semibold")} title={arm.name}>
                {isP ? `${arm.name.replace(/\s*\(.*\)$/, "")} (reference)` : arm.name}
              </span>
              <span className="flex items-center gap-2">
                {t?.levelPct != null ? (
                  <>
                    <LevelTrack level={t.levelPct} placebo={p.levelPct!} tone={isP ? "placebo" : toneOf(arm, t) === "detect" ? "detect" : "quiet"} />
                    <span className="w-11 shrink-0 text-[13px] font-semibold tabular-nums">{pct(t.levelPct)}</span>
                  </>
                ) : (
                  <span className="text-[13px] text-[var(--paper-muted)]">{arm.nWeighted === 0 ? "No respondents" : "—"}</span>
                )}
              </span>
              <span className="text-[13px] tabular-nums">
                {isP ? (
                  <span className="text-[var(--paper-muted)]">Control arm</span>
                ) : t?.liftPp != null ? (
                  <>
                    <span className="font-semibold">
                      {approx(t.derivation)}
                      {signed(t.liftPp)} pp
                    </span>
                    {t.verdict && <span className={cn(t.verdict === "detectable" ? "text-[var(--r-detect)]" : "text-[var(--paper-muted)]")}> · {t.verdict}</span>}
                  </>
                ) : t?.verdict ? (
                  <span className="text-[var(--paper-muted)]">— · {t.verdict}</span>
                ) : null}
              </span>
            </div>
          )
        })}
        <div className={cn(grid, "border-t border-[var(--paper-rule)]/40 pt-1")}>
          <span />
          <span className="relative h-4 pr-[52px] text-[11px] text-[var(--paper-muted)] tabular-nums">
            <span className="relative block h-full">
              {[0, 25, 50, 75, 100].map((t) => (
                <span key={t} className="absolute -translate-x-1/2" style={{ left: `${t}%` }}>
                  {t}%
                </span>
              ))}
            </span>
          </span>
          <span />
        </div>
      </div>
    </div>
  )
}

/** A 0–100 level bar on its track, the placebo's level a dashed line through it. */
export function LevelTrack({
  level,
  placebo,
  tone,
  edge,
  small,
  height = 16,
}: {
  level: number
  placebo?: number | null
  tone: "detect" | "quiet" | "placebo" | "campaign"
  edge?: boolean
  small?: boolean
  height?: number
}) {
  const fill = tone === "detect" ? "var(--r-detect)" : tone === "placebo" ? "var(--r-placebo)" : tone === "campaign" ? "var(--r-campaign)" : "var(--r-quiet)"
  return (
    <Reveal as="span" className="relative block min-w-0 flex-1 rounded-[2px] bg-[var(--r-track)]" style={{ height }}>
      <span
        className={cn("grow-x absolute inset-y-0 left-0 rounded-[2px]", small && "report-hatch", edge && "ring-[1.5px] ring-[var(--r-detect-edge)] ring-inset")}
        style={{ width: `${Math.max(0, Math.min(100, level))}%`, backgroundColor: fill }}
      />
      {placebo != null && <span className="absolute -inset-y-1 border-l border-dashed border-[var(--paper-text)]" style={{ left: `${placebo}%` }} />}
    </Reveal>
  )
}

// ── The per-wave overview: both outcomes' lifts on one scale ────────────

export function DualLift({ rs, a }: { rs: ResultSet; a: Axis }) {
  const outs = rs.outcomes
  const placebo = placeboOf(rs)
  const cols = `minmax(140px,220px) ${outs.map(() => "minmax(0,1fr) 150px").join(" ")}`
  return (
    <div className="report-avoid overflow-x-auto">
      <div className="min-w-[760px]">
        <ChartHead left="Lift versus own-wave placebo, percentage points" right={`Same ${signed(a.min)} to +${a.max} scale on ${outs.length === 2 ? "both outcomes" : "every outcome"} · placebo = 0`} />
        <div className="grid items-center gap-x-3 py-1 text-[11px] text-[var(--paper-muted)]" style={{ gridTemplateColumns: cols }}>
          <span>Video</span>
          {outs.map((o) => (
            <React.Fragment key={o.id}>
              <span>{o.name}</span>
              <span />
            </React.Fragment>
          ))}
        </div>
        {treatmentsOf(rs).map((arm, k) => (
          <div key={arm.id} className="grid items-center gap-x-3 border-t border-[var(--paper-rule)]/10 py-2.5 print:py-1.5" style={{ gridTemplateColumns: cols, ...nth(k) }}>
            <span className="line-clamp-3 font-semibold" title={arm.name}>
              {arm.name}
            </span>
            {outs.map((o) => {
              const t = toplineOf(rs, arm.id, o.id)
              const pl = placebo ? toplineOf(rs, placebo.id, o.id) : undefined
              return (
                <React.Fragment key={o.id}>
                  {t?.liftPp != null ? <LiftBar value={t.liftPp} a={a} tone={toneOf(arm, t)} /> : <span />}
                  <span className="text-[13px] leading-tight tabular-nums">
                    {t?.liftPp != null ? (
                      <span className="font-semibold">
                        {approx(t.derivation)}
                        {signed(t.liftPp)} pp
                      </span>
                    ) : (
                      <span className="text-[var(--paper-muted)]">—</span>
                    )}
                    {t?.verdict && <span className={cn(t.verdict === "detectable" ? "text-[var(--r-detect)]" : "text-[var(--paper-muted)]")}> · {t.verdict}</span>}
                    {t?.levelPct != null && pl?.levelPct != null && (
                      <span className="block text-[11px] text-[var(--paper-muted)]">
                        {pct(t.levelPct)} vs {pct(pl.levelPct)}
                      </span>
                    )}
                  </span>
                </React.Fragment>
              )
            })}
          </div>
        ))}
        <div className="grid gap-x-3 border-t border-[var(--paper-rule)]/40 pt-1" style={{ gridTemplateColumns: cols }}>
          <span />
          {outs.map((o) => (
            <React.Fragment key={o.id}>
              <AxisTicks a={a} />
              <span />
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Subgroup levels ──────────────────────────────────────────────────────

export function SubgroupPanels({ rs, d, outcomeId = "ballot" }: { rs: ResultSet; d: SubgroupDimension; outcomeId?: string }) {
  const placebo = placeboOf(rs)
  const arms = [placebo, ...treatmentsOf(rs)].filter((x): x is Arm => !!x)
  const n = d.categories.length
  return (
    <div className="report-avoid overflow-x-auto">
      <div className="grid min-w-[640px] gap-x-5" style={{ gridTemplateColumns: `minmax(100px,170px) repeat(${n}, minmax(0,1fr))` }}>
        <span />
        {d.categories.map((cat) => {
          const cs = arms.map((a) => cellOf(rs, d.id, cat.id, a.id, outcomeId)).filter(Boolean)
          const k = cs.filter((c) => c!.smallSample).length
          return (
            <div key={cat.id} className="flex min-h-9 flex-col justify-end border-b border-[var(--paper-rule)]/25 pb-1">
              <span className="text-[12px] leading-tight font-semibold">{cat.name}</span>
              {(cat.smallSampleAllCells || k > 0) && (
                <span className="text-[11px] text-[var(--paper-muted)] italic">Small sample — {cat.smallSampleAllCells || k === cs.length ? "all cells" : `${k} of ${cs.length} cells`}</span>
              )}
            </div>
          )
        })}
        {arms.map((arm, k) => (
          <React.Fragment key={arm.id}>
            <span className={cn("line-clamp-2 py-[3px] text-[12px] leading-tight", arm.role === "placebo" ? "text-[var(--paper-muted)]" : "")} title={arm.name}>
              {arm.role === "placebo" ? arm.name.replace(/\s*\(.*\)$/, "") : arm.name}
            </span>
            {d.categories.map((cat) => {
              const c = cellOf(rs, d.id, cat.id, arm.id, outcomeId)
              const pc = placebo ? cellOf(rs, d.id, cat.id, placebo.id, outcomeId) : undefined
              if (!c) return <span key={cat.id} className="py-[3px] text-[12px] text-[var(--paper-muted)]">—</span>
              const small = c.smallSample || !!cat.smallSampleAllCells
              const isP = arm.role === "placebo"
              return (
                <span key={cat.id} className="flex items-center gap-2 py-[3px]" style={nth(k)}>
                  <LevelTrack level={c.levelPct} placebo={pc?.levelPct} tone={isP ? "placebo" : c.significant ? "detect" : "quiet"} edge={c.significant} small={small} height={13} />
                  <span className={cn("w-9 shrink-0 text-right text-[12px] tabular-nums", c.significant && "font-semibold", small && "italic")}>{pct(c.levelPct)}</span>
                </span>
              )
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

/** "Marked vs placebo: 7 of 16 cells · small-sample flag: Black, Other" — the printed count where the data carries it, else counted. */
export function marksLine(rs: ResultSet, d: SubgroupDimension): string {
  const m = marksOf(rs, d)
  const printed = d.markedOfCells
  const head = `Marked vs placebo: ${printed ? printed.marked : m.marked} of ${printed ? printed.of : m.of} cells`
  return `${head} · ${m.small.length ? `small-sample flag: ${m.small.join(", ")}` : "no small-sample flags"}`
}
