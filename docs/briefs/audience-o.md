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
