"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@govblock/ui/components/nova/button"

import { num, type SourceRow } from "./audience-data"
import { rawHref } from "../_wire/wire-data"

// The Global view's furniture, shared by the question pane's Topline,
// Crosstab, Trend and Global views (Brendan, 2026-10-29): one centered
// column of cards, led by the same h2, a sentence with its figures in bold
// and a line of facts under it.

/** The centered column every view stands in. */
export function ViewColumn({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto flex w-full max-w-[920px] flex-col gap-5 p-6", className)} {...rest} />
}

/** The view's h2: a sentence of context, the facts under it, copied from a hover button. */
export function ViewHeading({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <Copyable flush>
      <div className="pr-10">
        <h2 className="text-[22px] leading-snug font-normal">{children}</h2>
        {sub && <p className="mt-3 text-sm text-muted-foreground tabular-nums">{sub}</p>}
      </div>
    </Copyable>
  )
}

/** A figure in a heading's sentence. */
export function B({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold">{children}</strong>
}

/** "age, education and party". */
export const listed = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`)

/** A block with the standard copy control: top right, on hover, its text to the clipboard. */
export function Copyable({ children, flush = false }: { children: React.ReactNode; flush?: boolean }) {
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
        className={cn("absolute opacity-0 group-hover/copy:opacity-100 focus-visible:opacity-100", flush ? "top-0 right-0" : "top-3 right-3", copied && "opacity-100")}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </Button>
    </div>
  )
}

/** Where the question's figures come from, in the reader's words (Brendan, 2026-11-02: no loader names, no files):
 *  the source, the publisher's page or pages, the weights, how many figures, and the data to download. */
/** `raw` false where the rows are the mount's own (Survey's): no download. */
export function Provenance({ source, id, label, rows, extra, raw = true }: { source: string; id: string; label: string | null; rows: SourceRow[] | null; extra?: React.ReactNode; raw?: boolean }) {
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
  if (urls.length === 1)
    parts.push(
      <a key="u" href={urls[0]} className="text-pax2-light-blue underline" target="_blank" rel="noreferrer">
        {host(urls[0])}
      </a>
    )
  else if (urls.length > 1) parts.push(`${urls.length} sources (${[...new Set(urls.map(host))].join(", ")})`)
  if (extra) parts.push(extra)
  if (rows) parts.push(`${num(rows.length, 0)} figures for this question`)
  if (raw)
    parts.push(
      <a key="raw" href={rawHref(source, id)} download className="text-pax2-light-blue underline">
        Download the data
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
