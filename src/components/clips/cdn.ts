// The clips' CloudFront host alone, so a client surface that only checks a URL against it (app/agents/transcript.tsx)
// doesn't carry the whole catalog. catalog.ts re-exports it.

// NEXT_PUBLIC_CLIPS_CDN names the distribution per deploy (inlined at build); the default is the new account's, over pax-trinity-clips-613473203863.
export const CLIPS_CDN = process.env.NEXT_PUBLIC_CLIPS_CDN ?? "https://d19bx9wfmnrb34.cloudfront.net"
