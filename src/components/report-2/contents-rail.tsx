"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

// Report 2's contents: a sticky list of the sections, the open one marked as
// the page scrolls. The shell's main is the scroller; any scroll under the
// document moves the mark.

/** The nearest ancestor that scrolls, else none (the viewport). */
function scrollerOf(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY
    if ((oy === "auto" || oy === "scroll") && p.scrollHeight > p.clientHeight) return p
  }
  return null
}

export function ContentsRail({ items }: { items: { id: string; label: string }[] }) {
  const ref = React.useRef<HTMLElement>(null)
  const [on, setOn] = React.useState(items[0]?.id)
  const ids = items.map((i) => i.id).join(",")

  React.useEffect(() => {
    const list = ids.split(",")
    if (!list.length) return
    const update = () => {
      const box = scrollerOf(ref.current)?.getBoundingClientRect()
      const top = box?.top ?? 0
      const bottom = box?.bottom ?? window.innerHeight
      let cur = list[0]
      for (const id of list) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top - top <= 120) cur = id
      }
      // At the foot the last section is open, however short it runs.
      const doc = ref.current?.parentElement
      if (doc && doc.getBoundingClientRect().bottom <= bottom + 4) cur = list[list.length - 1]
      setOn(cur)
    }
    update()
    document.addEventListener("scroll", update, { capture: true, passive: true })
    window.addEventListener("resize", update)
    return () => {
      document.removeEventListener("scroll", update, { capture: true })
      window.removeEventListener("resize", update)
    }
  }, [ids])

  return (
    <nav ref={ref} aria-label="Contents" className="report-2-rail sticky top-10 hidden self-start lg:block">
      <ol className="flex flex-col border-l border-[var(--paper-rule)]/25 text-[13px] leading-snug">
        {items.map((it) => (
          <li key={it.id}>
            <a
              href={`#${it.id}`}
              aria-current={on === it.id ? "location" : undefined}
              className={cn(
                "-ml-px block border-l-2 py-1.5 pl-4 transition-colors",
                on === it.id ? "border-[var(--paper-text)] font-semibold text-[var(--paper-text)]" : "border-transparent text-[var(--paper-muted)] hover:text-[var(--paper-text)]"
              )}
            >
              {it.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
