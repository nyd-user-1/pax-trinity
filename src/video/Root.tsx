import * as React from "react"
import { Composition } from "remotion"
import { loadFont } from "@remotion/google-fonts/PlusJakartaSans"

import { allTemplates, durationOf } from "./registry"

// Remotion's root, for Studio and the renderer: every registered template as a
// Composition, its fixture as the default props, its schema for Studio's props
// editor, and its length worked out again whenever the props change. Inside the
// app TemplatePlayer plays the same components; this file is never imported there.

loadFont("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] })

export function Root() {
  return (
    <>
      {allTemplates().map((t) => {
        const defaults = t.propsSchema.parse(t.fixture)
        return (
          <Composition
            key={t.id}
            id={t.id}
            component={t.component}
            schema={t.propsSchema}
            defaultProps={defaults}
            fps={t.fps}
            width={t.width}
            height={t.height}
            durationInFrames={durationOf(t, defaults)}
            calculateMetadata={({ props }) => ({ durationInFrames: durationOf(t, t.propsSchema.parse(props)) })}
          />
        )
      })}
    </>
  )
}
