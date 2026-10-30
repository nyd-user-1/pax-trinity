"use client"

import * as React from "react"

import "./reveal.css"

// Charts arrive the first time they come into view (Brendan, 2026-10-29): on page load for the ones on
// screen, on scroll for the rest. <Reveal> marks its element data-chart, and data-shown once it has been
// on screen; the marks inside it say how they arrive (reveal.css). One IntersectionObserver serves every
// chart on the page. The attribute is React's own, set from state, so a server-rendered chart hydrates
// without a mismatch. ECharts canvases animate their first draw instead (report-charts.tsx).

let observer: IntersectionObserver | null = null
const waiting = new Map<Element, () => void>()

function watch(el: Element, show: () => void) {
  if (typeof IntersectionObserver === "undefined") {
    show()
    return () => {}
  }
  observer ??= new IntersectionObserver(
    (entries) => {
      // The charts that arrive together cascade top to bottom: on page load that is every chart on
      // screen; on scroll, the one or two just come into view. A row's own --i, where set, wins.
      const arriving = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
      arriving.forEach((e, k) => {
        ;(e.target as HTMLElement).style.setProperty("--reveal-order", String(k))
        waiting.get(e.target)?.()
        waiting.delete(e.target)
        observer?.unobserve(e.target)
      })
    },
    // Well inside the window's foot, so the motion is seen rather than spent below the fold.
    { rootMargin: "0px 0px -8% 0px" },
  )
  waiting.set(el, show)
  observer.observe(el)
  return () => {
    waiting.delete(el)
    observer?.unobserve(el)
  }
}

/** A ref to put on a chart and whether it has been on screen yet. */
export function useReveal<T extends Element>() {
  const ref = React.useRef<T>(null)
  const [shown, setShown] = React.useState(false)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const show = () => setShown(true)
    const stop = watch(el, show)
    window.addEventListener("beforeprint", show)
    return () => {
      stop()
      window.removeEventListener("beforeprint", show)
    }
  }, [])
  return [ref, shown] as const
}

type RevealProps = React.HTMLAttributes<HTMLElement> & { as?: "div" | "span" | "tr" }

/** A chart's element: its marks (.grow-x, .grow-x-neg, .grow-y, .grow-in) arrive once it is on screen. */
export function Reveal({ as = "div", ...props }: RevealProps) {
  const [ref, shown] = useReveal<HTMLElement>()
  const Tag = as as React.ElementType
  return <Tag ref={ref} data-chart="" data-shown={shown ? "" : undefined} {...props} />
}

/** The house's stance on motion, for the canvases that animate in script. */
export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
