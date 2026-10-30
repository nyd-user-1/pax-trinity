import { z } from "zod"

export const SurveySplitProps = z
  .object({
    question: z.string().min(1).max(200),
    /** "1984". */
    wave: z.string().min(1).max(20),
    /** "GSS". */
    source: z.string().min(1).max(40),
    /** The answers, in the question's order. */
    bands: z.array(z.string().min(1).max(32)).min(2).max(4),
    segments: z
      .array(
        z.object({
          label: z.string().min(1).max(24),
          n: z.number().int().positive(),
          /** One per band, in the bands' order: the share and its margin, in points. */
          estimates: z.array(z.object({ est: z.number().min(0).max(100), moe: z.number().min(0).max(50) })),
        }),
      )
      .min(1)
      .max(6),
  })
  .superRefine((p, ctx) =>
    p.segments.forEach((s, i) => {
      if (s.estimates.length !== p.bands.length)
        ctx.addIssue({ code: "custom", path: ["segments", i, "estimates"], message: `${s.label} has ${s.estimates.length} estimates for ${p.bands.length} bands` })
    }),
  )

export type SurveySplitProps = z.infer<typeof SurveySplitProps>
