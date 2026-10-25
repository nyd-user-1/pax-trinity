import "server-only"

import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto"

import { STATEMENTS, monthOf, type GroundStatement } from "@/lib/consensus/common-ground"

// Common Ground's guard (2026-09-24). The server deals the statements; the
// reader only answers them. Three things keep an answer from counting twice
// or being forged:
//
//   · the voter: 'u:<id>' when signed in, else a random id in an httpOnly
//     cookie signed with AUTH_SECRET, holding this month's answered statements;
//   · the ticket: each dealt statement comes with a signature over voter,
//     statement and the moment it was dealt, and a vote without the ticket for
//     that statement is refused — so no one can vote on a statement they were
//     not shown, or pick which ones they answer;
//   · the database's unique key (sql/039_consensus_votes.sql): one answer per
//     statement, voter and month, whatever the cookie says.
//
// An answer faster than a statement can be read, or past three from one
// address on one statement in a month, is kept but not counted.

export const COOKIE = "gb_ground"
/** Faster than this after the deal and nobody read the statement. */
export const MIN_READ_MS = 1200

const secret = () => `common-ground:${process.env.AUTH_SECRET ?? "dev"}`
const sign = (data: string) => createHmac("sha256", secret()).update(data).digest("base64url")
const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

export type Ground = { voter: string; month: string; answered: number[] }

/** The cookie's state, or a fresh anonymous voter when it is missing, forged or last month's. */
export function readGround(raw: string | undefined, signedIn: string | null): Ground {
  const month = monthOf().key
  let state: Ground | null = null
  if (raw) {
    const [body, sig] = raw.split(".")
    if (body && sig && same(sign(body), sig)) {
      try {
        state = JSON.parse(Buffer.from(body, "base64url").toString()) as Ground
      } catch {
        state = null
      }
    }
  }
  const voter = signedIn ? `u:${signedIn}` : state?.voter?.startsWith("a:") ? state.voter : `a:${randomUUID()}`
  const answered = state && state.month === month && state.voter === voter ? state.answered.filter(Number.isInteger) : []
  return { voter, month, answered }
}

export function writeGround(g: Ground) {
  const body = Buffer.from(JSON.stringify(g)).toString("base64url")
  return `${body}.${sign(body)}`
}

export type Dealt = { statement: GroundStatement; issued: number; ticket: string } | null

/** A statement this voter has not answered this month, at random. */
export function deal(g: Ground): Dealt {
  const done = new Set(g.answered)
  const left = STATEMENTS.filter((s) => !done.has(s.tid))
  if (!left.length) return null
  const statement = left[randomInt(left.length)]
  const issued = Date.now()
  return { statement, issued, ticket: sign(`${g.voter}|${g.month}|${statement.tid}|${issued}`) }
}

export const ticketHolds = (g: Ground, tid: number, issued: number, ticket: string) => typeof ticket === "string" && same(sign(`${g.voter}|${g.month}|${tid}|${issued}`), ticket)

/** The address, hashed with the secret and the month so it cannot be reversed or followed across months. */
export const ipHash = (ip: string | null, month: string) => (ip ? createHash("sha256").update(`${secret()}|${month}|${ip}`).digest("hex").slice(0, 32) : null)

export const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 40 }
