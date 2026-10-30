import { z } from "zod"

import type { TemplateSpec } from "./template"
import { exampleSpec } from "./templates/_example/spec"
import { liftCardSpec } from "./templates/lift-card/spec"
import { liftLeaderboardSpec } from "./templates/lift-leaderboard/spec"
import { metricTrendSpec } from "./templates/metric-trend/spec"
import { surveySplitSpec } from "./templates/survey-split/spec"

// Every template's spec by id: its schema, frame, length and fixture, without
// its component. Server-safe, so /api/video/render and the chat agent validate
// and list templates without loading Remotion (which needs React's client
// runtime). registry.ts pairs each spec with its component for the Player,
// Studio and the renderer. A new template is one import and one entry here,
// and its component in registry.ts.

// Each spec is typed by its own schema; the list holds them side by side.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnySpec = TemplateSpec<any>

const SPECS: AnySpec[] = [exampleSpec, liftCardSpec, liftLeaderboardSpec, surveySplitSpec, metricTrendSpec]

const BY_ID: Readonly<Record<string, AnySpec>> = Object.fromEntries(SPECS.map((s) => [s.id, s]))

export function getSpec(id: string): AnySpec | null {
  return BY_ID[id] ?? null
}

export function allSpecs(): readonly AnySpec[] {
  return SPECS
}

/** A template's length in frames for validated props. */
export function durationOf(spec: AnySpec, props: unknown): number {
  return typeof spec.durationInFrames === "number" ? spec.durationInFrames : spec.durationInFrames(props)
}

/** What the agent is told: each template's id, purpose, frame and the JSON Schema of the props it may write. */
export function listTemplates() {
  return SPECS.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    width: s.width,
    height: s.height,
    fps: s.fps,
    schema: z.toJSONSchema(s.propsSchema, { io: "input", unrepresentable: "any" }),
  }))
}

export type Validated = { ok: true; spec: AnySpec; props: unknown; durationInFrames: number } | { ok: false; error: string }

/** The validation boundary: nothing reaches a composition without passing its schema. */
export function validate(templateId: string, props: unknown): Validated {
  const spec = getSpec(templateId)
  if (!spec) return { ok: false, error: `No template "${templateId}". Known: ${SPECS.map((s) => s.id).join(", ")}.` }
  const parsed = spec.propsSchema.safeParse(props)
  if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error) }
  return { ok: true, spec, props: parsed.data, durationInFrames: durationOf(spec, parsed.data) }
}
