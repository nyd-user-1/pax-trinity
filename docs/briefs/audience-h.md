# Brief H — The Questions view on /audience, and Add to survey

You are the audience-h window, in the Next app at /Users/brendanstanton/Code/pax-trinity. Ground rules: commit locally per feature, never push; stage by explicit path, never `-A`; stay strictly inside the paths named here. Off limits: `/inbox` and `/inbox-2` (the lead's surfaces), `src/registry/blocks/sidebar-09/`, everything under `audience/` (Python, other windows), `src/components/clips/`. The dev server runs on 3000; this Mac has 8GB, so never run tsc, a build, or a second dev server — a hook will block commands containing the typecheck tool names, including in heredocs; verify by loading routes on 3000 and reading the dev log. Your report is appended under "Worker report" at the end of this file. Rulings and seam conflicts route to the lead session, not to other windows.

## What this is

/audience is the audience database in the Agentic Inbox's frame: a BlockShell whose rail holds the sources, the thread-list anatomy as the metric list, a reading pane of grouped pennant tables, an About panel as the 420px fourth column. Read `src/app/audience/audience-surface.tsx` first — it is the container and the state owner — then `audience-rail.tsx`, `audience-list.tsx`, `audience-pane.tsx`, `audience-rows.tsx`, `audience-data.ts` (the export's contract: 13-element rows, split sources concatenated).

This brief adds the third read: **Questions** — the norms-to-instrument close. A researcher browsing the database should be able to see, per metric, each source's verbatim question wording with its response options side by side, check the wordings they want, and turn the checked set into a draft survey the consensus admin holds.

## 1. The Questions view

- Entry: a second group in the rail under Sources — label **Views**, rows **Metrics** (the current list, default) and **Questions** — using the same SidebarGroup/SidebarMenuButton anatomy the rail already has. No new route: the view swaps the content beside the rail, the way the flat table already does (see `mode` in audience-surface.tsx; extend that state).
- Content: group by metric (its display label from the index; vocabulary is settled — "Metric", "Segment", never "construct" in UI copy). Under each metric, one item card per distinct (source, item_text): the source's short name (`shortSource`), the period range, the wording verbatim, and its distinct response options in data order. Items sit side by side where width allows (a simple responsive grid). item_text is element 10; today only POLL and ELECTION_RESULT carry it — the view must therefore fetch sources it hasn't loaded yet (reuse the surface's per-source fetch; load all index sources when the view opens, concatenating split files exactly as the surface does) and render progressively as sources arrive, with per-source "reading…" states. A metric with no wording anywhere is omitted.
- The header search (the surface's `query`) filters by metric label and wording text.
- Each item carries a checkbox. A thin bar appears above the grid when anything is checked: "N picked" left, an **Add to survey** button right.

## 2. Add to survey

The seam is committed and unwired — wire it, change its shape only if you must and say so in the report:

- `src/lib/consensus/draft.ts`: `saveDraft(texts: string[])` writes a Conversation-shaped draft to localStorage; `readDraft`, `clearDraft`, `DRAFT_SLUG`.
- `src/components/consensus/draft-card.tsx`: the card that renders the draft with a Discard button.

Add to survey calls `saveDraft` with the checked wordings verbatim (one statement per item, in display order) and then navigates with `next/navigation`'s router to `/consensus/admin?c=audience-draft`. Mount `<DraftCard />` on `src/app/consensus/admin/page.tsx` as the first child inside its `data-not-typeset` column — that one file in the consensus directory is yours to touch, one import and one element, nothing else on the page moves.

## Dress rules

First-person singular anywhere a voice is needed; no "→" characters anywhere; no explainer line under a heading that only restates it; pax2 tokens (`text-pax2-blue`, `bg-pax2-mist`, `bg-pax2-lavender`) as the surface already uses them; checkboxes are the govblock Checkbox the list already imports. Commit messages in the repo's prose style — read `git log -5` before writing one.

## Done means

On the dev server: the rail shows Views with Metrics and Questions; Questions renders grouped wordings from every source that has them, loading the rest of the export progressively; search filters it; checking items and pressing Add to survey lands on /consensus/admin with the draft card showing those wordings; Discard clears it; the Metrics view and flat table are untouched. Committed locally per feature; report appended below with commit hashes and anything you changed about the seam.

---

## Worker report

(appended by the worker)
