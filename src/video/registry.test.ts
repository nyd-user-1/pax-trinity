import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { bundle } from "@remotion/bundler"
import { renderStill, selectComposition } from "@remotion/renderer"
import { beforeAll, describe, expect, it } from "vitest"

import { allTemplates, unpaired } from "./registry"
import { allSpecs, durationOf, validate, YES_ON_3_FAMILY } from "./specs"
import { GRAPHICS, versionEntries } from "./studio"

// Every spec has its component; every template's fixture passes its schema,
// props that do not fit are refused, and its first and last frames render
// without throwing, from the same bundle Studio uses. The same for Studio's
// Graphics folder, and its Versions folder keeps only versions it can draw.

let serveUrl = ""

beforeAll(async () => {
  serveUrl = await bundle({ entryPoint: path.join(path.dirname(fileURLToPath(import.meta.url)), "index.ts") })
})

it("pairs every spec with a component", () => {
  expect(unpaired()).toEqual({ specs: [], components: [] })
  expect(allTemplates().map((t) => t.id)).toEqual(allSpecs().map((s) => s.id))
})

describe.each(allSpecs().map((t) => [t.id, t] as const))("%s", (id, t) => {
  it("parses its fixture", () => {
    const v = validate(id, t.fixture)
    expect(v.ok, v.ok ? "" : v.error).toBe(true)
  })

  it("refuses props that do not fit", () => {
    expect(validate(id, { nonsense: true }).ok).toBe(false)
  })

  it("renders its first and last frames", async () => {
    const inputProps = t.propsSchema.parse(t.fixture) as Record<string, unknown>
    const composition = await selectComposition({ serveUrl, id, inputProps })
    expect(composition.durationInFrames).toBe(durationOf(t, inputProps))
    for (const frame of [0, composition.durationInFrames - 1]) {
      await renderStill({ composition, serveUrl, frame, inputProps, output: path.join(os.tmpdir(), `pax-video-test-${id}-${frame}.png`) })
    }
  })
})

describe("the yes-on-3 family", () => {
  it("is four vertical templates, each taking a recorded take as its backdrop and its length from seconds", () => {
    expect(YES_ON_3_FAMILY).toHaveLength(4)
    for (const id of YES_ON_3_FAMILY) {
      const t = allSpecs().find((s) => s.id === id)!
      expect(t, id).toBeDefined()
      expect(t.height > t.width, id).toBe(true)
      // A take as the chooser passes it: the clips CDN's address and the take's whole length.
      const v = validate(id, { ...t.fixture, backdrop: "https://d19bx9wfmnrb34.cloudfront.net/recorded/rec-01jbx3c6c8ka7m2v0rq5n4dfgh.webm", seconds: 45 })
      expect(v.ok, v.ok ? id : v.error).toBe(true)
      if (v.ok) expect(v.durationInFrames, id).toBe(45 * t.fps)
    }
  })
})

describe.each(GRAPHICS.map((g) => [g.id, g] as const))("%s", (id, g) => {
  it("parses its sample", () => {
    const r = g.schema.safeParse(g.defaultProps)
    expect(r.success, r.success ? "" : r.error.message).toBe(true)
  })

  it("renders its first and last frames", async () => {
    const composition = await selectComposition({ serveUrl, id, inputProps: g.defaultProps })
    expect(composition.durationInFrames).toBe(g.durationInFrames)
    for (const frame of [0, composition.durationInFrames - 1]) {
      await renderStill({ composition, serveUrl, frame, inputProps: g.defaultProps, output: path.join(os.tmpdir(), `pax-video-test-${id}-${frame}.png`) })
    }
  })
})

it("keeps the versions Studio can draw and leaves out the rest", () => {
  const fixture = allSpecs().find((s) => s.id === "lift-card")?.fixture
  const entries = versionEntries([
    { id: "v-lift-card-2", templateId: "lift-card", props: fixture },
    { id: "v-lift-card-1", templateId: "lift-card", props: fixture },
    { id: "v-lift-card-10", templateId: "lift-card", props: fixture },
    { id: "v-gone-1", templateId: "gone", props: {} },
    { id: "v-lift-card-3", templateId: "lift-card", props: { nonsense: true } },
    { id: "not an id", templateId: "lift-card", props: fixture },
  ])
  expect(entries.map((e) => e.id)).toEqual(["v-lift-card-1", "v-lift-card-2", "v-lift-card-10"])
  expect(entries[0].template.id).toBe("lift-card")
})
