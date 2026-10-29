// The demo accounts behind the sign-in corner's quiet "Terms and conditions" link: Admin, Staff and
// Partners (Brendan, 2026-10-29), each a real user in the parallax Cognito pool with a confirmed email
// and a permanent password. The credentials are public by design — the popover shows them to anyone who
// finds it — so the sandbox is the protection: a demo account makes and reads its own world (the demo
// admin sees only demo-owned videos) and can never publish, rescore, review, or touch the poller or the
// pipeline. No "server-only" here: the sign-in popover renders these.

export type DemoAccount = { role: string; line: string; email: string; password: string }

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { role: "Admin", line: "The ops surfaces, hands off the levers", email: "admin@pax-demo.app", password: "Admin-demo-26!" },
  { role: "Staff", line: "Make a video, test it, read the results", email: "staff@pax-demo.app", password: "Staff-demo-26!" },
  { role: "Partners", line: "Your videos, tests, lifts and reports", email: "partners@pax-demo.app", password: "Partners-demo-26!" },
]

// Creator and Research left the card on 2026-10-29 and are disabled in the pool (admin-enable-user
// brings one back). They stay listed so that, re-enabled, they come back sandboxed, and what they made
// stays in the demo admin's view.
const RETIRED = ["creator@pax-demo.app", "research@pax-demo.app"]

export const DEMO_ADMIN = "admin@pax-demo.app"
export const DEMO_EMAILS = new Set([...DEMO_ACCOUNTS.map((a) => a.email), ...RETIRED])

/** The corner's row click on /signin: the form fills both fields from the account and signs in. */
export const DEMO_SIGNIN_EVENT = "pax:demo-signin"
