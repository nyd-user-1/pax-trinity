// Who PAX may actually email (Brendan, 2026-10-29). Every real send passes
// through here: an address not on the list is held, never sent. Until Brendan
// widens it, the list is his own address alone, so every test lands with him.
// MAIL_ALLOWLIST (comma-separated) replaces the default when it is set.

const DEFAULT = ["brendan@nysgpt.com"]

export function allowlist(): string[] {
  const set = process.env.MAIL_ALLOWLIST?.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean)
  return set?.length ? set : DEFAULT
}

/** Splits recipients into those PAX may mail and those it holds. */
export function screen(addresses: string[]): { allowed: string[]; held: string[] } {
  const ok = new Set(allowlist())
  const unique = [...new Set(addresses.map((a) => a.trim().toLowerCase()).filter((a) => a.includes("@")))]
  return { allowed: unique.filter((a) => ok.has(a)), held: unique.filter((a) => !ok.has(a)) }
}
