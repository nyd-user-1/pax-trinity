import { FPS, SIZES } from "../../theme"
import { defineSpec } from "../../template"
import { YesOn3ExplainerProps } from "./schema"

export const yesOn3ExplainerSpec = defineSpec({
  id: "yes-on-3-explainer",
  name: "Yes on 3 explainer",
  description:
    "Text on screen that explains Question 3, vertical: a hook question in condensed capitals over the open of a recorded take (backdrop), then the take, then an end card in the campaign's blue with the answer in up to three rows and an orange footer bar. For a read that should leave the viewer knowing what the measure does; for Yes on 3 work only.",
  propsSchema: YesOn3ExplainerProps,
  fps: FPS,
  ...SIZES.vertical,
  durationInFrames: (p) => Math.round(p.seconds * FPS),
  // Sample copy from Report 2: the comprehension question every Wave 2 arm was asked, and the answer it
  // scored correct ("one primary with all candidates on the same ballot, with the top two vote-getters
  // overall advancing"), with the vote's date from the ballot summary.
  fixture: {
    hook: "What does Question 3 change?",
    highlight: "change",
    end: { title: "YES ON 3", lines: ["One primary ballot", "Every candidate on it", "Top two advance"], footer: "Vote November 3" },
    seconds: 10,
  },
})
