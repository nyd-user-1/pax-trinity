import { FPS, SIZES } from "../../theme"
import { defineSpec } from "../../template"
import { YesOn3QuoteProps } from "./schema"

export const yesOn3QuoteSpec = defineSpec({
  id: "yes-on-3-quote",
  name: "Yes on 3 quote",
  description:
    "A quote card for Yes on 3, vertical: one line of someone's words set large in white on the campaign's blue, an orange quotation mark, and who said it beneath an orange rule, at the top or the bottom of the frame over a recorded take (backdrop). For an endorsement or a voter's own line; quote only what the person said. For Yes on 3 work only.",
  propsSchema: YesOn3QuoteProps,
  fps: FPS,
  ...SIZES.vertical,
  durationInFrames: (p) => Math.round(p.seconds * FPS),
  // Sample copy: the ballot summary's own words, as Report 2 prints the explanation every Wave 2 arm read.
  fixture: {
    quote: "Voters could vote for any candidate on the ballot.",
    highlight: "any",
    by: "Question 3",
    role: "The official ballot summary",
    seconds: 6,
  },
})
