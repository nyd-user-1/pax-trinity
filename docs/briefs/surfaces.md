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

All seven steps landed, each a path-limited commit, plus the wireframes entry points. No step pushed.

| Step | Commit | Smoke (curl :3000; a client chunk grepped where the page renders browser-side) |
|---|---|---|
| 1 Dev-tool pass | 4e2f464 | /inbox-2 200; chunk carries "Question actions", "Remove column" |
| 2 /inbox-2 becomes /audience | 286256c | /audience 200 with the `?source=` read; /inbox-2 (and `?source=GSS`) 307 to /audience |
| 3 /lift on the anatomy, shared set | 424bac6 | /audience 200 ("Four columns at most", "Pinned only"); /lift 200 ("Search metrics…", "Search treatments…", About panel) |
| 4 /consensus tabs | c77bbc1 | each tab 200 with the tablist and its own marker; four old addresses 307 into their tabs |
| Wireframes entry points | b90cb92 | /audience chunk carries /constructs, /electorate, the dossier href; the three routes 200 |
| 5 /survey | 6ebf215 | /survey 200, server-rendered with the seed's 23 cards and the open survey's row current |
| 6 Reference four-into-one | ad6a8f9 | each /data-dictionary tab 200 with its marker (react-flow on both canvases); /glossary, /schema, /erd 307 |
| 7 Kill list | 46c452b | the twelve kept routes plus /test/*, /constructs, /electorate, /clips/studio, /clips/transcript all 200; the shell chunk carries /survey, /lift and no /changelog |

Type-checking and lint were not possible: the machine's hook blocks both. Verification was Turbopack compiling each route on request, plus grepping the compiled chunks for new strings. A remote build should be the type check before any deploy.

### Shared set (step 3)
`src/components/bank/` contains: bank-frame (BankFrame, BankSplit), bank-rail (BankRail, RailGroup, RailRow, with an `href` option for link rows), card-list (CardList over a generic Card: title, the one chip, tag, span, detail, row-kebab actions; both 52px bars) and pane-bars (SearchField, PaneSearchRow, PaneTitleRow, RefreshButton, ViewToggle). /audience, /lift and /survey import it. /inbox does not; see the flags.

### Redirects
All of these are 307s from `alias()` in `src/proxy.ts`. Each old route also keeps a page file that redirects, as a backstop.
- /inbox-2 → /audience (query kept)
- /consensus/survey → /consensus?tab=questions; /consensus/report → ?tab=results; /consensus/admin → ?tab=admin (`c` kept on all three)
- /questions → /consensus?tab=questions (proxy only: no /questions route existed)
- /glossary, /schema, /erd → /data-dictionary?tab=glossary|schema|erd
- Removed: the /pipeline-2 alias (it now finds nothing), and the aliases into /metrics and /methodology, which don't exist here (/patterns, /outliers, /feature-lift, /ml, /velocity-tracker, /live-tracking, /flow*, /evidence, /scoring/method, /tracking).

### Deleted
- Routes retired into others: /inbox-2 (now /audience), /consensus/survey|report|admin (now tabs), /glossary, /schema, /erd (now tabs). Each keeps only its redirect stub.
- Step 2: audience/bank-client, bank-surface, audience-surface, audience-list, audience-rail; inbox-2/band-list (nothing imported it); the dead exports AudiencePane, metricIdsOf, snippetOf.
- Step 3: audience/segment-list (replaced by bank/card-list) and audience/audience-rows (the whole-source flat table nothing could reach). Also BackButton, plus the grid's `focus` plumbing: nothing ever set it, so its back arrow, focused header and second Add to survey were unreachable.
- Step 4: components/consensus/rail.tsx (both rails were passed to a DocsPage that ignores them).
- Step 7, no importer anywhere: components/account-view, add-block-button, bookmark-button, consensus/statement-card, favorites-rail, home/recents, open-in-v0-cta, rail-toggle, rail-views; registry/blocks/sidebar-09/page-2 (an identical, unimported copy of page.tsx); api/dev-locate (its caller, the dev inspector, was removed on 10/25); lib/blocks, blocks-store, bookmarks, fixtures, layout, legislative-body, workspace/datasets, workspace/pins.
- Shell: the Research list, the Admin list's seven entries for pages that don't exist here, the account menu's Lab (Campaigns), header titles for missing pages, and 18 unused icons.

### Flags
1. **/changelog: unpublished, not deleted.** It's out of LIVE and the nav and still reachable by URL. It's two days old and Brendan maintains it by hand, so dropping it from the keep list may have been an oversight. Delete it (route plus lib/changelog.ts) on his word.
2. **/clips/studio and /clips/transcript kept.** The keep list names only /clips/embed/*, but /clips links to both (the generate panel's Studio, upload's transcript button). Deleting them would break /clips.
3. **Five API routes with no caller in the repo were kept**, in case something outside the repo calls them: api/clips/admin, api/consensus/ground, api/policy/commits, api/policy/forks, api/policy/forms.
4. **next.config.ts still has six redirects to pages that don't exist here** (/reviews, /campaign, /method, /reference, /sources, /break-out). I didn't touch it because editing it restarts the shared dev server. `siteConfig` in lib/config.ts no longer has a consumer (recents.tsx was its last); only `withScope` is live there.
5. **/inbox does not use the shared set.** The mail thread list's checkboxes are mail's bulk select, which is exactly what Brendan's pass removed from the question list. Forcing one set would either strip mail of bulk actions or give CardList a mail-only mode. My recommendation: leave /inbox on its block unless Brendan rules otherwise.
6. **"Pretrainings" is my reading.** Nothing in the code has that name. Per the product vision ("how pretraining questions are constructed"), the Pretrainings folder on /survey is the survey draft built from /audience's Add to survey, read from the browser, with "None yet" when there's no draft.
7. **Judgment calls on step 1:**
   - The screenshot drops the Data view's filter row; the Wave/Segment/Band chips now sit in the pane's title row, before refresh.
   - The card loses its scale-and-waves line, as in the picture.
   - The removed row controls moved into a row kebab that takes the year's place on hover (Gmail's swap): Add as column, which also brings up the compare grid beside the list; Pin; Add to blocks; Add to survey. Add to survey had no working entry point before.
   - A pinned row shows a small star before its wording, since the star button is gone.
   - The pane's search is the list's own filter (same placeholder as the picture).
   - /lift's pane search filters treatments instead, and its list search filters metrics.
8. **/lift's cards are metrics, not treatments.** The archive's 575 treatments are opaque IDs (`X01568197a85d (study …)`), so cards per treatment would be unreadable. The pane is the existing treatment grid sorted by the open metric, and a folder opens on its first metric. /lift was also missing from the shell's full-bleed list (its frame sat inside the page padding); it and /survey are in it now.
9. **Production readiness:** no new env vars. The canvases on /data-dictionary load only when their tab is picked. /survey sends the browser only the open conversation, so a large room's statements travel only when it's opened.

### Lead's rulings

1. **/changelog unpublished, not deleted: approved** — the brief's safe default, Brendan's delete call to make.
2. **/clips/studio and /clips/transcript stay** — linked from /clips, they're part of that experience.
3. **The five caller-less API routes stay, flagged** — an external caller can't be ruled out from the repo alone; Brendan rules.
4. **next.config's dead redirects stay tonight** — editing it restarts the dev server under four working windows; queued.
5. **/inbox off the shared bank set: approved** — mail's bulk select is real; the anatomies differ on purpose.
6. **Pretrainings read as the audience survey draft: tolerated, flagged** — "pretraining" is Brendan's word; he confirms or corrects.

Routes verified live after the kill list: ten keepers 200, four retired addresses 307. The push's Amplify builds stand in for the banned local type-check.
