// The desks clips are filed under. A module of its own, without "use client",
// so the server can file a clip under a desk with the same list the rail shows.

export type Creator = { id: string; name: string; handle: string; image?: string | null; state?: string; kind: "desk" | "user" }

// The partners (src/lib/roles.ts). Voter Freedom and Unite America hold no
// clips yet; their avatars follow once their channel art is pulled.
export const CREATORS: Creator[] = [
  { id: "parallax", name: "PAX", handle: "pax", image: "/pax-avatar.svg", kind: "desk" },
  { id: "voter-freedom", name: "Voter Freedom", handle: "voterfreedom", kind: "desk" },
  { id: "unite-america", name: "Unite America", handle: "uniteamerica", kind: "desk" },
  { id: "yeson3", name: "Yes on 3", handle: "yeson3ma", kind: "desk" },
]

export const creatorOf = (id: string) => CREATORS.find((c) => c.id === id)
