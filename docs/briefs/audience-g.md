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

(append here)
