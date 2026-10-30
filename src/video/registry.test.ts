import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { bundle } from "@remotion/bundler"
import { renderStill, selectComposition } from "@remotion/renderer"
import { beforeAll, describe, expect, it } from "vitest"

import { allTemplates, unpaired } from "./registry"
import { allSpecs, durationOf, validate } from "./specs"

// Every spec has its component; every template's fixture passes its schema,
// props that do not fit are refused, and its first and last frames render
// without throwing, from the same bundle Studio uses.

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
