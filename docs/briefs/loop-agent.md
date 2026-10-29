# The loop, part B — the agent: the inbox fields surveys and tests

## The loop this serves

Read docs/briefs/loop-pipeline.md's first section for the whole loop. Your part: a survey or test is executed by the inbox's agent — it sends, follows up, assigns people to groups, and closes the fielding. Use the existing inbox, agent-mail and contacts machinery; extend it, never fork it.

## Deliverables

1. **Assignment.** A test (/message-tests) or survey (/s/<slug>) is assignable to the agent with a contact group. The agent mails each contact their link, tracks who responded, follows up with non-responders, and stops at the target (the test's per-arm targets; a survey's stated n).
2. **Groups.** A survey respondent's answers profile them into panel groups (party, media trust, and the like — the A/T question ids carry the construct). Groups are selectable audiences for future sends. At test send, assignment to arms — placebo included — is randomized, balanced within groups.
3. **Completion.** When fielding completes, the agent calls part A's completion hook (it owns all computation — never duplicate it), then mails staff and partners that the results are in, and appends the result to the clip's discussion.
4. **Prove it.** One survey and one seeded demo test fielded start to finish by the agent against a small contact group, visibly closed, hook fired, mail sent.

## Seams — not yours

Statistics, weighting, ResultSet/export writing (part A). Clips, America Thinks, reports and lift surfaces (part C). The respondent pages themselves: link to them, don't redesign them.

## Rules

Shared checkout: stage only your paths, never amend, never push; commit per milestone in the house voice. AGENTS.md binds (no lead-in paragraphs, no arrow character); no placeholder or mock labels; first person where a voice is needed. Verify headless on localhost:3000 (~/bin/trinity-dev-up if down); the typecheck is the Amplify build's; npm, not pnpm. Real mail sends only to Brendan's own addresses in dev — nothing to real partner contacts. Report to lead-agent by SendMessage per milestone; questions to lead-agent, never Brendan. A seam conflict stops work and goes to the lead.
