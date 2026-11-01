import { z } from "zod"

// Schema first. The Yes on 3 card as the team ran it in the Wave 2 videos: a title, up to three checked
// rows and a footer bar on a blue panel over the lower half of a vertical frame. Lengths are what a row
// holds at full size; a longer row is set smaller to fit, never cut.

export const YesOn3CardProps = z.object({
  title: z.string().min(1).max(20).default("QUESTION 3"),
  items: z.array(z.string().min(1).max(24)).min(1).max(3),
  footer: z.string().max(40).optional(),
  /** wide: rows nearly the frame's width. compact: the same card at about three quarters, centred,
   *  under the same full-width panel. Both ran in Wave 2. */
  layout: z.enum(["wide", "compact"]).default("wide"),
  /** The panel stands in from the frame's sides and bottom, as one Wave 2 cut has it. */
  inset: z.boolean().default(false),
  /** A line set on the panel's top edge in the campaign's condensed capitals, with one word in orange:
   *  what the speaker is saying as the card holds. */
  caption: z.string().max(32).optional(),
  highlight: z.string().max(16).optional(),
  /** cut: on at the first frame, as Wave 2 ran it. rise: the panel slides up and the rows follow. */
  entrance: z.enum(["cut", "rise"]).default("cut"),
  /** What the card sits over: a recorded take's URL (it plays), or a picture. Without one, a plain field. */
  backdrop: z.string().max(500).optional(),
  /** How long the card holds. Wave 2 held it about thirteen seconds; over a recorded take, up to the
   *  take's length (Record stops at sixty). */
  seconds: z.number().min(2).max(60).default(6),
})

export type YesOn3CardProps = z.infer<typeof YesOn3CardProps>
