"use client"

import dynamic from "next/dynamic"

// The lift surface loads browser-side like the audience instrument beside it:
// the rail width and read sources live in this browser.
const LiftSurface = dynamic(() => import("./lift-surface").then((m) => m.LiftSurface), { ssr: false })

export function LiftClient() {
  return <LiftSurface />
}
