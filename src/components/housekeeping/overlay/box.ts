// The blue box (spec §2.2). It tweens top/left/width/height between targets
// (never transform: scale, which blurs the 2px border), snaps when the same target
// merely moves (scroll, resize, layout), and unfolds from the pointer on first show.

import { h, sameRect, snapRect, type Rect } from "./dom";

const TWEEN_MS = 120;
const CHIP_GAP = 4;
const EDGE = 4;

export class Box {
  readonly el: HTMLDivElement;
  private readonly chip: HTMLDivElement;
  private shown = false;
  private rect: Rect | null = null;
  private tweenUntil = 0;
  private chipWidth = 0;
  private chipHeight = 0;

  constructor(doc: Document, parent: ShadowRoot) {
    this.el = h(doc, "div", "box");
    this.chip = h(doc, "div", "chip");
    this.el.appendChild(this.chip);
    parent.appendChild(this.el);
  }

  get visible(): boolean {
    return this.shown;
  }

  /** Move to a new target: tween, or unfold from the pointer if hidden. */
  to(r: DOMRect, from: { x: number; y: number }, now: number): void {
    const next = snapRect(r);
    if (!this.shown) {
      this.el.classList.add("snap");
      this.el.classList.remove("on");
      this.write({ left: Math.round(from.x), top: Math.round(from.y), width: 0, height: 0 });
      void this.el.offsetWidth; // commit the 0×0 start so the next write transitions
      this.el.classList.remove("snap");
      this.el.classList.add("on");
      this.shown = true;
    } else {
      this.el.classList.remove("snap");
    }
    this.write(next);
    this.tweenUntil = now + TWEEN_MS + 20;
  }

  /** Same target, re-measured. Snap to it unless a tween is still in flight. */
  track(r: DOMRect, now: number): void {
    if (!this.shown) return;
    const next = snapRect(r);
    if (sameRect(next, this.rect)) return;
    this.el.classList.toggle("snap", now >= this.tweenUntil);
    this.write(next);
  }

  /** Locked: the box stops following the pointer and fills a little more. */
  lock(on: boolean): void {
    this.el.classList.toggle("locked", on);
  }

  get locked(): boolean {
    return this.el.classList.contains("locked");
  }

  hide(): void {
    if (!this.shown) return;
    this.shown = false;
    this.el.classList.remove("on");
  }

  setLabel(text: string): void {
    if (this.chip.textContent === text) return;
    this.chip.textContent = text;
    this.chipWidth = this.chip.offsetWidth;
    this.chipHeight = this.chip.offsetHeight;
    this.chip.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 100, easing: "linear" });
    if (this.rect) this.placeChip(this.rect);
  }

  private write(r: Rect): void {
    this.rect = r;
    const s = this.el.style;
    s.top = `${r.top}px`;
    s.left = `${r.left}px`;
    s.width = `${r.width}px`;
    s.height = `${r.height}px`;
    this.placeChip(r);
  }

  // The chip rides the box: it is a child, so it moves with the tween. Only its
  // offset changes, to keep it inside the viewport.
  private placeChip(r: Rect): void {
    const view = this.el.ownerDocument.documentElement.clientWidth;
    this.chip.classList.toggle("inside", r.top < this.chipHeight + CHIP_GAP + EDGE);
    // chip x = box left + 2px border + offset
    let offset = -2;
    if (r.left + offset + 2 < EDGE) offset = EDGE - r.left - 2;
    if (r.left + offset + 2 + this.chipWidth > view - EDGE) offset = Math.max(EDGE - r.left - 2, view - EDGE - this.chipWidth - r.left - 2);
    this.chip.style.left = `${offset}px`;
  }
}
