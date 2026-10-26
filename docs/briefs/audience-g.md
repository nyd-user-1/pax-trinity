# Brief G — Fielding: test setup, the panel handshake, and the monitor

You are the audience-a window, now in the Next app. Ground rules: commit locally per feature, never push; stay strictly inside the paths named here. Off limits: `/inbox`, `src/app/audience/` (another window), and `src/app/test/[id]/flow.tsx` + `src/app/api/tests/[id]/responses/` (the audience-b window is editing those under Brief F — coordinate through lead-agent, never edit them). The dev server runs on 3000.

## What this is

When the client funds panel waves, an admin must be able to set a test up, hand the panel vendor one link, watch the field fill, and close it — without a developer. Most parts exist; this brief adds the three missing surfaces.

## 1. Tests become data

- DynamoDB table `pax-trinity-tests` (us-east-1, on-demand, pk `id`). Create it via CLI; grant the Amplify SSR role (app d7ae83v4rrcey) read/write — live parity.
- `src/lib/tests/store.ts`: `getTest(id)` — reads the table, falls back to the seeded `open-primaries-1` from `src/lib/tests/open-primaries.ts` when the id matches or the table is unreachable (dev without creds still works). A test record holds: id, title, entry questions (defaulting to the seeded battery), arms (clip-store ids plus the placebo src), explanation, ballot, comprehension (with correct key), target completes per arm, status (draft | fielding | closed), and panel config: vendor name plus redirect URL templates for complete / screenout / quota-full, each containing a `{pid}` placeholder.
- Edit `src/app/test/[id]/page.tsx` (this file only in that directory) to load via `getTest` — unknown ids still 404; a `closed` test renders a plain "This survey is closed." card.

## 2. /message-tests — the admin surface

Admin-gated with `requireAdmin` patterns (`currentUser` from `@/lib/auth`; non-admins get the signin redirect). Block dress, context switcher title, sidebar entry visible to admins only.

- **List:** every test with status, arm count, completes so far.
- **Setup (create/edit):** form over the test record. Arms are picked from the clips store's PUBLISHED by id (show title + duration); the placebo src is a URL field with the mixkit default. Entry/ballot/comprehension default from the seed and are editable as text. Target completes per arm, status.
- **Field kit:** per test, the copyable entry link `https://<host>/test/<id>?pid={PID}` and the three redirect templates echoed back, so the vendor handoff is one copy-paste each way.
- **Monitor:** `/message-tests/<id>` shows the field: per-arm finished counts against target, entry-question balance (party, 2024 vote) per arm, and screenout/quota counts. Read from `GET /api/tests/[id]/monitor` (audience-b is building it under Brief F). If the endpoint isn't committed yet, render the page against its documented shape with a clear "collector not yet live" empty state — do not build a rival endpoint.

## 3. The panel handshake (respondent side, without touching flow.tsx)

The flow file belongs to audience-b. Your half: `page.tsx` reads `?pid=` and passes it into the flow as a prop (coordinate the prop name with lead-agent: it is `pid: string | null`; audience-b has been told to accept it, store it on the response record, and on completion redirect to the test's complete-URL template with `{pid}` substituted when panel config exists — otherwise show the code screen as today). Screenout/quota redirects happen the same way at the attention/quota gates audience-b owns. Your deliverable is the data model + admin + field kit + monitor; the flow wiring is theirs.

## Done means

A draft test can be created, edited, set fielding, and closed from /message-tests on the dev server; /test/<new-id> serves it; the field-kit link carries pid through; the monitor renders (live data if F's endpoint is in, documented empty state if not); IAM on the live role; committed locally; report appended below.

---

## Worker report

**Done.** Three commits, all local, not pushed:

- `53bb273`: the data model (src/lib/tests/types.ts, store.ts).
- `719a637`: /message-tests (list, setup, field kit, monitor) and the admin-only sidebar entry.
- `7d2a271` (audience-b's commit): my src/app/test/[id]/page.tsx, landed together with the Flow it renders and credited in that commit's message, as the lead ruled.

### AWS, live

- **Table:** `pax-trinity-tests`, us-east-1, on-demand, pk `id`, tags `project=pax-trinity` and `purpose=message-tests`, deletion protection on (matching the responses table).
- **IAM:** an inline policy `pax-trinity-tests` on the Amplify app's compute role `pax-trinity-amplify-compute` (app d7ae83v4rrcey), granting `dynamodb:GetItem`, `PutItem` and `Scan` on that table only. It follows the pattern of the role's `pax-trinity-test-responses` policy.
- **Contents:** the table is empty. The seeded `open-primaries-1` is served from code until someone saves it in /message-tests; then the saved item wins.

### What's built

- **`getTest(id)`** reads the table. It falls back to the seed when the id is `open-primaries-1` and either no item exists or the table is unreachable; any other unknown id is null.
- **The record:** id, title, entry questions (defaulting to the seed's battery), explanation title and text, ballot, comprehension with its correct key, and arms. Arms are `"placebo"` plus clips-store PUBLISHED ids, with `placeboSrc` defaulting to the mixkit clip. It also holds `targetPerArm`, status (`draft | fielding | closed`) and `panel { vendor, completeUrl, screenoutUrl, quotaFullUrl } | null`, each URL required to contain `{pid}`.
- **`problems()`** lists every validation failure in plain words.
- **/message-tests** (Block dress; header "Message tests"; admins only, everyone else redirected to /signin; actions refuse non-admins and demo accounts):
  - The list shows status, arm count, and completes against target, with completes from the collector's monitor.
  - **Setup** (`/new`, `/<id>/edit`):
    - Arms are picked from PUBLISHED by title, id and duration.
    - The placebo URL is its own field.
    - Entry, ballot and comprehension are edited as text (`key | prompt`, `- value | label`, `*` for the correct answer).
    - The form also holds target per arm, status, and the panel vendor with its three redirect templates.
    - A failed save lists every problem and keeps the admin's edits.
  - The **test page** (`/<id>`) has Start fielding / Close / Reopen, the field kit, and the monitor.
  - The **field kit** is copyable: `https://<host>/test/<id>?pid={PID}`, with the host taken from the request, plus the complete, screenout and quota-full templates echoed back.
  - The **monitor** reads `GET /api/tests/<id>/monitor`, now live in audience-b's commit:
    - finished / target per arm with a bar, started, and completion;
    - party and 2024-vote balance per arm;
    - screenouts and quota-fulls, each shown as "Not counted yet" until the collector reports it. Screenouts are reported now; quota-full isn't yet.
    - It refreshes every 30 s, and has a "Collector not yet live" state for when the endpoint doesn't answer.
- **Sidebar:** an Admin group (ShieldCheck), shown to admins only, holding Message tests; `/message-tests` joins the live set.
- **The respondent page** (`/test/<id>`) loads through `getTest`. Unknown ids get the not-found page, and a closed test gets "This survey is closed." The arm is drawn from `test.arms`, and `?pid=` is passed through, trimmed and capped at 128 characters. The page renders `<Flow arm pid test />`.

### Verified on the dev server

I drove headless Chromium through the real UI, against the live table:

1. Create with a complete-redirect missing `{pid}`: errors listed, edits kept.
2. Fix and create: redirected to the test page; the field kit shows the entry link and all three redirects.
3. `/test/<id>?pid=…` serves the draft.
4. Start fielding.
5. Edit the title.
6. Close: `/test/<id>` shows the closed card.
7. The list shows the test as Closed with 0 completes; the monitor reads audience-b's endpoint live (0 / 600, screenouts 0, each arm by clip title, the balance tables).

After audience-b's flow landed, a new test id rendered its own title and questions, none of the seed's, with the `pid` carried into the flow. The comprehension-key check refused an unmarked answer.

Both smoke records were deleted afterwards. They left no responses.

### Notes

- **The clips store is a `"use client"` module,** so server code can't read PUBLISHED. The setup form checks arm ids against PUBLISHED; the server action checks their format only; and the flow falls back to the placebo source for an unknown id. A server-readable copy of the published list would let the server check membership too.
- **Draft tests are served at /test/<id>,** so an admin can preview one, and responses to a draft would be collected. Only `closed` shows the closed card. If drafts shouldn't collect, page.tsx can show the closed card for drafts as well. That's a one-line change I didn't make.
- **The seed's target is 500 per arm.** That's a setup default I picked, editable in the form, not a figure from any source.
- **Not-found pages answer HTTP 200 on this dev server,** for every route, not just these (e.g. /definitely-not-a-route-xyz). The unknown-id body is the standard not-found page.
- **Type checks:** a user hook bans full-project `tsc` on this machine. I type-checked only the files I touched, with a scoped TypeScript program: 0 problems, about 410 MB peak. page.tsx checks clean against audience-b's Flow. I didn't run `next build`; the Amplify build will run the full check.
- **Not touched:** flow.tsx, the responses and monitor routes, /inbox, src/app/audience.
