import { z } from "zod"

/** The outcomes a PAX test measures, as the Lift table names them. */
export const LIFT_METRICS = ["Support", "Comprehension", "Emotional Response"] as const

export const LiftCardProps = z
  .object({
    treatment: z.object({
      title: z.string().min(1).max(60),
      /** The partner's handle: "@pax", "@yeson3ma". */
      partner: z.string().max(40).optional(),
      thumbnailUrl: z.url().optional(),
    }),
    segment: z.string().min(1).max(60).default("Everyone"),
    metrics: z
      .array(
        z.object({
          name: z.enum(LIFT_METRICS),
          /** The placebo group's level, 0 to 100. */
          control: z.number().min(0).max(100),
          /** The treatment's lift over it, in points. */
          lift: z.number().min(-100).max(100),
          significant: z.boolean(),
        }),
      )
      .min(1)
      .max(3),
    rct: z.boolean().default(true),
    /** Seeded demo respondents, not a fielded panel: the badge says "Simulated data" in place of the trial's. */
    simulated: z.boolean().optional(),
    n: z.number().int().positive().optional(),
  })
  .superRefine((p, ctx) =>
    p.metrics.forEach((m, i) => {
      const level = m.control + m.lift
      if (level < 0 || level > 100) ctx.addIssue({ code: "custom", path: ["metrics", i, "lift"], message: `control + lift is ${level.toFixed(1)}, outside 0 to 100` })
    }),
  )

export type LiftCardProps = z.infer<typeof LiftCardProps>
