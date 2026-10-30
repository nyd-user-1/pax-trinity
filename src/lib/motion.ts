// The slide (named 2026-10-30, Brendan's "very smooth" one): the motion of the shell's sidebar as it opens
// and shuts (components/shell.tsx), the America Thinks, Lift and Survey rails (components/bank/
// bank-frame.tsx) and About Result's sheet. A panel's size eases over 300ms, ease-in-out, while its
// content holds its own size inside a clip, so nothing reflows mid-motion. Run backwards it closes a
// panel; Consensus's Questions closes a finished row of cards with it (components/consensus/survey.tsx).
// Pair it with the property that moves, e.g. `transition-[width] ${SLIDE}`.
export const SLIDE = "duration-300 ease-in-out motion-reduce:transition-none"
