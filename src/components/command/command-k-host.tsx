"use client"

import * as React from "react"
import dynamic from "next/dynamic"

// ⌘K from anywhere opens the palette (command-k.tsx); so does the shell's search field and anything that
// dispatches "pax:command-k". The palette's code loads the first time it opens, not with every page.
const CommandK = dynamic(() => import("./command-k").then((m) => m.CommandK), { ssr: false })

export const openCommandK = () => window.dispatchEvent(new Event("pax:command-k"))

export function CommandKHost() {
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k" && !open) {
        e.preventDefault()
        setOpen(true)
      }
    }
    const onAsk = () => setOpen(true)
    window.addEventListener("keydown", onKey)
    window.addEventListener("pax:command-k", onAsk)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener("pax:command-k", onAsk)
    }
  }, [open])
  return open ? <CommandK onClose={() => setOpen(false)} /> : null
}
