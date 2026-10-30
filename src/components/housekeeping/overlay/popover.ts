// The comment popover (spec §2.4): anchored to the right of the pin, flipped left
// when there's no room, below when neither side fits.

import { h } from "./dom";
import type { Session } from "./index";

export interface PopoverActions {
  /** Enter or the primary button; Shift+Enter is a new line. */
  submit(): void;
  /** "Copy as prompt". */
  copy(): void;
  /** Delete a committed pin (view mode). */
  remove(): void;
}

export type PopoverMode = "compose" | "view";

const WIDTH = 320;
const GAP = 8;
const PIN = 28;
const EDGE = 8;

export class Popover {
  readonly el: HTMLDivElement;
  readonly textarea: HTMLTextAreaElement;
  private readonly crumb: HTMLDivElement;
  private readonly chip: HTMLSpanElement;
  private readonly note: HTMLDivElement;
  private readonly compose: HTMLDivElement;
  private readonly sendBox: HTMLInputElement;
  private readonly session: HTMLSelectElement;
  private readonly copyBtn: HTMLButtonElement;
  private readonly primary: HTMLButtonElement;
  private readonly primaryLabel: HTMLSpanElement;
  private readonly shots: HTMLSpanElement;
  private pasted: { mime: string; data: string }[] = [];
  private readonly removeBtn: HTMLButtonElement;
  private readonly win: Window;
  private size = { w: WIDTH, h: 0 };
  mode: PopoverMode = "compose";
  isOpen = false;

  constructor(doc: Document, parent: ShadowRoot, actions: PopoverActions) {
    this.win = doc.defaultView ?? window;
    this.el = h(doc, "div", "popover");
    this.el.hidden = true;

    this.crumb = h(doc, "div", "pc-crumb");
    this.chip = h(doc, "span", "pc-chip", "@Housekeeping");
    this.note = h(doc, "div", "pc-note");
    this.textarea = h(doc, "textarea", "pc-text");
    this.textarea.placeholder = "Leave a comment… (paste a screenshot to attach it)";
    this.textarea.rows = 2;

    // Options row: send toggle, session (PAX: dictation is gone, Brendan 2026-10-30)
    const sendLabel = h(doc, "label", "pc-check");
    this.sendBox = h(doc, "input");
    this.sendBox.type = "checkbox";
    this.sendBox.checked = true;
    sendLabel.append(this.sendBox, h(doc, "span", "", "Send to Housekeeping"));
    // PAX: one destination, so neither the toggle nor the session menu shows.
    sendLabel.hidden = true;
    this.shots = h(doc, "span", "pc-note");


    this.session = h(doc, "select", "pc-session");
    const options = h(doc, "div", "pc-row");
    options.append(sendLabel, this.session, this.shots);

    // Actions row
    this.copyBtn = h(doc, "button", "pc-link", "Copy as prompt");
    this.copyBtn.type = "button";
    this.removeBtn = h(doc, "button", "pc-link", "Delete");
    this.removeBtn.type = "button";
    this.primary = h(doc, "button", "pc-primary");
    this.primary.type = "button";
    this.primaryLabel = h(doc, "span", "", "Send");
    this.primary.append(this.primaryLabel, h(doc, "kbd", "", "↵"));
    const actionsRow = h(doc, "div", "pc-row pc-actions");
    actionsRow.append(this.copyBtn, this.removeBtn, h(doc, "span", "pc-grow"), this.primary);

    this.compose = h(doc, "div", "pc-compose");
    this.compose.append(this.chip, this.textarea, options);
    this.el.append(this.crumb, this.note, this.compose, actionsRow);
    parent.appendChild(this.el);

    this.textarea.addEventListener("input", () => this.autosize());
    // Screenshots pasted into the box ride along with the comment.
    this.textarea.addEventListener("paste", (e) => {
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith("image/"));
      if (!files.length) return;
      e.preventDefault();
      for (const f of files.slice(0, 4 - this.pasted.length)) {
        const reader = new FileReader();
        reader.onload = () => {
          this.pasted.push({ mime: f.type, data: String(reader.result) });
          this.shots.textContent = `${this.pasted.length} screenshot${this.pasted.length === 1 ? "" : "s"} attached`;
          this.measure();
        };
        reader.readAsDataURL(f);
      }
    });
    this.textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        actions.submit();
      }
    });
    this.sendBox.addEventListener("change", () => this.refresh());
    this.session.addEventListener("change", () => this.refresh());
    this.primary.addEventListener("click", () => actions.submit());
    this.copyBtn.addEventListener("click", () => actions.copy());
    this.removeBtn.addEventListener("click", () => actions.remove());
  }

  get value(): string {
    return this.textarea.value;
  }

  /** The screenshots pasted since the box opened. */
  get images(): { mime: string; data: string }[] {
    return [...this.pasted];
  }

  get sendToClaude(): boolean {
    return this.sendBox.checked;
  }

  get sessionId(): string | null {
    return this.session.disabled ? null : this.session.value || null;
  }

  open(o: { mode: PopoverMode; crumb: string; sessions?: Session[]; text?: string }): void {
    this.mode = o.mode;
    this.isOpen = true;
    this.el.hidden = false;
    this.el.classList.toggle("viewing", o.mode === "view");
    this.crumb.textContent = o.crumb;
    this.note.textContent = o.mode === "view" ? o.text ?? "" : "";
    this.textarea.value = o.mode === "compose" ? o.text ?? "" : "";
    this.pasted = [];
    this.shots.textContent = "";
    this.shots.style.color = "";
    this.setSessions(o.sessions ?? []);
    this.refresh();
    this.autosize();
    this.el.animate([{ opacity: 0, translate: "0 4px" }, { opacity: 1, translate: "0 0" }], { duration: 120, easing: "cubic-bezier(.2,.8,.2,1)" });
    if (o.mode === "compose") this.textarea.focus({ preventScroll: true });
  }

  close(): void {
    this.isOpen = false;
    this.el.hidden = true;
  }

  setCrumb(text: string): void {
    this.crumb.textContent = text;
  }

  /** Brief nudge when a click can't unlock because there's a draft. */
  nudge(): void {
    this.el.animate([{ translate: "0 0" }, { translate: "-4px 0" }, { translate: "4px 0" }, { translate: "0 0" }], { duration: 180 });
    this.textarea.focus({ preventScroll: true });
  }

  /** Says a send failed, under the box. */
  fail(text: string): void {
    this.shots.textContent = text;
    this.shots.style.color = "#f87171";
    this.measure();
  }

  flashCopied(): void {
    const label = this.copyBtn.textContent;
    this.copyBtn.textContent = "Copied";
    setTimeout(() => (this.copyBtn.textContent = label), 1200);
  }

  /** Position next to the pin whose tip is at `p`. */
  place(p: { x: number; y: number }): void {
    if (!this.isOpen) return;
    const doc = this.el.ownerDocument;
    const vw = doc.documentElement.clientWidth;
    const vh = this.win.innerHeight;
    const { w, h: ht } = this.size;
    let left = p.x + PIN + GAP;
    let top = p.y - PIN;
    if (left + w > vw - EDGE) left = p.x - GAP - w;
    if (left < EDGE) {
      left = Math.min(Math.max(p.x - w / 2, EDGE), vw - w - EDGE);
      top = p.y + GAP;
    }
    top = Math.min(Math.max(top, EDGE), Math.max(EDGE, vh - ht - EDGE));
    this.el.style.left = `${Math.round(left)}px`;
    this.el.style.top = `${Math.round(top)}px`;
  }

  rect(): DOMRect {
    return this.el.getBoundingClientRect();
  }

  /** Visible buttons, for drivers that can't reach into the closed shadow root. */
  controls(): Record<string, DOMRect> {
    const out: Record<string, DOMRect> = {};
    const all = { copy: this.copyBtn, primary: this.primary, remove: this.removeBtn, send: this.sendBox };
    for (const [name, el] of Object.entries(all)) if (!el.hidden && el.getClientRects().length) out[name] = el.getBoundingClientRect();
    return out;
  }

  get primaryText(): string {
    return this.primaryLabel.textContent ?? "";
  }

  // --- internals ---

  setSessions(sessions: Session[]): void {
    const doc = this.el.ownerDocument;
    const sorted = [...sessions].sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
    this.session.replaceChildren(
      ...(sorted.length
        ? sorted.map((s) => {
            const o = h(doc, "option", "", `${s.id.slice(0, 8)}${s.cwd ? ` · ${s.cwd.split("/").filter(Boolean).pop()}` : ""}`);
            o.value = s.id;
            return o;
          })
        : [h(doc, "option", "", "No session")]),
    );
    this.session.disabled = sorted.length === 0;
    this.refresh();
  }

  // The primary action follows what's possible: send to a live session, copy the
  // prompt when there's none, or keep the pin as a note when Send is off. The
  // separate "Copy as prompt" link shows only when the primary isn't already that.
  private refresh(): void {
    const send = this.sendBox.checked;
    const canSend = send && !!this.sessionId;
    this.chip.hidden = !send;
    this.session.hidden = true;
    this.primaryLabel.textContent = !send ? "Save" : canSend ? "Send" : "Copy as prompt";
    this.copyBtn.hidden = this.mode === "compose" && send && !canSend;
    this.removeBtn.hidden = this.mode !== "view";
    this.primary.hidden = this.mode === "view";
    this.measure();
  }

  private autosize(): void {
    const t = this.textarea;
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
    this.measure();
  }

  private measure(): void {
    if (this.el.hidden) return;
    this.size = { w: this.el.offsetWidth || WIDTH, h: this.el.offsetHeight };
  }

}
