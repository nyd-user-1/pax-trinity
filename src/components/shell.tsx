"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ArrowLeft, BadgeCheck, Bell, BookA, BookOpen, Boxes, ChevronDown, ChevronUp, ChevronsUpDown, Clapperboard, ClipboardList, Columns2, Columns3, EllipsisVertical, FileText, Film, FlaskConical, Gauge, House, LayoutDashboard, Link2, ListChecks, LogIn, LogOut, MessagesSquare, Palette, PanelLeftClose, PanelLeftOpen, PanelRight, Puzzle, Search, Settings, Shield, ShieldCheck, SlidersHorizontal, Star, User2, Users, Video, Vote, X, createLucideIcon } from "lucide-react"

import dynamic from "next/dynamic"
import { SidebarChats } from "@/components/sidebar-chats"
import { KebabMenu, MenuFoot, MenuHeader, MenuRow, MenuSeparator } from "@/components/kebab-menu"
import { useNavFavorites } from "@/lib/nav-favorites"
import { RevealFx } from "@/components/reveal-fx"
import { Wordmark } from "@/components/wordmark"
import { CommandKHost, openCommandK } from "@/components/command/command-k-host"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/ui/components/nova/dropdown-menu"
import { cn } from "@/ui/lib/utils"
import { whiteButton } from "@/components/white-button"
import { HOUSEKEEPING_OPEN, HousekeepingTool } from "@/components/housekeeping/tool"
import { useThemePanel } from "@/components/theme/theme-palette"
import { STUDIO_OPEN } from "@/lib/studio"
import { PaneFrame, PaneSync } from "@/components/pane"
import { PANE_MESSAGE, isEmbedded, isPanePath } from "@/lib/pane"
import { useThemeFollow } from "@/lib/theme-client"
import type { ChipOffer } from "@/lib/question-resolver"

// The discussion panel carries the whole chat (markdown, the Remotion player): it loads the first time it opens,
// not with every page.
const DiscussionPanel = dynamic(() => import("@/components/discussion-panel").then((m) => m.DiscussionPanel), { ssr: false })

// The sidebar by audience (the UX audit's split, ruled 2026-10-19): the creator's product first, then the
// research behind it, then the admin surfaces for admins only. Brendan's grouping (2026-10-22): Chat,
// then Create, Explore and Lab as group rows, then Learn, then Research and Admin as group rows too.
// A group row folds its pages open and shut with its chevron; every group starts shut. /app/home stays
// as a route, off the sidebar.
// The pages trinity keeps (the 2026-10-27 kill list, /reports since): every other destination renders in place but
// goes nowhere. /changelog is unpublished pending Brendan's word, reachable by URL alone.
const LIVE = new Set(["/", "/chat", "/clips", "/america-thinks", "/inbox", "/survey", "/lift", "/reports", "/dashboard", "/data-dictionary", "/studio", "/signin", "/signup"])

type NavLink = { href: string; label: string; icon: typeof House }
type NavGroup = { label: string; icon: typeof House; children: NavLink[]; admin?: boolean }
// A to Z (Brendan, 2026-10-23, again 2026-10-29); the Admin group holds the foot.
// Dashboard joined, and Message tests became Tests (Brendan, 2026-10-29). Studio joined (Brendan, 2026-10-30).
// Tests moved into Survey's inbox, as Consensus did (Brendan, 2026-10-31).
const ADMIN = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/studio", label: "Studio", icon: Clapperboard },
]
// lucide's Inbox with its two shapes in the other order: lucide draws the notch, then the tray over it,
// so the two-tone fill covered the notch's line. Here the tray goes first and the notch's line on top.
const InboxTray = createLucideIcon("InboxTray", [
  ["path", { d: "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z", key: "tray" }],
  ["polyline", { points: "22 12 16 12 14 15 10 15 8 12 2 12", key: "notch" }],
])

const NAV_TREE: (NavLink | NavGroup)[] = [
  { href: "/america-thinks", label: "America Thinks", icon: Users },
  { href: "/chat", label: "Chat", icon: MessagesSquare },
  { href: "/clips", label: "Clips", icon: Film },
  { href: "/data-dictionary", label: "Data dictionary", icon: BookA },
  { href: "/inbox", label: "Inbox", icon: InboxTray },
  { href: "/lift", label: "Lift", icon: FlaskConical },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/survey", label: "Survey", icon: ListChecks },
  // Admins only: the admin surfaces that exist so far.
  { label: "Admin", icon: ShieldCheck, admin: true, children: ADMIN.filter((l) => LIVE.has(l.href)) },
]

// The product's pages, in order: the search's list and the phone's strip.
const NAV: NavLink[] = NAV_TREE.filter((n) => !("children" in n) || n.label !== "Admin").flatMap((n) => ("children" in n ? n.children : [n]))

// The header names the page; the first match wins, so a deeper route comes before its parent.
const TITLES: [string, string][] = [
  ["/v/", "Video"],
  ["/america-thinks", "America Thinks"],
  ["/data-dictionary", "Data dictionary"],
  ["/q/", "Question"],
  ["/reports-2", "Report 2"],
  ["/constructs", "Constructs"],
  ["/electorate", "Electorate"],
]

// 420px: the width the discussion and take panels open at (Brendan, 2026-10-20).
const PANEL_THIRD = "md:w-[420px]"
const PANEL_HALF = "md:w-[50vw]"
// A dragged split: the panel's width as a share of the viewport, carried in --split.
const PANEL_CUSTOM = "md:w-(--split)"
const SPLIT_KEY = "pax2:split"
const MIN_PANE = 320
const GAP = 18

type PanelState = {
  setOpen: (open: boolean) => void
  wide: boolean
  setWide: (wide: boolean) => void
  /** The right panel's three sizes: a third, half, or the whole content area; custom once the divider is dragged. */
  size: PanelSize
  /** Where the size button goes next. */
  nextSize: PanelSize
  cycleSize: () => void
  panelOpen: boolean
  sidebarOpen: boolean
  toggleSidebar: () => void
  discuss: boolean
  toggleDiscuss: () => void
  /** Opens content in the right panel (a chat script's Citations); null closes it. */
  openAside: (aside: Aside | null) => void
  /** Which content the right panel holds now, by its key. */
  asideKey: string | null
  /** Opens the discussion panel's chat about something on this page: its context, the video its chips
   *  come from, and a chip to ask at once. */
  askAbout: (seed: Omit<DiscussSeed, "nonce">) => void
  /** What this page last asked the discussion about. */
  discussSeed: DiscussSeed | null
  /** The signed-in user is an admin: the Studio and Housekeeping are theirs. */
  admin: boolean
  /** Opens a page in the second panel, beside the main one (lib/pane.ts). */
  openPane: (href: string) => void
}
/** `nonce` makes asking the same thing twice a second ask. */
export type DiscussSeed = { context: () => string; chipVideo?: string; ask?: ChipOffer | null; nonce: number }
/** `key` names the content's owner, so it can tell whether the panel still shows it. `back` puts the
 *  Discussion panel's back arrow before the title; `flush` lets rows run to the panel's edges. */
export type Aside = { key: string; title: string; body: React.ReactNode; back?: () => void; flush?: boolean }
export type PanelSize = "third" | "half" | "full" | "custom"
const PanelCtx = React.createContext<PanelState>({ setOpen: () => {}, wide: false, setWide: () => {}, size: "third", nextSize: "half", cycleSize: () => {}, panelOpen: false, sidebarOpen: false, toggleSidebar: () => {}, discuss: false, toggleDiscuss: () => {}, openAside: () => {}, asideKey: null, askAbout: () => {}, discussSeed: null, admin: false, openPane: () => {} })
export const useShellPanel = () => React.useContext(PanelCtx)

export function Shell({ children, drawer, signedIn = false, admin = false }: { children: React.ReactNode; drawer: React.ReactNode; signedIn?: boolean; admin?: boolean }) {
  const path = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [panelOpen, setPanelOpen] = React.useState(false)
  const [size, setSize] = React.useState<PanelSize>("third")
  const wide = size !== "third"
  const [split, setSplit] = React.useState(0.34)
  const [dragging, setDragging] = React.useState(false)
  // The size to return to once the panel that took the page closes.
  const restore = React.useRef<PanelSize | null>(null)
  const nextSize: PanelSize = size === "third" ? "half" : size === "half" ? "full" : size === "full" ? "third" : split < 0.5 ? "half" : "full"
  const [scrolled, setScrolled] = React.useState(false)
  const [discuss, setDiscuss] = React.useState(false)
  // The right panel holds its content through the slide shut, as the sidebar does (the slide, lib/motion.ts):
  // unmounted at once, it blinked out while its column was still closing (Brendan, 2026-10-30).
  const [discussShown, setDiscussShown] = React.useState(false)
  React.useEffect(() => {
    if (discuss) return setDiscussShown(true)
    const t = window.setTimeout(() => setDiscussShown(false), 300)
    return () => window.clearTimeout(t)
  }, [discuss])
  const [aside, setAside] = React.useState<Aside | null>(null)
  const [seed, setSeed] = React.useState<DiscussSeed | null>(null)
  // The second panel (lib/pane.ts): the page it opened on (its frame's src, fixed per opening) and where it
  // is now. `n` reloads the frame when a page is opened into it again.
  const [pane, setPane] = React.useState<{ src: string; href: string; n: number } | null>(null)
  const paneRef = React.useRef<HTMLIFrameElement>(null)
  const openPane = React.useCallback((href: string) => (setAside(null), setPane({ src: href, href, n: Date.now() })), [])
  // The panel's frame says where its page has gone; the address follows (PaneSync).
  React.useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== paneRef.current?.contentWindow) return
      const d = e.data as { type?: string; href?: string } | null
      if (d?.type === PANE_MESSAGE && typeof d.href === "string") setPane((p) => (p && p.href !== d.href ? { ...p, href: d.href! } : p))
    }
    window.addEventListener("message", on)
    return () => window.removeEventListener("message", on)
  }, [])
  // A theme picked in another tab, or around the panel's frame, repaints this one.
  useThemeFollow()
  // What a click opens in the main container a right-click opens in the second panel (Brendan, 2026-10-31):
  // any of this app's links, anywhere around the panel. Shift with the right-click keeps the browser's own
  // menu. Inside the panel's frame the browser's menu stays. Rows that open without a link pass their own
  // address to openPane (America Thinks' questions).
  React.useEffect(() => {
    if (isEmbedded()) return
    const on = (e: MouseEvent) => {
      if (e.shiftKey || e.defaultPrevented) return
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null
      if (!a || a.target === "_blank" || a.hasAttribute("download") || a.getAttribute("href")?.startsWith("#")) return
      const url = new URL(a.href, window.location.href)
      const href = url.pathname + url.search + url.hash
      if (url.origin !== window.location.origin || !isPanePath(href)) return
      e.preventDefault()
      openPane(href)
    }
    document.addEventListener("contextmenu", on)
    return () => document.removeEventListener("contextmenu", on)
  }, [openPane])
  const animKey = React.useRef("Scored")
  const panel = React.useMemo<PanelState>(
    () => ({
      setOpen: setPanelOpen,
      wide,
      setWide: (w: boolean) => setSize(w ? "half" : "third"),
      size,
      nextSize,
      cycleSize: () => ((restore.current = null), setSize(nextSize)),
      panelOpen,
      sidebarOpen,
      toggleSidebar: () => setSidebarOpen((v) => !v),
      discuss,
      toggleDiscuss: () => (setAside(null), setDiscuss((v) => !v)),
      openAside: (a: Aside | null) => {
        if (a) setDiscuss(false)
        setAside(a)
      },
      asideKey: aside?.key ?? null,
      askAbout: (s: Omit<DiscussSeed, "nonce">) => (setAside(null), setSeed({ ...s, nonce: Date.now() }), setDiscuss(true)),
      discussSeed: seed,
      admin,
      openPane,
    }),
    [wide, size, nextSize, panelOpen, sidebarOpen, discuss, aside?.key, seed, admin, openPane],
  )
  // Housekeeping's pointer and page markers open the discussion panel on Housekeeping; a chat video's
  // Open in Studio opens it on the Studio.
  React.useEffect(() => {
    const open = () => (setAside(null), setDiscuss(true))
    window.addEventListener(HOUSEKEEPING_OPEN, open)
    window.addEventListener(STUDIO_OPEN, open)
    return () => {
      window.removeEventListener(HOUSEKEEPING_OPEN, open)
      window.removeEventListener(STUDIO_OPEN, open)
    }
  }, [])
  // The dragged split is remembered between visits, but a panel always opens at the third.
  React.useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SPLIT_KEY) ?? "null") as { size?: PanelSize; split?: number } | null
      if (typeof saved?.split === "number") setSplit(saved.split)
    } catch {}
  }, [])
  React.useEffect(() => {
    if (dragging || size === "full") return
    localStorage.setItem(SPLIT_KEY, JSON.stringify({ size, split }))
  }, [size, split, dragging])
  // Closing the panel after the page was closed beside it brings the page back at its old split.
  const open = panelOpen || discuss || !!aside || !!pane
  // What a page handed the panel belongs to that page.
  React.useEffect(() => (setAside(null), setSeed(null)), [path])
  // A new page closes the sidebar (Brendan, 2026-10-31): opened to pick a page, it shuts once one is picked.
  React.useEffect(() => setSidebarOpen(false), [path])
  // Every panel opens at the one-third view, 420px (Brendan's rule, 2026-10-20); a drag resizes it after.
  // A video opening or closing beside the discussion counts: each lands at the third.
  React.useEffect(() => {
    if (open) setSize("third")
  }, [open, panelOpen])
  React.useEffect(() => {
    if (open || !restore.current) return
    setSize(restore.current)
    restore.current = null
  }, [open])
  React.useEffect(() => {
    if (!dragging) return
    const s = document.body.style
    const prev = [s.cursor, s.userSelect]
    s.cursor = "col-resize"
    s.userSelect = "none"
    return () => {
      s.cursor = prev[0]
      s.userSelect = prev[1]
    }
  }, [dragging])
  const mainRef = React.useRef<HTMLDivElement>(null)
  const drawerRef = React.useRef<HTMLDivElement>(null)
  // Sets the panel's width from where the divider sits, leaving each pane at least MIN_PANE.
  const resizeTo = (x: number) => {
    const right = drawerRef.current?.getBoundingClientRect().right
    const left = mainRef.current?.getBoundingClientRect().left
    if (right == null || left == null) return
    const w = Math.max(MIN_PANE, Math.min(right - x - GAP / 2, right - left - GAP - MIN_PANE))
    setSplit(w / window.innerWidth)
    setSize("custom")
  }
  // Create stays lit through the whole recording flow, whichever prefix a step lives under.
  const active = (href: string) => (href === "/recording" ? path.startsWith("/recording") || path.startsWith("/record/") : path.startsWith(href))
  const { favs, toggle: toggleFav } = useNavFavorites()
  // Which group rows are folded open. Every load starts with all of them shut; nothing is remembered.
  const [openGroups, setOpenGroups] = React.useState<string[]>([])
  const toggleGroup = (label: string) => setOpenGroups((g) => (g.includes(label) ? g.filter((x) => x !== label) : [...g, label]))
  // The switcher and the header search offer only pages that exist (Brendan, 2026-10-25): the LIVE set, once per address.
  const findable = React.useMemo(() => [...new Map([...NAV, ...(admin ? ADMIN : [])].filter((l) => LIVE.has(l.href)).map((l) => [l.href, l])).values()], [admin])
  // The front door (landing, record entry, sign-in) is full bleed; the recording flow, from /recording on, sits in the shell.
  // /signup and /signin are the landing's first screen with a form in place of the hero, sidebar and all.
  // Trinity's front door lives inside the shell; only the auth screens stay full bleed.
  const home = path === "/signup" || path === "/signin"
  // A message test's respondent page (/test/<id>) and a survey's (/s/<slug>) are bare: no sidebar, nothing of the product.
  if (path.startsWith("/test/") || path.startsWith("/s/")) return <>{children}</>
  if (path === "/record" || (path.startsWith("/sign") && !home))
    return (
      <div className="min-h-dvh bg-pax2-surface">
        <RevealFx key={path} translateY={4}>
          {children}
        </RevealFx>
      </div>
    )
  // Each item carries Code/hq's row kebab on hover (components/kebab-menu.tsx): its path to copy, then
  // Favorite (a star on the row, kept in this browser), Open in new tab and Copy link, with its group at
  // the foot.
  const item = (href: string, label: string, Icon: typeof Gauge, small = false) => {
    const on = active(href)
    const fav = favs.includes(href)
    const group = ADMIN.some((n) => n.href === href) ? "Admin" : "Main"
    const url = () => `${window.location.origin}${href}`
    const rowCls = cn(
      "group relative flex items-center gap-3 rounded-xl px-3 pr-14 outline-none transition-[color,background-color,box-shadow]",
      small ? "py-1.5 text-[13px]" : "py-2 text-sm",
      on ? "bg-pax2-lift font-semibold text-pax2-blue shadow-e1" : "text-slate-500 hover:bg-pax2-lift/70 hover:text-pax2-blue hover:shadow-e1",
    )
    const rowBody = (
      <>
        {on && <span aria-hidden className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-pax2-light-blue" />}
        <Icon
          className={cn(small ? "size-3.5" : "size-[18px]", "icon-pop shrink-0 transition-colors", on ? "fill-pax2-lavender text-pax2-blue" : "fill-pax2-raised group-hover:fill-pax2-lavender group-hover:text-pax2-blue")}
          strokeWidth={on ? 2.25 : 1.75}
        />
        {label}
      </>
    )
    return (
      <div key={href} className="group/item relative">
      {LIVE.has(href) ? (
        <Link href={href} aria-current={on ? "page" : undefined} className={rowCls}>
          {rowBody}
        </Link>
      ) : (
        <span className={cn(rowCls, "cursor-default")}>{rowBody}</span>
      )}
      <span className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center">
        {fav && <Star aria-label="Favorite" className="size-3 fill-amber-400 text-amber-400" />}
        <KebabMenu
          label={`${label} options`}
          align="left"
          width="w-56"
          trigger={<EllipsisVertical className="size-4" />}
          triggerClassName="flex size-7 items-center justify-center rounded-lg text-slate-400 opacity-0 transition-opacity hover:bg-pax2-lift hover:text-pax2-blue focus-visible:opacity-100 group-hover/item:opacity-100 aria-expanded:bg-pax2-lift aria-expanded:opacity-100"
        >
          <MenuHeader text={href} copy={href} />
          <MenuSeparator />
          <MenuRow icon={<Star className={fav ? "fill-amber-400 text-amber-400" : undefined} />} label={fav ? "Unfavorite" : "Favorite"} onClick={() => toggleFav(href)} />
          <MenuRow icon={<PanelRight />} label="Open in panel" onClick={() => openPane(href)} />
          <MenuRow icon={<Link2 />} label="Copy link" onClick={() => navigator.clipboard.writeText(url())} />
          <MenuSeparator />
          <MenuFoot title={label} sub={group} />
        </KebabMenu>
      </span>
      </div>
    )
  }
  const sidebar = (
    <div className="flex h-full w-60 flex-col rounded-2xl border border-slate-500 bg-pax2-sidebar px-3 pb-4 shadow-e2">
      {/* The wordmark stands in a header as tall as the main container's and the right panel's, with the same
          shadow under it, so the three header rows line up (Brendan, 2026-10-30). */}
      <div className="relative z-10 -mx-3 mb-4 flex min-h-[73px] shrink-0 items-center rounded-t-2xl bg-pax2-sidebar px-6 shadow-[0_4px_12px_-8px_rgb(var(--t-shadow-rgb,15_23_42)/0.25)]">
        <Link href="/" aria-label="Home" className="flex">
          <Wordmark size={20} />
        </Link>
      </div>
      {/* The ⌘K search sits under the wordmark, above Chat (moved from the header, 2026-10-22). */}
      <div className="mb-3">
        <HeaderSearch items={findable} />
      </div>
      {/* A group row folds its pages open and shut; open, they hang off it on the comment thread's tree
          lines: the trunk down from the group's icon, a rounded elbow turning into each page. */}
      <nav className="-mx-1 flex shrink-0 flex-col gap-0.5 overflow-y-auto px-1 max-h-[55%]">
        {NAV_TREE.map((n) => {
          if (!("children" in n)) return item(n.href, n.label, n.icon)
          if (n.admin && !admin) return null
          const subs = n.children
          const isOpen = openGroups.includes(n.label)
          // Shut, the row still says the page in view lives under it.
          const holds = !isOpen && subs.some((c) => active(c.href))
          const Chevron = isOpen ? ChevronUp : ChevronDown
          return (
            <React.Fragment key={n.label}>
              <button
                type="button"
                onClick={() => toggleGroup(n.label)}
                aria-expanded={isOpen}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm outline-none transition-[color,background-color,box-shadow] hover:bg-pax2-lift/70 hover:text-pax2-blue hover:shadow-e1 focus-visible:bg-pax2-lift/70",
                  holds ? "font-semibold text-pax2-blue" : "text-slate-500",
                )}
              >
                <n.icon className={cn("icon-pop size-[18px] shrink-0 transition-colors", holds ? "fill-pax2-lavender text-pax2-blue" : "fill-pax2-raised group-hover:fill-pax2-lavender group-hover:text-pax2-blue")} strokeWidth={holds ? 2.25 : 1.75} />
                <span className="flex-1">{n.label}</span>
                <Chevron className="size-4 shrink-0 text-slate-400 transition-colors group-hover:text-pax2-blue" />
              </button>
              {isOpen && (
                <div className="flex flex-col">
                  {subs.map((c, k) => (
                    <div key={c.href} className="relative pl-8">
                      {k < subs.length - 1 && <span aria-hidden className="absolute bottom-0 left-[21px] top-0 w-px bg-slate-300" />}
                      <span aria-hidden className="absolute left-[21px] top-0 h-4 w-5 rounded-bl-[10px] border-b-[1.5px] border-l-[1.5px] border-slate-300" />
                      {item(c.href, c.label, c.icon, true)}
                    </div>
                  ))}
                </div>
              )}
            </React.Fragment>
          )
        })}
      </nav>
      <div className="mt-3 flex min-h-0 flex-1 flex-col border-t border-slate-200/70 pt-3">
        {signedIn && (
          <React.Suspense>
            <SidebarChats />
          </React.Suspense>
        )}
      </div>
      <div className="border-t border-slate-200/70 pt-3">
        <AccountMenu />
      </div>
    </div>
  )
  // The landing is full bleed. Signed in, it is the feed under its own bar, and the sidebar and the
  // discussion slide in over it rather than pushing a shell that isn't there.
  if (home)
    return (
      <PanelCtx.Provider value={panel}>
      <CommandKHost />
        <div className="min-h-dvh bg-pax2-surface">{children}</div>
        {/* The sidebar slides in for everyone (PAX in the landing header calls it); the discussion is for the signed in. */}
        <div aria-hidden onClick={() => (setSidebarOpen(false), setDiscuss(false))} className={cn("fixed inset-0 z-40 bg-night-900/20 transition-opacity duration-300", sidebarOpen || discuss ? "opacity-100" : "pointer-events-none opacity-0")} />
        <div className={cn("fixed inset-y-[18px] left-[18px] z-[45] transition-transform duration-300 ease-in-out", sidebarOpen ? "translate-x-0" : "-translate-x-[calc(100%+18px)]")}>{sidebar}</div>
        {signedIn && (
          <div className={cn("fixed inset-y-[18px] right-[18px] z-[45] w-[min(420px,calc(100vw-36px))] transition-transform duration-300 ease-in-out", discuss ? "translate-x-0" : "translate-x-[calc(100%+18px)]")}>
            {(discuss || discussShown) && <DiscussionPanel admin={admin} onClose={() => setDiscuss(false)} />}
          </div>
        )}
      </PanelCtx.Provider>
    )
  const title = titleFor(path)
  // The take panel must not remount (and re-fade) the page beneath it.
  if (!path.startsWith("/v/")) animKey.current = title
  const panelW = size === "half" ? PANEL_HALF : size === "custom" ? PANEL_CUSTOM : PANEL_THIRD
  // Full: the panel takes the whole content area and the page beneath folds away.
  const takeover = open && size === "full"
  // Both panes side by side: the divider and the corner closes show.
  const paired = open && !takeover
  const closePanel = () => (panelOpen ? router.back() : pane ? setPane(null) : discuss ? setDiscuss(false) : setAside(null))
  // /chat fills the content card edge to edge, as solar's chat fills its main area; /app/home is the same chat dressed as the home.
  // /studio's Studio frame does too.
  const full = path === "/" || ["/data-dictionary", "/america-thinks", "/survey", "/lift", "/chat", "/inbox", "/studio"].some((p) => path.startsWith(p))
  return (
    <PanelCtx.Provider value={panel}>
      <CommandKHost />
      <React.Suspense>
        <PaneSync href={pane?.href ?? null} onOpen={openPane} />
      </React.Suspense>
      <div data-shell-frame className="flex min-h-dvh md:h-dvh md:overflow-hidden md:bg-pax2-frame md:p-[18px]">
        <div data-chrome className={cn("hidden shrink-0 overflow-hidden transition-[width,margin] duration-300 ease-in-out md:block", sidebarOpen ? "md:mr-[18px] md:w-60" : "md:w-0")}>
          {sidebar}
        </div>
        <div ref={mainRef} className={cn("relative flex min-w-0 flex-1 flex-col", takeover && "md:hidden")}>
          <div data-shell-main className="flex min-w-0 flex-1 flex-col md:min-h-0 md:overflow-hidden md:rounded-2xl md:border md:border-slate-500 md:bg-pax2-surface md:shadow-e2">
            <Announcement />
            <header data-chrome className="sticky top-0 z-20 flex items-center gap-3 border-b bg-pax2-surface/90 px-4 py-2.5 backdrop-blur md:hidden">
              <Link href="/" aria-label="Home"><Wordmark size={18} /></Link>
              <nav className="no-scrollbar flex flex-1 gap-1 overflow-x-auto">
                {NAV.map(({ href, label }) => {
                  const cls = cn("whitespace-nowrap rounded-full px-3 py-1 text-xs", active(href) ? "bg-pax2-lavender font-semibold text-pax2-blue" : "text-slate-500")
                  return LIVE.has(href) ? (
                    <Link key={href} href={href} className={cls}>
                      {label}
                    </Link>
                  ) : (
                    <span key={href} className={cls}>
                      {label}
                    </span>
                  )
                })}
              </nav>
            </header>
            <div data-chrome className={cn("relative z-10 hidden min-h-[73px] shrink-0 items-center gap-3 bg-pax2-surface px-5 py-4 shadow-[0_4px_12px_-8px_rgb(var(--t-shadow-rgb,15_23_42)/0.25)] md:flex")}>
              <button type="button" onClick={() => setSidebarOpen((v) => !v)} aria-label="Toggle sidebar" className={whiteButton("circle")}>
                {sidebarOpen ? <PanelLeftClose className="size-4" strokeWidth={2} /> : <PanelLeftOpen className="size-4" strokeWidth={2} />}
              </button>
              {/* /home's title is the context switcher again (restored 2026-10-20); everywhere else it stays plain. */}
              <PageSwitcher title={title} items={findable} />
              <div className="flex-1" />
              {/* A page's own header controls (the dashboard's poller switch and pipeline run) portal in here. */}
              <div id="page-actions" className="flex items-center gap-3" />
              {/* Housekeeping's pointer (Brendan, 2026-10-30): admins comment on any element for the super admin. */}
              {admin && <HousekeepingTool />}
              {/* 44b's DiscussionHeaderButton: the discussion panel opens from every page. */}
              <button type="button" onClick={() => (setAside(null), setDiscuss((v) => !v))} aria-pressed={discuss} aria-label="Open the discussion" className={whiteButton("circle")}>
                <MessagesSquare className="size-4" style={{ color: "#033882", fill: "#dbe7fa" }} />
              </button>
            </div>
            <main className={cn("flex-1", full ? "flex min-h-0 flex-col md:overflow-hidden" : "md:overflow-y-auto")} onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 0)}>
              {/* Each page arrives with RevealFx's wipe; the front door has its curtain instead. */}
              <RevealFx key={animKey.current} translateY={4} className={cn("@container w-full", full ? "flex min-h-0 flex-1 flex-col" : path === "/home" || path === "/scripts" ? "px-5 pb-6 md:px-10 md:pb-9" : "px-5 py-6 md:px-10 md:py-9")}>
                {children}
              </RevealFx>
            </main>
          </div>
          {/* Closing the page hands the panel the whole area. */}
          {paired && <CornerClose label="Close the page" onClose={() => ((restore.current = size), setSize("full"))} />}
        </div>
        {/* Chrome's split-view divider: drag to resize, double-click for the default third. */}
        <div className={cn("hidden w-0 shrink-0 items-center justify-center transition-[width] duration-300 ease-in-out md:flex", paired && "md:w-[18px]", dragging && "transition-none")}>
          {paired && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize the panels"
              tabIndex={0}
              onPointerDown={(e) => {
                if (e.button !== 0) return
                e.preventDefault()
                e.currentTarget.setPointerCapture(e.pointerId)
                setDragging(true)
              }}
              onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && resizeTo(e.clientX)}
              onPointerUp={() => setDragging(false)}
              onPointerCancel={() => setDragging(false)}
              onLostPointerCapture={() => setDragging(false)}
              onDoubleClick={() => setSize("third")}
              onKeyDown={(e) => {
                if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
                e.preventDefault()
                const left = drawerRef.current?.getBoundingClientRect().left ?? 0
                resizeTo(left - GAP / 2 + (e.key === "ArrowLeft" ? -24 : 24))
              }}
              className="group flex h-16 w-[18px] cursor-col-resize touch-none items-center justify-center outline-none"
            >
              <span className={cn("h-8 w-1 rounded-full transition-colors group-hover:bg-pax2-blue group-focus-visible:bg-pax2-blue", dragging ? "bg-pax2-blue" : "bg-slate-300")} />
            </div>
          )}
        </div>
        <div
          ref={drawerRef}
          style={{ "--split": `${split * 100}vw` } as React.CSSProperties}
          className={cn("w-0 shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out", open && (takeover ? "md:w-auto md:flex-1" : panelW), dragging && "transition-none")}
        >
          <div className={cn("relative h-full", takeover ? "w-full" : panelW)}>
            {drawer}
            {pane && !panelOpen && <PaneFrame key={pane.n} src={pane.src} title={titleFor(pane.href)} nextSize={nextSize} onSize={() => ((restore.current = null), setSize(nextSize))} onClose={() => setPane(null)} dragging={dragging} frameRef={paneRef} />}
            {(discuss || discussShown) && !panelOpen && !pane && <DiscussionPanel admin={admin} onClose={() => setDiscuss(false)} />}
            {aside && !discuss && !panelOpen && !pane && <AsidePanel aside={aside} wide={wide} onWide={(w) => setSize(w ? "half" : "third")} onClose={() => setAside(null)} />}
            {paired && <CornerClose label="Close" onClose={closePanel} />}
          </div>
        </div>
        {/* A video opened beside the discussion: the drawer takes the column above, between the page and
            the discussion, and the discussion keeps its own 420px column on the far right. Close the page
            and the video takes the room that's left. */}
        {discuss && (panelOpen || !!pane) && (
          <div className="shrink-0 md:ml-[18px] md:w-[420px]">
            <DiscussionPanel onClose={() => setDiscuss(false)} />
          </div>
        )}
      </div>
    </PanelCtx.Provider>
  )
}

// Chrome's split-view tab: a bite out of the pane's bottom-right corner holding its close. The pane's
// border runs around the bite, rounded out where it leaves the edges and in at its inner corner; the
// bite is painted the shell's ground (white under slate-200/60) so the pane reads as cut.
const BITE_EDGE = "M43.5 0V0.5A8 8 0 0 1 35.5 8.5H18.5A10 10 0 0 0 8.5 18.5V35.5A8 8 0 0 1 0.5 43.5H0"
const BITE_FILL = `${BITE_EDGE}V44H44V0Z`
function CornerClose({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <div className="pointer-events-none absolute bottom-0 right-0 z-30 hidden size-11 md:block">
      <svg aria-hidden viewBox="0 0 44 44" className="absolute inset-0 size-full">
        <path d={BITE_FILL} className="fill-background" />
        <path d={BITE_FILL} className="fill-slate-200/60" />
        <path d={BITE_EDGE} fill="none" strokeWidth={1} className="stroke-slate-500" />
      </svg>
      <button type="button" onClick={onClose} aria-label={label} className="pointer-events-auto absolute bottom-1.5 right-1.5 flex size-6 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-300/70 hover:text-pax2-blue">
        <X className="size-3.5" strokeWidth={2.25} />
      </button>
    </div>
  )
}

// The announcement over the header: what just shipped, in one line, dismissed once per browser.
// The gradient runs the wordmark's navy into its red.
const BANNER_KEY = "pax2:banner:elevenlabs-voices"
function Announcement() {
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => {
    try {
      if (!localStorage.getItem(BANNER_KEY)) setOpen(true)
    } catch {}
  }, [])
  if (!open) return null
  return (
    <div data-chrome className="relative z-30 flex shrink-0 items-center justify-center gap-2 bg-[linear-gradient(100deg,#060b22,#1e3a8a_55%,#5b1120_130%)] px-12 py-2 text-[13px] text-white">
      <p className="truncate">Four ElevenLabs voices are in the Studio — Sarah, Matilda, Eric and Brian.</p>
      <Link href="/record/studio" className="shrink-0 font-semibold underline underline-offset-2">
        Try them
      </Link>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => {
          setOpen(false)
          try {
            localStorage.setItem(BANNER_KEY, "1")
          } catch {}
        }}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-white/70 transition-colors hover:text-white"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

// The header's search: every page behind one field, ⌘K from anywhere, Enter takes the first match.
// The page name is also the jump menu: a pill that opens a filterable list of every page (the leuk
// context switcher, in pax2 clothes). It is the header title on every page by Brendan's standing ruling
// (2026-10-23), after the UX audit retired it once (c19e82f): do not replace it with a plain title. It
// lists the same pages the search does.
function PageSwitcher({ title, items }: { title: string; items: { href: string; label: string; icon: typeof Gauge }[] }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState("")
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  const go = (href: string) => {
    setOpen(false)
    setQ("")
    router.push(href)
  }
  const needle = q.trim().toLowerCase()
  const filtered = needle ? items.filter((d) => d.label.toLowerCase().includes(needle)) : items

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${title} — switch page`}
        className={cn("flex h-9 items-center gap-1.5 rounded-full pl-3 pr-2 transition-colors", open ? "bg-slate-200/70" : "hover:bg-slate-200/70")}
      >
        <span className="font-display max-w-[220px] truncate text-[17px] text-slate-900">{title}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-slate-400" />
      </button>
      <h1 className="sr-only">{title}</h1>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-2xl border border-slate-200/80 bg-pax2-surface shadow-e3">
          <div className="border-b border-slate-200/70 p-2">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find…"
              aria-label="Find a page"
              className="w-full rounded-lg bg-pax2-mist px-2.5 py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="no-scrollbar max-h-72 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <p className="px-2.5 py-3 text-sm text-slate-500">No matches.</p>
            ) : (
              filtered.map((d) => (
                <button
                  key={d.href}
                  type="button"
                  role="menuitem"
                  onClick={() => go(d.href)}
                  className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-slate-600 transition-colors hover:bg-pax2-mist hover:text-pax2-blue"
                >
                  <d.icon className="size-4 shrink-0 text-slate-400 transition-colors group-hover:fill-pax2-lavender group-hover:text-pax2-blue" strokeWidth={1.75} />
                  <span className="flex-1 truncate">{d.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** The ⌘K search, in the sidebar under the wordmark: the field opens the palette (components/command,
 *  2026-10-29), as ⌘K does from anywhere; `items` is the palette's to search now. */
function HeaderSearch({ items }: { items: { href: string; label: string; icon: typeof Gauge }[] }) {
  return (
    <button
      type="button"
      onClick={openCommandK}
      aria-label={`Search everything (${items.length} pages and more)`}
      className="flex h-9 w-full items-center gap-2 rounded-full border border-slate-200 bg-pax2-surface px-3 text-left shadow-e1 transition-colors hover:border-slate-300"
    >
      <Search className="size-4 shrink-0 text-slate-400" />
      <span className="flex-1 text-sm text-slate-400">Search…</span>
      <span aria-hidden className="flex shrink-0 gap-1">
        <kbd className="rounded-md border border-slate-200 bg-pax2-mist px-1.5 py-0.5 text-[11px] text-slate-500">⌘</kbd>
        <kbd className="rounded-md border border-slate-200 bg-pax2-mist px-1.5 py-0.5 text-[11px] text-slate-500">K</kbd>
      </span>
    </button>
  )
}


// leuk's AccountMenu (components/shell/account-menu.tsx): the UserChip at the foot of the
// sidebar, opening upward to the identity header and Log out.
type User = { name: string; email: string }
const initials = (name: string) =>
  name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")

// Every signed-in user's default profile image (Gilbert Stuart's Washington); initials stay as its alt text.
function Initials({ name, size }: { name: string; size: "sm" | "md" }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/avatars/default.jpg" alt={initials(name)} width={36} height={36} className={cn("shrink-0 select-none rounded-full object-cover", size === "sm" ? "size-7" : "size-9")} />
  )
}

export function AccountMenu() {
  const router = useRouter()
  const path = usePathname()
  const [user, setUser] = React.useState<User | null | undefined>(undefined)
  const [themePanel, setThemePanel] = useThemePanel()
  // /settings' tabs, as the account menu opens them; General has the bare address.
  const openSettings = (tab: string) => router.push(tab === "general" ? "/settings" : `/settings?tab=${tab}`)
  React.useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d: { user: User | null }) => setUser(d.user))
      .catch(() => setUser(null))
  }, [])
  const signOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" })
    router.push("/signin")
    router.refresh()
  }
  if (user === undefined) return <div className="h-9" />
  // Signed out, the account chip is simply the way in.
  if (!user)
    return (
      <Link href={`/signin?next=${encodeURIComponent(path)}`} className="flex w-full items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-sm font-semibold text-pax2-blue transition-colors hover:bg-pax2-surface/70">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500"><LogIn className="size-3.5" /></span>
        Log in
      </Link>
    )
  const name = user.name
  const item = "gap-2.5 rounded-lg px-2.5 py-2 text-sm [&_svg]:size-4 [&_svg]:text-slate-500"
  const sub = "min-w-44 rounded-2xl border border-slate-500 bg-pax2-surface p-1.5 shadow-e2 ring-0"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Account menu" className="flex w-full max-w-full items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-pax2-blue outline-none transition-colors hover:bg-pax2-surface/70 data-[popup-open]:bg-pax2-surface/70">
        {user ? <Initials name={name} size="sm" /> : <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500"><User2 className="size-3.5" /></span>}
        <span className="flex-1 truncate text-left text-sm font-semibold">{name}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-slate-400" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-(--anchor-width) rounded-2xl border border-slate-500 bg-pax2-surface p-1.5 shadow-e2 ring-0">
        <div className="flex items-center gap-3 px-2.5 py-2">
          {user ? <Initials name={name} size="md" /> : <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500"><User2 className="size-4" /></span>}
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold text-pax2-blue">{name}</span>
            {user && <span className="block truncate text-sm text-slate-500">{user.email}</span>}
          </span>
        </div>
        <DropdownMenuSeparator />
        {/* Each opens /settings at its tab (Brendan, 2026-10-29); Account and Settings fold the tabs the
            menu had no row for. Docs (Help until 2026-10-29) opens /docs; Models sits in Help's old place. */}
        <DropdownMenuItem onClick={() => openSettings("profile")} className={item}>
          <User2 /> Profile
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={item}>
            <BadgeCheck /> Account
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className={sub}>
            <DropdownMenuItem onClick={() => openSettings("members")} className={item}>
              <Users /> Members
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openSettings("permissions")} className={item}>
              <Shield /> Permissions
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={() => openSettings("notifications")} className={item}>
          <Bell /> Notifications
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={item}>
            <Settings /> Settings
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className={sub}>
            <DropdownMenuItem onClick={() => openSettings("general")} className={item}>
              <SlidersHorizontal /> General
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openSettings("integrations")} className={item}>
              <Puzzle /> Integrations
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={() => router.push("/docs")} className={item}>
          <BookOpen /> Docs
        </DropdownMenuItem>
        {/* Theme (Brendan, 2026-10-30): a switch, the menu staying open; on, the palette sits in the page's lower-right corner. */}
        <DropdownMenuItem closeOnClick={false} onClick={() => setThemePanel(!themePanel)} className={item}>
          <Palette /> Theme
          <span aria-hidden className={cn("ml-auto inline-flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors", themePanel ? "bg-pax2-light-blue" : "bg-slate-300")}>
            <span className={cn("size-3 rounded-full bg-pax2-surface shadow-sm transition-transform", themePanel && "translate-x-3")} />
          </span>
          <span className="sr-only">{themePanel ? "on" : "off"}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/models")} className={item}>
          <Boxes /> Models
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className={cn(item, "text-pax2-red-deep [&_svg]:text-pax2-red-deep")}>
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The right panel holding content a page hands it (openAside): the discussion panel's frame, its back arrow,
 *  title, width toggle and close. */
function AsidePanel({ aside, wide, onWide, onClose }: { aside: Aside; wide: boolean; onWide: (wide: boolean) => void; onClose: () => void }) {
  return (
    <section className="fixed inset-0 z-50 flex flex-col bg-pax2-surface md:static md:z-auto md:h-full md:overflow-hidden md:rounded-2xl md:border md:border-slate-500 md:shadow-e2">
      <div className="flex min-h-[73px] shrink-0 items-center justify-between gap-3 px-6 py-4">
        <div className="flex min-w-0 items-center gap-2">
          {aside.back && (
            <button type="button" onClick={aside.back} aria-label="Back" className="-ml-2 flex size-9 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-pax2-surface hover:text-pax2-blue">
              <ArrowLeft className="size-4" />
            </button>
          )}
          <p className="truncate font-display text-xl text-slate-900">{aside.title}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={() => onWide(!wide)} className={whiteButton("circle", "hidden md:inline-flex")} aria-label={wide ? "Narrow the panel" : "Widen the panel"}>
            {wide ? <Columns3 className="size-4" /> : <Columns2 className="size-4" />}
          </button>
          <button type="button" onClick={onClose} className={whiteButton("circle")} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div className={cn("min-h-0 flex-1 overflow-y-auto border-t border-slate-200/70", !aside.flush && "px-6 py-5")}>{aside.body}</div>
    </section>
  )
}

/** A page's header title from its path (the second panel names its page the same way). */
function titleFor(href: string) {
  const p = href.split(/[?#]/)[0] || "/"
  return TITLES.find(([x]) => p.startsWith(x))?.[1] ?? (p === "/" ? "Home" : p.slice(1).split("/")[0].replace(/^./, (c) => c.toUpperCase()))
}
