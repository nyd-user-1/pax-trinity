// Human-facing names for elements: the breadcrumb on the label chip (spec §2.5)
// and the short selectors used in the debug panel.

const LANDMARKS = [
  "header", "nav", "main", "section", "article", "aside", "footer", "form", "dialog",
  "[role=banner]", "[role=navigation]", "[role=main]", "[role=region]", "[role=complementary]",
  "[role=contentinfo]", "[role=search]", "[role=dialog]", "[role=form]",
].join(",");

export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** Visible text of an element, as a human would name it. */
export function visibleText(el: Element, max: number): string {
  const aria = el.getAttribute("aria-label");
  const tag = el.localName;
  let text = "";
  if (tag === "input" || tag === "textarea") {
    const input = el as HTMLInputElement;
    const isButton = ["button", "submit", "reset"].includes(input.type);
    text = aria || (isButton ? input.value : "") || input.placeholder || "";
  } else if (tag === "select") {
    const select = el as HTMLSelectElement;
    text = aria || select.selectedOptions[0]?.textContent || "";
  } else if (tag === "img") {
    text = aria || (el as HTMLImageElement).alt || "";
  } else {
    text = aria || (el instanceof HTMLElement ? el.innerText : el.textContent) || "";
  }
  return clip(text, max);
}

// How an element's kind reads to a person (PAX, 2026-10-30): "link", not "a".
const KIND: Record<string, string> = {
  a: "link", button: "button", img: "image", svg: "icon", input: "field", textarea: "field", select: "menu",
  h1: "heading", h2: "heading", h3: "heading", h4: "heading", h5: "heading", h6: "heading",
  p: "text", li: "item", ul: "list", ol: "list", table: "table", tr: "row", td: "cell", th: "cell",
  label: "label", nav: "navigation", header: "header", footer: "footer", form: "form", video: "video",
};

/**
 * The element's own name: its aria-label, else its heading when it holds just one (a card), else its
 * text. A container of several headings has no name of its own: it reads as its kind ("main"), not
 * as its first heading.
 */
function ownName(el: Element, max: number): string {
  const aria = el.getAttribute("aria-label");
  if (aria?.trim()) return clip(aria, max);
  if (!/^h[1-6]$/.test(el.localName)) {
    const headings = el.querySelectorAll("h1, h2, h3, h4, h5, h6");
    if (headings.length > 1) return "";
    const heading = headings[0];
    const text = heading instanceof HTMLElement ? heading.innerText : heading?.textContent;
    if (text?.trim()) return clip(text, max);
  }
  return visibleText(el, max);
}

/** `link "Chat"`: what the element is and what it is called. */
export function describe(el: Element): string {
  const kind = el.getAttribute("role") || KIND[el.localName] || "";
  const text = ownName(el, 32);
  if (!text) return kind || el.localName;
  return kind ? `${kind} "${text}"` : `"${text}"`;
}

/** sonar's own wording, which the first Housekeeping comments were saved under. */
export function legacyDescribe(el: Element): string {
  const kind = el.getAttribute("role") || el.localName;
  const text = visibleText(el, 24);
  return text ? `${kind} "${text}"` : kind;
}

function landmarkName(lm: Element): string {
  const aria = lm.getAttribute("aria-label");
  if (aria?.trim()) return clip(aria, 24);
  const labelledBy = lm.getAttribute("aria-labelledby");
  if (labelledBy) {
    const doc = lm.ownerDocument;
    const text = labelledBy
      .split(/\s+/)
      .map((id) => doc.getElementById(id)?.textContent ?? "")
      .join(" ");
    if (text.trim()) return clip(text, 24);
  }
  const heading = lm.querySelector("h1, h2, h3");
  const headingText = heading?.textContent?.trim();
  if (headingText) return clip(headingText, 24);
  return lm.getAttribute("role") || lm.localName;
}

/**
 * The element itself, after its landmark only when the landmark is named outright (an aria-label or
 * aria-labelledby). A landmark's first heading named the wrong thing: on Home, `main`'s first heading is
 * the America Thinks card, so every element there read "America Thinks › …" (Brendan, 2026-10-30).
 */
export function breadcrumb(el: Element): string {
  const lm = el.parentElement?.closest(LANDMARKS);
  const tail = describe(el);
  const named = lm && (lm.getAttribute("aria-label")?.trim() || lm.getAttribute("aria-labelledby"));
  return named ? `${landmarkName(lm)} › ${tail}` : tail;
}

/** `tag#id.class1.class2.class3` for display. */
export function shortSel(el: Element, maxClasses = 3): string {
  let s = el.localName;
  if (el.id) s += `#${el.id}`;
  const classes = Array.from(el.classList).slice(0, maxClasses);
  for (const c of classes) s += `.${c}`;
  return s;
}
