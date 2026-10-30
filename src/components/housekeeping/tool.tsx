"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { Crosshair } from "lucide-react"

import { whiteButton } from "@/components/white-button"

// Housekeeping's pointer (Brendan, 2026-10-30): sonar's overlay as PAX's own comment tool. The
// header's crosshair, or ⌥⇧C anywhere, starts it: hover outlines and names an element, a click
// locks it, and the comment (with any pasted screenshots) goes to Housekeeping's stream in the
// right panel. Escape leaves. Admins and the super admin only; the shell renders it for them.

export const HOUSEKEEPING_CHANGED = "housekeeping:changed"
const OUTLINE_KEY = "housekeeping:outline"

type Overlay = typeof import("./overlay")
let running: { unmount: () => void } | null = null
const listeners = new Set<(on: boolean) => void>()
const announce = () => listeners.forEach((l) => l(!!running))

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

let mine: Promise<string> | null = null
/** The signed-in admin's first initial, for the pins. */
const myInitial = () =>
  (mine ??= fetch("/api/housekeeping?me=1")
    .then((r) => r.json())
    .then((b: { me?: { name?: string } }) => (b.me?.name ?? "?").trim().charAt(0).toUpperCase() || "?")
    .catch(() => "?"))

/** Starts the pointer, or stops it if it is running. */
export async function togglePointer() {
  if (running) {
    running.unmount()
    running = null
    announce()
    return
  }
  const [{ mount }, initial]: [Overlay, string] = await Promise.all([import("./overlay"), myInitial()])
  running = mount({
    initial,
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
      window.dispatchEvent(new Event(HOUSEKEEPING_CHANGED))
      return res.ok
    },
    onExit: () => {
      running = null
      announce()
    },
  })
  announce()
}

/** Outlines an element found by its CSS path for a few seconds, scrolling it into view. */
export function outlineElement(path: string) {
  let el: Element | null = null
  try {
    el = document.querySelector(path)
  } catch {
    el = null
  }
  if (!el) return false
  el.scrollIntoView({ block: "center", behavior: "smooth" })
  const ring = document.createElement("div")
  const place = () => {
    const r = el!.getBoundingClientRect()
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
export function goToComment(route: string, path: string, push: (href: string) => void) {
  if (route === window.location.pathname) return void outlineElement(path)
  sessionStorage.setItem(OUTLINE_KEY, path)
  push(route)
}

/** The header's crosshair, the ⌥⇧C shortcut, and the outline that waits for a page to arrive. */
export function HousekeepingTool() {
  const [on, setOn] = React.useState(false)
  const path = usePathname()
  React.useEffect(() => {
    listeners.add(setOn)
    const key = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.code === "KeyC") {
        e.preventDefault()
        void togglePointer()
      }
    }
    window.addEventListener("keydown", key)
    return () => {
      listeners.delete(setOn)
      window.removeEventListener("keydown", key)
    }
  }, [])
  // A comment opened from another page: its element is outlined once this page has drawn it.
  React.useEffect(() => {
    const pending = sessionStorage.getItem(OUTLINE_KEY)
    if (!pending) return
    let tries = 0
    const t = window.setInterval(() => {
      if (outlineElement(pending) || ++tries > 40) {
        window.clearInterval(t)
        sessionStorage.removeItem(OUTLINE_KEY)
      }
    }, 150)
    return () => window.clearInterval(t)
  }, [path])
  return (
    <button
      type="button"
      onClick={() => void togglePointer()}
      aria-pressed={on}
      aria-label="Comment on the page (⌥⇧C)"
      title="Comment on the page (⌥⇧C)"
      className={whiteButton("circle", on ? "ring-2 ring-pax2-light-blue" : undefined)}
    >
      <Crosshair className="size-4" style={{ color: "#033882" }} />
    </button>
  )
}
