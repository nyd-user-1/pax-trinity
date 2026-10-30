import { z } from "zod"

export const MetricTrendProps = z
  .object({
    title: z.string().min(1).max(80),
    /** Up to four lines; points line up by their place, so give every series the same labels. */
    series: z
      .array(
        z.object({
          name: z.string().min(1).max(40),
          points: z.array(z.object({ label: z.string().min(1).max(12), value: z.number() })).min(2).max(40),
        }),
      )
      .min(1)
      .max(4),
    /** "%", "pts". */
    unit: z.string().max(8).optional(),
    /** A callout that springs in as the line passes the point at `atIndex`. */
    annotation: z.object({ atIndex: z.number().int().min(0), text: z.string().min(1).max(80) }).optional(),
  })
  .refine((p) => !p.annotation || p.annotation.atIndex < Math.max(...p.series.map((s) => s.points.length)), {
    message: "annotation.atIndex is past the last point",
    path: ["annotation", "atIndex"],
  })

export type MetricTrendProps = z.infer<typeof MetricTrendProps>
