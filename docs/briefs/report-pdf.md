# Brief: the report PDF — Trinity prints its own branded readout

To: wireframes · From: lead (pax-trinity-1c) · 2026-10-27 · Brendan's order

## Why

The finish line was always "generate that PDF from scratch from Trinity."
The web readout exists; the deliverable a partner holds is a PDF as nicely
constructed as `docs/reports/report-2-ma-test-waves-1-2.pdf`. One renderer,
two media: the study page you built prints itself. No second rendering
path, no hand-built document — the PDF is the page, dressed for paper.

You own `src/app/reports/**`, `src/components/report/**`,
`scripts/reports/**` (new) and the print stylesheet. Nothing else.

## The work

1. **Print dress for `/reports/[study]`.** A print stylesheet (and a
   `?print=1` variant if the page needs structural switches) that makes the
   page a document: app shell, nav and interactive chrome hidden; Letter
   portrait; a true cover (title, waves line, subtitle, fact strips);
   each major section starting a fresh page; no page break inside a video
   card, a dimension panel, a pairing card or a caution box;
   `print-color-adjust: exact` so bars, hatching and chips survive;
   charts and type at print scale (the source PDF is the register to beat).
2. **`scripts/reports/pdf.mjs`.** Drives the installed Chrome headless
   (puppeteer-core or playwright with the chrome channel — tariffs uses
   playwright 1.60, the pattern is in-house). HARD RULES: devDependency
   only; nothing may download a browser at install or in the Amplify build;
   the script is local tooling and never enters `next build`. It takes a
   base URL (default :3000) and a study slug, prints with brand header or
   footer templates (the house wordmark; study title · page n of N), and
   writes the PDF. Usage documented at the top.
3. **The exemplar, committed.** Generate the MA study's PDF and commit it
   as `docs/reports/ma-test-waves-1-2-trinity.pdf`. That file is the
   acceptance test: side by side with report-2 it must read as the same
   caliber of document — cover, exec summary, both waves, subgroup pages,
   methodology — every figure from RESULT_SETS, watch links clickable.
4. **Computed sets print too.** The rehearsal taught the renderer to take a
   computed ResultSet; confirm the print dress holds for one (your local
   rehearsal wiring, not committed) — no empty-section artifacts on paper.

## Rules (you may be context-cleared; this is everything)

- Shared checkout, several windows on main: `git log -1` before every
  commit, stage explicit paths, never amend, **never push** (the lead
  pushes dev; main moves only in Brendan's batches).
- No tsc, no eslint, no builds, no dev servers (hook-blocked; :3000 runs —
  use it). Parse-check via node + typescript createSourceFile; type-strict.
- House rules hold on paper exactly as on screen: first-person voice where
  a voice is needed, no "→", no lead-in paragraphs, "chip"/"badge" never
  "pill", transcribed language verbatim.
- Report to pax-trinity-1c: shas, the committed PDF's path and page count,
  and anything print exposed that the screen hid.
