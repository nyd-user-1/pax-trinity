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

export function describe(el: Element): string {
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

/** `<nearest landmark name> › <tag or role> "<text>"` */
export function breadcrumb(el: Element): string {
  const lm = el.parentElement?.closest(LANDMARKS);
  const tail = describe(el);
  return lm ? `${landmarkName(lm)} › ${tail}` : tail;
}

/** `tag#id.class1.class2.class3` for display. */
export function shortSel(el: Element, maxClasses = 3): string {
  let s = el.localName;
  if (el.id) s += `#${el.id}`;
  const classes = Array.from(el.classList).slice(0, maxClasses);
  for (const c of classes) s += `.${c}`;
  return s;
}
