"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { ArrowUpRight, History, Search, Star, type LucideIcon } from "lucide-react"

import { isPanePath } from "@/lib/pane"
import { useNavFavorites } from "@/lib/nav-favorites"
import { useNavRecents } from "@/lib/nav-recents"
import { PARTNERS } from "@/lib/roles"
import { cn } from "@/ui/lib/utils"

// Go to (Brendan, 2026-10-31): a right-click on the page header's empty run opens a page switcher at the
// pointer. Type to find; Recent, Favorites and the pages otherwise. Enter (or a click) opens the page here;
// ⌥ Enter, or a row's arrow, opens it in the second panel, as a right-click on a link does.

type Page = { href: string; label: string; icon: LucideIcon }
type Entry = { href: string; label: string; sub?: string; icon: LucideIcon }

const WIDTH = 296
const RECENT = 5

/** What an address's query names, read as words: a partner by its name, any other value with its dashes as spaces. */
function querySub(query: string): string | undefined {
  const params = new URLSearchParams(query.replace(/^[?]/, "").split("#")[0])
  const words = [...params].map(([k, v]) => (k === "partner" ? (PARTNERS.find((p) => p.id === v)?.name ?? v) : v.replace(/[-_]+/g, " ")))
  return words.length ? words.join(" · ") : undefined
}

/** A search's order: the label starting with it, then a word in it starting with it, then anywhere in it. */
function rank(e: Entry, needle: string) {
  const l = e.label.toLowerCase()
  if (l.startsWith(needle)) return 0
  if (l.split(/\s+/).some((w) => w.startsWith(needle))) return 1
  return 2
}

export function GoToMenu({ at, pages, current, titleOf, onPane, onClose }: { at: { x: number; y: number }; pages: Page[]; current: string; titleOf: (href: string) => string; onPane: (href: string) => void; onClose: () => void }) {
  const router = useRouter()
  const recents = useNavRecents()
  const { favs } = useNavFavorites()
  const [q, setQ] = React.useState("")
  const [active, setActive] = React.useState(0)
  const box = React.useRef<HTMLDivElement>(null)
  const [pos, setPos] = React.useState({ left: at.x, top: at.y })

  // A page's entry: its sidebar icon, its title, and the query when there is one (two Dashboards differ by it).
  const entry = React.useCallback(
    (href: string, icon?: LucideIcon): Entry => {
      const path = href.split(/[?#]/)[0]
      const page = pages.find((p) => p.href === path)
      const query = href.slice(path.length)
      return { href, label: page?.label ?? titleOf(href), sub: query ? querySub(query) : undefined, icon: icon ?? page?.icon ?? History }
    },
    [pages, titleOf],
  )

  const sections = React.useMemo(() => {
    const needle = q.trim().toLowerCase()
    // The page in view, its query included, is where the reader already is.
    const here = typeof window === "undefined" ? current : window.location.pathname + window.location.search
    const recent = recents.filter((h) => h !== here).slice(0, RECENT).map((h) => entry(h))
    const fav = favs.map((h) => entry(h, Star))
    const all = pages.map((p) => entry(p.href))
    if (needle) {
      const seen = new Set<string>()
      const hits = [...all, ...recent, ...fav].filter((e) => (e.label.toLowerCase().includes(needle) || (e.sub ?? "").toLowerCase().includes(needle)) && !seen.has(e.href) && seen.add(e.href))
      return [{ label: null, entries: hits.sort((a, b) => rank(a, needle) - rank(b, needle)) }]
    }
    return [
      { label: "Recent", entries: recent },
      { label: "Favorites", entries: fav },
      { label: "Pages", entries: all },
    ].filter((s) => s.entries.length)
  }, [q, recents, favs, pages, current, entry])
  const flat = sections.flatMap((s) => s.entries)
  React.useEffect(() => setActive(0), [q])

  // Held inside the window: a right-click near an edge opens the menu toward the room.
  React.useLayoutEffect(() => {
    const h = box.current?.offsetHeight ?? 0
    setPos({ left: Math.max(8, Math.min(at.x, window.innerWidth - WIDTH - 8)), top: Math.max(8, Math.min(at.y, window.innerHeight - h - 8)) })
  }, [at])

  React.useEffect(() => {
    const down = (e: MouseEvent) => !box.current?.contains(e.target as Node) && onClose()
    const away = () => onClose()
    document.addEventListener("mousedown", down)
    window.addEventListener("resize", away)
    window.addEventListener("blur", away)
    return () => {
      document.removeEventListener("mousedown", down)
      window.removeEventListener("resize", away)
      window.removeEventListener("blur", away)
    }
  }, [onClose])

  const go = (href: string, pane = false) => {
    onClose()
    if (pane && isPanePath(href)) onPane(href)
    else router.push(href)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") return onClose()
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      const n = flat.length
      if (n) setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + n) % n)
    }
    if (e.key === "Enter" && flat[active]) {
      e.preventDefault()
      go(flat[active].href, e.altKey)
    }
  }

  // Keep the active row in view as the arrows walk the list.
  React.useEffect(() => {
    box.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" })
  }, [active])

  let i = -1
  return createPortal(
    <div
      ref={box}
      role="dialog"
      aria-label="Go to"
      onKeyDown={onKey}
      onContextMenu={(e) => e.preventDefault()}
      style={{ left: pos.left, top: pos.top, width: WIDTH }}
      // The model card's shape (settings/blocks.tsx Block, Brendan, 2026-10-31): the tinted frame with the search
      // on it, and the rows in the white card inside.
      className="fixed z-[80] rounded-[18px] border border-slate-200 bg-slate-50 p-1 shadow-e3"
    >
      <div className="flex items-center gap-2 px-3 pt-2 pb-2.5">
        <Search className="size-4 shrink-0 text-slate-400" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Go to…" aria-label="Go to a page" className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400" />
      </div>
      <div className="no-scrollbar max-h-[min(420px,70vh)] overflow-y-auto rounded-[14px] border border-slate-200 bg-pax2-surface p-1.5 shadow-e1" role="listbox">
        {!flat.length && <p className="px-2.5 py-3 text-sm text-slate-500">No page matches.</p>}
        {sections.map((s) => (
          <div key={s.label ?? "hits"} className="pb-1">
            {s.label && <p className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium tracking-wide text-slate-400 uppercase">{s.label}</p>}
            {s.entries.map((e) => {
              i += 1
              const me = i
              const on = me === active
              return (
                <div
                  key={`${s.label}:${e.href}`}
                  role="option"
                  aria-selected={on}
                  data-active={on}
                  onMouseMove={() => setActive(me)}
                  onClick={(ev) => go(e.href, ev.altKey)}
                  className={cn("group flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm", on ? "bg-pax2-lift text-pax2-blue shadow-e1" : "text-slate-700")}
                >
                  <e.icon className={cn("size-4 shrink-0", on ? "text-pax2-blue" : "text-slate-400", e.icon === Star && "fill-amber-400 text-amber-400")} />
                  <span className="min-w-0 flex-1 truncate">
                    {e.label}
                    {e.sub && <span className="ml-1.5 text-xs text-slate-400">{e.sub}</span>}
                  </span>
                  {isPanePath(e.href) && (
                    <button
                      type="button"
                      aria-label={`Open ${e.label} in the second panel`}
                      title="Panel 2"
                      onClick={(ev) => {
                        ev.stopPropagation()
                        go(e.href, true)
                      }}
                      className={cn("flex size-6 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-foreground/8 hover:text-pax2-blue", !on && "opacity-0 group-hover:opacity-100")}
                    >
                      <ArrowUpRight className="size-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>,
    document.body,
  )
}
