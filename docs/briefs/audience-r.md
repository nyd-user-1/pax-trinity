# Brief R — Constructs: the question-to-construct concordance

You are an Opus window taking Brief R. Ground rules as before: commit locally per feature, never push; stage by explicit path, never `-A`; check `git log -1` immediately before any commit — several windows share this checkout. Never run tsc, a Next build, or a second dev server on this 8GB Mac (a hook enforces it; the dev server on :3000 is Brendan's — leave it alone). The store is single-writer: take `audience/store/.lock` before any store computation; migration numbers are claimed by message between windows and frozen once on disk. Exports never enter git: they regenerate and upload to the bucket's `exports/` prefix, served at `/audience-data/`. Yours: the migration, the concordance module and seed in `audience/`, the regenerated `index.json` upload, and this file's Worker report.

## The vocabulary, settled by Brendan (2026-10-26)

A **question** is one asked instrument — one wording, one administration, one mnemonic (abany, abanyg, conlegiy). A **construct** is the concept that groups versions of the same question — across rewordings, administrations and, eventually, sources. Nothing about this is averaging: every question keeps its own rows; a construct is a recorded, citable claim that these questions measure one thing. The store's existing `constructs` table is historically misnamed — its raw-tier entries are questions, 1:1 — and this brief builds the real layer above it without renaming or breaking anything that exists.

## What exists today

- 15 hand-harmonized entries (confidence_congress, party_id_7, …) that *fold* their versions' data under one id — the data stays as loaded; do not restructure them this pass.
- 8,028 question entries in the served index, with wording (Brief P) and, if Brief Q has landed, topics.
- No table anywhere linking versions to a concept: abany, abanyg and ablegal point at nothing shared.

## The mechanism

A migration (claim the next number by message to the lead's session before writing it) adding two tables:

- `construct(construct_id, label, definition, anchor, note)` — `anchor` is the citation that makes the grouping the field's claim rather than ours: "GSS replicating core", "MR133 (Cowan, Hout & Perrett 2021)", "ANES time series". A construct without an anchor carries note text saying whose judgment it is.
- `construct_member(construct_id, question_id, relation)` — relation one of `version` (a rewording or experiment), `mode` (the same text, another administration: the web-grid twins), `core` (the construct's flagship form).

A loader module registers constructs and memberships; `index.json` gains one optional top-level array `families: { id, label, definition, anchor, members: { question: string, relation: string }[] }[]` — named `families` in the export so the app's existing `constructs` key keeps meaning what it means today. Everything else byte-identical.

## The seed

Only groupings this conversation has already established, every one anchored:

1. **The Rossi abortion battery** — abdefect, abnomore, abhlth, abpoor, abrape, absingle as `version`s (core: abdefect's stem family — your call which member is `core`, say so), each web-grid twin (abdefectg…) a `mode` member beside its parent. Anchor: MR133.
2. **Abortion, any reason** — abany core, abanyg mode, ablegal version. Anchor: MR133 (its documented ABANY caveat goes in the note).
3. **Confidence in Congress** — confidence_congress core; conlegiy, concong, trcong, trlegis versions. Anchor: GSS replicating core / the confidence battery; the trust rewordings' distance noted.
4. **Party identification** — party_id_7 core, the lone stable question; it exists to prove a one-member construct renders sanely. Anchor: GSS replicating core.
5. The remaining 13 hand-harmonized entries, each as a construct whose sole member (relation `core`) is itself — so the harmonized tier appears in the layer without restructuring.

Nothing speculative: no grouping the lead hasn't seen. The machinery is the deliverable; the library of constructs grows by later rulings.

## Done means

Migration applied to the store under the lock; the seed loaded; `index.json` regenerated and uploaded; verified in Node against the served file — the families array present, member counts right, abany appearing in exactly one family with relation core and its twin as mode. Report below with hashes, the migration number claimed, and rulings for the lead; the UI (a construct chip on member questions, a construct view) is the lead's side after your report.

---

## Worker report

*(append here: hashes, migration number, seed counts, verification, rulings)*
