import { NextResponse, type NextRequest } from "next/server"

// Keeps a reader signed in. Cognito's ID token, the pax2_session cookie, lasts an hour; the refresh token
// beside it (pax2_refresh) lasts 30 days. When the session is missing or about to lapse, this swaps in a
// fresh one before the page renders, so the page itself already sees the reader as signed in.

const CLIENT = process.env.PAX2_COGNITO_CLIENT_ID
const REGION = process.env.PAX2_REGION ?? "us-east-1"

const expiresSoon = (token: string) => {
  try {
    const { exp } = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number }
    return !exp || exp * 1000 < Date.now() + 60_000
  } catch {
    return true
  }
}

// Old addresses that now live elsewhere. Answered here, before any render, so the browser gets one
// redirect instead of a rendered shell that redirects itself (the page files keep the same mapping).
function alias(path: string, q: URLSearchParams): string | null {
  // The 2026-10-27 consolidation: /inbox-2 took the /audience address, the
  // reference pages became /data-dictionary's tabs, and consensus became one
  // page whose tabs the old sub-routes open.
  if (path === "/inbox-2") return `/audience${q.size ? `?${q}` : ""}`
  if (path === "/glossary" || path === "/schema" || path === "/erd") return `/data-dictionary?tab=${path.slice(1)}`
  const consensusTab = ({ "/consensus/survey": "questions", "/questions": "questions", "/consensus/report": "results", "/consensus/admin": "admin" } as Record<string, string>)[path]
  if (consensusTab) {
    const c = q.get("c")
    return `/consensus?tab=${consensusTab}${c ? `&c=${encodeURIComponent(c)}` : ""}`
  }
  return null
}

// Pages that send a signed-out reader to /signin. With no session and no refresh cookie the answer is
// known before render, so the redirect happens here (each page still checks for itself).
const GATED = ["/signup/welcome", "/message-tests"]
const gated = (path: string) => GATED.some((g) => path === g || path.startsWith(`${g}/`))

export async function proxy(req: NextRequest) {
  const session = req.cookies.get("pax2_session")?.value
  const refresh = req.cookies.get("pax2_refresh")?.value

  const moved = alias(req.nextUrl.pathname, req.nextUrl.searchParams)
  const dest = moved ?? `${req.nextUrl.pathname}${req.nextUrl.search}`
  // Local development signs everyone in as admin, so it never gates.
  if (!session && !refresh && process.env.NODE_ENV !== "development" && gated(dest.split("?")[0]))
    return NextResponse.redirect(new URL(`/signin?next=${encodeURIComponent(dest)}`, req.url))
  if (moved) return NextResponse.redirect(new URL(moved, req.url))

  if (!refresh || !CLIENT || (session && !expiresSoon(session))) return NextResponse.next()

  const r = await fetch(`https://cognito-idp.${REGION}.amazonaws.com/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-amz-json-1.1", "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth" },
    body: JSON.stringify({ AuthFlow: "REFRESH_TOKEN_AUTH", ClientId: CLIENT, AuthParameters: { REFRESH_TOKEN: refresh } }),
  }).catch(() => null)
  const t = r?.ok ? ((await r.json()) as { AuthenticationResult?: { IdToken?: string; ExpiresIn?: number } }).AuthenticationResult : undefined
  if (!t?.IdToken) {
    // The refresh token is no good (revoked, or past 30 days): sign the reader out cleanly.
    const res = NextResponse.next()
    if (r) res.cookies.delete("pax2_refresh")
    return res
  }
  req.cookies.set("pax2_session", t.IdToken)
  const res = NextResponse.next({ request: { headers: req.headers } })
  res.cookies.set("pax2_session", t.IdToken, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: t.ExpiresIn ?? 3600, path: "/" })
  return res
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logos/|api/video/).*)"],
}
