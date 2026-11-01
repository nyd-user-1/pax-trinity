import type { z } from "zod"

import type { LIFT_METRICS, LiftCardProps } from "../../video/templates/lift-card/schema"
import type { ResultSet } from "./types"

// A result's video (./video.ts): the lift card for its headline outcome's strongest
// treatment against the placebo. Pure, so a test reads a ResultSet in and props out.

/** The register's outcomes by the names the lift card gives them; outcomes it has no row for are left out. */
const METRIC: Record<string, (typeof LIFT_METRICS)[number]> = { ballot: "Support", comprehension: "Comprehension" }

const tenth = (x: number) => Math.round(x * 10) / 10

/** The lift card's props, or null when no treatment has a lift on the headline outcome (ballot support, else the first). */
export function liftCardProps(rs: ResultSet, partnerOf: (clipId: string) => string | undefined = () => undefined): z.input<typeof LiftCardProps> | null {
  const headline = (rs.outcomes.find((o) => o.id === "ballot") ?? rs.outcomes[0])?.id
  const best = rs.toplines.filter((t) => t.outcomeId === headline && t.liftPp != null).sort((a, b) => b.liftPp! - a.liftPp!)[0]
  const arm = best && rs.arms.find((a) => a.id === best.armId && a.role === "treatment")
  const placebo = rs.arms.find((a) => a.role === "placebo")
  if (!arm || !placebo) return null
  const metrics = rs.outcomes.flatMap((o) => {
    const control = rs.toplines.find((t) => t.armId === placebo.id && t.outcomeId === o.id)?.levelPct
    const t = rs.toplines.find((x) => x.armId === arm.id && x.outcomeId === o.id)
    return METRIC[o.id] && control != null && t?.liftPp != null ? [{ name: METRIC[o.id], control: tenth(control), lift: tenth(t.liftPp), significant: t.verdict === "detectable" }] : []
  })
  if (!metrics.length) return null
  const partner = arm.clipId ? partnerOf(arm.clipId) : undefined
  return {
    treatment: { title: arm.name.length > 60 ? `${arm.name.slice(0, 59).trimEnd()}…` : arm.name, ...(partner ? { partner } : {}) },
    segment: "Everyone",
    metrics: metrics.slice(0, 3),
    rct: true,
    n: Math.round(arm.nWeighted),
  }
}
