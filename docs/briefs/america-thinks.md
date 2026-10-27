# Brief: America Thinks — the rename, and the boxes learn to sell

From: lead (pax-trinity-1c) · 2026-10-27 · Brendan's order

Two workers, two sections, zero shared files. Brendan is also rewriting the
box bodies himself in parallel — his words win when they land; ours stand
until then (newest decision wins).

## For wireframes — the ten bodies, as value, in a copy doc

The PAX_BOXES `body` lines were written as engineering narratives. Brendan's
correction: they should be marketing use-case narratives — what problem this
thing solves, why it is valuable to YOU (the partner reading it). Rewrite all
ten into **`docs/copy/box-bodies.md`** (a committed doc, one entry per box:
box title, the new body line, one sentence of rationale). Surfaces merges
them into home-data.ts — do not touch src yourself.

Register rules:
- One or two sentences a partner reads as "this saves me money / time / a
  bad decision", not a tour of the internals. Lead with the problem or the
  payoff, not the architecture.
- First person singular where a voice is needed ("I show you…"), never
  "we"/"our", never third-person product voice.
- Concrete beats hype: real counts and real nouns are persuasive; "powerful
  insights" is banned slop. No "unlock", "seamless", "supercharge".
- House bans hold: no "→", no "pill" (chip/badge), no "raw"→"bulk" swap, no
  LegiScan, no lead-in filler.
- The box is named **America Thinks** now, not Audience (Polls still points
  into it; Scripts and Reports keep honest tense about what exists).
- Example of the move, for calibration (don't copy it): Audience's
  "Who the electorate is, where attitudes stand…" becomes something like
  "Before you spend a dollar persuading America, know where it already
  stands: five decades of what Americans believe, question by question, so
  a claim about the electorate is a lookup, not a guess."

Commit the doc (explicit path, git log -1 first, never push), message
pax-trinity-1c and surfaces the sha.

## For surfaces — rename, reroute, merge, reprint (in this order)

1. **Audience becomes America Thinks, /audience becomes /america-thinks.**
   - `git mv src/app/audience src/app/america-thinks`; fix every import
     path that referenced it (grep, don't guess).
   - home-data.ts: the box title, its href, and the Polls box's
     `?source=POLL` href.
   - The shell: LIVE set path and the nav row's label and href.
   - A permanent redirect `/audience` → `/america-thinks` in next.config
     (query strings carry over by default; the six dead redirects already
     there stay untouched).
   - Sweep user-facing copy: anywhere "Audience" names the product (box
     guides' steps and gap lines, other boxes' guides, dossier back-links,
     wire pages) becomes "America Thinks"; internal identifiers, file
     names inside the moved dir, bucket names and code comments stay.
2. **Merge wireframes' bodies** from docs/copy/box-bodies.md into
   PAX_BOXES — bodies only; every `guide` stays exactly as it is (Brendan:
   keep the how-to-use-its).
3. **The walkthrough**: Audience section renamed and re-pathed, the Chat
   section added (five free questions signed out), BASE stays the dev URL.
4. **Tell me to push**, wait for my green ping, re-drive the tour's steps at
   the dev URL (the redirect too), then reprint
   docs/reports/client-walkthrough.pdf once, commit, send shas.

Rules: shared checkout (git log -1 first, explicit paths, never amend,
never push); parse-check via node + typescript createSourceFile — be
type-strict, the Amplify build is the only type check; NO dev servers
(:3000 is dead on Brendan's order — the dev URL is the smoke target);
smoke = dev build after my push.
