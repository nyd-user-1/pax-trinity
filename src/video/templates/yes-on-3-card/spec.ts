import { FPS, SIZES } from "../../theme"
import { defineSpec } from "../../template"
import { YesOn3CardProps } from "./schema"

export const yesOn3CardSpec = defineSpec({
  id: "yes-on-3-card",
  name: "Yes on 3 card",
  description:
    "The Yes on 3 campaign's checklist card as its Wave 2 videos ran it, vertical: a title (QUESTION 3), up to three checked rows and an orange footer bar on a blue panel over the lower half of the frame, optionally over a recorded take (backdrop) with a caption line on the panel's edge. layout wide or compact; for Yes on 3 work only.",
  propsSchema: YesOn3CardProps,
  fps: FPS,
  ...SIZES.vertical,
  durationInFrames: (p) => Math.round(p.seconds * FPS),
  // The card as it stands in all four Wave 2 videos (Report 2, page 18).
  fixture: {
    title: "QUESTION 3",
    items: ["One Primary Ballot", "For Every Voter", "With Every Candidate"],
    footer: "Top two advance to November.",
  },
})
