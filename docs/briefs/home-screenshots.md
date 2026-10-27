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

### Hashes

- `f2733db`: the first set, nine PNGs.
- `48ad80f`: the re-shoot to the dialog frame's shape, and `consensus.png` removed.

Only `public/products/*.png` changed.

### Which boxes reached the placeholder

`/`'s contents rail is the ten pax boxes (`PAX_BOXES`) plus the two dev tools. Nine pax boxes reached `ProductShot`'s fallback with no file. Consensus is one of `TOOLS`, so its dialog draws its own illustration; I shot it first, saw it never shows, and removed it. HQ has its own `shots`, Inspector draws, and the models open no dialog. In the masthead's switchboard, every product has `shots`, the tools draw and the APIs show their readout, so no placeholder remains there.

### Box, surface, file

| Box | Surface shot | File |
|---|---|---|
| Audience | `/inbox-2`: the topics rail on Politics & government, "Are things in this country on the right track…" open on its Trend | `audience.png`, 448,675 B |
| Chat | `/chat?c=c617ae6c…`, a past conversation: "What is a persuasion score…", answer and trait table (opened only, nothing sent) | `chat.png`, 313,128 B |
| Clips | `/clips`, the grid across all partners (209 clips) | `clips.png`, 2,526,746 B |
| Lift Benchmarks | `/lift`, the Archive folder by favorability (618 treatments, 243,134 respondents) | `lift-benchmarks.png`, 247,235 B |
| Message Tests | `/lift`, the Tests folder: the arms' comprehension and support lifts against the placebo | `message-tests.png`, 143,568 B |
| Partners | `/clips`, the Unite America desk (36 clips), picked from the Partners menu | `partners.png`, 2,779,023 B |
| Polls | `/inbox-2`, the Polls folder with "Support for open primaries" open on its Data view | `polls.png`, 497,647 B |
| Scripts | `/chat?c=8a4b0802…`, a past conversation's Script block (62 words, about 29 seconds) and its Shots | `scripts.png`, 177,848 B |
| Reports | flagged: no surface; the wave readout is still underway | placeholder stays |

### How

- Playwright headless from `~/Code/44b`, against the running dev server, which I never restarted.
- **Frame shape.** The frame on `/` measures 640×530 on any desktop viewport (1.21:1) and fills with `object-cover` from the top. My first 1.44:1 set lost its sides, including the inbox's topics rail. The fix is shots at 1.2:1 and 2x: 1200×1000 for most, and 1440×1200 for Clips, Partners and Polls so their wide layouts hold. Each now loses 3px at the foot and nothing at the sides; I checked every dialog in a browser.
- **Clean state.** I closed the voices banner, hid the dev server's overlay badge with CSS, parked the mouse so no hover state shows, and waited for network idle before each shot.
- **Read-only.** Past chats were opened, never sent to. The test flow was never started.

### Rulings for the lead

1. **Scripts is a judgment.** The box reads "Underway" and has no route, but writing and revising a script in place is built: chat's Script block with its word count, length, citations and shots. If Scripts should wait for its own page, delete `scripts.png` and the placeholder returns.
2. **Message Tests shows `/lift`'s tests, not the box's own link** (`/test/open-primaries-1`). That flow posts a start record to the live responses table the moment Start is pressed, and its first screen is a bare card. The admin page `/message-tests/open-primaries-1` prints a localhost entry link and shows 3 completes.
3. **Two big files.** Clips and Partners are 2.5 and 2.8 MB, from the video thumbnails. The repo already ships PNGs of this size, and a dialog loads its image only when opened. No PNG optimizer is on this machine; AVIF, as the older products use, would need the card's `shots` set instead of the fallback.
4. **What the shots show as the app is.** Clips prints "Sign in to like or comment" and "Log in": the client session isn't set on dev, though the server treats local as admin. Polls' Geo column prints state codes (25, 08, 46). Lift Benchmarks' treatments are the archive's hashed ad ids.
