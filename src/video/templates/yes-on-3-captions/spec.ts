import { FPS, SIZES } from "../../theme"
import { defineSpec } from "../../template"
import { YesOn3CaptionsProps } from "./schema"

export const yesOn3CaptionsSpec = defineSpec({
  id: "yes-on-3-captions",
  name: "Yes on 3 captions",
  description:
    "A person speaking to camera for Yes on 3, vertical: a lower third with their name and role in the campaign's blue and orange, then what they say captioned a line at a time in condensed capitals, one word in orange, over a recorded take (backdrop). For a plain read straight to camera; for Yes on 3 work only.",
  propsSchema: YesOn3CaptionsProps,
  fps: FPS,
  ...SIZES.vertical,
  durationInFrames: (p) => Math.round(p.seconds * FPS),
  // Sample copy: the speaker is a placeholder, and the lines restate the ballot summary every arm read
  // in Report 2's Wave 2 ("a single, all-party primary … the two candidates receiving the most votes
  // … would advance").
  fixture: {
    name: "Your name",
    role: "Massachusetts voter",
    lines: ["Question 3 puts every candidate", "on one primary ballot.", "Any voter can pick any of them.", "The top two go to November."],
    highlight: "every",
    seconds: 8,
  },
})
