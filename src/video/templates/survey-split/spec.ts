import { FPS, SIZES } from "../../theme"
import { defineSpec } from "../../template"
import { SurveySplitProps } from "./schema"

export const surveySplitSpec = defineSpec({
  id: "survey-split",
  name: "Survey split",
  description:
    "One survey question's answers by group, wide: a bar per answer in each group, each with its margin-of-error whisker, the question at the top, each group's n under it, the source and wave at the foot.",
  propsSchema: SurveySplitProps,
  fps: FPS,
  ...SIZES.wide,
  durationInFrames: 10 * FPS,
  // GSS femilop, 1984, by age.
  fixture: {
    question:
      "And what about women? Would you say that their treatment and opportunities are better in the military, better in civilian employment, or that there isn't any difference these days?",
    wave: "1984",
    source: "GSS",
    bands: ["Military better", "Civilian better", "No difference"],
    segments: [
      { label: "Everyone", n: 1366, estimates: [{ est: 19.8, moe: 2.2 }, { est: 34.8, moe: 2.6 }, { est: 45.4, moe: 2.8 }] },
      { label: "18–29", n: 376, estimates: [{ est: 16.1, moe: 4.0 }, { est: 37.0, moe: 5.3 }, { est: 46.9, moe: 5.5 }] },
      { label: "30–44", n: 433, estimates: [{ est: 19.7, moe: 3.9 }, { est: 34.4, moe: 4.7 }, { est: 45.9, moe: 4.9 }] },
      { label: "45–64", n: 322, estimates: [{ est: 24.4, moe: 4.9 }, { est: 29.7, moe: 5.2 }, { est: 45.9, moe: 5.7 }] },
      { label: "65+", n: 233, estimates: [{ est: 19.9, moe: 4.7 }, { est: 39.6, moe: 5.7 }, { est: 40.4, moe: 5.7 }] },
    ],
  },
})
