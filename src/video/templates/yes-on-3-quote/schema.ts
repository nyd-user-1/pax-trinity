import { z } from "zod"

// Schema first. Someone's words on the measure, set large on the campaign's blue over the take, with who
// said it beneath: an endorsement, a voter's line, the ballot's own words. Report 2's videos were each
// carried by a messenger (a presenter, a street interview, an official); this puts one line of theirs on
// screen.

export const YesOn3QuoteProps = z.object({
  /** The words, without quotation marks; the card draws its own. */
  quote: z.string().min(1).max(140),
  /** One word of the quote set in orange. */
  highlight: z.string().max(16).optional(),
  /** Who said it. */
  by: z.string().min(1).max(40),
  /** What they are, or where the words come from. */
  role: z.string().max(48).optional(),
  /** Where the card stands: over the top of the frame, or the bottom, clear of the speaker's face. */
  position: z.enum(["top", "bottom"]).default("bottom"),
  /** What the card sits over: a recorded take's URL (it plays), or a picture. Without one, a plain field. */
  backdrop: z.string().max(500).optional(),
  /** The video's length: over a take, the take's. */
  seconds: z.number().min(2).max(60).default(6),
})

export type YesOn3QuoteProps = z.infer<typeof YesOn3QuoteProps>
