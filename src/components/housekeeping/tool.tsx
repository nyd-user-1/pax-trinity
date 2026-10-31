"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { usePathname } from "next/navigation"
import { Crosshair } from "lucide-react"

import { whiteButton } from "@/components/white-button"
import { describe, describeV2, legacyDescribe } from "./overlay/describe"

// Housekeeping's pointer (Brendan, 2026-10-30): sonar's overlay as PAX's own comment tool. The
// header's crosshair starts it (only the crosshair: no shortcut turns it on, as with the inspector's dock): hover outlines and names an element, a click
// locks it, Enter sends the comment (Shift+Enter is a new line), with any pasted screenshots, to
// Housekeeping's stream, and the right panel opens on it. Escape leaves. Every open comment marks
// its element on the page with its author's headshot until it is resolved. Admins and the super
// admin only; the shell renders this for them.

export const HOUSEKEEPING_CHANGED = "housekeeping:changed"
/** Opens the right panel on Housekeeping (the shell and the panel listen). */
export const HOUSEKEEPING_OPEN = "housekeeping:open"
const OUTLINE_KEY = "housekeeping:outline"

type Overlay = typeof import("./overlay")
let running: { unmount: () => void } | null = null
const listeners = new Set<(on: boolean) => void>()
const announce = () => listeners.forEach((l) => l(!!running))

/** The message the panel should bring into view when it next opens or hears HOUSEKEEPING_OPEN. */
let focusNext: string | null = null
export const takeFocus = () => {
  const id = focusNext
  focusNext = null
  return id
}
/** Was the panel asked to open on Housekeeping since it last looked? */
let openPending = false
export const takeOpen = () => {
  const was = openPending
  openPending = false
  return was
}

/** Opens the right panel on Housekeeping, with one message brought into view. */
export function openHousekeeping(id?: string) {
  focusNext = id ?? null
  openPending = true
  window.dispatchEvent(new Event(HOUSEKEEPING_OPEN))
}

/** A screenshot shrunk to at most 1600px on its long side, as JPEG, so a post stays small. */
export async function shrink(img: { mime: string; data: string }): Promise<{ mime: string; data: string }> {
  const el = new Image()
  el.src = img.data
  await el.decode().catch(() => {})
  const scale = Math.min(1, 1600 / Math.max(el.naturalWidth || 1, el.naturalHeight || 1))
  if (scale === 1 && img.data.length < 1_500_000) return img
  const c = document.createElement("canvas")
  c.width = Math.round(el.naturalWidth * scale)
  c.height = Math.round(el.naturalHeight * scale)
  c.getContext("2d")?.drawImage(el, 0, 0, c.width, c.height)
  return { mime: "image/jpeg", data: c.toDataURL("image/jpeg", 0.85) }
}

type Me = { name?: string; photo?: string }
let mine: Promise<Me> | null = null
/** The signed-in admin's name and headshot, for the pins. */
const whoAmI = () =>
  (mine ??= fetch("/api/housekeeping?me=1")
    .then((r) => r.json())
    .then((b: { me?: Me }) => b.me ?? {})
    .catch(() => ({})))

/** Starts the pointer, or stops it if it is running. */
export async function togglePointer() {
  if (running) {
    running.unmount()
    running = null
    announce()
    return
  }
  const [{ mount }, me]: [Overlay, Me] = await Promise.all([import("./overlay"), whoAmI()])
  running = mount({
    initial: (me.name ?? "?").trim().charAt(0).toUpperCase() || "?",
    photo: me.photo,
    // sonar's developer panel stays off; ⌥ precise, ↑↓ walk and Esc still work.
    debug: false,
    sessions: async () => [{ id: "housekeeping" }],
    send: async (c) => {
      const images = await Promise.all((c.images ?? []).map(shrink))
      const res = await fetch("/api/housekeeping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "comment", text: c.comment, page: c.page, route: c.route, target: c.target, path: c.path, bundle: c.content, images }),
      })
      if (!res.ok) return false
      const { message } = (await res.json().catch(() => ({}))) as { message?: { id: string; pk: string; sk: string } }
      window.dispatchEvent(new Event(HOUSEKEEPING_CHANGED))
      if (message) {
        openHousekeeping(message.id)
        // The prompt that would address it is written in the background and stored beside it.
        void fetch("/api/housekeeping/prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pk: message.pk, sk: message.sk }) })
          .then(() => window.dispatchEvent(new Event(HOUSEKEEPING_CHANGED)))
          .catch(() => {})
      }
      return true
    },
    onExit: () => {
      running = null
      announce()
    },
  })
  announce()
}

/**
 * The element a comment was made on: its path, and among several matches (the first comments'
 * paths matched every card in a row) the one whose name is the comment's target.
 */
export function findElement(path: string, target?: string): Element | null {
  let found: Element[] = []
  try {
    found = Array.from(document.querySelectorAll(path))
  } catch {
    found = []
  }
  const named = (el: Element) => !!target && (describe(el) === target || describeV2(el) === target || legacyDescribe(el) === target)
  if (found.length === 1) return found[0]
  if (found.length > 1) return found.find(named) ?? found[0]
  // The path no longer matches (the page changed): look for its last tag with the same name.
  const tag = path.split(">").pop()?.trim().match(/^[a-z][a-z0-9-]*/)?.[0]
  if (!tag || !target) return null
  return Array.from(document.getElementsByTagName(tag)).find(named) ?? null
}

/** Outlines a comment's element for a few seconds, scrolling it into view. */
export function outlineElement(path: string, target?: string) {
  const el = findElement(path, target)
  if (!el) return false
  el.scrollIntoView({ block: "center", behavior: "smooth" })
  const ring = document.createElement("div")
  const place = () => {
    const r = el.getBoundingClientRect()
    Object.assign(ring.style, { position: "fixed", left: `${r.left - 4}px`, top: `${r.top - 4}px`, width: `${r.width + 8}px`, height: `${r.height + 8}px` })
  }
  Object.assign(ring.style, { zIndex: "2147483646", pointerEvents: "none", border: "3px solid #2563eb", borderRadius: "10px", boxShadow: "0 0 0 6px rgb(37 99 235 / 0.18)", transition: "opacity .4s" })
  document.body.appendChild(ring)
  place()
  const t = window.setInterval(place, 50)
  window.setTimeout(() => (ring.style.opacity = "0"), 2600)
  window.setTimeout(() => (window.clearInterval(t), ring.remove()), 3100)
  return true
}

/** Opens a comment's page and outlines its element there (or here, when it is this page). */
export function goToComment(route: string, path: string, target: string | undefined, push: (href: string) => void) {
  if (route === window.location.pathname) return void outlineElement(path, target)
  sessionStorage.setItem(OUTLINE_KEY, JSON.stringify({ path, target }))
  push(route)
}

type Mark = { id: string; path: string; target?: string; author: string; authorName: string; photo?: string; text: string }

/** The header's crosshair, the page's comment markers, and the outline that waits for a page to arrive. */
export function HousekeepingTool() {
  const [on, setOn] = React.useState(false)
  const [marks, setMarks] = React.useState<Mark[]>([])
  const path = usePathname()

  React.useEffect(() => {
    listeners.add(setOn)
    return () => {
      listeners.delete(setOn)
    }
  }, [])

  // The open comments on this page, refreshed when Housekeeping changes and every 30 seconds.
  React.useEffect(() => {
    let live = true
    const load = async () => {
      const r = (await fetch(`/api/housekeeping?route=${encodeURIComponent(path)}`, { cache: "no-store" })
        .then((x) => (x.ok ? x.json() : { marks: [] }))
        .catch(() => ({ marks: [] }))) as { marks?: Mark[] }
      if (live) setMarks(r.marks ?? [])
    }
    void load()
    const t = window.setInterval(load, 30000)
    window.addEventListener(HOUSEKEEPING_CHANGED, load)
    return () => {
      live = false
      window.clearInterval(t)
      window.removeEventListener(HOUSEKEEPING_CHANGED, load)
    }
  }, [path])

  // A comment opened from another page: its element is outlined once this page has drawn it.
  React.useEffect(() => {
    const raw = sessionStorage.getItem(OUTLINE_KEY)
    if (!raw) return
    let pending: { path: string; target?: string }
    try {
      pending = raw.startsWith("{") ? JSON.parse(raw) : { path: raw }
    } catch {
      return void sessionStorage.removeItem(OUTLINE_KEY)
    }
    let tries = 0
    const t = window.setInterval(() => {
      if (outlineElement(pending.path, pending.target) || ++tries > 40) {
        window.clearInterval(t)
        sessionStorage.removeItem(OUTLINE_KEY)
      }
    }, 150)
    return () => window.clearInterval(t)
  }, [path])

  return (
    <>
      <button
        type="button"
        onClick={() => void togglePointer()}
        aria-pressed={on}
        aria-label="Comment on the page"
        title="Comment on the page"
        className={whiteButton("circle", on ? "ring-2 ring-pax2-light-blue" : undefined)}
      >
        <Crosshair className="size-4 text-pax2-blue" />
      </button>
      {marks.length > 0 && <Marks marks={marks} />}
    </>
  )
}

/** One headshot per open comment at its element's top-right corner, pulsing; a press opens it in
 *  the panel. They follow the element through scroll and resize, and hide when it is off the page. */
function Marks({ marks }: { marks: Mark[] }) {
  const refs = React.useRef(new Map<string, HTMLButtonElement>())
  React.useEffect(() => {
    let raf = 0
    const cache = new Map<string, Element | null>()
    const tick = () => {
      // Several comments on one element fan out to the left.
      const seen = new Map<Element, number>()
      for (const m of marks) {
        const btn = refs.current.get(m.id)
        if (!btn) continue
        let el = cache.get(m.id)
        if (!el || !el.isConnected) {
          el = findElement(m.path, m.target)
          cache.set(m.id, el)
        }
        const r = el?.getBoundingClientRect()
        if (!el || !r || (r.width === 0 && r.height === 0)) {
          btn.style.display = "none"
          continue
        }
        const n = seen.get(el) ?? 0
        seen.set(el, n + 1)
        btn.style.display = ""
        btn.style.transform = `translate3d(${Math.round(r.right - 14 - n * 22)}px, ${Math.round(r.top - 10)}px, 0)`
      }
      raf = window.requestAnimationFrame(tick)
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [marks])

  return createPortal(
    <div aria-label="Open comments on this page">
      {marks.map((m) => {
        const photo = m.photo
        return (
          <button
            key={m.id}
            ref={(el) => {
              if (el) refs.current.set(m.id, el)
              else refs.current.delete(m.id)
            }}
            type="button"
            onClick={() => openHousekeeping(m.id)}
            title={`${m.authorName}: ${m.text}`}
            aria-label={`Open ${m.authorName}'s comment`}
            style={{ display: "none" }}
            className="group fixed top-0 left-0 z-[60] size-6 rounded-full"
          >
            <span className="absolute inset-0 animate-ping rounded-full bg-pax2-light-blue/60" />
            <span className="relative flex size-6 items-center justify-center overflow-hidden rounded-full bg-pax2-blue text-[10px] font-semibold text-white ring-2 ring-pax2-surface shadow-e2 transition-transform group-hover:scale-110">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- a 24px headshot from public/
                <img src={photo} alt="" className="size-full object-cover" />
              ) : (
                m.authorName.charAt(0)
              )}
            </span>
          </button>
        )
      })}
    </div>,
    document.body,
  )
}
