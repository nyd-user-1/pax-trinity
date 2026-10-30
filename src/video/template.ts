import type * as React from "react"
import type { z } from "zod"

/** Everything about a template but its component: what fills it and the frame it fills.
 *  Server-safe (zod and theme numbers only), so a route can validate without loading Remotion. */
export type TemplateSpec<S extends z.ZodType = z.ZodType> = {
  /** Letters, digits and hyphens: Remotion's rule for a composition id. */
  id: string
  /** One line for the agent: what the template shows and when to reach for it. */
  description: string
  propsSchema: S
  fps: number
  width: number
  height: number
  /** Fixed, or worked out from the validated props (a leaderboard's rows, a receipt's steps). */
  durationInFrames: number | ((props: z.output<S>) => number)
  /** Props that parse: Studio's defaults and the render test's fixture. */
  fixture: z.input<S>
}

/** A spec with the Remotion component that draws it. Client and Remotion bundles only. */
export type Template<S extends z.ZodType = z.ZodType> = TemplateSpec<S> & {
  component: React.ComponentType<z.output<S>>
}

/** Declares a template's spec with its props typed from its schema. */
export function defineSpec<S extends z.ZodType>(spec: TemplateSpec<S>): TemplateSpec<S> {
  return spec
}
