# Brief U — The concordance: anchored constructs from the canonical lists

You are the Opus window that built the construct layer (Brief R) and the per-question serving (Brief S), taking the concordance. Ground rules as before: commit locally per feature, never push; stage by explicit path, never `-A`; check `git log -1` immediately before any commit — several windows share this checkout. Never run tsc, a Next build, or a dev server on this 8GB Mac (a hook enforces it). The store is single-writer: take `audience/store/.lock` before any store computation, release it after. **Migration number 012 is yours** — claimed by this brief, frozen on disk. Window-Q holds 011 concurrently; your migration must not assume its contents. Exports regenerate and upload to the audience bucket's `exports/` prefix, served at `/audience-data/`. Yours: the two canonical-list fetches, the concordance build in `audience/`, the regenerated `index.json` upload, and this file's Worker report — nothing else anywhere.

## What this is

Brendan's ruling (2026-10-27): constructs seed **top-down from the field's own canonical lists**, not bottom-up clustering. A construct is a concept the field itself tracks — "Confidence in Congress", "Party identification, 7-point" — anchored to the publisher's own citation, with member questions across sources. This is the concordance: the layer that lets one row say *Sources: ANES · CES · GSS*, lets a question page show its related constructs across studies, and gives the construct table its grouped shape (INSTITUTIONAL TRUST, SOCIAL TRUST, ECONOMIC FAIRNESS…). Your Brief R machinery — migration 009's `construct`/`construct_member`, the export's `families` with relations core/version/mode and `anchor` — is the proven seed; this brief grows it from 17 to the full anchored set.

## The two lists

- **GSS Key Trends** — the Data Explorer's curated trends (gssdataexplorer.norc.org/trends): roughly 200 trend variables filed under ~14 subject areas. You know this host from Briefs P/Q; find the route behind the trends page.
- **ANES Guide to Public Opinion and Electoral Behavior** — electionstudies.org: the trend tables, roughly 150 items, 1948–present, grouped by topic.

Fetch both politely (delay, resumable, terms noted in the docstring), raw synced to `raw/gss/` and `raw/anes/` before loading.

## The build

- One construct per canonical trend item, `anchor` = the publisher's own citation (list name + item + URL). Expect ~300–350 total.
- The 17 existing families sit **inside** this set: where a canonical item matches one, the family absorbs the anchor — never a duplicate construct (the ablegal ruling stands).
- Where the same concept appears in both lists (trust in government, party identification…), that is **one construct** with members from both sources — the whole point of the concordance.
- Members map to our question ids (mnemonics for GSS; `anes.py` for the ANES scheme). Fold in the 112 exact-normalized-wording groups (293 questions) where they fall inside a construct's members. CES members attach only on a clear wording/label match to an anchored construct; uncertain ones go to the flag list, never forced.
- Each construct carries its list's own subject area, so the construct table can group without our editorializing.
- The long tail stays unconstructed — honest. No construct without an anchor.

## The contract

The export's `families` array grows to the full anchored set, same shape you designed (construct, label, relations, anchor, optional note/of); constructs/questions/sources/geographies entries otherwise byte-identical; row files unchanged.

## Done means

Raw lists synced; migration 012 + code committed (explicit paths); the regenerated `index.json` uploaded same key, same posture; verified in Node against the served file — construct count, member counts by source, how many constructs are cross-source, ten example constructs quoted with their anchors. The flag list of ambiguous mappings is a first-class deliverable for the lead's ruling, not a failure. The bucket is mid-copy to the new AWS account: list every bucket key you added or changed. Report below, then ping the lead (`pax-trinity-1c`) by SendMessage.

---

## Worker report
