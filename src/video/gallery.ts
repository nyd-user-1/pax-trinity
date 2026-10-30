import { allSpecs } from "./specs"

/** The chat's fenced block for a filled template: ```pax-video, then { templateId, props } as JSON. */
export const videoBlock = (templateId: string, props: unknown) => "```pax-video\n" + JSON.stringify({ templateId, props }) + "\n```"

/** The + menu's Video templates: every template but the example, each filled with its sample props, as a reply the chat draws. */
export function galleryMessage(): string {
  const shown = allSpecs().filter((s) => s.id !== "example")
  return [
    "Here's every video template I can fill so far, each with real figures from Lift and America Thinks.",
    ...shown.map((s) => `**${s.name}**\n\n${videoBlock(s.id, s.fixture)}`),
  ].join("\n\n")
}
