"use client"

// Tools > Lift Analysis and Lift's own panel (Brendan, 2026-10-31): the cards (app/lift/deliverables.ts) open an
// analysis on Lift, and the analysis' Back returns to them.

/** Lift listens: open this analysis here, from a Tools card. */
export const LIFT_ANALYSIS_OPEN = "lift:analysis-open"
/** The shell listens: the Lift Analysis panel's Back, which reopens Tools on the cards. */
export const LIFT_TOOLS_OPEN = "lift:tools-open"

// Tools opens on the cards when it was asked to since it last looked.
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
