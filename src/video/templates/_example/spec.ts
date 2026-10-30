import { FPS, SIZES } from "../../theme"
import { defineSpec } from "../../template"
import { ExampleProps } from "./schema"

export const exampleSpec = defineSpec({
  id: "example",
  name: "Example",
  description: "The pattern's example: a title, one bar drawn to a value from 0 to 100, and an optional caption.",
  propsSchema: ExampleProps,
  fps: FPS,
  ...SIZES.wide,
  durationInFrames: 5 * FPS,
  fixture: { title: "Support among everyone", value: 64.3, caption: "One bar, drawn from the props alone." },
})
