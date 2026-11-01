// The inspector's answer for sonar's label (Brendan, 2026-11-01): the component that draws the
// element and the file it lives in, read the dock's way — the fiber's owner chain first, then
// /api/dev-locate for the file. The DOM's own answer (tag · size · layout · "name") moves into
// the comment box as live context; this is the element's durable name.

type Fiber = { return: Fiber | null; type: unknown; elementType: unknown; _debugOwner?: Fiber | null };

const FRAMEWORK = /^(LinkComponent|Link|Image|Head|Script|Suspense|Fragment|Router|.*Provider|.*Boundary)$/;
const PROD = process.env.NODE_ENV !== "development";

function fiberOf(node: Element): Fiber | null {
  for (const key in node) {
    if (key.startsWith("__reactFiber$")) return (node as unknown as Record<string, Fiber>)[key];
  }
  return null;
}

function nameOf(f: Fiber | null | undefined): string | null {
  const t = (f?.type ?? f?.elementType) as { displayName?: string; name?: string } | string | null | undefined;
  if (!t || typeof t === "string") return null;
  const name = t.displayName ?? t.name ?? null;
  return PROD && name && name.length < 3 ? null : name;
}

function ownerChain(fiber: Fiber | null, max = 8): string[] {
  const out: string[] = [];
  let f: Fiber | null | undefined = fiber;
  while (f && out.length < max) {
    const n = nameOf(f);
    if (n && !out.includes(n)) out.push(n);
    f = f._debugOwner ?? f.return;
  }
  return out;
}

const cache = new Map<string, Promise<string | null>>();

/** The file behind a component chain, via the dev server's /api/dev-locate; null where it can't say. */
function fileFor(chain: string[], className: string): Promise<string | null> {
  const k = `${chain.join(",")}|${className}`;
  const kept = cache.get(k);
  if (kept) return kept;
  const p = (async () => {
    try {
      const qs = new URLSearchParams();
      if (chain.length) qs.set("chain", chain.join(","));
      if (className) qs.set("class", className);
      const r = await fetch(`/api/dev-locate?${qs}`);
      if (!r.ok) return null;
      const j = (await r.json()) as { file?: string; line?: number };
      return j.file ? (j.line ? `${j.file}:${j.line}` : j.file) : null;
    } catch {
      return null;
    }
  })();
  cache.set(k, p);
  return p;
}

export type SourceLabel = { name: string | null; file: Promise<string | null> };

/** The element's component name now, and its file when the dev server answers. */
export function sourceLabel(el: Element): SourceLabel {
  const chain = ownerChain(fiberOf(el));
  const own = chain.find((n) => !FRAMEWORK.test(n)) ?? chain[0] ?? null;
  if (!own) return { name: null, file: Promise.resolve(null) };
  return { name: own, file: fileFor(chain, el.getAttribute("class") ?? "") };
}

/** The DOM's live line for the comment box: tag[role] · W×H · layout · "name". */
export function metricsLine(el: Element, name?: string): string {
  const r = el.getBoundingClientRect();
  const role = el.getAttribute("role");
  const display = el.ownerDocument.defaultView?.getComputedStyle(el).display ?? "";
  const quoted = (name ?? "").trim();
  return [
    `${el.localName}${role ? `[${role}]` : ""}`,
    `${Math.round(r.width)}×${Math.round(r.height)}`,
    display,
    quoted ? `"${quoted.length > 40 ? quoted.slice(0, 39) + "…" : quoted}"` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
