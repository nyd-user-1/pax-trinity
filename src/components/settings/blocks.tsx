import * as React from "react"
import Link from "next/link"

import { cn } from "@/ui/lib/utils"

// The parts /settings and /models are built from (Brendan, 2026-10-29). A Block is his reference card:
// the title (and an optional muted line) on a slate-50 ground, and inside it a white card of rows, each
// row a name on the left and its control or value at the right edge. Server-safe: the controls that
// need the browser live in controls.tsx.

export const PRIMARY =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-pax2-blue bg-pax2-blue px-5 py-2 text-sm font-semibold text-white shadow-e1 transition-colors outline-none hover:border-pax2-light-blue hover:bg-pax2-light-blue focus-visible:ring-3 focus-visible:ring-pax2-light-blue/30 disabled:pointer-events-none disabled:opacity-40"
export const SMALL =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-pax2-surface px-3 text-[13px] font-medium text-slate-700 shadow-e1 transition-colors outline-none hover:border-pax2-blue hover:text-pax2-blue focus-visible:ring-3 focus-visible:ring-pax2-light-blue/30 [&_svg]:size-3.5"
export const SMALL_PRIMARY =
  "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-full bg-pax2-blue px-3.5 text-[13px] font-semibold text-white shadow-e1 transition-colors outline-none hover:bg-pax2-light-blue focus-visible:ring-3 focus-visible:ring-pax2-light-blue/30"
export const ICON_BUTTON =
  "flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors outline-none hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-3 focus-visible:ring-pax2-light-blue/30 data-[popup-open]:bg-slate-100 data-[popup-open]:text-slate-700"
export const FIELD =
  "rounded-xl border border-slate-200 bg-pax2-surface text-sm text-slate-900 shadow-e1 transition-colors focus-within:border-pax2-light-blue focus-within:ring-3 focus-within:ring-pax2-light-blue/15"

/** The page's tab row: links, so a tab survives a reload and a shared link; `trailing` sits at its right. */
export function PageTabs({ tabs, active, trailing }: { tabs: { key: string; label: string; href: string; icon: React.ComponentType<{ className?: string }>; count?: number }[]; active: string; trailing?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-slate-200">
      <nav className="-mb-px flex min-w-0 gap-6 overflow-x-auto">
        {tabs.map(({ key, label, href, icon: Icon, count }) => {
          const on = key === active
          return (
            <Link
              key={key}
              href={href}
              scroll={false}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 border-b-2 pt-1 pb-3 text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:text-slate-900 [&_svg]:size-4",
                on ? "border-pax2-blue text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900",
              )}
            >
              <Icon /> {label}
              {count !== undefined && <span className="text-[12px] font-normal tabular-nums text-slate-400">{count}</span>}
            </Link>
          )
        })}
      </nav>
      {trailing && <div className="flex shrink-0 gap-2 pb-2">{trailing}</div>}
    </div>
  )
}

/** A page's tabs as a rail beside its content, in the reports' contents dress (components/report-2/
 *  contents-rail.tsx): a left rule, the open tab marked by its own 2px edge and set semibold. Under lg it
 *  lies above the content as a row. Links, so a tab survives a reload and a shared link. */
export function PageRail({ tabs, active, label }: { tabs: { key: string; label: string; href: string }[]; active: string; label: string }) {
  return (
    <nav aria-label={label} className="lg:sticky lg:top-10 lg:self-start">
      <ol className="flex gap-5 border-b border-slate-200 text-[13px] leading-snug lg:flex-col lg:gap-0 lg:border-b-0 lg:border-l">
        {tabs.map((t) => {
          const on = t.key === active
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                scroll={false}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "-mb-px block border-b-2 py-1.5 transition-colors lg:mb-0 lg:-ml-px lg:border-b-0 lg:border-l-2 lg:pl-4",
                  on ? "border-slate-900 font-semibold text-slate-900" : "border-transparent text-slate-500 hover:text-slate-900"
                )}
              >
                {t.label}
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/** The reference block: a title on the slate-50 frame, the rows in a white card inside it. `stretch` fills
 *  its grid cell, the white card taking the slack, so blocks in one row end level whatever they hold.
 *  `selected` draws the frame's 1px rule in blue, for the block in focus. */
export function Block({ title, sub, lead, badge, action, children, className, stretch, selected }: { title: React.ReactNode; sub?: React.ReactNode; lead?: React.ReactNode; badge?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; stretch?: boolean; selected?: boolean }) {
  return (
    <section className={cn("rounded-[18px] border bg-slate-50 p-1 shadow-e1 transition-colors", selected ? "border-pax2-light-blue" : "border-slate-200", stretch && "flex h-full flex-col", className)}>
      <div className="flex items-center gap-3 px-4 pt-2.5 pb-3 sm:px-5">
        {lead}
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-slate-900">
            {title}
            {badge}
          </h3>
          {sub && <p className="text-[13px] text-slate-500">{sub}</p>}
        </div>
        {action}
      </div>
      <div className={cn("divide-y divide-slate-200 overflow-visible rounded-[14px] border border-slate-200 bg-pax2-surface shadow-e1", stretch && "flex flex-1 flex-col")}>{children}</div>
    </section>
  )
}

/** One setting: its name and a short line on the left, its control at the right edge. */
export function Row({ label, hint, badge, lead, top, wide, children }: { label: string; hint?: string; badge?: React.ReactNode; lead?: React.ReactNode; top?: boolean; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:justify-between sm:gap-8 sm:px-5", top ? "sm:items-start" : "sm:items-center")}>
      <div className="flex min-w-0 items-start gap-3">
        {lead}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
            {label}
            {badge}
          </div>
          {hint && <p className="mt-0.5 text-[13px] text-slate-500">{hint}</p>}
        </div>
      </div>
      <div className={cn("flex w-full min-w-0 shrink-0 sm:justify-end", wide ? "sm:w-[26rem]" : "sm:w-72")}>{children}</div>
    </div>
  )
}

/** A fact on a model card: its name on the left, the value at the right edge. */
export function Fact({ label, mono, children }: { label: string; mono?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 px-4 py-3 sm:px-5">
      <span className="shrink-0 text-sm font-medium text-slate-900">{label}</span>
      <span className={cn("min-w-0 text-right text-slate-600", mono ? "font-mono text-[12px] break-all" : "text-sm")}>{children}</span>
    </div>
  )
}

/** A passage on a model card: the name on the left, the prose beside it. With no label it runs full width. */
export function Passage({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className={cn("px-4 py-3.5 text-sm leading-relaxed text-slate-700 sm:px-5", label && "sm:grid sm:grid-cols-[9rem_1fr] sm:gap-6")}>
      {label && <p className="mb-1 font-medium text-slate-900 sm:mb-0">{label}</p>}
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export type Tone = "green" | "violet" | "amber" | "slate" | "blue"
const TONE: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/25",
  violet: "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-400/10 dark:text-violet-300 dark:ring-violet-400/25",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/25",
  slate: "bg-pax2-surface text-slate-600 ring-slate-300",
  blue: "bg-pax2-lavender text-pax2-blue ring-pax2-blue/20 dark:text-pax2-light-blue",
}

export function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={cn("inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset", TONE[tone])}>{children}</span>
}

/** A colored square holding an icon, the ⌘K palette's tile. */
export function Tile({ icon: Icon, tint, size = 32 }: { icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; tint: string; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-lg text-white shadow-[inset_0_-1px_0_rgb(0_0_0/0.12)]" style={{ width: size, height: size, background: tint }}>
      <Icon className="size-4" strokeWidth={2} />
    </span>
  )
}

export function Chip({ children, onRemove, label }: { children: React.ReactNode; onRemove: () => void; label: string }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 pr-1 pl-2 text-[13px] text-slate-700">
      {children}
      <button type="button" data-edit onClick={onRemove} aria-label={`Remove ${label}`} className="flex size-5 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700">
        <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </span>
  )
}

// The staff photos (public/), as the inbox's address book carries them.
const PHOTO: Record<string, string> = {
  "brendan@nysgpt.com": "/brendan.jpg",
  "sajeela@parallaxinnovations.com": "/sajeela.jpeg",
  "garrett@parallaxinnovations.com": "/garrett.jpeg",
  "ted@parallaxinnovations.com": "/ted.jpeg",
  "ted@uniteamerica.org": "/partners/unite-america.jpg",
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")

export function Avatar({ name, email, size = 32, fallback }: { name: string; email?: string; size?: number; fallback?: string }) {
  const src = (email && PHOTO[email.toLowerCase()]) || fallback
  if (src)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-600" style={{ width: size, height: size }}>
      {initialsOf(name)}
    </span>
  )
}
