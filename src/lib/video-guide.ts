import "server-only"

import { RESULT_SETS } from "@/lib/results"
import { listTemplates } from "@/video/specs"

// What /api/chat tells the model about making videos (Brendan, 2026-10-30): the templates it can fill
// (src/video/specs.ts listTemplates: id, purpose, frame, the JSON Schema of the props), how to answer
// with a ```pax-video block, how to revise one, and the lift results a lift card is filled from, so no
// figure is invented. The page draws each block and saves it as a version (components/chat/video-block.tsx).

/** The register's outcomes under the names the lift card draws them by. */
const METRIC: Record<string, string> = { ballot: "Support", comprehension: "Comprehension" }

/** Every published test's treatments, each outcome's placebo level, lift and verdict. Seeded demo sets are left out. */
function liftResults(): string {
  const lines: string[] = []
  for (const set of RESULT_SETS) {
    if (set.simulated) continue
    const placebo = set.arms.find((a) => a.role === "placebo")
    const study = set.title.replace(/:\s*what the test found$/i, "")
    for (const arm of set.arms) {
      if (arm.role !== "treatment") continue
      const parts = set.outcomes.flatMap((o) => {
        const name = METRIC[o.id]
        const t = set.toplines.find((x) => x.armId === arm.id && x.outcomeId === o.id)
        const c = placebo ? set.toplines.find((x) => x.armId === placebo.id && x.outcomeId === o.id) : undefined
        if (!name || t?.liftPp == null || c?.levelPct == null) return []
        // A lift that subtracts two rounded levels is approximate, as the report prints it (≈).
        const approx = t.derivation === "derived_from_rounded" ? "≈" : ""
        return [`${name} placebo ${c.levelPct}%, lift ${approx}${t.liftPp > 0 ? "+" : ""}${t.liftPp} pp, ${t.verdict ?? "inconclusive"}`]
      })
      if (parts.length) lines.push(`- ${study} · ${arm.name} (n ${Math.round(arm.nWeighted)} weighted): ${parts.join("; ")}`)
    }
  }
  return lines.join("\n")
}

export function videoGuide(): string {
  const templates = listTemplates()
    .filter((t) => t.id !== "example")
    .map((t) => `- ${t.id} (${t.name}, ${t.width}x${t.height}): ${t.description}\n  Props JSON Schema: ${JSON.stringify(t.schema)}`)
  return `=== VIDEO TEMPLATES ===
I can make a short video by filling a template. The page draws it live, saves it as the user's next version of that template, and opens it in the Studio. To make one, write a \`\`\`pax-video code block holding one JSON object and nothing else: {"templateId": "<id>", "title": "<a few words naming this video>", "props": {<the template's props>}}. Before the block, one sentence says what the video shows; never describe the JSON.
- The props must fit the template's JSON Schema exactly. A block that does not fit is shown as an error in place of the video.
- Fill props only from figures in this conversation or in this prompt: the record, the LIFT RESULTS below, an ACTIVE CONTEXT, the SHORTS. Never invent a number, a name, a handle or a date. When a figure the template needs is missing, say which one and ask for it, and write no block.
- Each video block I wrote earlier in this conversation carries its saved id as "version" (v-<templateId>-<n>). To change one ("make the caption shorter", "add callouts", "make it shorter"), write a new complete block, every prop, changed only as asked, with "parent" set to that version's id.
- Pick the template whose description fits the request; yes-on-3-card is for Yes on 3 work only.
Templates:
${templates.join("\n")}
=== END VIDEO TEMPLATES ===

=== LIFT RESULTS — USE THESE EXACT NUMBERS ===
Each tested video against its own wave's placebo, in percentage points. Support is ballot support; Comprehension is the share who identified the change. "detectable" cleared the study's test (a lift card's significant: true); "inconclusive" did not (significant: false). The best-tested video is the one with the largest detectable Support lift.
${liftResults()}
=== END LIFT RESULTS ===`
}
