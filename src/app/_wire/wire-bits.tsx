import * as React from "react"

import { cn } from "@/lib/utils"

/** The small uppercase chip the wireframes draw: OBSERVED, HARM, HEADLINE. */
export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("inline-flex shrink-0 items-center rounded px-1.5 py-px text-[10px] font-semibold tracking-wide text-observed uppercase bg-observed/10", className)}>{children}</span>
}

/** A number the page will carry but does not yet: the wireframes' [—]. */
export function Gap({ className, title }: { className?: string; title?: string }) {
  return (
    <span className={cn("font-semibold text-foreground tabular-nums", className)} title={title}>
      [—]
    </span>
  )
}

/** A cell with nothing to carry: the data has no such rows. */
export function Absent({ className }: { className?: string }) {
  return <span className={cn("text-muted-foreground", className)}>—</span>
}

export function Card({ children, className, ...rest }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={cn("rounded-xl border bg-card p-5", className)} {...rest}>
      {children}
    </section>
  )
}

/** A card's small-caps name, as the wireframes letter them. */
export function CardLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("mb-3 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase", className)}>{children}</h2>
}

/** A pill chip: filled when it is the one in hand. */
export function Pill({ on, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={cn(
        "inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        on ? "border-foreground bg-foreground text-background" : "border-foreground/70 bg-background text-foreground hover:bg-muted",
        className
      )}
      {...rest}
    />
  )
}

export const pillClass = (on?: boolean) =>
  cn(
    "inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium transition-colors",
    on ? "border-foreground bg-foreground text-background" : "border-foreground/70 bg-background text-foreground hover:bg-muted"
  )
