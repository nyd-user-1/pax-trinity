# Brief — Screenshots for the / page's product dialogs

You are the Opus window that took Briefs Q and T, staying on for a visual task. Ground rules as before: commit locally per feature, never push; stage by explicit path; check `git log -1` immediately before any commit. **The dev server on :3000 is the lead's — use it, never restart or stop it, never start a second one** (a hook enforces the ban). No tsc, no Next build.

## What this is

Every box on `/` opens a dialog that shows a product screenshot. A box with `shots` set in `src/lib/home-data.ts` has its images; a box without falls back to `/products/<title-as-slug>.png` (`PRODUCT_EXTRAS`' comment states the rule, `src/app/ProductShot.tsx` renders the frame and the striped placeholder when the file is missing). The Audience dialog shows the placeholder today: `public/products/audience.png` does not exist. Brendan wants the placeholders replaced with real screenshots.

## The job

1. Read `home-data.ts` and `ProductShot.tsx`; enumerate every box whose dialog reaches the fallback path with no file in `public/products/` (API boxes draw their readout instead of a screenshot — skip them).
2. For each with a live surface in this app, screenshot it from the running dev server at `http://localhost:3000`. Audience's is `/inbox-2` — the new topics rail with a question open is the money shot. Pick each other box's truest surface yourself (Consensus has `/consensus`; the schema/reference surfaces exist); if a box has no real surface to show (a model, an unbuilt tool), leave it on the placeholder and flag it — never stage a fake.
3. Playwright headless is fine (the install in `~/Code/44b/node_modules` works; a macOS firewall prompt for chrome-headless-shell may appear — Brendan knows, Deny is fine and harmless). Match the frame's aspect from `ProductShot.tsx`; shoot a clean viewport (around 1440×1000, deviceScaleFactor 2) with the UI in a presentable state — a sensible selection open, no error toasts, data loaded (wait for it).
4. If a surface is auth-gated, check how `/signin` works locally before screenshotting; if sign-in can't be done non-interactively, flag it rather than forcing it.
5. Save as `public/products/<slug>.png`, commit by explicit path, and report below: each box → surface shot or flagged-why, with file sizes. Ping the lead (`pax-trinity-1c`) when done.

---

## Worker report
