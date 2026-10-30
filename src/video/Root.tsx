import * as React from "react"
import { Composition, continueRender, delayRender, Folder } from "remotion"
import { loadFont } from "@remotion/google-fonts/PlusJakartaSans"

import { allTemplates, durationOf } from "./registry"
import { GRAPHICS, versionEntries, type SavedVersion } from "./studio"
import { FPS, SIZES } from "./theme"

// Remotion's root, for Studio and the renderer, in three folders:
// - Templates: every registered template, its fixture as the default props, its schema for Studio's
//   props editor, and its length worked out again whenever the props change.
// - Graphics: the Enhance flow's graphics, each over an optional backdrop (a recorded take's URL).
// - Versions: the signed-in person's saved videos, v-<templateId>-<n>, from /api/video/versions on the
//   page's own origin. Where there is no app server behind the page (npm run video:studio, the renderer,
//   the tests), the fetch fails and the Studio shows the rest alone.
// Inside the app TemplatePlayer plays the same components; this file is never imported there.

// 800 for the graphics' heaviest type (the checklist's rows and footer); the templates use 400 to 700.
loadFont("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin"] })

function useSavedVersions(): SavedVersion[] {
  const [versions, setVersions] = React.useState<SavedVersion[]>([])
  const [handle] = React.useState(() => delayRender("Loading saved versions", { timeoutInMilliseconds: 15_000 }))
  React.useEffect(() => {
    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), 8_000)
    fetch("/api/video/versions", { signal: abort.signal, credentials: "same-origin", headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { versions?: SavedVersion[] } | null) => setVersions(Array.isArray(d?.versions) ? d.versions : []))
      .catch(() => setVersions([]))
      .finally(() => {
        clearTimeout(timer)
        continueRender(handle)
      })
    return () => abort.abort()
  }, [handle])
  return versions
}

export function Root() {
  const saved = useSavedVersions()
  const versions = React.useMemo(() => versionEntries(saved), [saved])
  return (
    <>
      <Folder name="Templates">
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
      </Folder>
      <Folder name="Graphics">
        {GRAPHICS.map((g) => (
          <Composition
            key={g.id}
            id={g.id}
            component={g.component}
            schema={g.schema}
            defaultProps={g.defaultProps}
            fps={FPS}
            width={SIZES.vertical.width}
            height={SIZES.vertical.height}
            durationInFrames={g.durationInFrames}
          />
        ))}
      </Folder>
      <Folder name="Versions">
        {versions.map(({ id, template: t, props }) => (
          <Composition
            key={id}
            id={id}
            component={t.component}
            schema={t.propsSchema}
            defaultProps={props}
            fps={t.fps}
            width={t.width}
            height={t.height}
            durationInFrames={durationOf(t, props)}
            calculateMetadata={({ props: edited }) => ({ durationInFrames: durationOf(t, t.propsSchema.parse(edited)) })}
          />
        ))}
      </Folder>
    </>
  )
}
