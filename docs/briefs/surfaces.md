# Brief — Surfaces: the consolidation

You are the window named `surfaces`. Yours is the existing app UI: Brendan's overnight consolidation ruling (2026-10-27), one commit per step below. Ground rules: commit locally per feature, never push; stage by explicit path, never `-A`; **check `git log -1` immediately before every commit — four windows share this checkout tonight** (`wireframes` adds new routes, `moving-day` touches only `src/components/clips/catalog.ts`, Window R works in `audience/`). Stay out of `audience/` (python), `public/audience-data/`, and other briefs. Never run tsc, a Next build, or a dev server (a hook enforces it); the lead's dev server runs on :3000 — smoke-test by `curl`ing a route and grepping for a marker string; Next compiles per request, so a 200 with your marker is the check. House rules: no "→" anywhere in UI; no explainer paragraph under any h1; first-person app voice where a voice is needed; "chip"/"badge", never the p-word; no counts invented.

## 1. Codify Brendan's dev-tool pass on the question list

He restyled /inbox-2 by hand in dev tools tonight; the screenshot is `docs/wireframes/inbox-row-changes.png` and it is canon. In code:

- Rows lose the grip, the importance arrow, and the selection checkbox (and the row-leading star/blocks buttons with them).
- Row horizontal padding becomes 16px each side.
- All four bars line up at **52px**: the list's search row, the list's toolbar, the pane's search row, the pane's title/toolbar row — borders flush across the split.
- The two search bars align to one another (both stay for now).
- The stacked card keeps **one** chip: the topic chip; the mnemonic chip goes. Chip and year move **under** the wording, and the card's column gap goes from 0.5 to 4.
- Toolbar sheds the select-all checkbox+menu and refresh (refresh lives at the pane's top right, per the screenshot); split toggle, chevrons and kebab stay.
- Dead props/state from the removals (checked/important plumbing, onCheckAll…) come out cleanly; the grid-column flow that used checkboxes should degrade gracefully — if the four-column compare loses its only entry point, move "Add as column" into the row kebab, don't keep the checkbox.

## 2. The inbox pattern becomes /audience

/inbox-2 is the real audience surface. Move it to `/audience`; retire the old audience browse surface (`bank-client`/`bank-surface` and the old unreferenced `audience-surface`/`list`/`rail` files — sweep them). **Keep `rows-view.tsx`** — question-table mounts it. `/inbox-2` redirects to `/audience`. Shell nav updated.

## 3. /lift onto the same anatomy

Same layout, same components: rail folders (its archive/benchmarks/tests), middle cards, right pane its tables. Replace /lift's bespoke layout with the shared one; content differs, anatomy doesn't. Extract shared pieces from the inbox files into `src/components/bank/` (or similar) as you go so /audience, /lift, /inbox and /survey import one set.

## 4. /consensus becomes one page with tabs

Tabs: Surveys | Questions | Results | Admin (Admin role-gated). The four current surfaces mount as tab panels — reuse, don't rewrite. Old sub-routes (`/consensus/survey`, `/consensus/report`, `/consensus/admin`, `/questions`) redirect into the tabs.

## 5. New /survey — consensus on the inbox pattern

The second consensus experience, Brendan's words: the gmail pattern mapped onto surveys. Rail folders = the surveys and pretrainings; middle cards = the open survey's questions (same card anatomy as /audience); pane = that question's results/detail. Shared components from step 3.

## 6. The reference four-into-one

/data-dictionary + /glossary + /schema + /erd → one surface with tabs, living at `/data-dictionary`; the other three redirect; the `/pipeline-2` alias dies with /erd's standalone route.

## 7. The kill list

Keep: `/`, `/chat`, `/clips` (+ `/v/*` overlay, `/clips/embed/*`), `/audience`, `/inbox`, `/survey`, `/consensus`, `/lift`, `/message-tests` (+ `/test/*`), `/data-dictionary`, `/signin`, `/signup`, `/logout`. Audit `shell.tsx`'s LIVE set and `src/app/` against that list; everything else goes — route and dead components both. Where you're unsure a route is truly dead, unpublish (out of LIVE) instead of deleting and flag it in the report.

## Entry points for the wireframes window

`wireframes` is building three new routes tonight (`/q/[source]/[id]`, `/constructs`, `/electorate`) and will message you their hrefs when they stand. You add the entry points (they won't touch your files): a Constructs row above Topics in the /audience rail; an Open control in the question pane's title row to the dossier; the rail's folder-group area links to /electorate. One-line insertions, your judgment on dress.

## Done means

Each step a path-limited commit with a curl smoke-check noted; the report below lists every deleted route/file and every redirect; flags for anything unpublished-not-deleted. Ping the lead (`pax-trinity-1c`) after step 2 lands (so the morning look has the renamed surface even if later steps run long), and again at the end.

---

## Worker report
