# The loop, part C — the surfaces: every room opens onto the next

## The loop this serves

Read docs/briefs/loop-pipeline.md's first section for the whole loop. Your part: each surface implies and guides its preferred action, and the loop's stations link. Build against the register's existing types (src/lib/results/types.ts) and part A's stated artifact shapes; where A hasn't landed yet, the shapes are those files' — don't invent variants.

## Deliverables

1. **Clips sends to test.** The clip's preferred next action: Send to test creates a message-test prefilled with the clip as a treatment arm and a placebo slot, and links back to the clip. The clip panel's results join (clip-test.tsx) is already the output end — leave it reading the register.
2. **America Thinks gains Responses.** A new section at the rail's foot mirroring the question/construct section's dress: each answered question a card — the question, its topline shares, n, dates — fed by the survey/test responses artifact, keyed by A/T question ids. Combined responses also join the main question library's listing.
3. **Reports wears the house skin.** A reports surface in the inbox/A-T dress: rows in the list (one per report, survey or test readout — name, dates, n, status), split view held, a row opening the document (the /reports-2 doc, the survey topline) in the pane. The existing document pages are the content; this surface is the shelf.
4. **Consensus banks questions.** A consensus card can be banked as a test question: attachable in message-tests' setup, so each video's questionnaire draws from banked cards and returns them for reuse.
5. **Partners see the work.** A visibility pass following the clips partner pattern: partners reach my videos, surveys, tests, lift analyses and reports.

## Seams — not yours

Fielding, sending, follow-ups (part B). Weighting, lift math, ResultSet/export writing (part A). /lift's internals and /reports' document renderers: link to them, don't edit them.

## Rules

Shared checkout: stage only your paths, never amend, never push; commit per milestone in the house voice. AGENTS.md binds (no lead-in paragraphs, no arrow character); no placeholder or mock labels; first person where a voice is needed. Verify headless on localhost:3000 (~/bin/trinity-dev-up if down); the typecheck is the Amplify build's; npm, not pnpm. Report to lead-agent by SendMessage per milestone; questions to lead-agent, never Brendan. A seam conflict stops work and goes to the lead.
