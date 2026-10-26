# Brief P — Verbatim question wordings for the GSS tier

You are an Opus window taking Brief P. Ground rules as before: commit locally per feature, never push; stage by explicit path, never `-A`; check `git log -1` immediately before any commit — several windows share this checkout. Never run tsc, a Next build, or a second dev server on this 8GB Mac (a hook enforces it; the dev server already on :3000 is Brendan's — leave it alone). The store is single-writer: take `audience/store/.lock` before any store computation, release it after. Data exports never enter git — they regenerate and upload to the audience bucket's `exports/` prefix (`https://pax-trinity-audience-638175140432.s3.amazonaws.com/exports/`), which Amplify serves at `/audience-data/`. Yours: the `audience/` Python package's wording step, the regenerated `index.json` upload, and this file's Worker report — nothing else anywhere.

## What this is

Every GSS question in the audience store gains its verbatim codebook wording — the sentence the interviewer actually reads — served in the export, so the /audience question cards read as survey questions from data instead of the six seeds the app window planted today. The bank's product sentence is "what America thinks, **in what wording**, measured by whom"; this brief is the middle clause.

Read first: `audience/README.md` and the loaders in `audience/audience/` (how constructs register and how the export writes), `src/app/audience/audience-data.ts` (the client contract: `AudienceIndex.constructs` is `{ construct, label, definition }`), and `src/app/audience/bank-surface.tsx` (the `WORDING` seed map your export replaces — read-only, the lead rewires the UI after your report).

## The contract

`index.json` constructs gain **one optional field**: `wording: string` — the verbatim question text exactly as the GSS codebook gives it, including the battery stem where an item belongs to one (the confidence battery's "I am going to name some institutions in this country…" joined to its item), whitespace-normalized and otherwise untouched. No paraphrase, no casing cleanup, no editorializing. Where codebook text genuinely differs across waves, carry the current form. Every other field of every constructs entry, for every source, stays byte-identical; the 13-element row files do not change at all.

## Sources, in order of preference

1. **NORC's own machine-readable metadata.** The GSS Data Explorer (gssdataexplorer.norc.org) exposes per-variable question text; NORC also publishes the cumulative codebook. Find the most scriptable route and document it with URLs in the loader's docstring.
2. **The gssr R package's `gss_dict`** (Kieran Healy) maps variable → question text if NORC's route resists scripting — verify its license and provenance before relying on it, and say which you used.
3. **GSS Methodological Report MR133** (Cowan, Hout & Perrett, 2021 — the abortion time-series paper) carries the verbatim Rossi battery stem and the 2018 module texts. Use it to **spot-check** the abortion battery (abany, abdefect, abrape, abhlth, abnomore, abpoor, absingle, the abhelp quartet, abmoral, abstate1/2, abinspay, abmedgov1/2, abfelegl, abmelegl), not as the bulk source.

## Scope

All 5,541 GSS questions where a codebook text exists — the raw tier keyed by GSS mnemonic and the 15 harmonized constructs both. For the harmonized pair the slice shows today: `confidence_congress` takes the CONLEGIS battery text; `party_id_7` takes PARTYID's ("Generally speaking, do you usually think of yourself as a Republican, Democrat, Independent, or what?") — verify both against the codebook rather than trusting this brief. Report the exact coverage count and a sample of what's missing and why; a grid-on-web twin that shares its parent's text should say so rather than go empty.

## Done means

The loader step committed (explicit paths); the regenerated `index.json` uploaded to the bucket at the same key with the same public-read posture; verified in Node against the served file — fetch `/audience-data/index.json` via the bucket URL, confirm `wording` present for the six slice ids (confidence_congress, concong, conlegiy, trcong, trlegis, party_id_7) and for two Data Explorer spot-checks of your choosing from the raw tier, quoted side by side with the source in the report. Report below with hashes, the coverage count, and rulings for the lead.

---

## Worker report

*(append here: hashes, coverage count, source route chosen and its license, spot-checks quoted, rulings for the lead)*
