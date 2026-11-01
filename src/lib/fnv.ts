// Its own module so a caller can hash without loading lib/catalog.ts, which reads
// data/generated/features.json from disk as it loads.

/** FNV-1a, enough to key a file and a snapshot deterministically. */
export function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}

/** JSON with every object's keys sorted, so equal values hash equal whatever order their keys were written in. */
export function canonicalJson(v: unknown): string {
  return JSON.stringify(v, (_, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x))
}
