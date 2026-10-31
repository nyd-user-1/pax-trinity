"use client"

import * as React from "react"

// The Lift Analyses opened in this browser (Brendan, 2026-10-31): Tools > Lift Analysis lays them out as the
// Blocks shelf lays its blocks, and a card opens its analysis again. Newest first, at most 24.

export type LiftAnalysis = {
  /** Lift's address for the analysis: its folder and its pick (?source=…&at=…). */
  href: string
  source: string
  /** The pick as Lift's at= list: option, metric, segment, fielding. */
  at: string[]
  /** The treatment. */
  title: string
  /** Metric · segment · lift. */
  sub: string
  opened: number
}

const KEY = "pax:lift-analyses"
const CHANGED = "lift-analyses:changed"
const MAX = 24

/** Lift listens: open this analysis here, from a Tools card. */
export const LIFT_ANALYSIS_OPEN = "lift:analysis-open"
/** The shell listens: the Lift Analysis panel's Back, which reopens Tools on the cards. */
export const LIFT_TOOLS_OPEN = "lift:tools-open"

export function readAnalyses(): LiftAnalysis[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]")
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function write(list: LiftAnalysis[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {}
  window.dispatchEvent(new Event(CHANGED))
}

export function recordAnalysis(a: Omit<LiftAnalysis, "opened">) {
  write([{ ...a, opened: Date.now() }, ...readAnalyses().filter((x) => x.href !== a.href)])
}

export function forgetAnalysis(href: string) {
  write(readAnalyses().filter((x) => x.href !== href))
}

export function useAnalyses() {
  const [list, setList] = React.useState<LiftAnalysis[]>([])
  React.useEffect(() => {
    const on = () => setList(readAnalyses())
    on()
    window.addEventListener(CHANGED, on)
    window.addEventListener("storage", on)
    return () => {
      window.removeEventListener(CHANGED, on)
      window.removeEventListener("storage", on)
    }
  }, [])
  return list
}

// A card opened from Tools: the panel it opens carries a Back to the cards. Lift takes the flag when the pick
// arrives (on this page by LIFT_ANALYSIS_OPEN, from another page through its address).
let fromTools = false
export const markFromTools = () => void (fromTools = true)
export const takeFromTools = () => {
  const was = fromTools
  fromTools = false
  return was
}

// Tools opens on the cards when it was asked to since it last looked (the Back above).
let toolsOnCards = false
export const openToolsOnCards = () => {
  toolsOnCards = true
  window.dispatchEvent(new Event(LIFT_TOOLS_OPEN))
}
export const takeToolsOnCards = () => {
  const was = toolsOnCards
  toolsOnCards = false
  return was
}
