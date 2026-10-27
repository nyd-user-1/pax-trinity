"use client"

import * as React from "react"
import Link from "next/link"
import { Check, Copy } from "lucide-react"

import { readDraft } from "@/lib/consensus/draft"
import { cn } from "@/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"

import { dimLabel, mnemonicOf, num, shortSource, WORDING, type SourceRow } from "../../../audience/audience-data"
import { Card, CardLabel, Gap, pillClass, Tag } from "../../../_wire/wire-bits"
import {
  bandOf,
  baseGeoOf,
  baseWave,
  dashed,
  dossierHref,
  fmt,
  fmtPct,
  loadRows,
  one,
  ordinal,
  rawHref,
  seriesOf,
  shortGeo,
  signed,
  useWireIndex,
  type Band,
  type Point,
} from "../../../_wire/wire-data"

// /q/[source]/[id] — one question's dossier, as Brendan drew it
// (docs/wireframes/question-dossier.png), in one column since his revision
// (pass 2, 2026-10-27, pass2-124): the trend by wave, the headline sentence,
// the latest wave's crosstab, then the related constructs, uses and
// provenance under them. Every clause is composed from the question's own
// rows; one that cannot be computed is left out, the trend whole when fewer
// than two waves stand. The three blocks copy their text from a hover button.

/** Sources whose rows are a general-population survey: their shares read "of Americans". */
const ATTITUDE = new Set(["GSS", "ANES", "CES"])
/** The loader module that writes a source's rows, where exactly one does. */
const LOADER: Record<string, string> = { GSS: "gss", ACS: "acs", CVAP: "cvap", CPS: "cps", MA_ENROLLMENT: "ma_enrollment", LIFT_ARCHIVE: "lift_archive", PAX_TEST: "pax_tests" }
/** Ordinal orders for breakdowns the export files alphabetically. */
const VALUE_ORDER: Record<string, string[]> = { educ: ["HS or less", "Some college", "BA", "Grad"] }

export function Dossier({ source, id }: { source: string; id: string }) {
  const SRC = source.toUpperCase()
  const { index, error } = useWireIndex()
  const [rows, setRows] = React.useState<SourceRow[] | null>(null)
  const [rowsError, setRowsError] = React.useState<string | null>(null)
  const [pick, setPick] = React.useState<string | null>(null)

  React.useEffect(() => {
    let on = true
    setRows(null)
    setRowsError(null)
    loadRows(SRC, id)
      .then((r) => on && setRows(r))
      .catch((e: Error) => on && setRowsError(e.message))
    return () => {
      on = false
    }
  }, [SRC, id])

  const geoName = React.useMemo(() => new Map((index?.geographies ?? []).map((g) => [g.code, g.name])), [index])
  const geoLevel = React.useMemo(() => new Map((index?.geographies ?? []).map((g) => [g.code, g.level])), [index])
  const construct = React.useMemo(() => index?.constructs.find((c) => c.construct === id) ?? null, [index, id])
  const label = construct?.label ?? id
  const wording = construct?.wording ?? WORDING[id] ?? null

  const baseGeo = React.useMemo(() => (rows ? baseGeoOf(rows, (c) => (c === "US" ? "US" : geoLevel.get(c))) : "US"), [rows, geoLevel])
  const geo = pick ?? baseGeo
  const band = React.useMemo(() => (rows ? bandOf(id, rows, baseGeo) : null), [rows, id, baseGeo])
  const total = React.useMemo(() => (rows && band ? seriesOf(rows, band, geo) : []), [rows, band, geo])
  const latest = total[total.length - 1] ?? null
  const base = baseWave(total)
  const place = geo === "US" ? "the United States" : (geoName.get(geo) ?? geo)

  if (rowsError)
    return (
      <div className="mx-auto w-full max-w-[1400px] p-6" data-dossier={`${SRC.toLowerCase()}/${id}`}>
        <Card>
          <p className="text-sm text-muted-foreground" title={rowsError}>
            No question {id} in {shortSource(SRC)}.
          </p>
        </Card>
      </div>
    )

  return (
    <div className="mx-auto flex w-full max-w-[920px] flex-col gap-5 p-6" data-dossier={`${SRC.toLowerCase()}/${id}`}>
      <div className="flex min-w-0 flex-col gap-5">
        {/* The trend stands only where it can draw: two waves or more (a skeleton while the rows come). */}
        {!rows ? (
          <Card>
            <CardLabel>Trend</CardLabel>
            <div className="h-[190px] animate-pulse rounded-md bg-muted/50" />
          </Card>
        ) : (
          total.length > 1 &&
          latest && (
            <Copyable>
              <Card>
                <CardLabel>Trend</CardLabel>
                <TrendBars points={total} />
                <TrendNotes total={total} base={base} latest={latest} />
              </Card>
            </Copyable>
          )
        )}

        {latest && band ? (
          <Copyable>
            <Card>
              <Headline source={SRC} label={label} wording={wording} band={band} geo={geo} place={place} total={total} base={base} latest={latest} />
            </Card>
          </Copyable>
        ) : (
          <Card>
            <div className="h-16 animate-pulse rounded-md bg-muted/50" />
          </Card>
        )}

        {rows && band && latest ? (
          <Copyable>
            <Card>
              <CardLabel>
                Crosstab · {latest.year}
                {band.label ? ` · ${band.label}` : ""}
              </CardLabel>
              <Crosstab rows={rows} band={band} geo={geo} latest={latest} base={base} />
            </Card>
          </Copyable>
        ) : (
          <Card>
            <CardLabel>Crosstab</CardLabel>
            <div className="h-40 animate-pulse rounded-md bg-muted/50" />
          </Card>
        )}
      </div>

      <aside className="flex min-w-0 flex-col gap-5">
        {error && <p className="text-sm text-muted-foreground">{error}</p>}
        {index && <Related index={index} source={SRC} id={id} ownRows={rows} />}
        <UsedBy text={wording ?? label} ready={!!index} />
        <Card>
          <CardLabel>Provenance</CardLabel>
          <Provenance source={SRC} id={id} label={index?.sources.find((s) => s.source === SRC)?.label ?? null} rows={rows} />
        </Card>
        {index && rows && <Chips index={index} source={SRC} id={id} rows={rows} geo={geo} geoLevel={geoLevel} geoName={geoName} onGeo={setPick} />}
      </aside>
    </div>
  )
}

/** A block with the standard copy control: top right, on hover, its text to the clipboard. */
function Copyable({ children }: { children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [copied, setCopied] = React.useState(false)
  React.useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 1500)
    return () => window.clearTimeout(t)
  }, [copied])
  return (
    <div className="group/copy relative">
      <div ref={ref}>{children}</div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Copy"
        title="Copy"
        onClick={() => {
          const text = ref.current?.innerText ?? ""
          void navigator.clipboard.writeText(text).then(() => setCopied(true))
        }}
        className={cn("absolute top-3 right-3 opacity-0 group-hover/copy:opacity-100 focus-visible:opacity-100", copied && "opacity-100")}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </Button>
    </div>
  )
}

// ── Trend ────────────────────────────────────────────────────────────────

const BAR_H = 170

function TrendBars({ points }: { points: Point[] }) {
  const top = Math.max(...points.map((p) => p.v + (p.moe ?? 0))) || 1
  const last = points.length - 1
  // Axis years: the first and last waves, 2008 where it stands, and the wave nearest halfway to it.
  const marks = new Set<number>([0, last])
  const i08 = points.findIndex((p) => p.year === 2008)
  if (i08 > 0 && i08 < last) marks.add(i08)
  const mid = i08 > 0 ? (points[0].year + 2008) / 2 : (points[0].year + points[last].year) / 2
  const iMid = points.reduce((b, p, i) => (Math.abs(p.year - mid) < Math.abs(points[b].year - mid) ? i : b), 0)
  if ([...marks].every((m) => Math.abs(m - iMid) > 2)) marks.add(iMid)
  return (
    <div>
      <div className="flex items-end gap-[3px] border-b border-foreground/40" style={{ height: BAR_H }}>
        {points.map((p, i) => (
          <div
            key={p.year}
            className="relative flex-1"
            style={{ height: `${(p.v / top) * 100}%` }}
            title={`${p.year}: ${fmtPct(p.v, p.type)}${p.moe != null ? ` ±${one(p.moe)}` : ""}${p.n != null ? `, n ${num(p.n, 0)}` : ""}`}
          >
            <div className={cn("absolute inset-0 rounded-t-[2px]", i === last ? "bg-zinc-800" : "bg-zinc-400")} />
            {p.moe != null && p.moe > 0 && (
              <div
                className={cn("absolute left-1/2 w-px -translate-x-1/2", i === last ? "bg-white/60" : "bg-zinc-700/60")}
                style={{ bottom: `${100 - (p.moe / p.v) * 100}%`, height: `${((2 * p.moe) / p.v) * 100}%` }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="relative mt-1.5 h-4 text-[11px] text-muted-foreground tabular-nums">
        {[...marks].map((i) => (
          <span
            key={i}
            className="absolute"
            style={i === 0 ? { left: 0 } : i === last ? { right: 0 } : { left: `${((i + 0.5) / points.length) * 100}%`, transform: "translateX(-50%)" }}
          >
            {points[i].year}
          </span>
        ))}
      </div>
    </div>
  )
}

function TrendNotes({ total, base, latest }: { total: Point[]; base: Point | null; latest: Point }) {
  const hi = total.reduce((b, p) => (p.v > b.v ? p : b), total[0])
  const lo = total.reduce((b, p) => (p.v < b.v ? p : b), total[0])
  const t = latest.type
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm">
      <span className="flex items-center gap-2">
        <Tag className="text-[11px]">Observed</Tag>
        {base && (
          <span className="tabular-nums">
            {base.year}–{latest.year}: {fmt(base.v, t)} to {fmt(latest.v, t)} ({signed(latest.v - base.v)}
            {t === "pct" ? " pp" : ""})
          </span>
        )}
      </span>
      {total.length > 2 && (
        <span className="tabular-nums">
          Series high {hi.year} ({fmt(hi.v, t)}) · low {lo.year} ({fmt(lo.v, t)})
        </span>
      )}
      {total.length > 1 && total.some((p) => (p.moe ?? 0) > 0) && <span>MoE band drawn ±</span>}
    </div>
  )
}

// ── The headline sentence ────────────────────────────────────────────────

/** A band reads lowercase mid-sentence where its first word stands lowercase in the wording. */
function inSentence(band: string, wording: string | null) {
  const w = band.split(/\s+/)[0]
  if (!/^[A-Z][a-z]+$/.test(w) || !wording) return band
  return new RegExp(`\\b${w.toLowerCase()}\\b`).test(wording) ? band.charAt(0).toLowerCase() + band.slice(1) : band
}

function Headline({
  source,
  label,
  wording,
  band,
  geo,
  place,
  total,
  base,
  latest,
}: {
  source: string
  label: string
  wording: string | null
  band: Band
  geo: string
  place: string
  total: Point[]
  base: Point | null
  latest: Point
}) {
  const t = latest.type
  const b = <strong className="font-semibold">{inSentence(band.label, wording)}</strong>
  const v = <strong className="font-semibold">{fmtPct(latest.v, t)}</strong>
  // "Confidence in Congress" reads "confidence in Congress"; an acronym ("ACA support") keeps its case.
  const subject = /^[A-Z][a-z]/.test(label) ? label.charAt(0).toLowerCase() + label.slice(1) : label
  const lead = ATTITUDE.has(source) ? (
    <>
      On {subject}, {v} of {geo === "US" ? "Americans" : `people in ${place}`} answer {b}.
    </>
  ) : (
    <>
      On {subject}, {b} stands at {v} in {place}.
    </>
  )
  // Where the latest wave sits among all of them; ties count as one rank.
  const above = total.filter((p) => p.v > latest.v).length
  const below = total.filter((p) => p.v < latest.v).length
  const years = latest.year - total[0].year
  let sits: string | null = null
  if (total.length >= 3 && years > 0) {
    const series = `${years}-year series`
    if (above === 0) sits = `the highest level in the ${series}`
    else if (below === 0) sits = `the lowest level in the ${series}`
    else if (total.length < 6) sits = null
    else if (above < below) sits = `the ${ordinal(above + 1)}-highest of ${total.length} waves in the ${series}`
    else sits = `the ${ordinal(below + 1)}-lowest of ${total.length} waves in the ${series}`
  }
  let move: React.ReactNode = null
  if (base) {
    const d = latest.v - base.v
    const was = <strong className="font-semibold">{fmtPct(base.v, t)}</strong>
    move = Math.abs(d) < 0.05 ? <>unchanged from {was} in {base.year}</> : <>{d > 0 ? "up" : "down"} from {was} in {base.year}</>
  }
  return (
    <div>
      <p className="text-[22px] leading-snug">
        {lead}
        {(move || sits) && (
          <>
            {" "}
            That is {move}
            {move && sits ? " and " : ""}
            {sits}.
          </>
        )}
      </p>
      <p className="mt-3 text-sm text-muted-foreground tabular-nums">
        {[latest.span, latest.moe != null ? `±${one(latest.moe)}` : null, latest.n != null ? `n ${num(latest.n, 0)}` : null].filter(Boolean).join(", ")}
      </p>
    </div>
  )
}

// ── Crosstab ─────────────────────────────────────────────────────────────

function Crosstab({ rows, band, geo, latest, base }: { rows: SourceRow[]; band: Band; geo: string; latest: Point; base: Point | null }) {
  const lines = React.useMemo(() => {
    const dims: string[] = []
    const values = new Map<string, string[]>()
    for (const r of rows) {
      if (r[1] !== geo || !r[5] || !r[6]) continue
      if (!values.has(r[5])) dims.push(r[5]), values.set(r[5], [])
      const vs = values.get(r[5])!
      if (!vs.includes(r[6])) vs.push(r[6])
    }
    return dims.flatMap((d) => {
      const order = VALUE_ORDER[d]
      const vs = order ? [...values.get(d)!].sort((a, b) => (order.indexOf(a) + 99) % 99 - ((order.indexOf(b) + 99) % 99)) : values.get(d)!
      return vs.map((v) => {
        const s = seriesOf(rows, band, geo, d, v)
        return { key: `${d}:${v}`, name: /^\d/.test(v) ? `${dimLabel(d)} ${dashed(v)}` : `${dimLabel(d)} · ${dashed(v)}`, now: s.find((p) => p.year === latest.year) ?? null, then: base ? (s.find((p) => p.year === base.year) ?? null) : null }
      })
    })
  }, [rows, band, geo, latest.year, base])
  const t = latest.type
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm tabular-nums">
        <thead>
          <tr className="border-b border-foreground/30 text-left text-[13px] text-foreground/80">
            <th className="px-3 py-2 font-medium">Breakdown</th>
            <th className="px-3 py-2 font-medium">{band.label}</th>
            <th className="px-3 py-2 font-medium">vs total</th>
            <th className="px-3 py-2 font-medium">n</th>
            <th className="px-3 py-2 font-medium">{base ? `Trend since ${base.year}` : "Trend"}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b">
            <td className="px-3 py-2 font-semibold">Total</td>
            <td className="px-3 py-2">
              <Est p={latest} />
            </td>
            <td className="px-3 py-2 text-muted-foreground">—</td>
            <td className="px-3 py-2">{latest.n != null ? num(latest.n, 0) : "—"}</td>
            <td className="px-3 py-2">{base && <Dir d={latest.v - base.v} show type={t} />}</td>
          </tr>
          {lines.map((l) => (
            <tr key={l.key} className="border-b">
              <td className="px-3 py-2">{l.name}</td>
              <td className="px-3 py-2">{l.now ? <Est p={l.now} /> : <span className="text-muted-foreground">—</span>}</td>
              <td className="px-3 py-2">{l.now ? signed(l.now.v - latest.v) : ""}</td>
              <td className="px-3 py-2">{l.now?.n != null ? num(l.now.n, 0) : ""}</td>
              <td className="px-3 py-2">{l.now && l.then && <Dir d={l.now.v - l.then.v} type={t} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!lines.length && <p className="mt-3 text-xs text-muted-foreground">No breakdowns on file at this geography.</p>}
    </div>
  )
}

function Est({ p }: { p: Point }) {
  return (
    <span className={cn(p.summed && "cursor-help")} title={p.summed ? "A sum of the band's options; no margin" : undefined}>
      <span className="font-semibold">{fmt(p.v, p.type)}</span>
      {p.moe != null && <span className="ml-1 text-[11px] text-muted-foreground">±{one(p.moe)}</span>}
    </span>
  )
}

function Dir({ d, show, type }: { d: number; show?: boolean; type: string }) {
  const mark = Math.abs(d) < 0.05 ? "■" : d > 0 ? "▲" : "▼"
  return (
    <span title={`${signed(d)}${type === "pct" ? " pp" : ""}`}>
      <span className="text-[11px]">{mark}</span>
      {show && ` ${signed(d)}`}
    </span>
  )
}

// ── Rail ─────────────────────────────────────────────────────────────────

type IndexT = NonNullable<ReturnType<typeof useWireIndex>["index"]>

function Related({ index, source, id, ownRows }: { index: IndexT; source: string; id: string; ownRows: SourceRow[] | null }) {
  const geoLevel = React.useMemo(() => new Map(index.geographies.map((g) => [g.code, g.level])), [index])
  const family = React.useMemo(() => (index.families ?? []).find((f) => f.members.some((m) => m.question === id && (!m.source || m.source === source))) ?? null, [index, id, source])
  const items = React.useMemo(() => {
    if (!family) return []
    const out: { source: string; q: string; last: number | null; label: string }[] = []
    for (const m of family.members) {
      const homes = m.source ? [m.source] : index.questions?.filter((x) => x.question === m.question).map((x) => x.source) ?? []
      for (const s of homes.sort((a, b) => (a === source ? -1 : b === source ? 1 : a.localeCompare(b)))) {
        if (out.some((o) => o.source === s && o.q === m.question)) continue
        out.push({ source: s, q: m.question, last: index.questions?.find((x) => x.source === s && x.question === m.question)?.last ?? null, label: index.constructs.find((c) => c.construct === m.question)?.label ?? m.question })
      }
    }
    return out
  }, [family, index, source])
  const many = new Set(items.map((i) => i.source)).size > 1
  const [vals, setVals] = React.useState<Record<string, { v: number; type: string; band: string } | null>>({})

  React.useEffect(() => {
    let on = true
    for (const it of items) {
      const key = `${it.source}/${it.q}`
      const read = it.source === source && it.q === id ? (ownRows ? Promise.resolve(ownRows) : null) : loadRows(it.source, it.q)
      read
        ?.then((rs) => {
          const g = baseGeoOf(rs, (c) => (c === "US" ? "US" : geoLevel.get(c)))
          const band = bandOf(it.q, rs, g)
          const s = seriesOf(rs, band, g)
          const p = s[s.length - 1]
          if (on) setVals((prev) => ({ ...prev, [key]: p ? { v: p.v, type: p.type, band: band.label } : null }))
        })
        .catch(() => on && setVals((prev) => ({ ...prev, [key]: null })))
    }
    return () => {
      on = false
    }
  }, [items, source, id, ownRows, geoLevel])

  if (!family || items.length < 2) return null
  return (
    <Card>
      <CardLabel>Related constructs</CardLabel>
      <ul className="divide-y text-sm">
        {items.map((it) => {
          const key = `${it.source}/${it.q}`
          const self = it.source === source && it.q === id
          const val = vals[key]
          const name = (
            <>
              <span className={cn(self ? "font-semibold" : "font-medium")}>{mnemonicOf(it.q)}</span>
              {many && <span className="text-muted-foreground"> · {shortSource(it.source)}</span>}
              <span className="ml-1.5 text-muted-foreground">{it.label}</span>
            </>
          )
          return (
            <li key={key} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-3 px-3 py-2.5">
              {self ? (
                <span className="truncate">{name}</span>
              ) : (
                <Link href={dossierHref(it.source, it.q)} className="truncate hover:underline">
                  {name}
                </Link>
              )}
              <span className="text-right tabular-nums" title={val ? val.band : undefined}>
                {val ? fmt(val.v, val.type) : val === null ? "—" : <Gap />}
              </span>
              <span className="w-10 text-right tabular-nums">{it.last ?? ""}</span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

/** Where the app itself uses this question: the survey draft held in this
 *  browser, matched on the text Add to survey writes. Nothing links, no card. */
function UsedBy({ text, ready }: { text: string; ready: boolean }) {
  const [item, setItem] = React.useState<number | null>(null)
  React.useEffect(() => {
    if (!ready) return
    const k = readDraft()?.questions.findIndex((q) => q.text === text) ?? -1
    setItem(k >= 0 ? k + 1 : null)
  }, [text, ready])
  if (item == null) return null
  return (
    <Card>
      <CardLabel>Used by</CardLabel>
      <p className="text-sm">
        Item {item} in the{" "}
        <Link href="/consensus?tab=admin" className="text-pax2-light-blue underline">
          draft survey
        </Link>
      </p>
    </Card>
  )
}

function Provenance({ source, id, label, rows }: { source: string; id: string; label: string | null; rows: SourceRow[] | null }) {
  const urls = React.useMemo(() => [...new Set((rows ?? []).map((r) => r[12]).filter((u): u is string => !!u))], [rows])
  const host = (u: string) => {
    try {
      return new URL(u).host.replace(/^www\./, "")
    } catch {
      return u
    }
  }
  const parts: React.ReactNode[] = []
  if (label) parts.push(label)
  if (urls.length === 1) parts.push(<a key="u" href={urls[0]} className="text-pax2-light-blue underline" target="_blank" rel="noreferrer">{host(urls[0])}</a>)
  else if (urls.length > 1) parts.push(`${urls.length} source files (${[...new Set(urls.map(host))].join(", ")})`)
  if (LOADER[source]) parts.push(<span key="l">loader <code className="font-mono text-[11px]">{LOADER[source]}</code></span>)
  if (rows) parts.push(`${num(rows.length, 0)} rows for this question`)
  parts.push(
    <a key="raw" href={rawHref(source, id)} className="text-pax2-light-blue underline" target="_blank" rel="noreferrer">
      open raw rows
    </a>
  )
  return (
    <p className="text-[13px] leading-relaxed text-muted-foreground">
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          {i > 0 && " · "}
          {p}
        </React.Fragment>
      ))}
    </p>
  )
}

function Chips({
  index,
  source,
  id,
  rows,
  geo,
  geoLevel,
  geoName,
  onGeo,
}: {
  index: IndexT
  source: string
  id: string
  rows: SourceRow[]
  geo: string
  geoLevel: Map<string, string>
  geoName: Map<string, string>
  onGeo: (g: string) => void
}) {
  // Every source that asks this question or a member of its construct, each opening its own dossier.
  const sources = React.useMemo(() => {
    const qs = index.questions ?? []
    const out = new Map<string, string>()
    for (const q of qs) if (q.question === id) out.set(q.source, q.question)
    const fam = (index.families ?? []).find((f) => f.members.some((m) => m.question === id))
    for (const m of fam?.members ?? []) for (const q of qs) if (q.question === m.question && (!m.source || m.source === q.source) && !out.has(q.source)) out.set(q.source, q.question)
    return [...out.entries()].sort(([a], [b]) => (a === source ? -1 : b === source ? 1 : a.localeCompare(b)))
  }, [index, id, source])
  // The geographies a reader can switch the page to: the nation and the states the rows reach.
  const geos = React.useMemo(() => {
    const out: string[] = []
    for (const r of rows) if (!out.includes(r[1]) && (r[1] === "US" || geoLevel.get(r[1]) === "STATE")) out.push(r[1])
    return out.sort((a, b) => (a === "US" ? -1 : b === "US" ? 1 : a.localeCompare(b)))
  }, [rows, geoLevel])
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {sources.map(([s, q]) =>
        s === source ? (
          <span key={s} className={pillClass(true)}>
            {shortSource(s)}
          </span>
        ) : (
          <Link key={s} href={dossierHref(s, q)} className={pillClass(false)}>
            {shortSource(s)}
          </Link>
        )
      )}
      {geos.map((g) => (
        <button key={g} type="button" aria-pressed={g === geo} title={geoName.get(g)} onClick={() => onGeo(g)} className={pillClass(g === geo)}>
          {shortGeo(g)}
        </button>
      ))}
    </div>
  )
}
