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

**Landed:** `cbc03a5`: `src/app/schema/` (`page.tsx`, `schema.ts`, `schema-canvas.tsx`). Nothing else moved.

**What's there.** /schema copies /erd's gate exactly: signed out goes to `/signin?next=/schema`, a non-admin gets a 404, `force-dynamic`, title "Schema". It draws the audience store on /erd's canvas:
- **Tables:** each one in the store box's dress, its name in mono beside the database icon and its columns underneath. Each column shows its type; a key marks the primary key and a link marks a column that refers to another table. Hovering a table or column shows its note from the migrations.
- **Key lines:** /erd's rounded line, each with an icon chip whose words show on hover.
- **Interaction:** the travelling light, tables that drag and keep their place in this browser until Reset layout, and the gear opening a Schema panel (Tables, Keys) in the shell's right slot, where each entry lights what it names.

FactoryCanvas builds its nodes and edges inline and exports neither its node kinds nor its edge. So, per the brief, the route carries its own content module (`schema.ts`, shaped like `build()`) and the canvas pattern's own pieces, on the same primitives: @xyflow, the shell panel, whiteButton, and the `erd-lit` and `erd-travel` styles. The only new piece is the table node, which is the store box with a column list, since an ERD needs columns.

**The content, from the migrations.** The store has six tables, not the brief's list: "constructs" is `concordance` and "estimates" is `norms`; no tables carry those names. The six are `concordance` (10 columns), `sources` (6), `norms` (22), `geographies` (4), `response_order` (4) and `schema_migrations` (2, created by `migrate.py`). Every column, in order, matches the live store (read-only, with no window holding the lock). Types are the Postgres ones, and the hover notes DuckDB's JSON and DECIMAL(38,10). None of the five keys is a database foreign key; each line names the code that holds it:
- `norms.construct` → `concordance.construct`: upsert_norms refuses an unknown construct, and the audit checks again.
- `norms.source` → `sources.source`: the export labels each source's files from it.
- `norms.geo_code` → `geographies.geo_code`: the refresh builds geographies from norms, and the audit checks.
- `geographies.parent_code` → `geographies.geo_code`: each place's parent.
- `response_order` → `norms` on (source, construct, response_option): the export's ordering join.

**Verification.** No dev server was up on 3000, and the hook blocks ESLint as well as tsc, so nothing is type-checked:
- **Syntax:** all three files transpile clean (TypeScript's single-file transpile, syntax only).
- **Content:** run in Node, `build()` gives five lines whose handles all name real columns, and six tables with no overlaps.
- **Layout:** `norms.source` and `response_order`'s join run level; the other three lines take one elbow each.
- **Code:** each typed pattern was read against factory-canvas.tsx, which uses the same ones.

The first load on 3000 is the real check.

**For the lead (navigation and shell, yours per the brief):**
1. **Full-bleed:** /erd is in `shell.tsx`'s full-bleed list (`path.startsWith("/erd")`). Until /schema joins it, the canvas sits inside the padded content area instead of edge to edge, which is the one visible difference in dress.
2. **Proxy gate:** `/erd` is in `src/proxy.ts`'s `GATED` list, a second, earlier sign-in redirect. /schema's page-level gate works without it, but /erd has both.
3. **Navigation:** `LIVE`, `ADMIN` and `TITLES` in `shell.tsx` decide whether the sidebar and switcher offer /schema. The header title already falls back to "Schema".
