import { FPS, SIZES } from "../../theme"
import { defineSpec } from "../../template"
import { MetricTrendProps } from "./schema"

// GSS abany, "Yes", every wave 1977–2024.
const ABANY: [string, number][] = [
  ["1977", 37.7], ["1978", 34.0], ["1980", 40.7], ["1982", 41.2], ["1983", 33.3], ["1984", 38.4], ["1985", 39.4], ["1987", 41.0], ["1988", 37.0], ["1989", 40.1],
  ["1990", 43.4], ["1991", 41.0], ["1993", 44.4], ["1994", 45.7], ["1996", 43.9], ["1998", 39.4], ["2000", 38.1], ["2002", 41.0], ["2004", 39.2], ["2006", 39.5],
  ["2008", 41.7], ["2010", 42.7], ["2012", 42.5], ["2014", 45.3], ["2016", 46.0], ["2018", 49.8], ["2021", 53.7], ["2022", 57.1], ["2024", 58.3],
]

export const metricTrendSpec = defineSpec({
  id: "metric-trend",
  name: "Trend",
  description:
    "Up to four series across waves, wide: each line drawn left to right behind a leading dot, an optional callout springing in as the line passes its point, the last value labeled at each line's end.",
  propsSchema: MetricTrendProps,
  fps: FPS,
  ...SIZES.wide,
  durationInFrames: 8 * FPS,
  fixture: {
    title: "Legal abortion if a woman wants it for any reason",
    series: [{ name: "Yes", points: ABANY.map(([label, value]) => ({ label, value })) }],
    unit: "%",
    annotation: { atIndex: ABANY.length - 1, text: "58.3%, the highest in 47 years" },
  },
})
