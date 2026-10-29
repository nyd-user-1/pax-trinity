"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { ChartColumn, ChevronDown, CircleHelp, Loader2, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { RESULT_SETS } from "@/lib/results"
import { Tooltip, TooltipContent, TooltipTrigger } from "@govblock/ui/components/ny4/tooltip"

import { num, type SourceRow } from "../america-thinks/audience-data"
import { fielding, levelOf, metricShort, periodKey, POINT_LEFT, POINT_RIGHT, segOf, signed, significance, testOf, treatmentName, type Pick } from "./lift-data"

// ECharts loads only when a benchmark card opens.
const DensityChart = dynamic(() => import("./density-chart").then((m) => m.DensityChart), { ssr: false, loading: () => <div className="h-[92px]" /> })

// Swayable's About Result (Brendan, 2026-10-28): Analytics and Open-ends; the
// result on a 0–100 line from its control group's level; the treatment and
// control groups' means and sizes, the impact with its strength and its
// interval; three benchmarks, each a quintile of a pool of lifts (every ad,
// the metric's ads, the test's own); and the test's treatments ranked. A
// figure the export does not carry reads as a dash.

const ORDINAL = ["1st", "2nd", "3rd", "4th", "5th"]
const QUINTILE = ["bg-red-500", "bg-orange-400", "bg-yellow-400", "bg-green-500", "bg-green-700"]

/** Where x falls among values: the percent below it, ties counted half (audience/api.py's place_lift). */
function percentile(values: number[], x: number) {
  let below = 0
  let tie = 0
  for (const v of values) {
    if (v < x) below++
    else if (v === x) tie++
  }
  return (100 * (below + tie / 2)) / values.length
}

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** A two-sided p from z, through erf (Abramowitz and Stegun 7.1.26). */
function pOf(z: number) {
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return 1 - erf
}

export function AboutResult({
  pick,
  files,
  folder,
  folders,
  complete,
  place,
  onClose,
}: {
  pick: Pick
  /** Every folder read so far, by source; the pick is in `folder`. */
  files: Record<string, SourceRow[]>
  folder: string
  /** The rail's names for the folders. */
  folders: Record<string, string>
  complete: boolean
  place: (code: string) => string
  onClose: () => void
}) {
  const [tab, setTab] = React.useState<"analytics" | "open-ends">("analytics")
  const { lift, level, control } = pick.cell
  const delta = lift[7]
  // The export's margin is 1.645 standard errors, a 90% interval.
  const z = lift[9] ? Math.abs(delta) / (lift[9] / 1.645) : null

  // Three nested pools, all on the pick's metric and segment (Swayable's All Brands, Financial Services, Chime
  // Ads): every folder, the pick's folder, its own test.
  const { pools, ranked } = React.useMemo(() => {
    const test = testOf(lift)
    const ofPick = (rs: SourceRow[]) => rs.filter((r) => r[8] === "lift_pp" && r[4] != null && r[0] === pick.metric && segOf(r) === pick.seg)
    const all = Object.values(files).flatMap(ofPick)
    const own = ofPick(files[folder] ?? [])
    const inTest = own.filter((r) => testOf(r) === test)
    return {
      pools: [
        { name: "All tests", values: all.map((r) => r[7]) },
        { name: folders[folder] ?? folder, values: own.map((r) => r[7]) },
        { name: "This test", values: inTest.map((r) => r[7]) },
      ],
      ranked: [...inTest].sort((a, b) => b[7] - a[7]),
    }
  }, [files, folder, folders, pick, lift])

  // What the results register knows of a PAX wave's arm: its line (producer, length, the printed note) and the
  // wave's pairings that name it. Archive picks have no register entry.
  const register = React.useMemo(() => {
    const set = RESULT_SETS.find((rs) => `${rs.fielded.start}|${rs.fielded.end}` === periodKey(lift))
    const arm = set?.arms.find((a) => a.name === treatmentName(lift[4] ?? ""))
    if (!set || !arm) return null
    return {
      arm: [arm.producer, arm.durationSeconds != null ? `${Math.round(arm.durationSeconds)}s` : null, arm.note].filter(Boolean).join(" · ") || null,
      pairings: set.pairings.filter((p) => p.armIds.includes(arm.id)).map((p) => `Pairing #${p.rank}: ${p.audience} — ${p.finding}`),
    }
  }, [lift])

  return (
    <aside className="flex h-full w-full flex-col overflow-y-auto rounded-2xl border border-slate-500 bg-background shadow-e2">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h3 className="text-sm font-semibold">About Result</h3>
        <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>

      <div className="px-4">
        <div className="grid grid-cols-2 rounded-md bg-muted p-0.5 text-xs">
          {(["analytics", "open-ends"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
              className={cn("rounded-[5px] py-1 transition-colors", tab === t ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {t === "analytics" ? "Analytics" : "Open-ends"}
            </button>
          ))}
        </div>
      </div>

      {tab === "open-ends" ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing on file.</p>
      ) : (
        <>
          <div className="px-4 pt-4 pb-4">
            {control && <Scale control={control[7]} delta={delta} quiet={significance(lift) === false} />}
            <div className={cn("grid grid-cols-[1fr_88px_72px] items-center gap-x-3 gap-y-2.5 text-[13px]", control && "mt-4")}>
              <span />
              <span className="text-xs leading-4 font-medium">
                Treatment
                <br />
                Group
              </span>
              <span className="text-xs leading-4 text-muted-foreground">
                Control
                <br />
                Group
              </span>
              <span className="col-span-3 -my-1 border-t" />
              <span>Mean</span>
              <span className="font-semibold tabular-nums">{level ? levelOf(level) : "—"}</span>
              <span className="text-muted-foreground tabular-nums">{control ? levelOf(control) : "—"}</span>
              <span>Sample Size</span>
              <span className="font-semibold tabular-nums">{lift[11] != null ? num(lift[11], 0) : "—"}</span>
              <span className="text-muted-foreground tabular-nums">{control?.[11] != null ? num(control[11], 0) : "—"}</span>
              <span>Impact</span>
              <span className="flex items-center gap-1.5 font-semibold tabular-nums">
                {signed(delta)}
                {z != null && <Strength z={z} />}
              </span>
              <span />
              <span>Confidence Interval</span>
              <span className="flex items-center gap-1.5 font-semibold tabular-nums">
                {lift[9] != null ? (
                  <>
                    ±{num(lift[9])}
                    <Help text="A 90% interval: the impact plus or minus 1.645 standard errors." />
                  </>
                ) : (
                  "—"
                )}
              </span>
              <span />
            </div>
          </div>

          <section className="border-t px-4 py-4">
            <h4 className="mb-3 text-[13px] font-semibold">Benchmarks</h4>
            {complete ? (
              <div className="flex flex-col gap-2">
                {pools.map((p) => (
                  <Benchmark key={p.name} name={p.name} values={p.values} x={delta} moe={lift[9]} context={{ metric: metricShort(pick.metric), segment: pick.segName, geography: place(lift[1]) }} />
                ))}
              </div>
            ) : (
              <p className="py-2 text-center text-xs text-muted-foreground">
                <Loader2 aria-hidden className="mr-1.5 inline size-3.5 animate-spin" />
                Reading every folder…
              </p>
            )}
          </section>

          <section className="border-t px-4 py-4">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-[13px] font-semibold">Compare Rank</h4>
              <Help text="Every treatment in the same test on this metric and segment, by impact. Difference is its impact less this one's." />
            </div>
            <div className="flex justify-between border-b pb-1.5 text-xs text-muted-foreground">
              <span>Treatment</span>
              <span>Difference</span>
            </div>
            {ranked.map((r, i) => {
              const self = r[4] === lift[4]
              return (
                <div key={r[4]} className={cn("flex items-center gap-2 border-b py-1.5 text-[13px] last:border-b-0", self && "font-semibold")}>
                  <span className="w-5 shrink-0 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{treatmentName(r[4] ?? "")}</span>
                  <span className="shrink-0 tabular-nums">{self ? "—" : signed(r[7] - delta)}</span>
                </div>
              )
            })}
          </section>

          <div className="mt-auto border-t px-4 py-3 text-[11.5px] leading-5 text-muted-foreground">
            <p>
              {place(lift[1])} · {fielding(lift[2], lift[3])}
            </p>
            {register && (
              <>
                {register.arm && <p>{register.arm}</p>}
                {register.pairings.map((line) => (
                  <p key={line} className="mt-1">
                    {line}
                  </p>
                ))}
              </>
            )}
            {lift[4] !== treatmentName(lift[4] ?? "") && <p>{lift[4]}</p>}
            {lift[12] &&
              (lift[12].startsWith("http") ? (
                <a href={lift[12]} target="_blank" rel="noreferrer" className="break-all underline-offset-2 hover:underline">
                  {lift[12]}
                </a>
              ) : (
                <p className="break-all">{lift[12]}</p>
              ))}
          </div>
        </>
      )}
    </aside>
  )
}

/** The result on the metric's 0–100 line: the arrow runs from the control group's level by the impact. */
function Scale({ control, delta, quiet }: { control: number; delta: number; quiet: boolean }) {
  const c = Math.min(100, Math.max(0, control))
  const t = Math.min(100, Math.max(0, control + delta))
  const up = delta >= 0
  return (
    <div>
      <div className="relative h-5 text-xs tabular-nums">
        <span
          aria-hidden
          className={cn("absolute bottom-1 h-[11px]", quiet ? "bg-muted-foreground/25" : up ? "bg-pax2-light-blue" : "bg-pax2-red")}
          style={{ left: `${Math.min(c, t)}%`, width: `max(5px, ${Math.abs(t - c)}%)`, clipPath: up ? POINT_RIGHT : POINT_LEFT }}
        />
        <span className={cn("absolute bottom-0.5 font-semibold", quiet ? "text-muted-foreground" : !up && "text-pax2-red")} style={up ? { left: `calc(${t}% + 4px)` } : { right: `calc(${100 - t}% + 4px)` }}>
          {signed(delta)}
        </span>
        <span className="absolute bottom-0.5 text-muted-foreground" style={up ? { right: `calc(${100 - c}% + 4px)` } : { left: `calc(${c}% + 4px)` }}>
          {num(control)}
        </span>
      </div>
      <div className="h-0.5 rounded-full bg-linear-to-r from-pax2-red/70 to-pax2-light-blue" />
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground tabular-nums">
        {Array.from({ length: 11 }, (_, i) => (
          <span key={i} className="flex w-0 justify-center">
            {i * 10}
          </span>
        ))}
      </div>
    </div>
  )
}

/** The impact's strength as four bars: lit at p < .10, .05 and .01 beyond the first. */
function Strength({ z }: { z: number }) {
  const lit = z >= 2.576 ? 4 : z >= 1.96 ? 3 : z >= 1.645 ? 2 : 1
  const p = pOf(z)
  return (
    <span title={p < 0.001 ? "p < 0.001" : `p = ${p.toFixed(3)}`} className="inline-flex items-end gap-[1.5px]">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className={cn("w-[2.5px] rounded-[0.5px]", i < lit ? "bg-foreground" : "bg-muted-foreground/25")} style={{ height: 4 + i * 2.5 }} />
      ))}
    </span>
  )
}

type Context = { metric: string; segment: string; geography: string }

function Benchmark({ name, values, x, moe, context }: { name: string; values: number[]; x: number; moe: number | null; context: Context }) {
  const [open, setOpen] = React.useState(false)
  // Five quintiles need five ads to place among.
  const pct = values.length >= 5 ? percentile(values, x) : null
  const q = pct == null ? null : Math.min(5, Math.floor(pct / 20) + 1)
  return (
    <div className="rounded-lg border">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
        <ChartColumn aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 text-[13px] font-medium">{name}</span>
        {q != null ? (
          <span className="flex shrink-0 flex-col items-end gap-0.5">
            <span className="text-[13px]">{q === 5 ? "Top" : ORDINAL[q - 1]} Quintile</span>
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground tabular-nums">
              {(q - 1) * 20} – {q * 20}%
              <span className="flex gap-[1.5px]">
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className={cn("h-2.5 w-[3px] rounded-[1px]", i <= q ? QUINTILE[q - 1] : "bg-muted-foreground/20")} />
                ))}
              </span>
            </span>
          </span>
        ) : (
          <span className="text-[13px] text-muted-foreground">—</span>
        )}
        <ChevronDown aria-hidden className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && values.length > 0 && (
        <div className="border-t px-3 pt-3 pb-2.5">
          {pct != null && <DensityChart values={values} x={x} moe={moe} />}
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 text-[13px]">
            <dt className="border-b py-2">Impact from Treatment</dt>
            <dd className="border-b py-2 text-right tabular-nums">
              {signed(x)} pts
              {moe != null && <span className="block text-[11px] text-muted-foreground">±{num(moe)}</span>}
            </dd>
            <dt className="py-2">Median Impact in Benchmark</dt>
            <dd className="py-2 text-right tabular-nums">{signed(median(values))} pts</dd>
          </dl>
          <p className="mt-2 mb-1 text-xs text-muted-foreground">About Comparable Set</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 text-xs">
            {(
              [
                ["Set", name],
                ["Geography", context.geography],
                ["Metric", context.metric],
                ["Segment", context.segment],
                ["Ads", values.length.toLocaleString("en-US")],
              ] as const
            ).map(([k, v]) => (
              <React.Fragment key={k}>
                <dt className="border-t py-1.5 text-muted-foreground">{k}</dt>
                <dd className="border-t py-1.5">{v}</dd>
              </React.Fragment>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}

function Help({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={text} className="text-muted-foreground hover:text-foreground">
          <CircleHelp className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{text}</TooltipContent>
    </Tooltip>
  )
}
