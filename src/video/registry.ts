import type * as React from "react"

import { allSpecs, getSpec, type AnySpec } from "./specs"
import type { Template } from "./template"
import { ExampleComposition } from "./templates/_example/Composition"
import { LiftCardComposition } from "./templates/lift-card/Composition"
import { LiftLeaderboardComposition } from "./templates/lift-leaderboard/Composition"
import { MetricTrendComposition } from "./templates/metric-trend/Composition"
import { SurveySplitComposition } from "./templates/survey-split/Composition"
import { YesOn3CardComposition } from "./templates/yes-on-3-card/Composition"

// Each spec (specs.ts) with the Remotion component that draws it: what
// TemplatePlayer plays in the page and Root.tsx registers for Studio and the
// renderer. Client and Remotion bundles only: the components need React's
// client runtime, so server code reads specs.ts instead.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COMPONENTS: Record<string, React.ComponentType<any>> = {
  example: ExampleComposition,
  "lift-card": LiftCardComposition,
  "lift-leaderboard": LiftLeaderboardComposition,
  "survey-split": SurveySplitComposition,
  "metric-trend": MetricTrendComposition,
  "yes-on-3-card": YesOn3CardComposition,
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTemplate = Template<any>

const pair = (spec: AnySpec): AnyTemplate | null => {
  const component = COMPONENTS[spec.id]
  return component ? { ...spec, component } : null
}

const ALL: AnyTemplate[] = allSpecs()
  .map(pair)
  .filter((t): t is AnyTemplate => t != null)

export function getTemplate(id: string): AnyTemplate | null {
  const spec = getSpec(id)
  return spec ? pair(spec) : null
}

export function allTemplates(): readonly AnyTemplate[] {
  return ALL
}

/** Specs that have no component, and components that have no spec: both should be empty. */
export function unpaired() {
  const specIds = new Set(allSpecs().map((s) => s.id))
  return { specs: [...specIds].filter((id) => !COMPONENTS[id]), components: Object.keys(COMPONENTS).filter((id) => !specIds.has(id)) }
}

export { durationOf, listTemplates, validate } from "./specs"
