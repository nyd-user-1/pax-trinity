import { z } from "zod"

// Schema first. A person speaking to camera, captioned: a lower third naming them, then what they say a
// line at a time in the campaign's condensed capitals. Report 2: Wave 1's largest lift was a 35-second
// street interview, and a quarter of Wave 2's sample named a person speaking to camera as the format they
// trust most for political information.

export const YesOn3CaptionsProps = z.object({
  /** Who speaks, on the lower third. */
  name: z.string().min(1).max(28),
  /** What they are: a town, a job, a role. */
  role: z.string().max(36).optional(),
  /** The small tag above the name. */
  tag: z.string().max(16).default("YES ON 3"),
  /** What they say, a line at a time across the take, each held an equal share of it. */
  lines: z.array(z.string().min(1).max(32)).min(1).max(16),
  /** One word set in orange wherever it appears. */
  highlight: z.string().max(16).optional(),
  /** What the captions sit over: a recorded take's URL (it plays), or a picture. Without one, a plain field. */
  backdrop: z.string().max(500).optional(),
  /** The video's length: over a take, the take's. */
  seconds: z.number().min(2).max(60).default(8),
})

export type YesOn3CaptionsProps = z.infer<typeof YesOn3CaptionsProps>
