# The agents' spend gate, and the old-account fallback audit

You are worker-2 on pax-trinity. Two steps, in order. Where the brief and the code disagree, follow the code and note it. Questions go to the lead (pax-trinity-60), never Brendan.

## Working rules

- Shared checkout: never amend, never `git add -A` — explicit paths only. Commit each finished step in the repo's commit voice (`git log -5`), never push. npm, not pnpm.
- Local `tsc`/`eslint`/builds are hook-blocked: prove each edited file parses in Node (esbuild transform); the lead runs the proving build.
- Report file: `docs/migration/account-audit-report.md`, git-ignored, appended as you go, never committed.
- AWS: **read-only CLI only** — describe/list/head under both profiles (default = the old account, `pax-new` = the new, us-east-2). You create, migrate and delete nothing.

## Step 1 — gate /api/agents/chat

`src/app/api/agents/chat/route.ts` runs a Bedrock loop with no auth — only a per-instance IP rate limit its own comment calls "not an access control". Add the gate: `currentUser()` from `@/lib/auth`, signed-in required, 401 JSON otherwise, before any body parsing; the rate limit stays. Sweep the rest of `src/app/api/agents/` for sibling routes that reach Bedrock unauthenticated and gate them the same way; list what you found either way.

## Step 2 — the old-account fallback audit

The code carries env-var defaults that point at the old account and us-east-1 while the app's home is the new account, us-east-2 — a missing production var fails silently into the wrong account. Known examples: `PAX2_BUCKET ?? "pax-2-638175140432"` and `PAX2_REGION ?? "us-east-1"` (several files), and `lib/clips/recorded.ts`'s region chain ending in us-east-1 while `lib/clips/storage.ts` defaults us-east-2.

1. Inventory every `process.env.X ?? <literal>` (and `|| <literal>`) in `src/` and `scripts/` whose literal names a region, bucket, table, pool, function or account id. One table in the report: file:line, var, default, what reads it.
2. For each, verify where the resource actually lives today — read-only CLI under both profiles (head-bucket, describe-table, etc.). Do not guess from names.
3. Then, per case: the resource lives in the new account → flip the in-code default to the real home; the resource genuinely still lives in the old account → leave the default, mark it OLD-ACCOUNT in the table; the var is production-critical with no safe default → keep the dev fallback but throw a plain error in production when it is unset (`NODE_ENV === "production"`), so it fails loudly, never silently.
4. Top of the report: every env var production (Amplify) needs set, current value included where you verified it.

Commit the code changes per logical group, with the audit table driving each one.
