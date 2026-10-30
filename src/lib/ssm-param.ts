import "server-only"

// One SecureString from SSM Parameter Store, cached five minutes: long enough that a burst of polls
// costs one read, short enough that a script writing a new token takes effect without a deploy
// (after govblock's lib/agents/connections/secret.ts). A missing or unreadable parameter reads as null.

// PAX Trinity's parameters sit in the new account's us-east-2 (copied from pax2's us-east-1,
// Brendan 2026-10-30: Trinity works in us-east-2 only); the tables' region names it.
const REGION = process.env.PAX_TRINITY_TABLES_REGION ?? "us-east-2"
const TTL = 5 * 60_000
const cache = new Map<string, { at: number; value: string | null }>()

export async function param(name: string): Promise<string | null> {
  const hit = cache.get(name)
  if (hit && Date.now() - hit.at < TTL) return hit.value
  let value: string | null = null
  try {
    const { SSMClient, GetParameterCommand } = await import("@aws-sdk/client-ssm")
    value = (await new SSMClient({ region: REGION }).send(new GetParameterCommand({ Name: name, WithDecryption: true }))).Parameter?.Value?.trim() || null
  } catch {
    value = null
  }
  cache.set(name, { at: Date.now(), value })
  return value
}
