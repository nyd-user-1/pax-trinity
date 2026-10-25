"use client"

import * as React from "react"
import { Check, CircleCheck, Copy, Lightbulb, Loader2, Search } from "lucide-react"

import type { ChangeEntry } from "@/lib/changelog"
import { cn } from "@govblock/ui/lib/utils"

// /changelog's body: govblock's legislation changelog, by way of pax2's
// learning-loop port (pax2 src/components/rl/changelog.tsx) — a step per
// entry, newest first, the search under the rule, the right rail jumping by
// day, twelve entries to a read with twelve more on reaching the end, and a
// long body folding in its titled block. Here the event is a shipped change
// (the commit message is the block's text, verbatim) or, for admins, an
// insight — same stream, its own tone.

// The reference's caps: twelve to a read, a block folds past fourteen lines or 900 characters.
const PER_READ = 12
const LONG = 14
const LONG_CHARS = 900

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/New_York" })
const anchor = (e: ChangeEntry) => e.hash ?? e.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")

const Ctx = React.createContext<{ entries: ChangeEntry[]; shown: ChangeEntry[]; query: string; setQuery: (q: string) => void; more: () => void; canLoad: boolean } | null>(null)

export function ChangelogProvider({ entries, children }: { entries: ChangeEntry[]; children: React.ReactNode }) {
  const [query, setQuery] = React.useState("")
  const [depth, setDepth] = React.useState(PER_READ)
  const matched = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) => [e.title, e.summary, e.body, e.hash ?? "", e.kind, fmtDate(e.date)].some((s) => s.toLowerCase().includes(q)))
  }, [entries, query])
  const shown = query.trim() ? matched : matched.slice(0, depth)
  const canLoad = !query.trim() && depth < matched.length
  const more = React.useCallback(() => setDepth((d) => d + PER_READ), [])
  const value = React.useMemo(() => ({ entries, shown, query, setQuery, more, canLoad }), [entries, shown, query, more, canLoad])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

/** The center container: the search under the rule, then a step per entry. */
export function ChangelogSteps() {
  const c = React.useContext(Ctx)
  if (!c) return null
  return (
    <div>
      <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm focus-within:border-pax2-blue">
        <Search className="size-4 shrink-0 text-slate-400" />
        <input value={c.query} onChange={(e) => c.setQuery(e.target.value)} placeholder="Search the changelog by change, day or commit…" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400" />
      </label>
      <div className="mt-8" />
      <Steps />
      <More />
    </div>
  )
}

/** The right rail: the days on the page, each jumping to its first entry. */
export function ChangelogIndex() {
  const c = React.useContext(Ctx)
  if (!c?.shown.length) return null
  const days = [...new Map(c.shown.map((e) => [dayKey(e.date), e])).values()]
  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="h-6 text-xs font-medium text-slate-500">On This Page</p>
      {days.map((e) => (
        <a key={dayKey(e.date)} href={`#day-${dayKey(e.date)}`} className="text-[0.8rem] text-slate-500 transition-colors hover:text-pax2-blue">
          {fmtDate(e.date)}
        </a>
      ))}
      <More />
    </div>
  )
}

/** The end of the steps and of the index: reaching either reads twelve more. */
function More() {
  const c = React.useContext(Ctx)
  const mark = React.useRef<HTMLDivElement>(null)
  const canLoad = !!c?.canLoad
  const more = c?.more
  React.useEffect(() => {
    const el = mark.current
    if (!el || !canLoad || !more) return
    const o = new IntersectionObserver((xs) => xs.some((x) => x.isIntersecting) && more())
    o.observe(el)
    return () => o.disconnect()
  }, [canLoad, more])
  if (!canLoad) return null
  return (
    <div ref={mark} className="flex h-8 items-center justify-center text-slate-400">
      <Loader2 aria-label="Loading more" className="size-4 animate-spin" />
    </div>
  )
}

function CopyButton({ value }: { value: string }) {
  const [done, setDone] = React.useState(false)
  return (
    <button
      type="button"
      aria-label="Copy"
      onClick={() => {
        void navigator.clipboard.writeText(value)
        setDone(true)
        setTimeout(() => setDone(false), 1500)
      }}
      className="flex size-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-pax2-blue"
    >
      {done ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  )
}

function CodeLines({ code }: { code: string }) {
  return (
    <pre className="min-w-0 overflow-x-auto py-3.5 font-mono text-[12.5px] leading-6">
      <code className="grid min-w-full">
        {code.split("\n").map((line, i) => (
          <span key={i} className="flex">
            <span className="sticky left-0 inline-block w-12 shrink-0 pr-4 text-right text-slate-400 select-none">{i + 1}</span>
            {/* Prose, not a printout: the line wraps instead of running off the right edge. */}
            <span className="min-w-0 flex-1 whitespace-pre-wrap pr-4 break-words">{line || " "}</span>
          </span>
        ))}
      </code>
    </pre>
  )
}

/** The titled block; past the fold it folds, with one Expand in the caption and a fade over the fold. */
function CodeBlock({ title, code, icon }: { title: string; code: string; icon: React.ReactNode }) {
  const long = code.split("\n").length > LONG || code.length > LONG_CHARS
  const [open, setOpen] = React.useState(false)
  return (
    <figure className="relative mt-6 mb-6 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-slate-800">
      <figcaption className="flex h-9 items-center gap-2 border-b border-slate-200 px-3 font-mono text-[13px] text-slate-500">
        {icon}
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {long && (
          <>
            <button type="button" onClick={() => setOpen((o) => !o)} className="h-7 rounded-md px-2 text-xs text-slate-500 hover:bg-slate-100 hover:text-pax2-blue">
              {open ? "Collapse" : "Expand"}
            </button>
            <span aria-hidden className="mx-0.5 h-4 w-px bg-slate-200" />
          </>
        )}
        <CopyButton value={code} />
      </figcaption>
      <div className={cn("relative", long && !open && "max-h-72 overflow-hidden")}>
        <CodeLines code={code} />
        {long && !open && <button type="button" aria-label="Expand" onClick={() => setOpen(true)} className="absolute inset-x-0 bottom-0 h-20 cursor-pointer bg-gradient-to-b from-transparent to-slate-50" />}
      </div>
    </figure>
  )
}

function Steps() {
  const c = React.useContext(Ctx)!
  const { entries, shown } = c
  const head = entries.find((e) => e.hash)
  const firstOfDay = new Set<string>()
  const seen = new Set<string>()
  for (const e of shown) if (!seen.has(dayKey(e.date))) (seen.add(dayKey(e.date)), firstOfDay.add(anchor(e)))
  return (
    <>
      {!shown.length && <p className="py-10 text-sm text-slate-500">{c.query.trim() ? `Nothing matching “${c.query.trim()}”.` : "Nothing on file."}</p>}
      <div className="mb-12 md:ml-4 md:border-l md:border-slate-200 md:pl-8">
        {!c.query.trim() && head && (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-400 px-4 py-3 text-sm text-slate-600">
            <span className="font-medium text-slate-900">Head of main</span>
            <span>
              · {head.hash} · {entries.filter((e) => e.hash).length} changes since {fmtDate(entries[entries.length - 1].date)}; the next lands above
            </span>
          </div>
        )}
        {shown.map((e, i) => {
          const insight = e.kind === "insight"
          const Icon = insight ? Lightbulb : CircleCheck
          // A one-sentence change is whole in its summary; the block appears only when the body says more.
          const hasBody = e.body.trim() !== e.summary.trim()
          return (
            <React.Fragment key={anchor(e)}>
              <h3 id={firstOfDay.has(anchor(e)) ? `day-${dayKey(e.date)}` : `entry-${anchor(e)}`} className={cn("scroll-mt-4 text-2xl font-semibold tracking-tight text-slate-900", i === 0 && c.query.trim() ? "mt-0" : "mt-16")}>
                {fmtDate(e.date)} · {e.title}
              </h3>
              <p className="mt-2 line-clamp-2 font-medium text-slate-800">{e.summary}</p>
              <div role="status" className={cn("mt-4 flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm", insight ? "border-pax2-blue/25 bg-pax2-lavender/60 text-pax2-blue" : "border-slate-300 bg-slate-100 text-slate-700")}>
                <Icon aria-label={insight ? "Insight" : "Shipped"} className="size-4 shrink-0" />
                <p className="m-0 min-w-0 font-medium">{insight ? "Insight · the lead agent's observation, quoted whole below" : `Shipped · commit ${e.hash} on main`}</p>
              </div>
              {hasBody && (
                <>
                  <hr className="mt-4 border-0 border-t border-slate-200" />
                  <CodeBlock title={insight ? `insights/${dayKey(e.date)}/${anchor(e)}` : `main/${e.hash}`} code={e.body} icon={<span className={cn("size-2 shrink-0 rounded-full", insight ? "bg-pax2-red" : "bg-pax2-blue")} />} />
                </>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </>
  )
}
