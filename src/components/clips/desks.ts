// The desks clips are filed under. A module of its own, without "use client",
// so the server can file a clip under a desk with the same list the rail shows.

export type Creator = { id: string; name: string; handle: string; image?: string | null; state?: string; kind: "desk" | "user" }

export const CREATORS: Creator[] = [
  { id: "parallax", name: "PAX", handle: "pax", image: "/pax-avatar.svg", kind: "desk" },
]

export const creatorOf = (id: string) => CREATORS.find((c) => c.id === id)
