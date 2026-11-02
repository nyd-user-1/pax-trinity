"use client"

import * as React from "react"
import { ArrowLeft, ChartColumn, ChevronRight, Clapperboard, Crosshair, FileText, Loader2, Columns2, Columns3, LayoutGrid, Maximize2, MessageSquareText, MessagesSquare, Palette, ScanSearch, SlidersHorizontal, SquarePen, SquareDashedMousePointer, Video, Wrench, X } from "lucide-react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"

import { connections } from "@/app/connect-actions"
import { Chat } from "@/components/chat/chat"
import { ConnectView, type Nav } from "@/components/connect-view"
import { useShellPanel } from "@/components/shell"
import { useHiddenBlocks, useShelf, type PageBlock, type ShelfBlock, type ShelfItem } from "@/lib/home-blocks"
import { setPageBlockDrag, setShelfDrag } from "@/lib/shelf-drag"
import { BlockCard } from "@/ui/components/nova/block-card"
import { cn } from "@/ui/lib/utils"
import { DEVTOOLS_OPEN, HOUSEKEEPING_OPEN, takeDevTools, takeOpen, usePointer } from "@/components/housekeeping/tool"
import { LIFT_ANALYSIS_OPEN, LIFT_TOOLS_OPEN, takeToolsOnCards } from "@/lib/lift-analyses"
import { useDeliverables, type Deliverable } from "@/app/lift/deliverables"
import { useThemePanel } from "@/components/theme/theme-palette"
import { STUDIO_OPEN, takeStudio } from "@/lib/studio"
import { openDrawnNote } from "@/lib/drawn-notes"
import { TOOLS_OPEN, takeTools } from "@/lib/clips-panel"
import { CircleButton } from "@/ui/components/nova/circle-button"

// 44b's DiscussionPanel (components/DiscussionPanel.tsx), cut to five doors: Blocks, Chat, Record, Slack and
// Discord. Blocks is the shelf after Cloudflare's chat canvas: a handful of shorts, and any block added
// from a page's block menu. A welcome list of rows; each opens its view in the same panel, with Back to the
// list, except Record, which opens /recording. Slack and Discord are admins' alone (components/connect-view.tsx),
// and so are Housekeeping and the Studio (Remotion Studio in a frame, opened beside Chat on a video's version).
// It sits in the shell's right slot in the take panel's frame, so the two read as one panel. It wears the
// rail's dress (Brendan, 2026-10-29, after America Thinks): the mist ground, its rows the rail's rows.

type View = "welcome" | "blocks" | "chat" | "devtools" | "edits" | "lift" | "reports" | "housekeeping" | "devsettings" | "theme" | "studio" | "slack" | "discord"

// Dev Tools (Brendan, 2026-10-30): one row for the admins' tools. Dev Comments is Housekeeping, renamed; the
// Inspector item opens the inspector dock's two panels here, Classifier and Comments (the admin's own
// notes); Sonar turns on Housekeeping's pointer. The header's crosshair and the dock stay as they are while
// the combined design is worked out. Theme (the account menu's switch shows it) opens the theme panel.
/** Where Back goes from a view; the welcome list when unnamed. */
const PARENT: Partial<Record<View, View>> = { housekeeping: "devtools", devsettings: "devtools" }

/** The inspector dock (components/dev/inspector.tsx) draws its panel into the slot this sends it. */
export const INSPECTOR_EMBED = "inspector:embed"
type InspectorPanel = "classifier" | "settings"

// Housekeeping's stream loads when it is opened (components/housekeeping).
const HousekeepingView = dynamic(() => import("@/components/housekeeping/view").then((m) => m.HousekeepingView), {
  ssr: false,
  loading: () => <Loader2 className="mx-6 my-6 size-5 animate-spin text-pax2-blue" />,
})
// The theme panel's controls load when Theme is opened.
const ThemeControls = dynamic(() => import("@/components/theme/theme-palette").then((m) => m.ThemeControls), { ssr: false })
// Edits and Reports, the clip's thread and readout that left /clips for this panel (Brendan, 2026-10-31), load
// when opened: the readout carries the results register.
const ClipEdits = dynamic(() => import("@/components/clips/tools-views").then((m) => m.ClipEdits), { ssr: false })
const ClipReports = dynamic(() => import("@/components/clips/tools-views").then((m) => m.ClipReports), { ssr: false })
// The Studio's frame loads when its view is opened, so the panel's first load carries none of it.
const StudioFrame = dynamic(() => import("@/components/studio-frame").then((m) => m.StudioFrame), { ssr: false })

// The panel moves to its own column when a video's drawer opens beside it (the shell), which remounts
// it; these keep its place through the move: the view it's on and the shelf tile last opened.
let keptView: View = "welcome"
let keptSelected: string | null = null
/** The composition the Studio view stands on: a chat video's version, or the Studio's own first. */
let keptStudio: string | null = null
// The service a Slack or Discord view talks to, named by its logo in the header at every level.
const LOGO: Partial<Record<View, string>> = { slack: "/logos/slack.png", discord: "/logos/discord-icon.svg" }
const TITLE: Record<View, string> = { welcome: "Tools", blocks: "Blocks", chat: "Chat", devtools: "Dev Tools", edits: "Edits", lift: "Lift Analysis", reports: "Reports", housekeeping: "Dev Comments", devsettings: "Settings", theme: "Theme", studio: "Studio", slack: "Slack", discord: "Discord" }

/** A Tools row, its icon in the sidebar's (Brendan, 2026-10-31): 18px at a 1.75 stroke, filled raised and lavender
 *  on hover, popping as the sidebar's icons do (icon-pop, pax2.css), and the row lifting with the sidebar's shadow. */
function Row({ icon, label, sub, onClick }: { icon: React.ReactNode; label: string; sub?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex w-full items-center gap-3 border-b border-slate-200 px-3 py-3 text-left transition-[color,background-color,box-shadow] hover:z-10 hover:bg-pax2-lift/70 hover:shadow-e1"
    >
      <span className="icon-pop flex size-[18px] shrink-0 items-center justify-center text-slate-500 transition-colors group-hover:text-pax2-blue [&_img]:size-[18px] [&_svg]:size-[18px] [&_svg]:fill-pax2-raised [&_svg]:stroke-[1.75] [&_svg]:transition-colors group-hover:[&_svg]:fill-pax2-lavender">{icon}</span>
      <span className="flex-1">
        <span className="block text-[15px] font-medium text-slate-600 group-hover:text-pax2-blue">{label}</span>
        {sub && <span className="block text-xs text-slate-400">{sub}</span>}
      </span>
      <ChevronRight className="size-4 text-slate-400 group-hover:text-pax2-blue" />
    </button>
  )
}

// The canvas, as Cloudflare's chat canvas: the blocks added from any page's block menu and the shelf's
// shorts, in the order they're dragged into, then empty dashed tiles waiting for more. Pressing a block
// opens its page at the block; the panel lives in the shell, beside the page, so it stays where it is.
// Tiles are at least 120px; the panel's width sets the columns (3 at the 420px third, up to 6 wide), and
// empty slots fill whatever height is left, as Cloudflare's canvas fills its panel.
const MIN_TILE = 120
const GAP = 10
const PLACE = (path: string) => (path === "/" ? "Landing" : path.slice(1).split("/")[0].replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()))

function BlocksShelf() {
  const router = useRouter()
  const path = usePathname()
  const { items, layout, remove, move } = useShelf()
  const { hidden, show } = useHiddenBlocks()
  // The page's own layout leads the shelf: every block of it, the deleted ones dimmed. Pressing one puts it
  // back if deleted and scrolls to it; dragging one onto the page drops it where it lands.
  const offPage = (b: PageBlock) => hidden.includes(`${b.page}/${b.id}`)
  const reveal = (b: PageBlock) => {
    show(`${b.page}/${b.id}`)
    setTimeout(() => document.getElementById(`block-${b.page}-${b.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50)
  }
  const [dragging, setDragging] = React.useState<string | null>(null)
  const [over, setOver] = React.useState<string | null>(null)
  // The panel's box, for the columns and the empty slots that fill it.
  const box = React.useRef<HTMLDivElement>(null)
  const [size, setSize] = React.useState({ w: 372, h: 600 })
  React.useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const cols = Math.min(6, Math.max(3, Math.floor((size.w + GAP) / (MIN_TILE + GAP))))
  const tileSide = (size.w - GAP * (cols - 1)) / cols
  const rows = Math.max(Math.ceil((items.length + layout.length) / cols), Math.ceil((size.h + GAP) / (tileSide + GAP)))
  const empties = rows * cols - items.length - layout.length
  // A block's page can take a moment; its tile spins until the page has arrived.
  const [pending, startNav] = React.useTransition()
  const [going, setGoing] = React.useState<string | null>(null)
  // The tile last opened from the shelf wears the feed cards' 1px blue border.
  const [selected, setSelectedState] = React.useState<string | null>(keptSelected)
  const setSelected = (k: string) => setSelectedState((keptSelected = k))
  // A short opens in the video drawer, which comes in left of this panel, between it and the page.
  const play = (id: string) => {
    setSelected(`v:${id}`)
    router.push(`/v/yt-${id}`)
  }
  const open = (b: ShelfBlock) => {
    show(b.key)
    setSelected(`b:${b.key}`)
    // A note put on the shelf from its menu opens as its card (components/notes/draw-notes.tsx).
    if (b.key.startsWith("note:")) return openDrawnNote(b.key.slice(5))
    if (b.path === path) document.getElementById(b.anchor)?.scrollIntoView({ behavior: "smooth", block: "start" })
    else {
      setGoing(`b:${b.key}`)
      startNav(() => router.push(`${b.path}#${b.anchor}`))
    }
  }
  // Each tile drags: onto another tile it moves there, onto an empty slot it goes last, and onto the
  // chat it attaches as context (it carries the shelf's drag payload, lib/shelf-drag).
  const drag = (it: ShelfItem) => {
    const key = it.key
    return {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      setShelfDrag(
        e.dataTransfer,
        it.block
          ? { kind: "block", title: it.block.title, path: it.block.path, anchor: it.block.anchor }
          : { kind: "video", id: it.video.id, title: it.video.title, channel: it.video.channel, ratio: it.video.ratio, duration: it.video.duration },
      )
      setDragging(key)
    },
    onDragEnd: () => (setDragging(null), setOver(null)),
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault()
      setOver(key)
    },
    onDragLeave: () => setOver((o) => (o === key ? null : o)),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault()
      if (dragging) move(dragging, key)
      setDragging(null)
      setOver(null)
    },
    }
  }
  // A tile's frame states, for the kit's BlockCard (src/ui/components/nova/block-card.tsx).
  const state = (key: string) => ({ selected: selected === key, dragging: dragging === key, dropTarget: over === key })
  return (
    <div data-shelf className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-1">
    <div ref={box} className="h-full">
    <div className="grid content-start" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: GAP }}>
      {layout.map((b) => {
        const off = offPage(b)
        return (
          <BlockCard
            key={`p:${b.page}/${b.id}`}
            draggable
            onDragStart={(e) => {
              setPageBlockDrag(e.dataTransfer, { page: b.page, id: b.id })
              setShelfDrag(e.dataTransfer, { kind: "block", title: b.label, path, anchor: b.id })
            }}
            role="button"
            tabIndex={0}
            onClick={() => reveal(b)}
            onKeyDown={(e) => e.key === "Enter" && reveal(b)}
            aria-label={off ? `Put ${b.label} back on the page` : `Go to ${b.label}`}
            title={b.label}
            muted={!off}
            {...state(`p:${b.id}`)}
          />
        )
      })}
      {items.map((it) =>
        it.block ? (
          <BlockCard key={it.key} {...drag(it)} role="button" tabIndex={0} onClick={() => open(it.block)} onKeyDown={(e) => e.key === "Enter" && open(it.block)} aria-label={`Open ${it.block.title}`} title={it.block.title} sub={PLACE(it.block.path)} loading={pending && going === it.key} {...state(it.key)}>
            <button
              type="button"
              onClick={(e) => (e.stopPropagation(), remove(it.block.key))}
              aria-label={`Take ${it.block.title} off the shelf`}
              className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-md text-slate-400 opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          </BlockCard>
        ) : (
          <BlockCard
            key={it.key}
            {...drag(it)}
            role="button"
            tabIndex={0}
            onClick={() => play(it.video.id)}
            onKeyDown={(e) => e.key === "Enter" && play(it.video.id)}
            aria-label={`Play ${it.video.title}`}
            variant="thumbnail"
            title={it.video.title}
            image={`https://i.ytimg.com/vi/${it.video.id}/hqdefault.jpg`}
            badge={it.video.duration || undefined}
            {...state(it.key)}
          />
        ),
      )}
      {Array.from({ length: Math.max(0, empties) }, (_, i) => (
        <div
          key={i}
          aria-hidden
          onDragOver={(e) => (e.preventDefault(), setOver(`empty-${i}`))}
          onDragLeave={() => setOver((o) => (o === `empty-${i}` ? null : o))}
          onDrop={(e) => {
            e.preventDefault()
            if (dragging) move(dragging, null)
            setDragging(null)
            setOver(null)
          }}
          className={cn("aspect-square rounded-xl border border-dashed transition-colors", over === `empty-${i}` ? "border-pax2-light-blue bg-pax2-lavender/40" : "border-slate-300")}
        />
      ))}
    </div>
    </div>
    </div>
  )
}

/** `admin` shows the Slack and Discord rows, each with the workspace or server it reaches. */
/** Tools > Lift Analysis (Brendan, 2026-10-31): every deliverable the PAX waves tested, as the Blocks shelf's
 *  plain tiles (app/lift/deliverables). A card opens its analysis in this column, its Back returning here. */
function LiftAnalyses() {
  const router = useRouter()
  const path = usePathname()
  const loaded = useDeliverables()
  const list = loaded ?? []
  const box = React.useRef<HTMLDivElement>(null)
  const [size, setSize] = React.useState({ w: 372, h: 600 })
  React.useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const cols = Math.min(6, Math.max(3, Math.floor((size.w + GAP) / (MIN_TILE + GAP))))
  const tileSide = (size.w - GAP * (cols - 1)) / cols
  const rows = Math.max(Math.ceil(list.length / cols), Math.ceil((size.h + GAP) / (tileSide + GAP)))
  const open = (a: Deliverable) => {
    if (path === "/lift") window.dispatchEvent(new CustomEvent(LIFT_ANALYSIS_OPEN, { detail: { source: a.source, at: a.at } }))
    else router.push(a.href)
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-1">
      <div ref={box} className="h-full">
        {!loaded && <Loader2 className="mb-3 size-4 animate-spin text-pax2-blue" />}
        <div className="grid content-start" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gap: GAP }}>
          {list.map((a) => (
            <BlockCard key={a.href} role="button" tabIndex={0} onClick={() => open(a)} onKeyDown={(e) => e.key === "Enter" && open(a)} aria-label={`Open the analysis of ${a.title}`} kind="lift" title={a.title} sub={a.sub} />
          ))}
          {Array.from({ length: Math.max(0, rows * cols - list.length) }, (_, i) => (
            <div key={i} aria-hidden className="aspect-square rounded-xl border border-dashed border-slate-300" />
          ))}
        </div>
      </div>
    </div>
  )
}

export function DiscussionPanel({ onClose: close, admin = false }: { onClose: () => void; admin?: boolean }) {
  const { wide, setWide, discussSeed } = useShellPanel()
  const router = useRouter()
  const [view, setViewState] = React.useState<View>(keptView)
  const [themeRow] = useThemePanel()
  const [linked, setLinked] = React.useState<{ slack: string | null; discord: string | null } | null>(null)
  React.useEffect(() => {
    if (admin) connections().then(setLinked).catch(() => setLinked({ slack: null, discord: null }))
  }, [admin])
  const status = (name: string | null | undefined) => (linked ? (name ?? "Not connected") : undefined)
  // Inside Slack or Discord, the header names the channel or post and its arrow steps back one level.
  const [sub, setSub] = React.useState<Nav>(null)
  const setView = (v: View) => setViewState((keptView = v))
  const [studio, setStudio] = React.useState<string | null>(keptStudio)
  const standOn = (id: string | null) => setStudio((keptStudio = id))
  // Housekeeping's pointer or a page marker asked for Housekeeping: open on it, now or as the panel mounts.
  React.useEffect(() => {
    if (!admin) return
    if (takeOpen()) setViewState((keptView = "housekeeping"))
    const open = () => (takeOpen(), setViewState((keptView = "housekeeping")))
    window.addEventListener(HOUSEKEEPING_OPEN, open)
    return () => window.removeEventListener(HOUSEKEEPING_OPEN, open)
  }, [admin])
  // The account menu's Admin › Dev Tools: open on Dev Tools, now or as the panel mounts.
  React.useEffect(() => {
    if (!admin) return
    const go = () => takeDevTools() && setViewState((keptView = "devtools"))
    go()
    window.addEventListener(DEVTOOLS_OPEN, go)
    return () => window.removeEventListener(DEVTOOLS_OPEN, go)
  }, [admin])
  // A clip's comment button on /clips opens Edits: now, or as the panel mounts.
  React.useEffect(() => {
    const go = () => {
      const v = takeTools()
      if (v) setViewState((keptView = v))
    }
    go()
    window.addEventListener(TOOLS_OPEN, go)
    return () => window.removeEventListener(TOOLS_OPEN, go)
  }, [])
  // A chat video's Open in Studio: open the Studio view on its version, now or as the panel mounts.
  React.useEffect(() => {
    if (!admin) return
    const go = () => {
      const want = takeStudio()
      if (!want) return
      standOn(want.id)
      setViewState((keptView = "studio"))
    }
    go()
    window.addEventListener(STUDIO_OPEN, go)
    return () => window.removeEventListener(STUDIO_OPEN, go)
  }, [admin])
  // The Studio opens at the half (Brendan, 2026-10-31), from Chat's Open in Studio and from Tools alike. A frame
  // later, so it lands after the shell's opening size (every panel opens at the third).
  React.useEffect(() => {
    if (view !== "studio") return
    const id = requestAnimationFrame(() => setWide(true))
    return () => cancelAnimationFrame(id)
    // setWide is the shell's; only arriving on the Studio widens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])
  // Lift Analysis' Back: open on its cards, now or as the panel mounts.
  React.useEffect(() => {
    const go = () => takeToolsOnCards() && setViewState((keptView = "lift"))
    go()
    window.addEventListener(LIFT_TOOLS_OPEN, go)
    return () => window.removeEventListener(LIFT_TOOLS_OPEN, go)
  }, [])
  // A page asking about itself (the video page's Ask row) opens straight onto the chat.
  React.useEffect(() => {
    if (discussSeed) setViewState((keptView = "chat"))
  }, [discussSeed?.nonce])
  // Closing starts the next opening fresh, on the list.
  const onClose = () => {
    keptView = "welcome"
    keptSelected = null
    keptStudio = null
    close()
  }
  return (
    <section className="fixed inset-0 z-50 flex flex-col bg-pax2-sidebar md:static md:z-auto md:h-full md:overflow-hidden md:rounded-2xl md:border md:border-slate-500 md:shadow-e2">
      <div className="relative z-10 flex min-h-[73px] shrink-0 items-center justify-between gap-3 bg-pax2-sidebar px-6 py-4 shadow-header">
        <div className="flex min-w-0 items-center gap-2">
          {view !== "welcome" && (
            <button type="button" onClick={() => (sub ? sub.back() : setView(PARENT[view] ?? "welcome"))} aria-label="Back" className="-ml-2 flex size-9 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-pax2-lift hover:text-pax2-blue">
              <ArrowLeft className="size-4" />
            </button>
          )}
          {LOGO[view] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={LOGO[view]} alt="" className="size-5 shrink-0 object-contain" />
          )}
          <p className="truncate font-display text-xl text-slate-900">{sub?.title ?? TITLE[view]}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {view === "studio" && (
            <CircleButton render={<Link href={studio ? `/studio?v=${encodeURIComponent(studio)}` : "/studio"} />} nativeButton={false} aria-label="Open the Studio full page" title="Open the Studio full page">
              <Maximize2 className="size-4" />
            </CircleButton>
          )}
          <CircleButton type="button" onClick={() => setWide(!wide)} className="hidden md:inline-flex" aria-label={wide ? "Narrow the panel" : "Widen the panel"}>
            {wide ? <Columns3 className="size-4" /> : <Columns2 className="size-4" />}
          </CircleButton>
          <CircleButton type="button" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </CircleButton>
        </div>
      </div>
      <div className={cn("flex min-h-0 flex-1 flex-col", view === "welcome" && "overflow-y-auto")}>
        {view === "welcome" && (
          <div className="flex flex-col px-3 pt-1">
            <Row icon={<LayoutGrid />} label="Blocks" sub="Shorts and blocks you've saved" onClick={() => setView("blocks")} />
            <Row icon={<MessagesSquare />} label="Chat" sub="Ask about the scores, scripts and results" onClick={() => setView("chat")} />
            {admin && <Row icon={<Wrench />} label="Dev Tools" sub="Comment, inspect, and more" onClick={() => setView("devtools")} />}
            {/* A to Z, Slack and Discord at the foot (Brendan, 2026-10-31). */}
            <Row icon={<SquarePen />} label="Edits" sub="The team's thread on the clip playing" onClick={() => setView("edits")} />
            <Row icon={<ChartColumn />} label="Lift Analysis" sub="Every deliverable the tests measured" onClick={() => setView("lift")} />
            <Row icon={<Video />} label="Record" sub="Write a script, record it or upload a video" onClick={() => router.push("/recording")} />
            <Row icon={<FileText />} label="Reports" sub="Every tested clip's readout" onClick={() => setView("reports")} />
            {admin && <Row icon={<Clapperboard />} label="Studio" sub="Templates, graphics and saved versions" onClick={() => setView("studio")} />}
            {themeRow && <Row icon={<Palette />} label="Theme" sub="Six themes, and every colour in them" onClick={() => setView("theme")} />}
            {admin && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <Row icon={<img src="/logos/slack.png" alt="" className="object-contain" />} label="Slack" sub={status(linked?.slack)} onClick={() => setView("slack")} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <Row icon={<img src="/logos/discord-icon.svg" alt="" className="object-contain" />} label="Discord" sub={status(linked?.discord)} onClick={() => setView("discord")} />
              </>
            )}
          </div>
        )}
        {view === "blocks" && <BlocksShelf />}
        {view === "lift" && <LiftAnalyses />}
        {view === "edits" && <ClipEdits />}
        {view === "reports" && <ClipReports onNav={setSub} />}
        {view === "devtools" && admin && <DevToolsRows onSettings={() => setView("devsettings")} onComments={() => setView("housekeeping")} />}
        {view === "housekeeping" && <HousekeepingView />}
        {view === "devsettings" && admin && <EmbedSlot view="settings" />}
        {view === "theme" && <ThemeControls />}
        {view === "studio" && admin && <StudioFrame id={studio} onMove={standOn} />}
        {view === "chat" && <Chat compact context={discussSeed?.context} chipVideo={discussSeed?.chipVideo} surface={discussSeed?.chipVideo ? "video-panel" : "chat"} explore={!discussSeed?.chipVideo} seedChip={discussSeed?.ask ?? null} seedNonce={discussSeed?.nonce} />}
        {(view === "slack" || view === "discord") && (linked ? <ConnectView key={view} service={view} mock={!linked[view]} onNav={setSub} /> : <Loader2 className="mx-6 my-6 size-5 animate-spin text-pax2-blue" />)}
      </div>
    </section>
  )
}

/**
 * Dev Tools' rows (Brendan, 2026-11-01): Dev Comments keeps its layer; Inspector and Sonar are
 * switches — on arms the mode, nothing deeper; X-ray is the dock's classifier as a switch, the panel
 * unfolding beneath it under a skeleton in its shape; Settings keeps the chevron and goes one layer
 * deeper to the dock's switches. The dock itself keeps only the scope.
 */
function DevToolsRows({ onSettings, onComments }: { onSettings: () => void; onComments: () => void }) {
  const [onNow, toggle] = usePointer()
  return (
    // data-sonar-exempt + data-devinspector: the rows stay ordinary ground while a mode runs — the
    // standard cursor, clickable — so either mode can always be turned off here (Brendan, 2026-11-01).
    <div data-sonar-exempt data-devinspector className="flex min-h-0 flex-1 flex-col px-3 pt-1">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Row icon={<MessageSquareText />} label="Dev Comments" sub="Comments on the app, and direct messages" onClick={onComments} />
        <ToggleRow icon={<SquareDashedMousePointer />} label="Point and Click" sub="Point, click, and leave edit notes." on={onNow} onToggle={toggle} />
        <XRay />
      </div>
      {/* Settings holds the panel's foot whatever X-ray unfolds above it (Brendan, 2026-11-01). */}
      <div className="shrink-0 border-t border-slate-200">
        <Row icon={<SlidersHorizontal />} label="Settings" sub="The pointer tools' switches" onClick={onSettings} />
      </div>
    </div>
  )
}

/** Row's dress with a switch where the chevron stood. */
function ToggleRow({ icon, label, sub, on, onToggle }: { icon: React.ReactNode; label: string; sub?: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      className="group relative flex w-full items-center gap-3 border-b border-slate-200 px-3 py-3 text-left transition-[color,background-color,box-shadow] hover:z-10 hover:bg-pax2-lift/70 hover:shadow-e1"
    >
      <span className="icon-pop flex size-[18px] shrink-0 items-center justify-center text-slate-500 transition-colors group-hover:text-pax2-blue [&_img]:size-[18px] [&_svg]:size-[18px] [&_svg]:fill-pax2-raised [&_svg]:stroke-[1.75] [&_svg]:transition-colors group-hover:[&_svg]:fill-pax2-lavender">{icon}</span>
      <span className="flex-1">
        <span className="block text-[15px] font-medium text-slate-600 group-hover:text-pax2-blue">{label}</span>
        {sub && <span className="block text-xs text-slate-400">{sub}</span>}
      </span>
      <span aria-hidden className={cn("inline-flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors", on ? "bg-pax2-light-blue" : "bg-slate-300")}>
        <span className={cn("size-3 rounded-full bg-pax2-surface shadow-sm transition-transform", on && "translate-x-3")} />
      </span>
    </button>
  )
}

/** X-ray: the dock's classifier under its own switch, the panel beneath the row, a skeleton in its shape first. */
function XRay() {
  const [on, setOn] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const slot = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!on) return
    setLoading(true)
    window.dispatchEvent(new CustomEvent(INSPECTOR_EMBED, { detail: { slot: slot.current, view: "classifier" } }))
    const t = window.setTimeout(() => setLoading(false), 450)
    return () => {
      window.clearTimeout(t)
      window.dispatchEvent(new CustomEvent(INSPECTOR_EMBED, { detail: null }))
    }
  }, [on])
  return (
    <>
      <ToggleRow icon={<ScanSearch />} label="X-ray" sub="Every element on the page, classified in place" on={on} onToggle={() => setOn((v) => !v)} />
      {on && (
        <div className="relative my-2 flex min-h-[320px] flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-pax2-surface shadow-e1">
          <div ref={slot} className="flex min-h-0 flex-1 flex-col overflow-y-auto" />
          {loading && (
            <div aria-hidden className="absolute inset-0 z-10 flex flex-col gap-3 bg-pax2-surface p-4">
              <div className="flex gap-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <span key={i} className="h-5 w-14 animate-pulse rounded-full bg-slate-200" />
                ))}
              </div>
              {["w-2/3", "w-1/2", "w-5/6", "w-3/5", "w-3/4", "w-1/2", "w-2/3"].map((w, i) => (
                <span key={i} style={{ marginLeft: (i % 3) * 12 }} className={cn("h-3 animate-pulse rounded bg-slate-200", w)} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

/** A dock panel drawn into this view's slot (the dock portals it in; one slot at a time). */
function EmbedSlot({ view }: { view: InspectorPanel }) {
  const slot = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent(INSPECTOR_EMBED, { detail: { slot: slot.current, view } }))
    return () => void window.dispatchEvent(new CustomEvent(INSPECTOR_EMBED, { detail: null }))
  }, [view])
  return (
    <div className="flex min-h-0 flex-1 flex-col px-3">
      <div ref={slot} className="flex min-h-0 flex-1 flex-col overflow-y-auto" />
    </div>
  )
}
