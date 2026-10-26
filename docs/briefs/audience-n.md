# Brief N — /schema, the ERD's dress over the store

You are the audience-j window, taking Brief N. Ground rules as before: commit locally per feature, never push; stage by explicit path, never `-A`. Yours this time: `src/app/schema/**` (new) and this file's Worker report — nothing else under `src/` except read access, nothing under `audience/` but reading, no shell or sidebar edits (the lead wires navigation). Never run tsc, a Next build, or a second dev server on this 8GB Mac; verify by loading the route on 3000 if the dev server is up, otherwise against /erd's code. Report appended below with commit hashes; rulings to the lead session.

## What this is

/erd (src/app/erd/page.tsx, 18 lines) is the factory on one canvas: an admin-gated page rendering FactoryCanvas (components/factory-canvas.tsx) on @xyflow. /schema is **that page duplicated — no new components beyond what the canvas pattern itself requires, only new content**: the audience store's schema on the same canvas dress.

- Read factory-canvas.tsx first to see how it defines its nodes and edges; define yours the same way, in your own directory, reusing every primitive it reuses. If its nodes and edges are inline rather than parameterized, your page carries its own content module shaped the same — that is content, not a new component.
- The content: the store's tables as you know them from the night's work — sources, constructs, the concordance, estimates, response_order, geographies, and whatever else `audience/audience/db.py` and the migrations define — as nodes with their columns, edges where keys reference. Read the migrations for the truth; invent nothing.
- The page copies /erd's gate exactly: signed out redirects to /signin?next=/schema, non-admin 404s. `force-dynamic`, metadata title "Schema".

## Done means

/schema renders the store's tables and their keys in /erd's exact dress behind the same gate; nothing outside your paths moved; report with hashes below.

---

## Worker report

(appended by the worker)
