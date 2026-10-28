# Brief — America Thinks: one bar each side, the split in the kebab, and the Banner view

You are the worker; the lead is `pax-trinity-09`. Two parts, two commits, in order. Brendan made Part A as a DevTools pass on 2026-10-28 (his screenshot: list bar = search icon … chevrons, kebab; pane bar = box, arrow, star, title … Data | Crosstab | Trend | globe), then ordered Part B the same night. Paths and line anchors are from the tree at 2f8bf96.

Ground rules: the repo is **npm**; never run pnpm. No tsc or eslint (Brendan's hook blocks both): parse-check each touched file with the `typescript` package's `createSourceFile` parseDiagnostics, and be type-strict, since the Amplify build is the only type check. No dev server. Commit each part path-limited (`git add <exact paths>`), house prose style, never amend, **never push**. After each commit, message `pax-trinity-09` with the hash and the parse result. Questions go to `pax-trinity-09`, never Brendan.

## Part A — the DevTools pass

Scope: America Thinks changes fully. /lift and /survey change only where step A1 says so; everything else on them stays byte-for-byte as it renders today, so every new behavior below is opt-in by prop.

### A1. The split goes into the list's kebab — `src/components/bank/card-list.tsx` (all surfaces)

- Delete the split toggle button block (lines ~132-138, the `onSplit && <Tip …>` with PanelRightIcon/RowsIcon). Drop `PanelRightIcon` and `RowsIcon` from the lucide import if nothing else uses them.
- The kebab renders when `onSplit` or `menu` is present (today only `menu`). Its content, in order:
  1. When `onSplit`: a `DropdownMenuRadioGroup value={split} onValueChange={(v) => onSplit(v as Split)}` with `DropdownMenuRadioItem value="none"` "No split" and `value="vertical"` "Vertical split" (the Agentic Inbox's own labels, `src/registry/blocks/sidebar-09/components/thread-list.tsx:171-173`).
  2. Step A2's sidebar item, when it applies (preceded by `DropdownMenuSeparator` if anything came before).
  3. `menu`, when given (preceded by `DropdownMenuSeparator` if anything came before).
- Import `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, `DropdownMenuSeparator` from `@govblock/ui/components/ny4/dropdown-menu`.
- Update the file's header comment: the split now lives in the kebab.

### A2. The frame's header row can go, its rail toggle into the kebab — `src/components/bank/bank-frame.tsx`

- Add an optional prop `bare?: boolean`. When true, BankFrame renders no `<header>` (lines 54-84): no rail toggle button, no crumb, no header search. Default false: unchanged.
- Export a context from this file: `export const BankRail = React.createContext<{ open: boolean; toggle: () => void } | null>(null)`. BankFrame always provides it with `railOpen` and a toggler, wrapping its children.
- In card-list.tsx, `React.useContext(BankRail)`. When the list is `compact` (A3) and the context exists, the kebab carries a `DropdownMenuItem` reading "Hide sidebar" when open, "Show sidebar" when closed, calling `toggle`. Not compact: no item (/lift and /survey keep their header's toggle).

### A3. The list's one bar — `src/components/bank/card-list.tsx`

- Add an optional prop `compact?: boolean`. Default false: the two bars exactly as today, minus the split button (A1).
- Compact: one 52px bar (`flex h-[52px] shrink-0 items-center gap-1 border-b px-3`), no SearchField row. At the left, the search:
  - Closed (local `searching` state false and `query` empty): BankFrame's header search button, copied (`Button variant="ghost" size="icon-sm"`, `aria-label={placeholder}`, lucide `Search` size-4), setting `searching` true.
  - Open: the existing `SearchField` taking the bar's width (wrap it in `min-w-0 flex-1`), focused on open. Escape and its X both clear the query and close it.
  - Then the chevrons and kebab, `ml-auto` as today.
- `SearchField` (`src/components/bank/pane-bars.tsx:14`) gains optional `autoFocus?: boolean` and `onClose?: () => void`. With `onClose`: the input takes `autoFocus`, Escape calls `onClose`, and the X shows always and calls `onClose`. Without it: unchanged.

### A4. The pane's one bar — `src/app/america-thinks/question-table.tsx` and `rows-view.tsx`

- question-table.tsx:142-145: delete the `PaneSearchRow`. The `ViewToggle` (with its globe filter and the comment above it) moves into the title row's right side as the `children` of every `PaneTitleRow` in this file (lines ~148, 153, 162).
- `onBack`: when present, its button (copy pane-bars.tsx:49-53, ArrowLeft, "Back to the list") leads the `leading` node, before `<Marks …>`.
- `RowsView` (rows-view.tsx:152) renders its own `PaneTitleRow` with its kebab as children. Give RowsView an optional `toggle?: React.ReactNode` prop rendered before that kebab, and pass the ViewToggle from question-table.tsx:159. The leading node with the back button reaches it through the existing `leading` prop.
- Drop the `PaneSearchRow` import from question-table.tsx, and `query`/`onQuery` props there if nothing else reads them (follow them up to audience-inbox.tsx and remove the passing too). Leave `PaneSearchRow` itself in pane-bars.tsx: /lift and /survey use it.
- pane-bars.tsx's header comment: America Thinks' pane has one bar, the title row with the view toggle at its right.

### A5. Wire America Thinks — `src/app/america-thinks/audience-inbox.tsx`

- `<BankFrame …>` (line ~469) gets `bare`. Its `search` prop is still required by the type: keep passing it.
- `<CardList …>` (line ~391) gets `compact`.
- The kebab's "All questions / Pinned only" menu goes (Brendan: not the right menu; pinned questions stay reachable through the rail's Favorites). Delete the `menu={…}` prop (lines 402-407), and with it `type ListTab`, the `tab`/`setTab` state, `setTab("all")` (line ~173), the `tab` filter in the reading order (line ~274; the list keeps the "all" behavior, pins first, as today), `tab` from that memo's dependency array, and `tab === "pinned" ||` from the empty message (line ~413). Fix the comment at line ~269 ("the search and the pinned-only tab") to match.

Commit Part A, then ping.

## Part B — the Banner view in the compare grid — `src/app/america-thinks/segment-grid.tsx`

Today the grid puts questions across and groups down the side, one band per group, as gaps from the topline ("Compare"). Banner flips it into a pollster's banner table: groups across, every added question's answers down the side, levels with their margins: one crosstab covering many questions at once. A one-question Banner must read identically to that question's Crosstab view.

### B1. One crosstab computation for both

Move the crosstab body of question-table.tsx's `tab` memo (lines 107-123 and 131: base, options with the `MAX_BANNER_ROWS` cap, `banner`, `cell`) into an exported pure function `crosstabOf(rows: SourceRow[], info: MetricInfo)` in `src/app/america-thinks/audience-data.ts`, with `MAX_BANNER_ROWS` moved and exported there. Give `cell` an optional fourth argument `geo = base`, used in place of `base` in its row filter. question-table.tsx calls `crosstabOf` inside its memo and keeps its trend fields (latestYear, years, trendCell) local. Crosstab behavior is unchanged.

### B2. The toggle

- State: `const [across, setAcross] = React.useState<"questions" | "groups">("questions")`.
- First in the toolbar row (line 82): `ViewToggle` from `@/components/bank/pane-bars`, views `[{ value: "questions", label: "Compare" }, { value: "groups", label: "Banner" }]`.
- Segments, Breakdowns, Filter and the row count stay and apply to both views.

### B3. The Banner table (across === "groups")

- Columns: **Total** (each question's own baseline geography); then a **Geography** group, one column per place in `grid.geos` except a place that is the baseline of every column question; then one group per entry in `grid.breakdowns` (so the Breakdowns menu governs it), `dimLabel(dim)` over its values.
- Header: two rows drawn exactly as question-table.tsx's Crosstab draws its banner header (group cells with colSpan over a row of value cells). The stub header cell is empty.
- Body, for each question `c` in `grid.cols`: a section row (`bg-pax2-mist px-2.5 py-1.5 text-xs font-semibold text-muted-foreground`, colSpan all) reading `label(c.id)`. Then `const t = crosstabOf(rows.filter((r) => r[0] === c.id), c)` and one row per `t.options` band: Total = `t.cell(opt, null, null)`; a place = `t.cell(opt, null, null, g)`; a group value = `t.cell(opt, dim, val)`. Then the Crosstab's "Unweighted n" row for that question.
- Cells: the Crosstab's own cell markup (value with the small muted ±margin), inside a `<button className={frame}>` calling `onPick({ r, metric: c.id, segment: <the column's label> })`. Rows wear `rowDress(about != null && <row's cells>.includes(about.r))`. A missing cell prints the grid's "—".
- The stub column is sticky (`sticky left-0 z-[1] bg-background`; the section rows keep their mist ground).
- Width: replace SegmentGrid's `ScrollArea` (line 80) with a native `<div className="min-h-0 min-w-0 flex-1 overflow-y-auto">` (question-table.tsx:163-165 records why: radix's viewport sized itself to the banner's width and blew the pane out), and wrap the Banner table in `<div className="overflow-x-auto">`. Drop the ScrollArea import if unused.
- Compare stays exactly as it is.

Update the file's header comment to describe both views. Commit Part B, then ping.
