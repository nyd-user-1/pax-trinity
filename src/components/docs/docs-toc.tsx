"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/** An article's contents (Notion's, Brendan 2026-10-31): its sections, the one being read marked as the reader
 *  scrolls the docs' column (#docs-scroll), and a click scrolling there. */
export function DocsToc({ headings }: { headings: { id: string; text: string }[] }) {
  const [active, setActive] = React.useState(headings[0]?.id ?? null)
  React.useEffect(() => {
    const scroller = document.getElementById("docs-scroll")
    if (!scroller || !headings.length) return
    const read = () => {
      const top = scroller.getBoundingClientRect().top
      let on = headings[0]!.id
      for (const h of headings) {
        const el = document.getElementById(h.id)
        if (el && el.getBoundingClientRect().top - top < 140) on = h.id
      }
      // At the foot of the page, the last section is the one being read.
      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4) on = headings[headings.length - 1]!.id
      setActive(on)
    }
    read()
    scroller.addEventListener("scroll", read, { passive: true })
    return () => scroller.removeEventListener("scroll", read)
  }, [headings])
  if (!headings.length) return null
  return (
    <nav aria-label="Contents" className="sticky top-10">
      <p className="mb-3 text-[12px] font-medium tracking-[0.08em] text-slate-500 uppercase">Contents</p>
      <ul className="border-l border-slate-200">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(h.id)?.scrollIntoView({ behavior: "smooth", block: "start" })
                history.replaceState(history.state, "", `#${h.id}`)
              }}
              className={cn("-ml-px block border-l-2 py-1.5 pl-4 text-[14px] leading-snug transition-colors", active === h.id ? "border-pax2-light-blue text-pax2-light-blue" : "border-transparent text-slate-500 hover:text-slate-900")}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
