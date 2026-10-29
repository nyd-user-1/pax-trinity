import type { Arm, ResultSet, SubgroupDimension, Topline } from "@/lib/results/types"

import type { BarCell, BarSpec, FingerprintSpec, LinesSpec, Tone } from "./report-charts"
import { approx, axis, cellOf, isCampaign, pct, placeboOf, signed, toplineOf, treatmentsOf, verdictWord } from "./report-math"

// The charts' specs, built on the server from the result sets (report-charts.tsx draws them): every
// figure the old flex charts printed, in the bars' labels and each bar's hover readout.

type Axis = ReturnType<typeof axis>

const toneOf = (arm: Arm | undefined, t: Topline | undefined): Tone => (t?.verdict !== "detectable" ? "quiet" : isCampaign(arm) ? "campaign" : "detect")
const verdictOf = (t: Topline | undefined) => (t?.verdict ? verdictWord(t.verdict).toLowerCase() : null)
const liftText = (t: Topline) => `${approx(t.derivation)}${signed(t.liftPp!)} pp`
const placeboName = (arm: Arm) => arm.name.replace(/\s*\(.*\)$/, "")

/** A lift cell: the lift and its verdict on the bar, the levels behind it on hover. */
function liftCell(rs: ResultSet, arm: Arm, outcomeId: string, name: string, extra: string[] = []): BarCell | null {
  const t = toplineOf(rs, arm.id, outcomeId)
  if (t?.liftPp == null) return null
  const placebo = placeboOf(rs)
  const pl = placebo ? toplineOf(rs, placebo.id, outcomeId) : undefined
  const verdict = verdictOf(t)
  return {
    value: t.liftPp,
    tone: toneOf(arm, t),
    text: liftText(t),
    note: verdict ?? undefined,
    tip: [arm.name, ...extra, `${name}: ${liftText(t)} vs placebo${verdict ? ` · ${verdict}` : ""}`, ...(t.levelPct != null && pl?.levelPct != null ? [`${pct(t.levelPct)} against the placebo's ${pct(pl.levelPct)}`] : [])],
  }
}

/** A wave's videos, each outcome's lift against its own placebo, on the study's one scale. */
export function liftSpec(rs: ResultSet, a: Axis): BarSpec {
  return {
    unit: "pp",
    min: a.min,
    max: a.max,
    valueRoom: 15,
    panels: rs.outcomes.map((o) => ({ title: o.name })),
    rows: treatmentsOf(rs).map((arm) => ({ label: arm.name, cells: rs.outcomes.map((o) => liftCell(rs, arm, o.id, o.name)) })),
  }
}

/** Every wave's videos together, ranked by their ballot lift, each against its own wave's placebo. */
export function crossWaveSpec(waves: ResultSet[], ballot = "ballot", comprehension = "comprehension"): BarSpec {
  const last = waves[waves.length - 1]
  const names = [ballot, comprehension].map((id) => last.outcomes.find((o) => o.id === id)?.name ?? id)
  const rows = waves
    .flatMap((rs) => treatmentsOf(rs).map((arm, i) => ({ rs, arm, i, b: toplineOf(rs, arm.id, ballot) })))
    .sort((x, y) => (y.b?.liftPp ?? -Infinity) - (x.b?.liftPp ?? -Infinity) || x.rs.wave - y.rs.wave || x.i - y.i)
  const lifts = waves.flatMap((rs) => rs.toplines.filter((t) => t.outcomeId === ballot || t.outcomeId === comprehension).map((t) => t.liftPp).filter((v): v is number => v != null))
  const a = axis(lifts)
  return {
    unit: "pp",
    min: a.min,
    max: a.max,
    valueRoom: 15,
    panels: names.map((title) => ({ title })),
    rows: rows.map(({ rs, arm }) => {
      const wave = `Wave ${rs.wave}${rs.simulated ? " · simulated respondents" : ""}`
      return { label: `W${rs.wave} · ${arm.name}`, cells: [ballot, comprehension].map((id, k) => liftCell(rs, arm, id, names[k], [wave])) }
    }),
  }
}

/** One outcome's levels: the placebo first, each video against the placebo's dashed level. */
export function levelSpec(rs: ResultSet, outcomeId: string): BarSpec | null {
  const placebo = placeboOf(rs)
  const p = placebo ? toplineOf(rs, placebo.id, outcomeId) : undefined
  if (!placebo || p?.levelPct == null) return null
  const outcome = rs.outcomes.find((o) => o.id === outcomeId)
  const name = outcome?.name ?? outcomeId
  return {
    unit: "%",
    min: 0,
    max: 100,
    valueRoom: 17,
    panels: [{ title: `${name}, % level`, ref: p.levelPct }],
    rows: [placebo, ...treatmentsOf(rs)].map((arm) => {
      const t = toplineOf(rs, arm.id, outcomeId)
      const isP = arm.role === "placebo"
      if (t?.levelPct == null) return { label: isP ? `${placeboName(arm)} (reference)` : arm.name, muted: isP, cells: [null] }
      const verdict = verdictOf(t)
      return {
        label: isP ? `${placeboName(arm)} (reference)` : arm.name,
        muted: isP,
        cells: [
          {
            value: t.levelPct,
            tone: isP ? "placebo" : toneOf(arm, t) === "detect" ? "detect" : "quiet",
            text: pct(t.levelPct),
            note: isP ? "control" : t.liftPp != null ? `${liftText(t)}${verdict ? ` · ${verdict}` : ""}` : (verdict ?? undefined),
            tip: [isP ? placeboName(arm) : arm.name, `${name}: ${pct(t.levelPct)}`, isP ? "The control arm: every lift is against this level." : t.liftPp != null ? `${liftText(t)} against the placebo's ${pct(p.levelPct!)}${verdict ? ` · ${verdict}` : ""}` : (verdict ?? "")].filter(Boolean),
          },
        ],
      }
    }),
  }
}

/** A subgroup dimension: each category a panel of levels, its own placebo's level dashed through it. */
export function subgroupSpec(rs: ResultSet, d: SubgroupDimension, outcomeId = "ballot"): BarSpec {
  const placebo = placeboOf(rs)
  const arms = [placebo, ...treatmentsOf(rs)].filter((x): x is Arm => !!x)
  return {
    unit: "%",
    min: 0,
    max: 100,
    valueRoom: 7,
    rowHeight: 22,
    panels: d.categories.map((cat) => {
      const pc = placebo ? cellOf(rs, d.id, cat.id, placebo.id, outcomeId) : undefined
      return { title: cat.name, ref: pc?.levelPct ?? null }
    }),
    rows: arms.map((arm) => {
      const isP = arm.role === "placebo"
      return {
        label: isP ? placeboName(arm) : arm.name,
        muted: isP,
        cells: d.categories.map((cat) => {
          const c = cellOf(rs, d.id, cat.id, arm.id, outcomeId)
          if (!c) return null
          const pc = placebo ? cellOf(rs, d.id, cat.id, placebo.id, outcomeId) : undefined
          const small = c.smallSample || !!cat.smallSampleAllCells
          return {
            value: c.levelPct,
            tone: isP ? "placebo" : c.significant ? "detect" : "quiet",
            edge: c.significant,
            small,
            text: pct(c.levelPct),
            tip: [
              `${d.name.replace(/\s*\(.*\)$/, "")} · ${cat.name}`,
              `${isP ? placeboName(arm) : arm.name}: ${pct(c.levelPct)} selecting Yes`,
              ...(!isP && pc ? [`Placebo here: ${pct(pc.levelPct)} (${signed(Math.round((c.levelPct - pc.levelPct) * 10) / 10)} pp)`] : []),
              ...(c.significant ? ["Significant vs placebo inside this subgroup"] : []),
              ...(small ? ["Small sample"] : []),
            ],
          }
        }),
      }
    }),
  }
}

/** A self-selected question's shares, a panel per wave. */
export function shareSpec(waves: { rs: ResultSet; d: SubgroupDimension }[]): BarSpec {
  const cats = waves[waves.length - 1]?.d.categories ?? []
  return {
    unit: "%",
    min: 0,
    max: 100,
    valueRoom: 9,
    panels: waves.map(({ rs }) => ({ title: `Wave ${rs.wave}` })),
    rows: cats.map((cat) => ({
      label: cat.name,
      cells: waves.map(({ rs, d }) => {
        const c = d.categories.find((x) => x.id === cat.id)
        if (c?.sharePct == null) return null
        return { value: c.sharePct, tone: "campaign" as Tone, text: `${approx(d.shareDerivation)}${pct(c.sharePct)}`, tip: [`${cat.name} · Wave ${rs.wave}`, `${approx(d.shareDerivation)}${pct(c.sharePct)} of the weighted sample${c.nWeighted != null ? ` (${Math.round(c.nWeighted).toLocaleString("en-US")})` : ""}`] }
      }),
    })),
  }
}

// ── The fingerprint ──────────────────────────────────────────────────────

/** A band's name short enough to sit under its own cells. */
const SHORT: Record<string, string> = {
  gender: "Gender",
  age: "Age",
  race: "Race",
  education: "Education",
  income: "Income",
  parent: "Parents",
  ideology: "Ideology",
  party: "Party",
  community: "Community",
  "vote-2024": "2024 vote",
  vote2024: "2024 vote",
  "turnout-2022": "2022 turnout",
  "media-trust": "Media",
  mediaTrust: "Media",
  "media-market": "Market",
}
const HUES = [173, 271, 35, 142, 0, 199, 330, 88, 250, 20, 160, 300, 55]

/** The wave's signature: each video's row of cells, its overall lifts, then its lift inside every subgroup. */
export function fingerprintSpec(rs: ResultSet, ballot = "ballot"): FingerprintSpec | null {
  const placebo = placeboOf(rs)
  const arms = treatmentsOf(rs)
  if (!placebo || !arms.length) return null
  type Col = { band: string; label: string; lift: (arm: Arm) => number | null; line: (arm: Arm) => string }
  const cols: Col[] = rs.outcomes.map((o) => ({
    band: "Overall",
    label: o.name,
    lift: (arm) => toplineOf(rs, arm.id, o.id)?.liftPp ?? null,
    line: (arm) => {
      const t = toplineOf(rs, arm.id, o.id)
      return t?.liftPp == null ? `${arm.name}: not read` : `${arm.name}: ${liftText(t)}${verdictOf(t) ? ` · ${verdictOf(t)}` : ""}`
    },
  }))
  for (const d of rs.dimensions) {
    const band = SHORT[d.id] ?? d.name.replace(/\s*\(.*\)$/, "").split(" ")[0]
    for (const cat of d.categories) {
      const pc = cellOf(rs, d.id, cat.id, placebo.id, ballot)
      if (!pc) continue
      cols.push({
        band,
        label: cat.name,
        lift: (arm) => {
          const c = cellOf(rs, d.id, cat.id, arm.id, ballot)
          return c ? Math.round((c.levelPct - pc.levelPct) * 10) / 10 : null
        },
        line: (arm) => {
          const c = cellOf(rs, d.id, cat.id, arm.id, ballot)
          if (!c) return `${arm.name}: not read`
          return `${arm.name}: ${pct(c.levelPct)} vs ${pct(pc.levelPct)} (${signed(Math.round((c.levelPct - pc.levelPct) * 10) / 10)} pp)${c.significant ? " · significant" : ""}${c.smallSample || cat.smallSampleAllCells ? " · small sample" : ""}`
        },
      })
    }
  }
  if (cols.length <= rs.outcomes.length) return null
  // A cell's depth is its lift's place among every lift in the wave's fingerprint, 0 to 1.
  const lifts = cols.flatMap((c) => arms.map((arm) => c.lift(arm))).filter((v): v is number => v != null).sort((x, y) => x - y)
  const depth = (v: number | null) => {
    if (v == null || lifts.length < 2) return v == null ? null : 0.5
    let below = 0
    let ties = 0
    for (const x of lifts) {
      if (x < v) below++
      else if (x === v) ties++
    }
    return (below + (ties - 1) / 2) / (lifts.length - 1)
  }
  const bands = [...new Set(cols.map((c) => c.band))].map((name, i) => ({ name, hue: name === "Overall" ? 224 : HUES[(i - 1) % HUES.length] }))
  return {
    rows: arms.map((arm) => arm.name),
    columns: cols.map((c) => ({ band: c.band, label: c.label })),
    bands,
    cells: arms.map((arm) => cols.map((c) => depth(c.lift(arm)))),
    readout: cols.map((c) => [`${c.band} · ${c.label}`, ...arms.map((arm) => c.line(arm))]),
  }
}

/** A chart's figures as rows, for its block's Download. */
export function rowsOf(spec: BarSpec): Record<string, string | number | null>[] {
  return spec.rows.flatMap((r) => spec.panels.map((p, i) => ({ row: r.label, panel: p.title, value: r.cells[i]?.value ?? null, label: r.cells[i] ? `${r.cells[i]!.text}${r.cells[i]!.note ? ` · ${r.cells[i]!.note}` : ""}` : null })))
}

/** The wave's every subgroup along one axis: the overall level, then each dimension's categories, each
 *  arm's level a line (the placebo's first), with the cells a video won against the placebo marked. */
export function subgroupLinesSpec(rs: ResultSet, ballot = "ballot"): LinesSpec | null {
  const placebo = placeboOf(rs)
  if (!placebo) return null
  const arms = [placebo, ...treatmentsOf(rs)]
  const columns: LinesSpec["columns"] = [{ band: "Overall", label: "Everyone" }]
  const bands: LinesSpec["bands"] = [{ name: "Overall", from: 0, to: 0 }]
  const values = arms.map((arm) => [toplineOf(rs, arm.id, ballot)?.levelPct ?? null])
  const marks = arms.map((arm) => [toplineOf(rs, arm.id, ballot)?.verdict === "detectable"])
  for (const d of rs.dimensions) {
    const band = SHORT[d.id] ?? d.name.replace(/\s*\(.*\)$/, "").split(" ")[0]
    const from = columns.length
    for (const cat of d.categories) {
      if (!cellOf(rs, d.id, cat.id, placebo.id, ballot)) continue
      columns.push({ band, label: cat.name })
      arms.forEach((arm, k) => {
        const c = cellOf(rs, d.id, cat.id, arm.id, ballot)
        values[k].push(c?.levelPct ?? null)
        marks[k].push(!!c?.significant && arm.role !== "placebo")
      })
    }
    if (columns.length > from) bands.push({ name: band, from, to: columns.length - 1 })
  }
  if (columns.length < 3) return null
  return { columns, bands, series: arms.map((arm, k) => ({ name: arm.role === "placebo" ? placeboName(arm) : arm.name, placebo: arm.role === "placebo", values: values[k], marks: marks[k] })) }
}
