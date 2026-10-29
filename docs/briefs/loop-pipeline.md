# The loop, part A — the pipeline: a completed test writes its own ResultSet

## The loop this serves

The platform replaces the hand-made workflow that produced report 2. Chat makes a video; clips holds it and its discussion; a test (/message-tests: arms with per-arm targets, a placebo, the respondent page at /test/[id]) or a survey (/survey topline, /s/ fill form, responses in the test-responses table) is fielded by the inbox's agent; responses weight to the America Thinks targets; lifts and toplines compute; a ResultSet lands in the register; /lift, /reports, /clips and /america-thinks read it; mail goes out. Swayable's methodology (swayable.com/methodology) and src/lib/results (ma-wave-1/2 — report 2's register) are the model: randomized exposure against placebo, lift in percentage points with a margin and a stated criterion. Today every ResultSet is hand-carried. This brief makes the machine write them.

## Deliverables

1. **The completion hook.** When a message-test reaches its per-arm targets or is closed, compute per arm × outcome × segment: weighted levels (rake the responses to the America Thinks targets — see docs/briefs/raking-targets.md and its code), the lift against the placebo arm, the margin (the export's 1.645-SE convention), and the significance call at the study's criterion.
2. **Two artifacts, emitted automatically.** (a) A ResultSet in the register's exact shape (src/lib/results/types.ts) — arms, outcomes, toplines, dimensions, cells, threshold, sample. (b) The audience-data export rows in the pax_test format (all fourteen fields, significance included) plus the index entry — so /lift's folders, About Result's benchmarks, and /clips' joined panels light up with no UI change anywhere.
3. **The survey's artifact.** A completed survey emits its topline: question id, shares, n, fielding dates — the responses data the America Thinks Responses section (part C) will draw, keyed by the questions' A/T ids.
4. **Prove it end to end.** One organically produced ResultSet from a seeded demo test run, plus the open-primaries survey's real topline, visible on /lift and /clips with no hand-carried file.

## Seams — not yours

Fielding, sending, follow-ups, group assignment (part B, the inbox agent). All surface/UI work (part C). The /lift and /reports renderers and src/lib/results' existing wave files: read, never edit.

## Rules

Shared checkout: stage only your paths, never amend, never push; commit per milestone in the house voice. AGENTS.md binds (no lead-in paragraphs, no arrow character); no placeholder or mock labels; first person where a voice is needed. Verify headless on localhost:3000 (~/bin/trinity-dev-up if down); the typecheck is the Amplify build's; npm, not pnpm. Report to lead-agent by SendMessage per milestone; questions to lead-agent, never Brendan. A seam conflict stops work and goes to the lead.
