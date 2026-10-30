import * as React from "react"
import { z } from "zod"

// Relative paths: Studio's webpack has no "@/" alias. Neither file reaches past remotion, react and
// plain data (footage.ts imports nothing), so both are safe in the Studio's browser bundle.
import { GraphicVideo } from "../components/studio/graphic-video"
import { BRAND_PRESETS, GRAPHIC_KINDS, type Brand, type GraphicKind, type Graphics } from "../lib/footage"
import { getTemplate, type AnyTemplate } from "./registry"
import { FPS } from "./theme"

// What Remotion Studio lists beyond the templates (Root.tsx):
//
// - Graphics: the Enhance flow's graphics (src/components/studio/graphic-video.tsx), one composition per
//   kind at 1080x1920, each with its own fields, a brand, and a backdrop: paste a recorded take's URL
//   (the Record flow's clips CDN) and the graphic plays over it.
// - Versions: the signed-in person's saved videos (/api/video/versions), each as its template's
//   composition filled with that version's props.

const line = (max: number) => z.string().max(max)

/** Every graphic's backdrop and dress. */
const DRESS = {
  backdrop: z.string().optional(),
  brand: z.object({ name: z.string(), logo: z.string().nullable(), primary: z.string(), accent: z.string(), font: z.enum(["jakarta", "condensed", "serif"]) }),
}

/** Each graphic's own fields, as the Enhance flow's plan writes them (src/app/footage-actions.ts), flat, so
 *  Studio's props editor shows them as fields. */
const SCHEMAS: Record<GraphicKind, z.ZodObject> = {
  checklist: z.object({ title: line(40), items: z.array(line(40)).min(1).max(3), footer: line(80), ...DRESS }),
  callout: z.object({ text: line(80), highlight: line(30), ...DRESS }),
  stat: z.object({ value: line(12), label: line(60), ...DRESS }),
  quote: z.object({ text: line(160), by: line(60), ...DRESS }),
  intro: z.object({ title: line(60), sub: line(80), ...DRESS }),
  end: z.object({ ask: line(60), handle: line(40), ...DRESS }),
}

/** Studio's samples: the Yes on 3 card as the team ran it in Wave 2, and lines from the same campaign. */
const SAMPLES: Graphics = {
  checklist: { title: "QUESTION 3", items: ["One Primary Ballot", "For Every Voter", "With Every Candidate"], footer: "Top two advance to November." },
  callout: { text: "Top two advance to November", highlight: "November" },
  stat: { value: "57%", label: "Ballot support after Pahlow's video" },
  quote: { text: "One primary ballot for every voter, with every candidate.", by: "Yes on 3" },
  intro: { title: "Question 3", sub: "One primary for every voter" },
  end: { ask: "Vote Yes on 3", handle: "@yeson3ma" },
}

const EMPTY: Graphics = {
  checklist: { title: "", items: [], footer: "" },
  callout: { text: "", highlight: "" },
  stat: { value: "", label: "" },
  quote: { text: "", by: "" },
  intro: { title: "", sub: "" },
  end: { ask: "", handle: "" },
}

export type GraphicEntry = {
  id: string
  kind: GraphicKind
  schema: z.ZodObject
  defaultProps: Record<string, unknown>
  durationInFrames: number
  component: (props: Record<string, unknown>) => React.ReactNode
}

function entry(kind: GraphicKind, seconds: number): GraphicEntry {
  const component = (props: Record<string, unknown>) => {
    const { backdrop, brand, ...fields } = props
    return (
      <GraphicVideo
        kind={kind}
        graphics={{ ...EMPTY, [kind]: fields } as Graphics}
        backdrop={typeof backdrop === "string" && backdrop ? backdrop : undefined}
        brand={brand as Brand}
      />
    )
  }
  return { id: `graphic-${kind}`, kind, schema: SCHEMAS[kind], defaultProps: { ...SAMPLES[kind], brand: BRAND_PRESETS[0] }, durationInFrames: seconds * FPS, component }
}

export const GRAPHICS: GraphicEntry[] = GRAPHIC_KINDS.map((k) => entry(k.id, k.seconds))

/** A saved version as the list route returns it; only what Studio needs. */
export type SavedVersion = { id: string; templateId: string; props: unknown }

export type VersionEntry = { id: string; template: AnyTemplate; props: Record<string, unknown> }

/** The versions Studio can draw: a composition id Remotion accepts, a template that still exists, and
 *  props that still pass its schema. Anything else is left out rather than breaking the Studio. */
export function versionEntries(versions: readonly SavedVersion[]): VersionEntry[] {
  const out: VersionEntry[] = []
  for (const v of versions) {
    if (typeof v.id !== "string" || !/^v-[a-z0-9-]+-\d+$/.test(v.id)) continue
    const template = getTemplate(v.templateId)
    if (!template) continue
    const parsed = template.propsSchema.safeParse(v.props)
    if (parsed.success) out.push({ id: v.id, template, props: parsed.data as Record<string, unknown> })
  }
  return out.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }))
}
