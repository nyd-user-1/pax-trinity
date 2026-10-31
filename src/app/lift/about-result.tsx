"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { Check, ChartColumn, ChevronDown, CircleHelp, Loader2 } from "lucide-react"

import { Reveal } from "@/components/reveal"
import { cn } from "@/lib/utils"
import { RESULT_SETS } from "@/lib/results"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@govblock/ui/components/ny4/tooltip"

import { num, type SourceRow } from "../america-thinks/audience-data"
import { AD_INFO, adOffice, adWhen, adWhere, fielding, levelOf, metricShort, periodKey, POINT_LEFT, POINT_RIGHT, segOf, signed, significance, testOf, TRAIT_GROUPS, treatmentName, type AdInfo, type Pick } from "./lift-data"
import { APPEALS } from "./lift-marks"

// ECharts loads only when a benchmark card opens.
const DensityChart = dynamic(() => import("./density-chart").then((m) => m.DensityChart), { ssr: false, loading: () => <div className="h-[92px]" /> })

// Lift Analysis, Swayable's About Result (Brendan, 2026-10-28; renamed 2026-10-31): Analytics and, where a
// result has no open-ends (none has yet), an Explainer that says in sentences what Analytics shows; the
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
}: {
  pick: Pick
  /** Every folder read so far, by source; the pick is in `folder`. */
  files: Record<string, SourceRow[]>
  folder: string
  /** The rail's names for the folders. */
  folders: Record<string, string>
  complete: boolean
  place: (code: string) => string
}) {
  const [tab, setTab] = React.useState<"analytics" | "second">("analytics")
  // An archive ad has no open-ends; its second tab is its coded traits (Brendan, 2026-10-29).
  const ad = AD_INFO.get(pick.option)
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
    // Its own tooltip provider: in the shell's right panel it stands outside Lift's (the panel crashed on a Tooltip without one).
    <TooltipProvider delayDuration={0}>
    <div className="flex w-full flex-col pt-4">
      <div className="px-6">
        <div className="grid grid-cols-2 rounded-md bg-muted p-0.5 text-xs">
          {(["analytics", "second"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tab === t}
              onClick={() => setTab(t)}
              className={cn("rounded-[5px] py-1 transition-colors", tab === t ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground")}
            >
              {t === "analytics" ? "Analytics" : ad ? "Traits" : "Explainer"}
            </button>
          ))}
        </div>
      </div>

      {tab === "second" ? (
        ad ? (
          <AdTraits ad={ad} />
        ) : (
          <Explainer
            name={treatmentName(lift[4] ?? "")}
            metric={metricShort(pick.metric)}
            segment={pick.segName}
            delta={delta}
            moe={lift[9]}
            z={z}
            level={level}
            control={control}
            n={lift[11] ?? null}
            nControl={control?.[11] ?? null}
            pools={complete ? pools : null}
            ranked={ranked}
            self={lift[4]}
          />
        )
      ) : (
        <>
          <div className="px-6 pt-4 pb-4">
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

          <section className="border-t px-6 py-4">
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

          <section className="border-t px-6 py-4">
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

          <div className="mt-auto border-t px-6 py-3 text-[11.5px] leading-5 text-muted-foreground">
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
    </div>
    </TooltipProvider>
  )
}

const points = (x: number) => `${num(Math.abs(x))} ${num(Math.abs(x)) === "1" ? "point" : "points"}`
const listed = (xs: string[]) => (xs.length < 3 ? xs.join(" and ") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`)

/** The second tab where a result has no open-ends (Brendan, 2026-10-31): what Analytics shows, in sentences, from
 *  the same figures (the means, the impact and its interval, the benchmarks, the test's ranking). */
function Explainer({
  name,
  metric,
  segment,
  delta,
  moe,
  z,
  level,
  control,
  n,
  nControl,
  pools,
  ranked,
  self,
}: {
  name: string
  metric: string
  segment: string
  delta: number
  moe: number | null
  z: number | null
  level: SourceRow | null | undefined
  control: SourceRow | null | undefined
  n: number | null
  nControl: number | null
  /** Null while the folders are still being read. */
  pools: { name: string; values: number[] }[] | null
  ranked: SourceRow[]
  self: string | null
}) {
  const who = segment === "Everyone" ? "everyone" : segment
  const moved = delta === 0 ? `left ${metric} unchanged among ${who}` : `${delta > 0 ? "raised" : "lowered"} ${metric} by ${points(delta)} among ${who}`
  const paras: string[] = []

  const sample = n != null ? ` ${num(n, 0)} people saw it${nControl != null ? `; ${num(nControl, 0)} were in the control group` : ""}.` : ""
  paras.push(control && level ? `${name} ${moved}: ${levelOf(control)} in the control group, ${levelOf(level)} among those who saw it.${sample}` : `${name} ${moved}.${sample}`)

  if (moe != null) {
    const lo = delta - moe
    const hi = delta + moe
    const p = z != null ? pOf(z) : null
    paras.push(
      lo <= 0 && hi >= 0
        ? `At 90% confidence the effect lies between ${signed(lo)} and ${signed(hi)} points. That range includes zero, so the test can't tell this effect from none.`
        : `At 90% confidence the effect lies between ${signed(lo)} and ${signed(hi)} points. The whole range is ${delta > 0 ? "above" : "below"} zero${p != null ? ` (p ${p < 0.001 ? "< 0.001" : `= ${p.toFixed(3)}`})` : ""}, so chance is an unlikely explanation.`
    )
  }

  // Five results are the fewest the benchmarks place among, as on the Analytics tab. The pools nest, so one the
  // size of the pool before it is the same pool (the Archive holds no Support): it is said once.
  const placed = (pools ?? []).filter((b, i, all) => b.values.length >= 5 && b.values.length !== all[i - 1]?.values.length).map((b) => `${Math.round(percentile(b.values, delta))}% of the ${num(b.values.length, 0)} in ${b.name === "All tests" ? "all tests" : b.name === "This test" ? "this test" : b.name}`)
  if (placed.length) paras.push(`Against other results on ${metric} among ${who}, it's ahead of ${listed(placed)}.`)

  const at = ranked.findIndex((r) => r[4] === self)
  if (ranked.length > 1 && at >= 0) {
    const nameOf = (r: SourceRow) => treatmentName(r[4] ?? "")
    paras.push(
      at === 0
        ? `It's the strongest of the ${ranked.length} treatments in this test, ${points(delta - ranked[1][7])} ahead of ${nameOf(ranked[1])}.`
        : `It ranks ${at + 1} of ${ranked.length} treatments in this test; ${nameOf(ranked[0])} leads it by ${points(ranked[0][7] - delta)}.`
    )
  }

  return (
    <div className="flex flex-col gap-3 px-6 py-4 text-[13px] leading-6">
      {paras.map((t) => (
        <p key={t}>{t}</p>
      ))}
    </div>
  )
}

/** The result on the metric's 0–100 line: the arrow runs from the control group's level by the impact. */
function Scale({ control, delta, quiet }: { control: number; delta: number; quiet: boolean }) {
  const c = Math.min(100, Math.max(0, control))
  const t = Math.min(100, Math.max(0, control + delta))
  const up = delta >= 0
  return (
    <div>
      {/* Keyed by the result, so a new pick grows in again. */}
      <Reveal key={`${control}:${delta}`} className="relative h-5 text-xs tabular-nums">
        <span
          aria-hidden
          className={cn("absolute bottom-1 h-[11px]", up ? "grow-x" : "grow-x-neg", quiet ? "bg-muted-foreground/25" : up ? "bg-pax2-light-blue" : "bg-pax2-red")}
          style={{ left: `${Math.min(c, t)}%`, width: `max(5px, ${Math.abs(t - c)}%)`, clipPath: up ? POINT_RIGHT : POINT_LEFT }}
        />
        <span className={cn("grow-in absolute bottom-0.5 font-semibold", quiet ? "text-muted-foreground" : !up && "text-pax2-red")} style={up ? { left: `calc(${t}% + 4px)` } : { right: `calc(${100 - t}% + 4px)` }}>
          {signed(delta)}
        </span>
        <span className="absolute bottom-0.5 text-muted-foreground" style={up ? { right: `calc(${100 - c}% + 4px)` } : { left: `calc(${c}% + 4px)` }}>
          {num(control)}
        </span>
      </Reveal>
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

/** An archive ad's coded profile: where and when it ran, then every trait group with what it carries checked,
 *  and the eight emotions' ratings, the archive coders' (0 to 1, full strength at 0.5). */
function AdTraits({ ad }: { ad: AdInfo }) {
  return (
    <div className="px-6 pt-3 pb-4 text-[13px]">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4">
        {(
          [
            ["Office", adOffice(ad)],
            ["State", adWhere(ad)],
            ["Tested", adWhen(ad)],
            ["Test", `Ad ${ad.ad} of ${ad.ads}`],
          ] as const
        ).map(([k, v]) => (
          <React.Fragment key={k}>
            <dt className="border-b py-1.5 text-muted-foreground">{k}</dt>
            <dd className="border-b py-1.5">{v}</dd>
          </React.Fragment>
        ))}
      </dl>
      {TRAIT_GROUPS.filter((g) => !["Race", "Cycle", "Emotional appeal"].includes(g.name)).map((g) => (
        <section key={g.name} className="mt-3">
          <h4 className="mb-1 text-xs font-semibold">{g.name}</h4>
          <ul className="grid grid-cols-2 gap-x-3">
            {g.traits.map((t) => {
              const has = t.has(ad)
              return (
                <li key={t.key} className={cn("flex items-center gap-1.5 py-0.5", !has && "text-muted-foreground/50")}>
                  {has ? <Check aria-label="Carries it" className="size-3.5 shrink-0" /> : <span aria-hidden className="w-3.5 shrink-0" />}
                  {t.name}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      <section className="mt-3">
        <h4 className="mb-1 text-xs font-semibold">Emotional appeal</h4>
        {APPEALS.map((e, k) => {
          const v = Math.max(0, Math.min(1, ad.emotions[e.key] ?? 0))
          return (
            <div key={e.key} className="flex items-center gap-2 py-0.5" style={{ "--i": k } as React.CSSProperties}>
              <span className={cn("w-20 shrink-0", v < 0.5 && "text-muted-foreground")}>{e.name}</span>
              <Reveal key={v} as="span" className="h-2 flex-1 rounded-full bg-muted">
                <span className="grow-x block h-full rounded-full" style={{ width: `${v * 100}%`, background: e.color }} />
              </Reveal>
              <span className="w-8 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{num(v, 2)}</span>
            </div>
          )
        })}
      </section>
    </div>
  )
}
