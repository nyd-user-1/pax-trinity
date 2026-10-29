# The Resonance score — pure, defined on the loop's own currency

Brendan's ruling, 2026-10-29: the old Resonance definition (the pre-publication channel-median stack) is thrown out. The score is defined fresh on Trinity's RCT loop, and it is pure — lift percentile only, no breadth ingredient.

## Definition

**Resonance = the percentile, 0 to 100, of a video's primary-outcome lift vs placebo among every lift on file** — the About Result All-tests pool, promoted and named. Ties count half (about-result.tsx's percentile function is the reference implementation).

- **Tested videos** compute it from the register: weighted, criterion-honest, the real thing.
- **Untested videos** carry a predicted Resonance from their nearest comparables in the archive pool (same metric where possible, else the metric-mixed pool is forbidden — stay same-metric). The completion hook replaces prediction with measurement the moment the video's test closes. The RCT badge already separates measured from predicted — add no extra labeling.

## Display

1. **/clips** — every clip's test panel shows its Resonance.
2. **/reports-2** — each video card carries the 0–100 mark beside its lift; the executive summary ranks the wave's videos by it.

House dress throughout; no explainer text (the number and its place carry it).

## Rules

Shared checkout: stage only your paths, never amend, don't push. AGENTS.md binds (no lead-ins, no arrow character). Verify headless on localhost:3000 (~/bin/trinity-dev-up if down). The typecheck is the Amplify build's; npm. Commit in the house voice; report to lead-agent with exactly where to look; questions to lead-agent, never Brendan.
