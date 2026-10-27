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

Done: the migration is applied, the seed loaded, and `index.json` regenerated, uploaded and verified against the served file.

### Hashes

- **7b0d2fb** holds all of Brief R's code: the migration, `audience/construct_layer.py`, the export block, the audit check, the README lines and the first cut of the tests. Its message describes only the toolbar. The app window committed at 21:37 with a plain `git commit`, which took the index I had staged a minute earlier. I checked the content: it is exactly what I staged, with none of Window-Q's uncommitted hunks. Per the shared-checkout rule I did not amend it.
- **87f6308** is the one change since (the tests now name their geography directly, so they pass in a clone without the raw/ Census cache) and carries the full Brief R description in its message.

### Migration

**009_construct_layer.sql**, claimed by message to pax-trinity-1c and confirmed; Window-Q took 010. I applied it to the store under the lock at 21:34. `migrate.apply` applies everything pending, so the same run also applied Q's 010 (an empty `concordance.gss_topics` column); Q's plan to apply it themselves crossed my run in the inbox, and I told them at once.

```
construct        (construct_id PK, label, definition, anchor, note,
                  CHECK (anchor IS NOT NULL OR note IS NOT NULL))
construct_member (construct_id, question_id, relation, parent, ordinal,
                  PK (construct_id, question_id))
```

Two columns beyond the brief's three:
- `parent` names the item a `mode` member repeats. In the six-item Rossi construct, `relation = mode` alone can't say which item a twin belongs to.
- `ordinal` keeps the seed's order: MR133's a–f for the battery, chronological for Congress.

`relation` has no SQL CHECK: the vocabulary grows by ruling, and DuckDB can't alter a CHECK. `construct_layer.validate` enforces it, along with exactly one core per construct, a mode's parent being a core or version member of the same construct, and every member being a `concordance` question. The audit re-checks members against the store (exit 0 on the real store).

### Seed: 17 constructs, 34 memberships

| construct | members | anchor |
|---|---|---|
| abortion_rossi | abdefect **core**; abnomore, abhlth, abpoor, abrape, absingle version; each …g twin mode, right after its item | MR133 (Cowan, Hout & Perrett 2021) |
| abortion_any_reason | abany **core**; abanyg mode (of abany); ablegal version | MR133 |
| confidence_congress | confidence_congress **core**; conlegiy, concong, trlegis, trcong version | GSS replicating core: the confidence battery |
| party_id_7 and the 13 other harmonized GSS entries | each its own sole core | per instrument (below) |

- **Rossi core: abdefect.** It is Rossi's first condition (MR133 p. 4: birth defects first, for Thalidomide), item (a), the one the stem attaches to.
- **The ABANY caveat**, in the note from MR133 p. 4: 20% of people who reject at least one Rossi item say yes to "any reason", and the seven-item scale is less reliable than the six (Hout and Hastings 2016).
- **Anchors for the 13:**
  - "GSS replicating core": TRUST, FAIR, HELPFUL, GETAHEAD and ATTEND, each in the codebook's core body and asked since the 1970s; CONFED and CONPRESS read "…: the confidence battery".
  - "GSS replicating core; ANES time series": ideology_7.
  - "ISSP National Identity module, in the GSS": national_pride, national_pride_domain, nationalism.
  - Core plus ISSP Role of Government and Social Inequality: gov_reduce_income_diff.
  - "GSS topical and ISSP modules": income_gap_too_large. INCGAP ran in the 1996 Markets module as well as the ISSP inequality years.
- **Notes** name every cross-source fold as my harmonization: party_id_7 also holds ANES VCF0301 and CES pid7; ideology_7 holds ANES VCF0803.

### index.json as uploaded (the last write before the reshape, unless Q uploads after me)

- **Bytes and hash:** 2,504,924 bytes, sha256 `29a37044abf7fc6ccc9ca3b8b16e510a9f27a7657c738b6f7ad9dc8831316a58`, uploaded 2026-10-27 01:35:40 UTC to `exports/index.json` (application/json, AES256, same posture as before).
- **Unchanged part:** everything but `families` is byte-identical to the 18:39 upload (2,494,410 bytes, sha256 `49287c50…71c8`).
- **Fields:**
  - `sources` ×41: `{source, label, rows, file}`
  - `constructs` ×8,028: `{construct, label, definition, wording?}`, 5,481 with `wording`, no `topics` yet
  - `geographies` ×373: `{code, name, level, parent}`
  - `families` ×17: `{id, label, definition, anchor, note?, members: [{question, relation, of?}]}`. All 17 carry a note; 7 members carry `of`.
- **Row files:** not re-uploaded. They regenerate unchanged.
- **Order:** Window-Q is the second uploader. Their regenerated index will carry `topics` and `families` together, from the same store and export.py, so after Q uploads, Q's file is the last write.

### Verification (Node, against the served S3 object)

- 200 application/json, hash matching the local file. Keys: sources, constructs, geographies, families.
- 17 families, 34 member questions: 12 + 3 + 5 + 14 × 1.
- Each family has exactly one core.
- abany sits in exactly one family (abortion_any_reason), as core. abanyg is its mode, `of: "abany"`.
- Every member is a `constructs` entry, and no question is in two families.
- party_id_7 renders as a one-member family.

### Tests

- 21 new tests in `tests/test_construct_layer.py`: seed rulings, every rule `validate` refuses, register idempotence, the export's key order and shape, members without rows, the audit.
- With the export, audit, store and lock tests: 35 pass in the full working tree, and again in a staged-only tree with no raw/ cache.
- I did not run the full suite: it loads every survey's raw files, and Q was fetching on this 8 GB machine.

### Rulings for the lead

1. **Two optional export keys beyond the brief's shape.** `note` carries MR133's ABANY caveat, the trust forms' distance and whose judgment each grouping is; without it the construct view would overstate the grouping. `of` on mode members names the item a twin repeats. Striking either is one line in `export.construct_families`.
2. **Rossi items as `version`.** The six conditions aren't rewordings of one question; they are six items of one scale. I followed the brief. If you want an `item` relation, it is a change to `RELATIONS` and the seed, with no migration.
3. **ablegal under abortion_any_reason.** ABLEGAL (1977 only) is a different question: legal under any, certain or no circumstances, the form MR133's Appendix A prints as Gallup's. MR133 doesn't group it with ABANY, and the note says so, calling the grouping "my ruling of 2026-10-26". Confirm it, or move it to its own construct.
4. **trlegis and trcong.** They ask trust on 0–10, not confidence; the note marks them as a ruling, not a GSS concordance.
5. **Construct ids.** They reuse harmonized ids (confidence_congress is both a `constructs` id and a `families` id). Key the UI by array.
6. **Harmonized entries left out.** The index holds 20 more harmonized entries outside the layer: the ANES, CES, lift and election ones (trust_gov, efficacy_*, thermometers, pres_approval, cand_trait_*, ideology_5, egalitarianism, elections_fair, primary_*, presidential_vote, lift_*). The brief named the GSS 15. Rule whether they enter as sole cores next.
7. **Voice in notes.** Notes say "my ruling" and "my harmonization", the house first-person voice, since they may reach the UI.
8. **The sweep.** The window that committed 7b0d2fb should commit with explicit paths (`git commit <paths>`). A bare `git commit` takes whatever another window has staged.
