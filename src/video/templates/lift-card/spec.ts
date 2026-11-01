import { FPS, SIZES } from "../../theme"
import { defineSpec } from "../../template"
import { LiftCardProps } from "./schema"

export const liftCardSpec = defineSpec({
  id: "lift-card",
  name: "Lift card",
  description:
    "One treatment's result from a PAX test, vertical: for each outcome (Support, Comprehension, Emotional Response) the placebo's level and the lift over it, a lift that did not clear its test drawn hollow.",
  propsSchema: LiftCardProps,
  fps: FPS,
  ...SIZES.vertical,
  durationInFrames: 8 * FPS,
  // Massachusetts test, Oct 26–29, 2026: Dustin Cathcart against the placebo, everyone. Its numbers are
  // the simulated Wave 3's, so the card says so; rct: true without simulated draws the trial's badge.
  fixture: {
    treatment: { title: "Dustin Cathcart", partner: "@pax" },
    segment: "Everyone",
    metrics: [
      { name: "Support", control: 48.6, lift: 15.7, significant: true },
      { name: "Comprehension", control: 51.4, lift: -9.1, significant: true },
    ],
    rct: false,
    simulated: true,
    n: 347,
  },
})
