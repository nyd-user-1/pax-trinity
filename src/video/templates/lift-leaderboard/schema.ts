import { z } from "zod"

import { LIFT_METRICS } from "../lift-card/schema"

/** The composition has eight lanes; the schema refuses a ninth row. */
export const LANES = 8

export const LiftLeaderboardProps = z
  .object({
    metric: z.enum(LIFT_METRICS),
    segment: z.string().min(1).max(60),
    rows: z
      .array(
        z.object({
          title: z.string().min(1).max(40),
          /** The lift over the placebo, in points. */
          lift: z.number().min(-100).max(100),
          /** False draws the bar grey, as Lift draws a lift inside its margin. */
          significant: z.boolean().default(true),
          thumbnailUrl: z.url().optional(),
        }),
      )
      .min(2)
      .max(LANES),
    /** The row the user asked about, by its place in `rows` as given. */
    highlightIndex: z.number().int().min(0).optional(),
    caption: z.string().max(120).optional(),
  })
  .refine((p) => p.highlightIndex == null || p.highlightIndex < p.rows.length, { message: "highlightIndex is past the last row", path: ["highlightIndex"] })

export type LiftLeaderboardProps = z.infer<typeof LiftLeaderboardProps>
