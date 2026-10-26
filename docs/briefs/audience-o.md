# Brief O — The question chart, ECharts over the bank

You are the audience-i window, taking Brief O. Ground rules as before: commit locally per feature, never push; stage by explicit path, never `-A`. Yours this time: `src/app/inbox-2/question-chart.tsx` (one new file) and this file's Worker report — nothing else anywhere. Never run tsc, a Next build, or a second dev server on this 8GB Mac; verify in Node and by reading against the references. Report with hashes below; rulings to the lead session.

## What this is

Every question in the bank carries a trend — waves back to 1948 for ANES, 1972 for GSS — that the crosstab shows as a table. This brief draws it: one ECharts line chart, one line per answer option across the waves, the chart every pollster puts in a report. The lead mounts it as a third position on the question view's toggle (Crosstab | Chart | Tidy data) after your report lands; you build only the component.

Read first: `src/app/inbox-2/question-table.tsx` (the view you're feeding; its `tab` memo shows how toplines, waves and options are derived from rows), `src/app/audience/audience-data.ts` (SourceRow's 13 elements, MetricInfo, num/year/value), and — read-only, the house's ECharts dress — `/Users/brendanstanton/Code/pax2/src/components/viometrics/charts.tsx`.

## The contract

```ts
export function QuestionChart({ rows, info, title, place }: {
  /** The question's rows alone, already filtered by the caller. */
  rows: SourceRow[]
  info: MetricInfo
  title: string
  place: (code: string) => string
})
```

The lead wraps the file in `next/dynamic` with ssr off; export nothing else.

## The chart

- **Series:** one line per answer option, toplines only (no subgroup, at `info.baseGeo`), x = wave year, y = share. Options in their recorded order; a question over 8 options charts the top 8 by latest value with a quiet line underneath saying so, the crosstab's own cap convention.
- **Tooltip:** the wave, then each option's share with ± its margin and the unweighted n once per wave. **Legend** on top; clicking isolates, ECharts' default.
- **Types:** `pct` charts 0–100 or auto within the data's span, whichever reads better at typical spans; `count` charts absolute with compact axis labels; `lift_pp` and single-wave questions are not this chart's job — render a quiet "No trend to draw" line so a wrong mount fails soft.
- **Dress:** the pax2 tokens the surface already wears — pax2-blue family for lines, mist gridlines, the app's font. Match /viometrics' register, not its content. Height around 380, width filling the pane, resizing with it.

## Lightweight is the brief

ECharts is already a dependency; the full build is about a megabyte and must never ride any page. Import from `echarts/core` and register only LineChart, GridComponent, TooltipComponent, LegendComponent and CanvasRenderer. Static imports inside your file are right — the lead's dynamic mount keeps the whole chunk off every route until someone clicks Chart. Add nothing to package.json. `init` on mount, `dispose` on unmount, one ResizeObserver.

## Done means

The one file, compiling clean (single-file transpile), its series math verified in Node against a real question's rows (fetch one source file from `https://pax-trinity-audience-638175140432.s3.amazonaws.com/exports/` for the check), the cap and tooltip rules in place; report with hashes below.

---

## Worker report

(appended by the worker)

### Landed

`77dc188`: `src/app/inbox-2/question-chart.tsx`, exporting `QuestionChart` alone, to the contract. Nothing else moved.

- **Series:** one line per answer option, in recorded order. Points are toplines at `info.baseGeo`, filtered to `info.type`. Each wave's point is the row the crosstab's trend cell reads: the latest `period_end` within the year.
- **Cap:** a question with more than 8 options charts the 8 highest at their latest wave, still in recorded order. A quiet line underneath reads "The first 8 of N options by the latest value."
- **Nothing to draw:** a `lift_pp` question, or one with fewer than two waves, renders "No trend to draw".
- **Tooltip:** the wave, then each visible option's value with its ± margin, then the unweighted n once. Option labels go in through `textContent`, never as HTML.
- **Legend:** on top, and clicking a name isolates its line; clicking the lone line again brings them all back. ECharts' default click *hides* the clicked line, the opposite of isolating, so I built isolate myself.
- **Y axis:** shares keep a zero baseline. They top out at 100 once any line passes 60, otherwise at the next ten above the peak, so a 2–8% option isn't flattened against a 0–100 frame. Counts get compact labels (500K, 1.5M).
- **Dress:**
  - Lines use a pax2-blue ramp, dark to light, anchored on pax2-blue `#1e3a8a` and chart-2 `#60a5fa`. Up to six options start at pax2-blue.
  - The ramp passes the dataviz validator's ordinal checks on white: lightness monotone, every step 0.067 apart, the light end at 2.5:1.
  - Each line also gets its own marker shape, so no line is told apart by color alone.
  - End-of-line value labels show on up to four lines and drop where two would collide.
  - Gridlines are mist, axis text muted, the app's font is read off the page, and the chart is 380 high, filling the pane.
- **Weight:** `echarts/core` with LineChart, GridComponent, TooltipComponent, LegendComponent and CanvasRenderer only. `init` on mount, `dispose` on unmount, one ResizeObserver. Nothing added to package.json.

### Checks

- **Single-file transpile** (TypeScript `transpileModule`): 0 diagnostics. The type-only imports drop out.
- **Node, against `exports/gss.json` and `exports/ma_enrollment.json` from the bucket:**
  - ABANY: 29 waves, 1977–2024. 2024 reads Yes 58.3 ± 2.5, No 41.7 ± 2.5, n 2,140. Tooltip text: "2024 58.3% ± 2.5 Yes 41.7% ± 2.5 No n 2,140".
  - AIDSREG: 10 options; it keeps the top 8 and drops Foreign and W. nor. central.
  - ABBELIEF (one wave) and a lift both return nothing to draw.
  - MA `registration_by_party` charts counts over 10 waves with compact labels.
  - Every question in the GSS part: 140 drawn (7 capped) and 278 with nothing to draw. Every drawn point matches an independent read of the rows.

### For the lead

1. **Mounting:** the component pads itself `px-5 pt-5`, matching the crosstab's `p-5`, so it can go straight under the toggle.
2. **Counts versus shares:** CPS and MA enrollment carry both count and pct rows. `info.type` reads `count` for them, because count sorts first in the file, so their charts draw counts, as the crosstab's cells do. If you'd rather show shares there, it's a one-line change.
3. **Unordered options:** answer options that aren't a scale (regions, denominations) get the same one-hue ramp as scales. Shapes, the legend and the tooltip carry their identity. Giving them separate hues would need a scale-or-not flag, which the export doesn't carry.
4. **Dark mode:** the colors are validated for light mode only.
