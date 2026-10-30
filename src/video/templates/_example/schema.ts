import { z } from "zod"

// Schema first: this is the whole of what a caller (the chat agent, a server
// action) writes to fill the template. Bounds live here, so anything the
// template cannot draw is refused before a frame is rendered.

export const ExampleProps = z.object({
  title: z.string().min(1).max(60),
  /** The figure the bar draws to, 0 to 100. */
  value: z.number().min(0).max(100),
  unit: z.string().max(8).default("%"),
  caption: z.string().max(120).optional(),
})

export type ExampleProps = z.infer<typeof ExampleProps>
