# Brief — Pass 2 on /audience: Brendan's 5am list

You are `surfaces`. Eleven deterministic steps, all files already scouted — paths and line anchors below are from the current tree. Screenshots: `docs/wireframes/pass2-*.png` (120 split bug, 123 About panel, 124 one-column dossier, 125/126 rail restyle). Ground rules: **no commits until the lead's QA** — do the whole list in the working tree, then ping the lead (`pax-trinity-1c`); the lead reviews on :3000 and answers with corrections or the word to commit (path-limited, per feature). **Never push** — Brendan reviews first. The dev server on :3000 is the lead's; curl it to smoke. No tsc/eslint (hook): the next push's Amplify build is the only type check, so be type-strict — the cautionary tale is c77bbc1→job 8, where a `.filter((g): g is …)` predicate over a React setter failed the remote build. Parse-check files with `node -e` + the `typescript` package's `createSourceFile` parseDiagnostics if you want a syntax net.

## 1. Split toggle with a question open — `src/app/audience/audience-inbox.tsx`

Bug (pass2-120): in table mode the layout hardcodes `listFor("vertical")`, so the list toolbar's split toggle changes state with no effect. Fix: in the `mode === "table" && tableMetric` branch, render the list only when `split === "vertical"`; when `split === "none"`, the pane takes the full width and its search row gains a leading back control — lucide `ArrowLeft`, ghost icon button, aria "Back to the list" — that sets `tableMetric` null and `mode` "list" (plumb a `onBack` prop into QuestionTable → `PaneSearchRow`; render it only when the list is hidden). Gmail's anatomy: reading pane off, the message takes the screen, back returns to the list.

## 2. Card chip border — `src/components/bank/card-list.tsx` (~line 162)

The chip span (`rounded-full bg-muted px-2 …`) gains `border` (1px, default border color).

## 3. Title max width — `src/components/bank/pane-bars.tsx` PaneTitleRow

The title span (`min-w-0 truncate text-sm font-semibold`) gains `max-w-[115ch]` — the measure of "And what about women? Would you say that their treatment and opportunities are better in the military, better…".

## 4. Select / important / favorite in front of the pane title

- `pane-bars.tsx`: `PaneTitleRow` gains an optional `leading?: React.ReactNode` rendered before the title span.
- `audience-inbox.tsx`: revive `const [important, setImportant] = React.useState<string[]>([])` (removed in 4e2f464). Pass to QuestionTable: `isColumn`, `atCap`, `onColumn` (the existing `toggleColumn`), `pinned`/`onPin`, `important`/`onImportant` for the open metric.
- `question-table.tsx`: compose `leading` = three controls for the open question, in order: the house Checkbox (`@govblock/ui/components/checkbox`, aria "Add as column", checked = isColumn, disabled at cap with title "Four columns at most"), the Gmail importance arrow (the amber SVG `Marker` deleted in 4e2f464 — recover it from `git show 4e2f464^:src/app/inbox-2/segment-list.tsx`, the `<path d="M4 5h7l5 5-5 5H4l5-5z">` button), and the star (StarIcon, fill-yellow-400 when pinned). Pass the same `leading` to RowsView (give RowsView a `leading` prop it forwards to its PaneTitleRow) and to the crosstab/chart/drill `PaneTitleRow`s.

## 5. Data-row kebab — `src/app/audience/rows-view.tsx`

A ninth column, header empty, cell width ~40px: on row hover only (the `group` pattern — rows aren't grouped yet; add `group/row` to the `<tr>`), an `EllipsisVerticalIcon` ghost icon button (opacity-0, `group-hover/row:opacity-100`, plus open-state held visible — copy the RowEnd pattern from card-list.tsx), menu: "Open in the panel" (calls the row's existing onPick) and "Copy row" (`navigator.clipboard.writeText` of the row's cells tab-separated: wave, segment, band, est, moe, n, geo, weight). Stop propagation so the row click doesn't fire.

## 6. About panel as a drill-down layer — `audience-inbox.tsx`, `question-table.tsx`, `audience-pane.tsx`

Today About renders as a 420px aside at the frame's right edge (pass2-123). Wanted: in table mode it takes the right PANE as a layer. `AboutPanel` gains a `layer?: boolean` prop: when set, the wrapper drops `w-[420px] border-l` for `w-full`, content capped `max-w-2xl`. In `question-table.tsx`, when `about != null`, the content area below the two bars renders `<AboutPanel layer …/>` instead of the current view (same pattern as the dossier drill; About wins over the drill if both are set — the X closes About and returns). In `audience-inbox.tsx`, the table branch's `aside` keeps only `blocksPanel` and passes `about`/`setAbout` through as it already does; the grid branch keeps the aside AboutPanel as is.

## 7. Dossier to one column — `src/app/q/[source]/[id]/dossier.tsx` (line 89)

Per pass2-124 (Brendan's revision): the grid `lg:grid-cols-[minmax(0,1fr)_380px]` becomes one column (`max-w-[920px]`, keep `mx-auto`); the `<aside>` contents (Related, UsedBy, Provenance card, Chips) follow the three main blocks in the same column, full width, same order.

## 8. Hide the Trend block when it cannot draw — same file

`total.length > 1` or nothing: when a question has fewer than two waves at the open geography, the whole Trend `<Card>` does not render (the "One wave on file: 1984." card dies; the no-wave message dies with it — the headline and crosstab still carry the single wave).

## 9. Click-to-copy on the three blocks — same file

Trend, Headline and Crosstab cards each gain the standard copy control: top-right corner, visible on hover of the card (`group` on Card's wrapper via a local wrapper div — do not edit `_wire/wire-bits.tsx`; wrap each Card's contents or wrap the Card), lucide `Copy` ghost icon button, aria "Copy"; onClick copies the block's `innerText` from a ref around the block's content; swap to `Check` for 1.5s after. One small shared component inside dossier.tsx.

## 10. The rail, restyled to the shell menu — `source-rail.tsx`, `bank-rail.tsx`, `bank-frame.tsx`

Per pass2-125/126 and Brendan's words:

- **bank-frame.tsx**: rail `ResizablePanel` defaultSize 224 → **240** (the shell menu is w-60). Rail bg must match the shell menu exactly: the shell sidebar is `bg-pax2-mist` (shell.tsx:267); set the rail panel `bg-pax2-mist` explicitly.
- **bank-rail.tsx**: `BankRail` drops the `<p>` title for an optional `header?: React.ReactNode`; keep the title prop working for /lift and /survey (title renders only when no header). `RailRow` gains `menu?: React.ReactNode` — when present, the count swaps to an `EllipsisVerticalIcon` kebab on row hover (the card-list RowEnd swap, count visible otherwise), the menu portaling with stopPropagation. Add `RailGroup` support for `collapsible?: boolean; defaultOpen?: boolean`: the label becomes a button with a chevron, collapsed hides the rows.
- **source-rail.tsx**:
  - Header: the shell's ⌘K search bar dress, exactly (shell.tsx:643–663): `flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 shadow-e1`, Search icon, placeholder "Search…", ⌘/K kbd chips (decorative) — wired to the list's existing `query`/`onQuery` (plumb the two props from audience-inbox into SourceRail). The old "Topics" h1 goes.
  - First group: Constructs (as is), then **Favorites** (lucide `Star`) and **Important** (lucide `Flag`) rows with counts = pinned.length / important.length. They are selections, not links: audience-inbox gains a third selection kind — suggest `topic` taking the sentinel values `"__favorites"`/`"__important"`, with `summaries` filtering `pinned.includes(q.question)` / `important.includes(q.question)` across the bank (LIFT/PAX excluded as in topic mode) and the rail marking the row `on`. Empty copy: "Nothing pinned." / "Nothing marked important."
  - Section label **"Index"** above the topics group (`RailGroup label="Index"`).
  - Every topic row gets an icon and a kebab menu whose one item is the count, disabled: `{count.toLocaleString()} questions`. Icon map (lucide): America & the world `Globe` · Community & connections `UsersRound` · Crime & punishment `Gavel` · Demographics `IdCard` · Economy & inequality `DollarSign` · Education & knowledge `GraduationCap` · Elections & voting `Vote` · Environment `Leaf` · Family & household `House` · Gender & sexuality `Heart` · Health & wellbeing `HeartPulse` · Home & place `MapPin` · Media & leisure `Film` · Politics & government `Landmark` · Race, ethnicity & immigration `Users` · Religion & spirituality `Church` · Rights & liberties `Scale` · Science & technology `FlaskConical` · Trust & values `Handshake` · Work & jobs `Briefcase` · No topic yet `CircleDashed`.
  - The folders group: label "Folders" → **"Data"**, every source icon Folder → **`Database`**, the group collapsible and **default collapsed** (Electorate stays its first row).

## 11. Done means

The whole list standing in the working tree, nothing committed, ping the lead with: what changed per step, the curl smokes (each touched route 200), and any type-risk notes. The lead QAs on :3000 and answers with corrections or the commit word. Keep every edit inside the files named here plus the minimal prop plumbing; `_wire/wire-bits.tsx` and other routes' files stay untouched.

---

## Worker report

All eleven steps landed across the ten files the brief names. No other route's files were touched (`_wire/wire-bits.tsx` included). The lead QA'd on :3000 and approved all three deviations. Committed per feature, not pushed:
- **0906477**: the question pane, steps 1–6. It carries a pane-only version of audience-inbox.tsx, so the commit stands without the rail.
- **6032e46**: the rail, step 10.
- **cd17623**: the dossier, steps 7–9.

**Smoke** (curl :3000 plus a grep of the compiled chunks):
- /audience 200, carrying "Back to the list", "Nothing marked important.", "Open in the panel", "Copy row", Favorites, Index, "Mark as important", `max-w-[115ch]`, the chip's `border` and the rail's `bg-pax2-mist`.
- /lift 200 and /survey 200 (they share the frame and rail).
- /q/gss/confidence_congress 200, carrying `group/copy` and `max-w-[920px]`.
- All ten files parse clean under the TypeScript parser. No type check was run (hook).

**Per step:**
1. In table mode the list renders only when split is on. Off, the pane takes the full width and its search row leads with Back (ArrowLeft), which returns to the list. **Deviation:** opening a question turns the split on, as opening always has. Otherwise, with the default split off, every click would hide the list, against Brendan's 10-26 "don't close the middle panel". The toggle now works with a question open. Say the word if the split should instead stick across opens (Gmail's reading-pane setting).
2. The card chip has `border`.
3. The pane title has `max-w-[115ch]`.
4. `PaneTitleRow` takes `leading`. The open question's leading controls are the house Checkbox, the recovered amber importance arrow and the star, on all four title rows (Data, Crosstab/Trend, dossier drill, About layer). `important` state is revived. **Deviation:** the checkbox only adds or removes the column and leaves the question open. `toggleColumn` also leaves the question for the compare grid, so ticking the box would have made it vanish. The row kebab's "Add as column" still jumps to the grid.
5. The Rows view has a ninth column with a hover kebab, held visible while open: "Open in the panel" (the row's onPick) and "Copy row" (eight printed cells, tab-separated). Both clicks stop propagation. Printed cells and copied cells share one helper.
6. `AboutPanel` takes `layer`: full width, reading capped at `max-w-2xl`. In table mode it replaces the content under the two bars, and About wins over the drill. The table branch's aside keeps only Blocks; the grid branch keeps the 420 aside. Opening another question now clears a picked value, so the layer can't cover the new question with the old one's figure.
7. The dossier is one column, `max-w-[920px] mx-auto`. Related, Used by, Provenance and Chips follow the three blocks in the same order.
8. The Trend card renders only with two or more waves. "One wave on file" and the no-wave line are gone. A skeleton still holds the slot while the rows load, so a single-wave question shows it briefly before the card drops.
9. `Copyable` wraps the Trend, Headline and Crosstab cards: a hover Copy button in the top-right corner copies the block's `innerText` and shows Check for 1.5s. It's one small component in dossier.tsx; skeleton cards don't get it.
10. **Frame:** the rail is 240 wide on `bg-pax2-mist`, for /audience, /lift and /survey alike.
    **BankRail:** `header` replaces the title, and `title` still serves /lift and /survey.
    **RailRow:** `menu` swaps the count for a kebab on hover. The kebab is a sibling of the row, not inside it, because a button can't hold a button.
    **RailGroup:** `collapsible` / `defaultOpen`.
    **SourceRail:**
    - The shell's ⌘K bar dress, wired to the list's query.
    - Constructs, then Favorites (Star) and Important (Flag) as selections, using the `__favorites` / `__important` sentinels across the bank, with LIFT/PAX left out.
    - "Index" over the topics, each with the brief's icon and a kebab holding "N questions" (disabled).
    - "Data" over Electorate and the sources, with Database icons, collapsible. **Deviation:** the Data group starts shut unless the address opened a folder. /electorate's `?source=` links would otherwise land on a hidden open row.

**Type-risk notes:**
- The Base UI Checkbox takes `title` and an `onCheckedChange` of `() => void`. Both were already in use on this component before 4e2f464, and that code built remotely.
- `onRefresh` came off QuestionTable, and its now-unused `refresh` came out of audience-inbox. Brendan's 4am pass had already removed the button.
- `aboutLayer` and `aside` take `JSX.Element | null | false`, which is valid ReactNode.
- `tableMetric` is used inside closures within its narrowed branch, the same pattern the old `refresh(tableMetric)` used.
