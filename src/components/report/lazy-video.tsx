"use client"

import * as React from "react"

/** A video card's opening frame, fetched only as the card nears the screen (2026-10-29): a report's ten cards
 *  each pulled the head of their file on load. Printing mounts every one first, so the paper still shows them. */
export function LazyVideo({ src, title, className }: { src: string; title: string; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [near, setNear] = React.useState(false)
  React.useEffect(() => {
    const el = ref.current
    if (!el || near) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setNear(true)
      },
      { rootMargin: "600px 0px" },
    )
    io.observe(el)
    const print = () => setNear(true)
    window.addEventListener("beforeprint", print)
    return () => {
      io.disconnect()
      window.removeEventListener("beforeprint", print)
    }
  }, [near])
  return (
    <div ref={ref} className={className}>
      {near && <video src={src} preload="metadata" muted playsInline className="size-full object-cover" aria-label={title} />}
    </div>
  )
}
