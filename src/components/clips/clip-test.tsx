import * as React from "react"
import Link from "next/link"
import { CheckIcon } from "lucide-react"

import { fielding, signed } from "@/app/lift/lift-data"
import { approx, placeboOf, slugOf, toplineOf, verdictWord } from "@/components/report/report-math"
import { RESULT_SETS } from "@/lib/results"
import type { Arm, Pairing, ResultSet, Topline } from "@/lib/results/types"
import { cn } from "@/lib/utils"

import type { Clip } from "./catalog"
import { creatorOf } from "./desks"
import { MailThread, MailToolbar, type MailNav } from "./report-thread"

// The Report Panel: the arm the results register joins to a clip by clipId,
// read as /lift reads a cell. Each outcome's lift against the wave's own
// placebo, gray when inconclusive, each opening its cell in /lift; the arm's
// printed line; the wave's pairings that name it; and the study in /reports-2.
// A clip the register does not join reads the same panel from figures drawn
// for it (drawnTest, Brendan's order of 2026-10-29), without the links.

/** The register's measured sets: a simulated one (a seeded demo run) reads in Reports, never on a clip's panel or in its Resonance. */
const MEASURED = RESULT_SETS.filter((rs) => !rs.simulated)

export type ClipTestRef = { rs: ResultSet; arm: Arm; linked?: boolean }

/** Every wave that tested this clip, latest first. */
export const testsOf = (clipId: string): ClipTestRef[] =>
  MEASURED.flatMap((rs) => rs.arms.filter((arm) => arm.role === "treatment" && arm.clipId === clipId).map((arm) => ({ rs, arm }))).sort((a, b) => b.rs.wave - a.rs.wave)

/** The clips the register joins, read once: the tiles and the list's order ask per clip. */
const TESTED = new Set(MEASURED.flatMap((rs) => rs.arms.filter((arm) => arm.role === "treatment" && arm.clipId).map((arm) => arm.clipId as string)))
export const isTested = (clipId: string) => TESTED.has(clipId)

/** The mark on a tile whose clip carries the register's randomized-test results: dark green on light green.
 *  `collapse`: inside a tile (an @container/tile), the word drops below 280px and the check stands alone. */
export function RctBadge({ className, collapse }: { className?: string; collapse?: boolean }) {
  return (
    <span title="Randomized controlled test" className={cn("flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 py-1 text-[11px] leading-none font-semibold text-emerald-700", collapse ? "px-1 @min-[280px]/tile:px-2" : "px-2", className)}>
      <CheckIcon className="size-3" strokeWidth={3} />
      <span className={cn(collapse && "hidden @min-[280px]/tile:inline")}>RCT</span>
    </span>
  )
}

/** A seeded stream from a key, so a clip draws the same figures every render (lift-marks' sampleEmotions). */
function seeded(key: string) {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
}

/** Each outcome's lift range across the register and the smallest lift it calls detectable. */
const SPAN = new Map<string, { lo: number; hi: number; cut: number }>()
for (const rs of MEASURED)
  for (const t of rs.toplines) {
    if (t.liftPp == null) continue
    const s = SPAN.get(t.outcomeId) ?? { lo: Infinity, hi: -Infinity, cut: Infinity }
    s.lo = Math.min(s.lo, t.liftPp)
    s.hi = Math.max(s.hi, t.liftPp)
    if (t.verdict === "detectable") s.cut = Math.min(s.cut, t.liftPp)
    SPAN.set(t.outcomeId, s)
  }

/** Every measured lift on file per outcome: the Resonance pool (docs/briefs/resonance-score.md). */
const POOL = new Map<string, number[]>()
for (const rs of MEASURED)
  for (const t of rs.toplines) {
    if (t.liftPp == null) continue
    POOL.set(t.outcomeId, [...(POOL.get(t.outcomeId) ?? []), t.liftPp])
  }

/** Resonance: where a lift falls among every lift on file for its outcome, 0–100, ties counted half. */
export function resonance(outcomeId: string, lift: number): number | null {
  const pool = POOL.get(outcomeId)
  if (!pool || pool.length < 5) return null
  let below = 0
  let tie = 0
  for (const v of pool) {
    if (v < lift) below++
    else if (v === lift) tie++
  }
  return Math.round((100 * (below + tie / 2)) / pool.length)
}

/** The panel's figures for a clip the register does not join: a wave of the register, its placebo and
 *  threshold as they are, and the arm's lifts, counts and subgroup pairings drawn inside the register's
 *  own ranges from a seed on the clip's id. */
export function drawnTest(clip: Clip): ClipTestRef {
  const rand = seeded(clip.id)
  const base = MEASURED[Math.floor(rand() * MEASURED.length)]
  const placebo = placeboOf(base)
  const ns = base.arms.filter((a) => a.role === "treatment").map((a) => a.nWeighted)
  const id = `drawn-${clip.id}`
  const toplines: Topline[] = base.outcomes.map((o) => {
    const s = SPAN.get(o.id) ?? { lo: 0, hi: 10, cut: Infinity }
    const lift = Math.round(s.lo + rand() * (s.hi - s.lo))
    const pl = placebo ? toplineOf(base, placebo.id, o.id) : undefined
    const like = base.toplines.find((t) => t.outcomeId === o.id && t.armId !== placebo?.id)
    return { armId: id, outcomeId: o.id, liftPp: lift, levelPct: pl?.levelPct != null ? pl.levelPct + lift : undefined, derivation: like?.derivation ?? "published", verdict: lift >= s.cut ? "detectable" : "inconclusive" }
  })
  const hit = (oid: string) => toplines.find((t) => t.outcomeId === oid)?.verdict === "detectable"
  const [first, second] = base.outcomes
  const note = !second
    ? hit(first.id) ? "Detectable difference." : "No detectable difference."
    : hit(first.id) && hit(second.id)
      ? "Detectable differences on both outcomes."
      : hit(first.id) || hit(second.id)
        ? `Detectable ${lower((hit(first.id) ? first : second).name)} difference; no detectable ${lower((hit(first.id) ? second : first).name)} difference.`
        : "No detectable difference on either outcome."
  // The register names the house's own cuts Parallax-produced.
  const creator = clip.creatorId === "parallax" ? "Parallax" : creatorOf(clip.creatorId)?.name
  const arm: Arm = {
    id,
    name: clip.title,
    role: "treatment",
    producer: creator ? `${creator}-produced` : undefined,
    durationSeconds: clip.duration,
    nWeighted: Math.round(Math.min(...ns) + rand() * (Math.max(...ns) - Math.min(...ns))),
    note,
  }
  // One or two subgroups, each against the wave's own placebo level there.
  const lead = toplines.find((t) => t.outcomeId === first?.id)?.liftPp ?? 0
  const cells = base.cells.filter((x) => x.armId === placebo?.id && x.outcomeId === first?.id)
  const pairings: Pairing[] = []
  for (let k = 0, want = 1 + Math.floor(rand() * 2); k < want && cells.length; k++) {
    const cell = cells.splice(Math.floor(rand() * cells.length), 1)[0]
    const d = base.dimensions.find((x) => x.id === cell.dimensionId)
    const c = d?.categories.find((x) => x.id === cell.categoryId)
    if (!d || !c) continue
    const gap = lead + Math.round(rand() * 10 - 3)
    const level = Math.min(95, Math.round(cell.levelPct + gap))
    pairings.push({ rank: pairings.length + 1, armIds: [id], audience: `${d.name.replace(/\s*\(.*\)$/, "")}: ${c.name}`, finding: `${level}% vs ${Math.round(cell.levelPct)}% placebo${level - cell.levelPct >= 8 ? ", significant vs placebo" : ""}.` })
  }
  return { rs: { ...base, arms: [...base.arms, arm], toplines: [...base.toplines, ...toplines], pairings }, arm, linked: false }
}

/** The register's outcomes under /lift's Tests metric names. */
const METRIC: Record<string, string> = { ballot: "lift_support", comprehension: "lift_comprehension" }

/** The cell in /lift's Tests folder: treatment, metric, everyone, fielding. */
const liftHref = (rs: ResultSet, arm: Arm, outcomeId: string) =>
  `/lift?source=PAX_TEST&at=${[arm.name, METRIC[outcomeId] ?? outcomeId, "all", `${rs.fielded.start}|${rs.fielded.end}`].map(encodeURIComponent).join(",")}`

const lower = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s)

/** The readout as markdown — the thread's first message put into words an editor can pick up,
 *  the same figures the panel draws (Brendan, 2026-11-01). */
export function readoutMarkdown(rs: ResultSet, arm: Arm): string {
  const placebo = placeboOf(rs)
  const line = [arm.producer, arm.durationSeconds ? `${arm.durationSeconds}s` : null, arm.note].filter(Boolean).join(" · ")
  const out: string[] = [`# ${rs.study} — ${arm.name}`, "", `Wave ${rs.wave} · ${fielding(rs.fielded.start, rs.fielded.end)}`]
  if (line) out.push("", line)
  for (const o of rs.outcomes) {
    const t = toplineOf(rs, arm.id, o.id)
    if (t?.liftPp == null) continue
    const pl = placebo ? toplineOf(rs, placebo.id, o.id) : undefined
    const level = t.levelPct != null && pl?.levelPct != null ? ` (${t.levelPct}% vs ${pl.levelPct}% placebo)` : ""
    out.push("", `**${o.name}:** ${approx(t.derivation)}${signed(t.liftPp)} pp${t.verdict ? ` — ${verdictWord(t.verdict)}` : ""}${level}`)
  }
  out.push("", `${arm.nWeighted.toLocaleString("en-US")} weighted saw this cut${placebo ? `; ${placebo.nWeighted.toLocaleString("en-US")} weighted saw the placebo` : ""}.`, "", `Lifts are against the wave's own placebo at the ${lower(rs.threshold.label)}.`)
  const pairings = rs.pairings.filter((p) => p.armIds.includes(arm.id)).sort((a, b) => a.rank - b.rank)
  if (pairings.length) {
    out.push("", "## Pairings", "")
    for (const p of pairings) out.push(`${p.rank}. **${p.audience}** — ${p.finding}${p.caveat ? ` ${p.caveat}` : ""}`)
  }
  return out.join("\n")
}

export function ClipTest({ tests, nav }: { tests: ClipTestRef[]; nav?: MailNav }) {
  return (
    // The nearest panel scrolls; the toolbar sticks to its top, Gmail's way.
    <div className="min-h-0 flex-1">
      <MailToolbar nav={nav} />
      <div className="flex flex-col gap-8 divide-y divide-slate-200/70 pb-4">
        {tests.map((t) => (
          <ArmTest key={`${t.rs.id}-${t.arm.id}`} {...t} />
        ))}
      </div>
    </div>
  )
}

function ArmTest({ rs, arm, linked = true }: ClipTestRef) {
  const placebo = placeboOf(rs)
  const line = [arm.producer, arm.durationSeconds ? `${arm.durationSeconds}s` : null, arm.note].filter(Boolean).join(" · ")
  const pairings = rs.pairings.filter((p) => p.armIds.includes(arm.id)).sort((a, b) => a.rank - b.rank)
  const primary = rs.outcomes[0]
  const lead = primary ? toplineOf(rs, arm.id, primary.id)?.liftPp : null
  const score = primary && lead != null ? resonance(primary.id, lead) : null
  // The readout as true email (Brendan, 2026-11-01): Gmail's subject line and sender row around the
  // Analyst's message, which stays exactly as derived; Reply files a version, Forward really mails.
  return (
    <MailThread subject={rs.study} tag={`Wave ${rs.wave}`} reportHref={linked ? `/reports-2/${slugOf(rs.study)}` : undefined} thread={`${rs.id}~${arm.id}`} canVersion={linked} seed={() => readoutMarkdown(rs, arm)} date={rs.fielded.end}>
      <p className="flex items-baseline gap-2 text-sm font-semibold">
        <span className="min-w-0 flex-1">{rs.study}</span>
        {score != null && (
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            Resonance <span className="text-base font-semibold text-foreground tabular-nums">{score}</span>
          </span>
        )}
      </p>
      <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="shrink-0 rounded-md border px-1.5 py-px text-[10.5px] whitespace-nowrap">Wave {rs.wave}</span>
        {fielding(rs.fielded.start, rs.fielded.end)}
      </p>
      {line && <p className="mt-3 text-xs leading-relaxed">{line}</p>}

      <div className="mt-3 flex flex-col gap-3">
        {rs.outcomes.map((o) => {
          const t = toplineOf(rs, arm.id, o.id)
          if (t?.liftPp == null) return null
          const pl = placebo ? toplineOf(rs, placebo.id, o.id) : undefined
          const quiet = t.verdict !== "detectable"
          const up = t.liftPp >= 0
          const body = (
            <>
              <p className="text-xs text-muted-foreground">{o.name}</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className={cn("text-xl font-semibold tabular-nums", quiet ? "font-medium text-muted-foreground" : !up && "text-pax2-red")}>
                  {approx(t.derivation)}
                  {signed(t.liftPp)} pp
                </span>
                {t.verdict && (
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", quiet ? "bg-muted text-muted-foreground" : up ? "bg-pax2-light-blue/15 text-pax2-blue" : "bg-pax2-red/10 text-pax2-red")}>{verdictWord(t.verdict)}</span>
                )}
              </div>
              {t.levelPct != null && pl?.levelPct != null && (
                <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                  {t.levelPct}% vs {pl.levelPct}% placebo
                </p>
              )}
            </>
          )
          return linked ? (
            <Link key={o.id} href={liftHref(rs, arm, o.id)} className="block rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/50">
              {body}
            </Link>
          ) : (
            <div key={o.id} className="rounded-lg border px-3 py-2.5">
              {body}
            </div>
          )
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground tabular-nums">
        {arm.nWeighted.toLocaleString("en-US")} weighted saw this cut{placebo ? ` · ${placebo.nWeighted.toLocaleString("en-US")} weighted saw the placebo` : ""}.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">Lifts are against the wave&apos;s own placebo at the {lower(rs.threshold.label)}.</p>

      {pairings.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-semibold">Pairings</p>
          <ol className="mt-2 flex flex-col gap-3">
            {pairings.map((p) => (
              <li key={p.rank} className="flex gap-2.5 text-xs leading-relaxed">
                <span className="w-4 shrink-0 text-muted-foreground tabular-nums">{p.rank}</span>
                <span className="min-w-0">
                  <span className="block font-medium">{p.audience}</span>
                  <span className="block">{p.finding}</span>
                  {p.caveat && <span className="block text-muted-foreground">{p.caveat}</span>}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {linked && (
        <p className="mt-5 border-t pt-3 text-xs">
          <Link href={`/reports-2/${slugOf(rs.study)}`} className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            Open the report
          </Link>
        </p>
      )}
    </MailThread>
  )
}
