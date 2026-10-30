import { FPS, SIZES, sec } from "../../theme"
import { defineSpec } from "../../template"
import { LiftLeaderboardProps } from "./schema"

export const liftLeaderboardSpec = defineSpec({
  id: "lift-leaderboard",
  name: "Lift leaderboard",
  description:
    "Treatments ranked on one outcome's lift, wide: up to eight bars on a shared scale from zero, the asked-about row ringed, a lift inside its margin grey, and a one-line caption typed on at the end.",
  propsSchema: LiftLeaderboardProps,
  fps: FPS,
  ...SIZES.wide,
  durationInFrames: (p) => sec(3 + 0.5 * p.rows.length),
  // Massachusetts test, Oct 26–29, 2026: support lift over the placebo, everyone.
  fixture: {
    metric: "Support",
    segment: "Everyone",
    rows: [
      { title: "Danielle Allen", lift: 14.2, significant: true },
      { title: "Dustin Cathcart", lift: 15.7, significant: true },
      { title: "Jesse Littlewood", lift: 10.9, significant: true },
      { title: "Paul Schilchtman", lift: 12.8, significant: true },
      { title: "Alex Rodriguez", lift: 5.1, significant: false },
      { title: "Ajayi Harris", lift: 3.8, significant: false },
    ],
    highlightIndex: 1,
    caption: "Grey bars did not clear the test.",
  },
})
