// sonar overlay, copied from ~/Code/sonar (extension/src/overlay, milestone 3) as PAX's own
// comment tool (Brendan, 2026-10-30): pointed comments go to Housekeeping rather than a Claude
// session. Dependency-free and host-agnostic. Changes from sonar: a comment goes out with its
// fields apart (the comment, page, element, selector) beside the bundle, and with any screenshots
// pasted into the comment box. Single entry: mount({ send, sessions }).

import { adopt, h, isEditable, outsideBy } from "./dom";
import { Box } from "./box";
import { Cursor } from "./cursor";
import { breadcrumb, shortSel } from "./describe";
import { locatorBundle, uniquePath } from "./locator";
import { describe } from "./describe";
import { DebugPanel, StatusPill } from "./panels";
import { Pin, type PinState } from "./pin";
import { Popover } from "./popover";
import { HOST_CSS, OVERLAY_CSS, PAGE_CSS } from "./styles";
import { boxParent, FRAME_TAGS, hitTest, isRoot, pick, type Pick } from "./targeting";

export interface Session {
  id: string;
  cwd?: string;
  startedAt?: number;
  source?: "sonar" | "hq";
}

export interface OutgoingComment {
  session: string;
  /** The locator bundle, comment included. */
  content: string;
  /** The comment alone. */
  comment: string;
  /** The page's full address and its route. */
  page: string;
  route: string;
  /** The element as a person reads it, and a CSS path that finds it again. */
  target: string;
  path: string;
  /** Screenshots pasted into the comment box, as data URLs. */
  images?: { mime: string; data: string }[];
}

export interface MountOptions {
  /** Delivers a comment to a live session (extension → hub). Wired in milestone 4. */
  send?: (comment: OutgoingComment) => Promise<unknown>;
  /** Lists live sessions for the selector. Wired in milestone 4. */
  sessions?: () => Promise<Session[]>;
  /** Clipboard override for hosts that have their own. */
  copy?: (text: string) => Promise<boolean>;
  /** Initial shown on the pin avatar (default "B"). */
  initial?: string;
  /** The commenter's headshot, shown on the pin in place of the initial. */
  photo?: string;
  /** Show the debug panel (breadcrumb + promotion chain). */
  debug?: boolean;
  /** Called after the overlay removes itself (Esc). */
  onExit?: () => void;
  document?: Document;
}

export interface Switch {
  t: number;
  target: string | null;
}

type Box4 = { top: number; left: number; width: number; height: number };

export interface Inspection {
  target: string | null;
  crumb: string;
  mode: "magnetic" | "precise" | "manual";
  chain: [string, string][];
  pending: string | null;
  switches: Switch[];
  box: Box4 & { opacity: number; visible: boolean; locked: boolean };
  targetRect: Box4 | null;
  locked: boolean;
  pin: { x: number; y: number; rect: Box4 } | null;
  pins: { target: string; state: PinState; comment: string; x: number; y: number }[];
  popover: { mode: "compose" | "view"; crumb: string; text: string; focused: boolean; rect: Box4; primary: string; controls: Record<string, Box4> } | null;
  lastCopy: string | null;
}

export interface Frame {
  t: number;
  top: number;
  left: number;
  width: number;
  height: number;
  opacity: number;
}

export interface Sonar {
  unmount(): void;
  inspect(): Inspection;
  /** Start (true) or stop (false) recording the rendered box geometry every frame. */
  trace(on: boolean): Frame[];
}

interface PinRecord {
  pin: Pin;
  comment: string;
}

// Hysteresis (spec §2.1.3)
const LEAVE_PX = 4; // leaving the current target's rect by more than this releases it…
const DWELL_MS = 40; // …otherwise a different target must hold this long
const MANUAL_RELEASE_PX = 24; // ↑/↓ choice holds until the pointer travels this far

const SWALLOW = ["pointerup", "mousedown", "mouseup", "click", "dblclick", "auxclick"] as const;
// Events from the overlay's own inputs that must not reach page handlers (a page's
// "/" shortcut, paste handler, or focus trap would otherwise see them).
const CONTAIN = ["keydown", "keyup", "keypress", "input", "beforeinput", "paste", "copy", "cut", "focusin", "focusout"] as const;

const rect4 = (r: DOMRect): Box4 => ({ top: r.top, left: r.left, width: r.width, height: r.height });

export function mount(opts: MountOptions = {}): Sonar {
  const doc = opts.document ?? document;
  const win = doc.defaultView ?? window;
  const initial = opts.initial || "B";

  const host = doc.createElement("sonar-root");
  host.style.cssText = HOST_CSS;
  const root = host.attachShadow({ mode: "closed" });
  const dropOverlayCss = adopt(root, OVERLAY_CSS);
  const dropPageCss = adopt(doc, PAGE_CSS);

  const box = new Box(doc, root);
  const cursor = new Cursor(doc, root);
  const debug = new DebugPanel(doc, root, opts.debug ?? true);
  const pill = new StatusPill(doc, root);
  const popover = new Popover(doc, root, {
    submit: () => void submit(),
    copy: () => void copyPrompt(),
    remove: () => removeViewed(),
  });
  doc.documentElement.appendChild(host);

  let px = 0;
  let py = 0;
  let alt = false;
  let hasPointer = false;
  let overUi = false;
  let overFrame = false;
  let dirty = false;

  let current: Element | null = null;
  let currentPick: Pick | null = null;
  let crumb = "";
  let pending: { pick: Pick; since: number; samples: number } | null = null;
  let manual: { x: number; y: number } | null = null;
  const switches: Switch[] = [];
  let tracing: Frame[] | null = null;
  let raf = 0;

  let draft: Pin | null = null; // the locked target's pin, popover open
  const pins: PinRecord[] = [];
  let viewing: PinRecord | null = null;
  let lastCopy: string | null = null;

  // --- hover targeting ---

  function commit(p: Pick, now: number): void {
    current = p.target;
    currentPick = p;
    pending = null;
    switches.push({ t: Math.round(now), target: current ? shortSel(current) : null });
    if (switches.length > 500) switches.shift();
    if (!current) {
      crumb = "";
      box.hide();
      return;
    }
    crumb = breadcrumb(current);
    box.to(current.getBoundingClientRect(), { x: px, y: py }, now);
    box.setLabel(crumb);
  }

  function evaluate(now: number, force = false): void {
    if (!hasPointer || draft) return;
    if (manual) {
      if (!force && current?.isConnected && Math.hypot(px - manual.x, py - manual.y) <= MANUAL_RELEASE_PX) return;
      manual = null;
      force = true;
    }

    const raw = hitTest(doc, px, py, host);
    overFrame = !!raw && FRAME_TAGS.has(raw.localName);
    const p = pick(raw, alt);
    const cand = p.target;

    if (cand === current) {
      pending = null;
      currentPick = p;
      return;
    }
    if (force) return commit(p, now);

    // Leaving the current target outright (and not just into its own container,
    // e.g. the gap between two rows) switches on the next agreeing frame. Anything
    // else — moving into a child, onto a border, into a gap — must dwell 40ms.
    const r = current?.getBoundingClientRect();
    const left = !r || outsideBy(r, px, py) > LEAVE_PX;
    const intoAncestor = !cand || (!!current && cand.contains(current));
    const fast = left && !intoAncestor;

    if (!pending || pending.pick.target !== cand) {
      pending = { pick: p, since: now, samples: 1 };
      return;
    }
    pending.pick = p;
    pending.samples++;
    if (fast ? pending.samples >= 2 : now - pending.since >= DWELL_MS) commit(p, now);
  }

  /** ↑ parent / ↓ child under the pointer (or the pin, when locked). */
  function walk(dir: "up" | "down"): void {
    if (!current) return;
    const ref = draft ? draft.point() : { x: px, y: py };
    let next: Element | null = null;
    if (dir === "up") {
      next = boxParent(current);
      if (!next || isRoot(next)) return;
    } else {
      const kids = Array.from(current.children).filter((c) => {
        const r = c.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      next =
        kids.find((c) => {
          const r = c.getBoundingClientRect();
          return ref.x >= r.left && ref.x <= r.right && ref.y >= r.top && ref.y <= r.bottom;
        }) ??
        kids[0] ??
        null;
      if (!next) return;
    }
    const chain = [...(currentPick?.chain ?? []), { el: next, verdict: dir === "up" ? "✓ ↑ parent" : "✓ ↓ child" }];
    if (!draft) manual = { x: px, y: py };
    commit({ raw: currentPick?.raw ?? null, target: next, chain }, performance.now());
    if (draft) {
      draft.anchor(next, ref.x, ref.y);
      popover.setCrumb(crumb);
    }
  }

  // --- lock, pin, popover (spec §2.3–2.4) ---

  function lock(): void {
    if (!current) return;
    manual = null;
    pending = null;
    const pin = new Pin(doc, root, initial, current, px, py, opts.photo);
    pin.el.addEventListener("click", () => popover.textarea.focus({ preventScroll: true }));
    draft = pin;
    box.lock(true);
    popover.open({ mode: "compose", crumb });
    popover.place(pin.point());
    opts.sessions?.().then(
      (list) => draft === pin && popover.setSessions(list),
      () => {},
    );
  }

  function unlock(): void {
    draft?.remove();
    draft = null;
    box.lock(false);
    popover.close();
    dirty = true;
  }

  // PAX (2026-10-30): one destination, so a comment always sends, and the box stays open until
  // Housekeeping has it. A failed send says so under the box; a sent pin ticks, then gives way to
  // the page's own marker (components/housekeeping/tool.tsx), which stays while the comment is open.
  let busy = false;
  async function submit(): Promise<void> {
    const pin = draft;
    if (!pin || busy) return;
    const comment = popover.value.trim();
    const images = popover.images;
    if (!comment && !images.length) return popover.nudge();
    if (!opts.send) {
      if (await copyText(locatorBundle({ target: pin.target, comment }))) popover.flashCopied();
      return;
    }
    busy = true;
    const loc = win.location;
    const ok = await opts
      .send({
        session: "housekeeping",
        content: locatorBundle({ target: pin.target, comment }),
        comment,
        page: loc.href,
        route: loc.pathname,
        target: describe(pin.target),
        path: uniquePath(pin.target),
        images,
      })
      .then(
        (r) => r !== false,
        () => false,
      );
    busy = false;
    if (draft !== pin) return;
    if (!ok) return popover.fail("That did not send. Try again.");
    pin.setState("sent");
    const record: PinRecord = { pin, comment };
    pin.el.addEventListener("click", () => view(record));
    pins.push(record);
    draft = null;
    box.lock(false);
    popover.close();
    dirty = true;
    win.setTimeout(() => {
      if (viewing === record) closeView();
      pin.remove();
      const i = pins.indexOf(record);
      if (i >= 0) pins.splice(i, 1);
    }, 1600);
  }

  async function copyPrompt(): Promise<void> {
    const target = viewing?.pin.target ?? draft?.target;
    if (!target) return;
    const comment = viewing ? viewing.comment : popover.value;
    if (await copyText(locatorBundle({ target, comment }))) popover.flashCopied();
  }

  function view(record: PinRecord): void {
    if (draft) {
      if (popover.value.trim()) return popover.nudge();
      unlock();
    }
    viewing = record;
    popover.open({ mode: "view", crumb: breadcrumb(record.pin.target), text: record.comment });
  }

  function closeView(): void {
    viewing = null;
    popover.close();
  }

  function removeViewed(): void {
    if (!viewing) return;
    viewing.pin.remove();
    pins.splice(pins.indexOf(viewing), 1);
    closeView();
  }

  async function copyText(text: string): Promise<boolean> {
    lastCopy = text;
    if (opts.copy) return opts.copy(text);
    try {
      await win.navigator.clipboard.writeText(text);
      return true;
    } catch {
      // No clipboard permission or not focused: fall back to a selection copy.
      const scratch = h(doc, "textarea");
      scratch.value = text;
      scratch.style.position = "fixed";
      scratch.style.opacity = "0";
      root.appendChild(scratch);
      scratch.select();
      let ok = false;
      try {
        ok = doc.execCommand("copy");
      } catch {
        /* unsupported */
      }
      scratch.remove();
      if (draft) popover.textarea.focus({ preventScroll: true });
      return ok;
    }
  }

  // --- frame loop ---

  function frame(now: number): void {
    raf = win.requestAnimationFrame(frame);
    if (draft) {
      if (!draft.target.isConnected) unlock();
      else {
        box.track(draft.target.getBoundingClientRect(), now);
        draft.place();
        popover.place(draft.point());
      }
    } else {
      if (current && !current.isConnected) evaluate(now, true);
      else if (dirty || pending) evaluate(now);
      dirty = false;
      if (current) box.track(current.getBoundingClientRect(), now);
    }
    for (const r of pins) r.pin.place();
    if (viewing) popover.place(viewing.pin.point());

    cursor.show(hasPointer && !overUi && !overFrame);
    cursor.frame();
    if (hasPointer) {
      debug.dodge(px, py);
      pill.dodge(px, py);
    }
    debug.render({
      crumb,
      chain: currentPick?.chain ?? [],
      rect: current?.getBoundingClientRect() ?? null,
      pending: pending ? { el: pending.pick.target, age: now - pending.since } : null,
    });
    if (tracing) {
      const b = box.el.getBoundingClientRect();
      tracing.push({ t: Math.round(now), top: b.top, left: b.left, width: b.width, height: b.height, opacity: Number(win.getComputedStyle(box.el).opacity) });
    }
  }

  // --- events ---

  const fromOverlay = (e: Event) => e.composedPath().includes(host);

  const onPointerMove = (e: PointerEvent) => {
    px = e.clientX;
    py = e.clientY;
    hasPointer = true;
    overUi = fromOverlay(e);
    cursor.move(px, py);
    if (e.altKey !== alt) {
      alt = e.altKey;
      manual = null;
      evaluate(performance.now(), true);
    }
    dirty = true;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (fromOverlay(e)) return;
    stop(e);
    if (e.button !== 0) return;
    if (viewing) return closeView();
    if (draft) return popover.value.trim() ? popover.nudge() : unlock();
    px = e.clientX;
    py = e.clientY;
    lock();
  };

  const onMouseOut = (e: MouseEvent) => {
    if (e.relatedTarget) return;
    hasPointer = false;
    pending = null;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      stop(e);
      if (draft) unlock();
      else if (viewing) closeView();
      else exit();
      return;
    }
    if (fromOverlay(e)) {
      // In the comment box, ↑/↓ walk the locked target only while it's empty.
      if (draft && !popover.value && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        stop(e);
        walk(e.key === "ArrowUp" ? "up" : "down");
      }
      return;
    }
    if (e.key === "Alt") {
      stop(e);
      if (!alt) {
        alt = true;
        manual = null;
        evaluate(performance.now(), true);
      }
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      stop(e);
      walk(e.key === "ArrowUp" ? "up" : "down");
    } else if ((e.key === "d" || e.key === "D") && !e.metaKey && !e.ctrlKey && !e.altKey && !isEditable(doc.activeElement)) {
      stop(e);
      debug.toggle();
    }
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key !== "Alt" || fromOverlay(e)) return;
    stop(e);
    alt = false;
    evaluate(performance.now(), true);
  };

  const onBlur = () => {
    if (!alt) return;
    alt = false;
    evaluate(performance.now(), true);
  };

  const onLayout = () => {
    dirty = true;
  };

  // While sonar is active, a click must not activate the page (follow a link,
  // submit a form, steal focus). Events from the overlay's own UI pass through.
  const swallow = (e: Event) => {
    if (fromOverlay(e)) return;
    stop(e);
    if (draft && (e.type === "mouseup" || e.type === "click")) popover.textarea.focus({ preventScroll: true });
  };

  const contain = (e: Event) => e.stopPropagation();

  function stop(e: Event): void {
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  // pointerover matters for frames: once the pointer is inside an iframe the page
  // gets no more pointermoves, only the pointerover on the <iframe> element.
  win.addEventListener("pointermove", onPointerMove, { capture: true, passive: true });
  win.addEventListener("pointerover", onPointerMove, { capture: true, passive: true });
  win.addEventListener("pointerdown", onPointerDown, true);
  doc.addEventListener("mouseout", onMouseOut, true);
  win.addEventListener("keydown", onKeyDown, true);
  win.addEventListener("keyup", onKeyUp, true);
  win.addEventListener("blur", onBlur);
  win.addEventListener("scroll", onLayout, { capture: true, passive: true });
  win.addEventListener("resize", onLayout, { passive: true });
  for (const type of SWALLOW) win.addEventListener(type, swallow, true);
  for (const type of CONTAIN) root.addEventListener(type, contain);
  raf = win.requestAnimationFrame(frame);

  let mounted = true;
  function unmount(): void {
    if (!mounted) return;
    mounted = false;
    popover.close();
    win.cancelAnimationFrame(raf);
    win.removeEventListener("pointermove", onPointerMove, true);
    win.removeEventListener("pointerover", onPointerMove, true);
    win.removeEventListener("pointerdown", onPointerDown, true);
    doc.removeEventListener("mouseout", onMouseOut, true);
    win.removeEventListener("keydown", onKeyDown, true);
    win.removeEventListener("keyup", onKeyUp, true);
    win.removeEventListener("blur", onBlur);
    win.removeEventListener("scroll", onLayout, true);
    win.removeEventListener("resize", onLayout);
    for (const type of SWALLOW) win.removeEventListener(type, swallow, true);
    dropPageCss();
    dropOverlayCss();
    host.remove();
  }

  function exit(): void {
    unmount();
    opts.onExit?.();
  }

  return {
    unmount,
    trace(on) {
      const out = tracing ?? [];
      tracing = on ? [] : null;
      return out;
    },
    inspect() {
      const b = box.el.getBoundingClientRect();
      const t = current?.getBoundingClientRect();
      return {
        target: current ? shortSel(current) : null,
        crumb,
        mode: manual ? "manual" : alt ? "precise" : "magnetic",
        chain: (currentPick?.chain ?? []).map((s) => [shortSel(s.el), s.verdict]),
        pending: pending ? (pending.pick.target ? shortSel(pending.pick.target) : "none") : null,
        switches: switches.slice(),
        box: { ...rect4(b), opacity: Number(win.getComputedStyle(box.el).opacity), visible: box.visible, locked: box.locked },
        targetRect: t ? rect4(t) : null,
        locked: !!draft,
        pin: draft ? { ...draft.point(), rect: rect4(draft.el.getBoundingClientRect()) } : null,
        pins: pins.map((r) => ({ target: shortSel(r.pin.target), state: r.pin.state, comment: r.comment, ...r.pin.point() })),
        popover: popover.isOpen
          ? {
              mode: popover.mode,
              crumb: viewing ? breadcrumb(viewing.pin.target) : crumb,
              text: viewing ? viewing.comment : popover.value,
              focused: root.activeElement === popover.textarea,
              rect: rect4(popover.rect()),
              primary: popover.primaryText,
              controls: Object.fromEntries(Object.entries(popover.controls()).map(([k, r]) => [k, rect4(r)])),
            }
          : null,
        lastCopy,
      };
    },
  };
}
