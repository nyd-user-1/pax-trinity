import { z } from "zod"

// Schema first. The open asks the question the ballot leaves people unsure of; the take answers it; an end
// card says it plainly. Report 2: after Wave 1 moved support but not understanding, the team added
// explanatory on-screen cards, and three of Wave 2's four videos then showed detectable comprehension gains
// (complete videos were tested, so the cards themselves are not isolated).

export const YesOn3ExplainerProps = z
  .object({
    /** The question on screen at the open. */
    hook: z.string().min(1).max(40),
    /** One word of the hook set in orange. */
    highlight: z.string().max(16).optional(),
    /** How long the hook holds over the take. */
    hookSeconds: z.number().min(1).max(6).default(3),
    end: z.object({
      /** The end card's head, in condensed capitals; its last word is set in orange. */
      title: z.string().min(1).max(16).default("YES ON 3"),
      /** The answer in up to three short rows. */
      lines: z.array(z.string().min(1).max(28)).max(3).default([]),
      /** The orange bar at the foot: the day, or a call. */
      footer: z.string().max(32).optional(),
    }),
    /** How long the end card holds at the close. */
    endSeconds: z.number().min(2).max(8).default(3),
    /** What the hook sits over: a recorded take's URL (it plays), or a picture. Without one, a plain field. */
    backdrop: z.string().max(500).optional(),
    /** The video's length: over a take, the take's. */
    seconds: z.number().min(4).max(60).default(10),
  })
  .superRefine((p, ctx) => {
    if (p.hookSeconds + p.endSeconds > p.seconds) ctx.addIssue({ code: "custom", path: ["seconds"], message: `the hook (${p.hookSeconds}s) and the end card (${p.endSeconds}s) need ${p.hookSeconds + p.endSeconds}s` })
  })

export type YesOn3ExplainerProps = z.infer<typeof YesOn3ExplainerProps>
