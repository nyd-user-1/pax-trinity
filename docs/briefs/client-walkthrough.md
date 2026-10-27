# Brief: the client walkthrough — a URL and a short PDF, "go do these things"

To: surfaces · From: lead (pax-trinity-1c) · 2026-10-27 · Brendan's order

## Why

Brendan wants to hand a client two things — a URL and a short PDF — and say:
go do these things and you'll see what you need to see. The PDF is a guided
tour of the platform, 2–4 pages, branded, built from the box guides you
wrote (they are the verified source of truth; don't re-derive steps from
scratch, but DO re-drive each step you print).

The URL is the dev build: **https://dev.d2vlduiqvq0u36.amplifyapp.com**
(the dev branch auto-builds on every push; main moves in batches). Put the
base URL in ONE place at the top of the source file so the handout
regenerates against main later.

## The work

1. **`docs/handout/walkthrough.html`** — a single self-contained HTML file
   (inline CSS, no app imports, no build step) in the paper dress: cover
   block with the house wordmark, the URL large, then the numbered tour.
   Letter portrait print layout, sections that break cleanly.
2. **The tour** (adapt freely from the box guides; every step must work
   signed-out at the dev URL):
   - The front door: the contents plate, open a box, read its guide.
   - Audience: open a topic, open a question, read its headline and trend,
     star it, the globe view's dossier.
   - Clips: a partner desk, watch a cut.
   - Reports: /reports, the Massachusetts study — the exec summary, one
     video card, one subgroup page, what "detectable" means there.
   - Lift: the archive, open a metric card.
   - Chat: ask something (five free questions signed out).
   - **Message Tests: handle with care.** open-primaries-1 is FIELDING; a
     pressed Start logs a start. The tour may show the test's landing page
     and describe the flow; it must NOT instruct the client to start or
     answer. If that can't be made safe in print, leave the stop out and
     let /reports carry the testing story.
3. **`docs/reports/client-walkthrough.pdf`** — print the HTML via the
   installed Chrome headless (`--headless --print-to-pdf`, no new
   dependencies), commit both files.
4. **Verify at the dev URL once its build is green** (I'll confirm when it
   is; draft against :3000 meanwhile). Every printed step re-driven there;
   anything that behaves differently from :3000 goes in your report.

## Voice and rules (you may be context-cleared)

- Steps in the imperative; the app speaks first person singular where a
  voice is needed; never "we"/"our"; no "→"; no lead-in paragraphs under
  headings; "chip"/"badge" never "pill"; "raw" never "bulk"; no LegiScan.
- No labels that restate the obvious; short sentences a non-technical
  reader follows on a phone.
- Shared checkout: `git log -1` first, explicit paths, never amend, never
  push. Parse-check isn't needed for plain HTML, but open the file on
  :3000? No — open it in the headless browser and eyeball the PDF pages.
- Report to pax-trinity-1c: shas, the PDF's path and page count, and any
  step that failed at the dev URL.
