"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { CameraIcon, ChevronLeftIcon, ChevronRightIcon, FileTextIcon, LayoutGridIcon, LockIcon, PlaySquareIcon, RefreshCwIcon, SquarePenIcon } from "lucide-react"

import { Button } from "@govblock/ui/components/nova/button"
import { Drawer, DrawerContent, DrawerTitle } from "@govblock/ui/components/nova/drawer"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@govblock/ui/components/nova/select"
import { cn } from "@govblock/ui/lib/utils"

import { Capture } from "./capture"
import { EditThread } from "./comments"
import { PanelBlock } from "@/components/blocks"
import { MenuRow, MenuSeparator } from "@/components/kebab-menu"
import { Creators } from "./creators"
import { DEFAULT_AVATAR } from "@/lib/auth/use-account"
import { viewer } from "@/app/original-actions"
import { LoadingFlag } from "@/components/loading-flag"
import { Feed, type Reactions } from "./feed"
import { Grid } from "./grid"
import { ReportDialog } from "./report"
import type { From as TemplateFrom, Take } from "./template-chooser"
import { YES_ON_3_FAMILY } from "@/video/family"
import { Upload } from "./upload"
import { isTested } from "./clip-test"
import { openTools, publishClipsPanel } from "@/lib/clips-panel"
import { LAST } from "./catalog"
import { creatorOf, CREATORS, isKeptRecording, SEED_COMMENTS, deleteClip, loadFeed, takeDown, loadFollows, loadLikes, loadMyComments, loadSaves, saveClip, storeFollows, storeLikes, storeMyComments, storeSaves, updateClip, type Clip, type Comment, type Feed as FeedData, type Upload as UploadRow } from "./store"

// Clips: short vertical video, recorded on a phone or a laptop, kept private
// until its owner says otherwise. A mock of the whole experience (Brendan,
// 2026-09-07) so the shape can be judged before Stream is wired in.
//
// The page is two panels in the Block dress (Brendan, 2026-10-31): the partners on the left, the clips in
// the middle, the grid first and the feed a toggle away, opening at the tile you chose. The clip's Edit
// Panel and Report Panel left the page for the shell's right panel (Tools' Edits and Reports, which read
// the clip playing through lib/clips-panel.ts). The partners' panel gives way first: it narrows before the
// clips do, and leaves when keeping it would cost the grid a column, its menu moving into the clips'
// header. On a phone the thread is a sheet that rises from the foot.

type Account = { name?: string | null; email?: string | null; image?: string | null; admin?: boolean } | null

function useAccount(): { account: Account; ready: boolean } {
  const [account, setAccount] = React.useState<Account>(null)
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => {
    let live = true
    try {
      const raw = sessionStorage.getItem("govblock:account")
      if (raw) setAccount(JSON.parse(raw) as Account)
    } catch {}
    // The server's own answer (lib/auth's currentUser, the Cognito session), the one keeping a recording checks.
    viewer()
      .then((u) => {
        if (!live) return
        setAccount(u ? { email: u.email, name: u.email.split("@")[0], admin: u.admin } : null)
        setReady(true)
      })
      .catch(() => live && setReady(true))
    return () => {
      live = false
    }
  }, [])
  return { account, ready }
}

/** Recording and the sign-in gate: the whole screen on a phone, a phone on a desktop. */
function Frame({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  React.useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [])
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black md:bg-black/85 md:p-6" onClick={onClose}>
      <div className="relative h-full w-full overflow-hidden bg-black md:aspect-[9/16] md:h-[min(100%,880px)] md:w-auto md:rounded-3xl md:shadow-2xl md:ring-1 md:ring-white/10" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

// Remotion loads only when Generate opens.
const Generate = dynamic(() => import("./generate").then((m) => m.Generate), { ssr: false })
// Remotion and the templates load only when the chooser opens.
const TemplateChooser = dynamic(() => import("./template-chooser").then((m) => m.TemplateChooser), { ssr: false })

// The feed, the creators and the comments fit the page under the header, or the right rail's sheet (Brendan, 2026-09-14): the sheet is 1.2rem shorter than the page and its content sits in 0.5rem of padding. The page's feed gives back a rem so its foot is never cut.
// The page's side panels stop 1rem above the frame's foot (Brendan, 2026-10-29): a column starts 2.25rem below the
// frame's top (the shell's padding) and holds 1rem under its panel, so it runs 4.375rem short of the header's span.
type Frame = "page" | "sheet"
const FEED_HEIGHT: Record<Frame, string> = { page: "h-[calc(100svh-var(--header-height)-4.5rem)]", sheet: "h-[calc(100svh-var(--header-height)-5.2rem)]" }
const COLUMN_HEIGHT: Record<Frame, string> = { page: "h-[calc(100svh-var(--header-height)-4.375rem)]", sheet: "h-[calc(100svh-var(--header-height)-1.7rem)]" }
// The clips' panel is a column like the partners' once the shell's frame is (md); on a phone the page scrolls.
const MAIN_HEIGHT: Record<Frame, string> = { page: "md:h-[calc(100svh-var(--header-height)-4.375rem)]", sheet: "md:h-[calc(100svh-var(--header-height)-1.7rem)]" }

/** `catalog` is the published stock the server lets this reader see (app/clips/page.tsx): every clip for staff, a
 *  partner's own sponsor's alone (lib/partners/sponsors.ts, 2026-11-02), so another's never reaches the browser. */
export function ClipsApp({ frame = "page", catalog, scoped = false }: { frame?: Frame; catalog: Clip[]; scoped?: boolean }) {
  const { account, ready } = useAccount()
  const signedIn = !!account
  const [mine, setMine] = React.useState<Clip[]>([])
  /** Published clips from Aurora, every origin, other than the reader's own. */
  const [live, setLive] = React.useState<Clip[]>([])
  const [uploads, setUploads] = React.useState<UploadRow[]>([])
  const [reporting, setReporting] = React.useState<Clip | null>(null)
  const [creator, setCreator] = React.useState("all")
  // The grid first (Brendan, 2026-09-14); a clip opens the feed.
  const [view, setView] = React.useState<"feed" | "grid">("grid")
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [muted, setMuted] = React.useState(true)
  const [liked, setLiked] = React.useState<Set<string>>(new Set())
  const [saved, setSaved] = React.useState<Set<string>>(new Set())
  const [following, setFollowing] = React.useState<Set<string>>(new Set())
  const [likedComments, setLikedComments] = React.useState<Set<string>>(new Set())
  const [myComments, setMyComments] = React.useState<Comment[]>([])
  const [mode, setMode] = React.useState<"capture" | "upload" | "generate" | "gate" | null>(null)
  // The template chooser over a take (./template-chooser.tsx): after Record keeps one, from a rail thumbnail or the clip menu.
  const [chooser, setChooser] = React.useState<{ take: Take; from: TemplateFrom; shown?: readonly string[]; picked?: string } | null>(null)
  const [sheet, setSheet] = React.useState(false)
  const [focusKey, setFocusKey] = React.useState(0)
  // Until the feed has been read, the gallery shows the loader rather than a
  // sentence about having nothing (Brendan, 2026-09-15).
  const [loaded, setLoaded] = React.useState(false)
  const pendingId = React.useRef<string | null>(null)

  // A take just sent keeps playing from the browser's copy until Stream's MP4 is ready.
  const applyFeed = React.useCallback((feed: FeedData) => {
    setLoaded(true)
    setLive(feed.published)
    setUploads(feed.uploads)
    setMine((prev) =>
      feed.mine.map((c) => {
        const local = prev.find((p) => p.id === c.id)
        return !c.src && local?.blob ? { ...c, src: local.src, blob: local.blob, poster: local.poster, duration: c.duration ?? local.duration } : c
      })
    )
  }, [])

  // While a take is still processing, the feed is read again every eight seconds.
  const processing = mine.some((c) => c.status === "processing")
  React.useEffect(() => {
    if (!processing) return
    const id = setInterval(() => void loadFeed().then(applyFeed), 8000)
    return () => clearInterval(id)
  }, [processing, applyFeed])

  React.useEffect(() => {
    void loadFeed().then(applyFeed)
    setLiked(loadLikes())
    setSaved(loadSaves())
    setFollowing(loadFollows())
    setMyComments(loadMyComments())
    const c = new URLSearchParams(window.location.search).get("c")
    if (c) pendingId.current = c
  }, [])

  const you: Clip["author"] = { name: account?.name ?? account?.email ?? "You", handle: (account?.email ?? "you").split("@")[0], image: account?.image || DEFAULT_AVATAR }

  // What is on offer: the published set (the reader's own public ones, then
  // every published clip in Aurora whether recorded, cut or generated, then
  // the stock), narrowed to a creator when one is picked.
  const published = React.useMemo(() => [...mine.filter((c) => c.visibility === "public" && c.status !== "processing"), ...live, ...catalog], [mine, live, catalog])
  const clips = React.useMemo(() => {
    // Bookmarks (Brendan, 2026-10-31): the clips the reader saved with the feed's bookmark, whoever's they are.
    const list = creator === "you" ? mine : creator === "all" ? published : creator === "saved" ? [...mine, ...published].filter((c, i, a) => saved.has(c.id) && a.findIndex((x) => x.id === c.id) === i) : published.filter((c) => c.creatorId === creator)
    // Newest first, everywhere (Brendan, 2026-10-25), the tested clips ahead of the rest (Brendan, 2026-10-29).
    const tested = (c: Clip) => (isTested(c.id) ? 1 : 0)
    // The edited cuts sort last, in LAST's order (catalog.ts).
    const last = (c: Clip) => LAST.indexOf(c.id) + 1
    return [...list].sort((a, b) => last(a) - last(b) || tested(b) - tested(a) || Date.parse(b.createdAt) - Date.parse(a.createdAt))
  }, [creator, mine, published, saved])

  // The rail lists the videos themselves (Brendan, 2026-10-25), not the desks.
  const clipRows = clips.map((c) => ({ id: c.id, title: c.title, sub: `${c.duration}s · @${c.author.handle}`, partner: creatorOf(c.creatorId)?.name ?? c.author.name }))
  // A partner's rail names only the desks it has clips from.
  const partnerRows = [{ id: "all", name: "All partners", count: published.length }, { id: "saved", name: "Bookmarks", count: saved.size }, ...CREATORS.map((c) => ({ id: c.id, name: c.name, count: published.filter((x) => x.creatorId === c.id).length })).filter((r) => !scoped || r.count > 0)]

  // The first clip plays on arrival, or the one the address names.
  React.useEffect(() => {
    // A link to one of the reader's own private clips (Chat's kept recording) opens Your library on it.
    if (pendingId.current && creator !== "you" && !clips.some((c) => c.id === pendingId.current) && mine.some((c) => c.id === pendingId.current)) {
      setCreator("you")
      setView("feed")
      return
    }
    if (!clips.length) return
    const want = pendingId.current && clips.find((c) => c.id === pendingId.current) ? pendingId.current : null
    if (want) {
      pendingId.current = null
      setActiveId(want)
      setTimeout(() => document.querySelector(`[data-id="${CSS.escape(want)}"]`)?.scrollIntoView({ block: "start" }), 50)
    } else if (!activeId || !clips.some((c) => c.id === activeId)) {
      setActiveId(clips[0].id)
    }
  }, [clips, activeId, creator, mine])

  const active = clips.find((c) => c.id === activeId) ?? null
  const commentsFor = React.useCallback((id: string) => [...SEED_COMMENTS.filter((c) => c.clipId === id), ...myComments.filter((c) => c.clipId === id)], [myComments])

  const toggleIn = (set: Set<string>, id: string) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }
  const record = () => setMode("capture")
  const upload = () => setMode("upload")
  const admin = account?.admin === true
  // An admin's takedown hides the clip everywhere at once; the row and the video stay for the record.
  const takeDownClip = async (clip: Clip) => {
    if (!window.confirm(`Take down “${clip.title}”? It leaves the feed for everyone.`)) return
    await takeDown(clip.id)
    setLive((l) => l.filter((c) => c.id !== clip.id))
    setMine((m) => m.filter((c) => c.id !== clip.id))
  }
  const goToPost = (clip: Clip) => {
    window.history.replaceState(null, "", `/clips?c=${encodeURIComponent(clip.id)}`)
    setView("feed")
    setActiveId(clip.id)
    setTimeout(() => document.querySelector(`[data-id="${CSS.escape(clip.id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 30)
  }

  const reactions: Reactions = {
    liked,
    saved,
    following,
    commentCount: (id) => commentsFor(id).length,
    onDelete: (clip) => void remove(clip),
    onReport: (clip) => setReporting(clip),
    onTakeDown: admin ? (clip) => void takeDownClip(clip) : undefined,
    onLike: (clip) => {
      setLiked((s) => {
        const n = toggleIn(s, clip.id)
        storeLikes(n)
        return n
      })
    },
    onSave: (clip) => {
      setSaved((s) => {
        const n = toggleIn(s, clip.id)
        storeSaves(n)
        return n
      })
    },
    onFollow: (creatorId) => {
      setFollowing((s) => {
        const n = toggleIn(s, creatorId)
        storeFollows(n)
        return n
      })
    },
    // The thread is Tools' Edits in the shell's right panel; on a phone, the sheet.
    onComment: (clip) => {
      setActiveId(clip.id)
      if (window.matchMedia("(min-width: 48rem)").matches) {
        openTools("edits")
        setFocusKey((k) => k + 1)
      } else setSheet(true)
    },
    onGoToPost: goToPost,
    // A rail thumbnail opens the chooser on its pick; the menu's Apply a template opens all four.
    onTemplate: (clip, pick) => {
      const take = { id: clip.id, src: clip.src, seconds: clip.duration ?? null }
      setChooser(pick ? { take, from: "rail", shown: pick.shown, picked: pick.picked } : { take, from: "menu", shown: YES_ON_3_FAMILY })
    },
  }

  const post = (text: string) => {
    if (!active) return
    const row: Comment = { id: `mc-${Date.now().toString(36)}`, clipId: active.id, author: you, text, at: new Date().toISOString(), likes: 0, mine: true }
    setMyComments((m) => {
      const n = [...m, row]
      storeMyComments(n)
      return n
    })
  }

  const saveRecording = async (clip: Clip, onProgress: (fraction: number) => void) => {
    const saved = await saveClip(clip, onProgress)
    setMine((m) => [saved, ...m])
    setCreator("you")
    setView("feed")
    setMode(null)
    pendingId.current = saved.id
    // The take is kept; the chooser offers it two templates, and closing it is the skip.
    setChooser({ take: { id: saved.id, src: saved.src, seconds: saved.duration ?? clip.duration ?? null }, from: "record" })
  }

  const remove = async (clip: Clip) => {
    await deleteClip(clip.id)
    setMine((m) => m.filter((c) => c.id !== clip.id))
  }
  const publish = async (clip: Clip) => {
    const visibility = clip.visibility === "public" ? "private" : "public"
    await updateClip(clip.id, { visibility })
    // The MP4's address changes with it (a private one plays through a token), so the row is read again.
    setMine((m) => m.map((c) => (c.id === clip.id ? { ...c, visibility } : c)))
    void loadFeed().then(applyFeed)
  }

  const likeComment = (id: string) => setLikedComments((s) => toggleIn(s, id))
  // A clip opened from Tools' Reports plays here; one under another partner brings back All partners.
  const openClip = (id: string) => {
    const c = clips.find((x) => x.id === id)
    if (c) return goToPost(c)
    pendingId.current = id
    setCreator("all")
    setView("feed")
  }
  // What the shell's right panel reads (Edits and Reports): the clip playing and the thread's handlers.
  const openClipRef = React.useRef(openClip)
  openClipRef.current = openClip
  React.useEffect(() => {
    publishClipsPanel({ clip: active, comments: active ? commentsFor(active.id) : [], signedIn, likedComments, focusKey, onPost: post, onLikeComment: likeComment, onOpen: (id) => openClipRef.current(id) })
    // post and likeComment read only active and state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, commentsFor, signedIn, likedComments, focusKey])
  React.useEffect(() => () => publishClipsPanel(null), [])

  const shown = clips
  // The count's refresh: the feed read again.
  const [refreshing, setRefreshing] = React.useState(false)
  const refresh = () => {
    setRefreshing(true)
    void loadFeed()
      .then(applyFeed)
      .finally(() => setRefreshing(false))
  }

  const viewToggle = (
    <div className="flex items-center rounded-full bg-muted p-0.5">
      <button type="button" onClick={() => setView("feed")} className={cn("flex size-8 items-center justify-center rounded-full", view === "feed" ? "bg-background shadow-sm" : "text-muted-foreground")} aria-label="Feed">
        <PlaySquareIcon className="size-4" />
      </button>
      <button type="button" onClick={() => setView("grid")} className={cn("flex size-8 items-center justify-center rounded-full", view === "grid" ? "bg-background shadow-sm" : "text-muted-foreground")} aria-label="Grid">
        <LayoutGridIcon className="size-4" />
      </button>
      {/* Edits and Reports at the switch's end (Brendan, 2026-10-31): the right panel's views of the clip picked. */}
      <span aria-hidden className="mx-1 h-4 w-px bg-border" />
      <button type="button" onClick={() => openTools("edits")} className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/8 hover:text-foreground" aria-label="Edits" title="Edits">
        <SquarePenIcon className="size-4" />
      </button>
      <button type="button" onClick={() => openTools("reports")} className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/8 hover:text-foreground" aria-label="Reports" title="Reports">
        <FileTextIcon className="size-4" />
      </button>
    </div>
  )
  // Picking a clip, from a tile, a partner row or the keys: the blue border, the address, and the tile into view.
  const select = (id: string) => {
    setActiveId(id)
    window.history.replaceState(null, "", `/clips?c=${encodeURIComponent(id)}`)
    document.querySelector(`[data-tile="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }
  // The keys step the clips (Brendan, 2026-10-31): in the partners list ↑ ↓ a row at a time, the grid following;
  // in the grid ← → a tile and ↑ ↓ a row of tiles; in the feed, the header's chevrons. Typing, menus and a video
  // with the focus keep their keys.
  const keys = React.useRef<(e: KeyboardEvent) => void>(() => {})
  keys.current = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || !clips.length) return
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return
    const t = e.target as HTMLElement
    if (t.closest("input, textarea, select, video, [contenteditable='true'], [role='menu'], [role='dialog']")) return
    const inList = !!t.closest("[data-partner-list]")
    if (inList && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return
    e.preventDefault()
    const forward = e.key === "ArrowRight" || e.key === "ArrowDown"
    if (view === "feed" && !inList) return step(forward ? 1 : -1)
    const tiles = [...document.querySelectorAll<HTMLElement>("[data-tile]")]
    const cols = inList || !tiles.length ? 1 : Math.max(1, tiles.filter((x) => x.offsetTop === tiles[0]!.offsetTop).length)
    const by = e.key === "ArrowLeft" || e.key === "ArrowRight" || inList ? 1 : cols
    const i = clips.findIndex((c) => c.id === activeId)
    const next = clips[Math.min(clips.length - 1, Math.max(0, (i < 0 ? 0 : i) + (forward ? by : -by)))]!
    if (view === "feed") {
      setActiveId(next.id)
      document.querySelector(`[data-id="${CSS.escape(next.id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" })
    } else select(next.id)
  }
  React.useEffect(() => {
    const on = (e: KeyboardEvent) => keys.current(e)
    window.addEventListener("keydown", on)
    return () => window.removeEventListener("keydown", on)
  }, [])
  // The header's chevrons step through the clips shown (Brendan, 2026-10-31), wrapping at the ends: in the grid the
  // picked tile takes the blue border and comes into view; in the feed the clip scrolls in and plays.
  const step = (d: 1 | -1) => {
    if (!clips.length) return
    const i = clips.findIndex((c) => c.id === activeId)
    const next = clips[(i + d + clips.length) % clips.length]
    setActiveId(next.id)
    const el = document.querySelector(view === "grid" ? `[data-tile="${CSS.escape(next.id)}"]` : `[data-id="${CSS.escape(next.id)}"]`)
    el?.scrollIntoView({ behavior: "smooth", block: view === "grid" ? "nearest" : "start" })
  }
  const creatorLabel = creator === "all" ? "All clips" : creator === "you" ? "Your library" : creator === "saved" ? "Bookmarks" : (CREATORS.find((c) => c.id === creator)?.name ?? creator)

  return (
    // The slot hides the site footer (Brendan, 2026-09-11): the page is the clip.
    <div data-slot="clips" className="container-wrapper @container/clips">
      {/* The partners' column takes 340px of the first 1156 and gives back up to 100 before the clips' column
          gives any (it shrinks a thousand times faster); under 1056px of page it leaves, since keeping it would
          take the grid below three columns. */}
      <div className="flex gap-6 px-2 md:px-4">
        <aside className="hidden min-w-[240px] flex-[0_1000_340px] @min-[1056px]/clips:block">
          <div className={cn("sticky top-4 pb-4", COLUMN_HEIGHT[frame])}>
            {/* The Block dress (Brendan, 2026-10-25): the title, then the menu, where the partners live. */}
            <PanelBlock
              title="Partners"
              name="partners"
              rows={clipRows}
              menuItems={partnerRows.map((x) => (
                <MenuRow key={x.id} label={x.name} checked={creator === x.id} onClick={() => setCreator(x.id)} />
              ))}
            >
              <Creators clips={clipRows} activeId={activeId} onSelect={select} onPlay={(id) => { const c = published.find((x) => x.id === id); if (c) goToPost(c) }} />
            </PanelBlock>
          </div>
        </aside>

        <main className="min-w-0 flex-[1_1_760px]">
          <div className={cn("flex flex-col md:sticky md:top-4 md:pb-4", MAIN_HEIGHT[frame])}>
            {/* The partners' dress (Brendan, 2026-10-31): the partner shown as the title, the view toggle after it,
                the count and its refresh before the menu. Without the partners' column the title is its menu. */}
            <PanelBlock
              title=""
              id="clips"
              name="clips"
              rows={clipRows}
              menuItems={
                <>
                  <MenuRow icon={<SquarePenIcon />} label="Edits" onClick={() => openTools("edits")} />
                  <MenuRow icon={<FileTextIcon />} label="Reports" onClick={() => openTools("reports")} />
                  <MenuSeparator />
                </>
              }
              tools={
                <div className="flex min-w-0 items-center gap-3">
                  {/* The default view carries no label (Brendan, 2026-11-01); a chosen partner or library is named. */}
                  {creator !== "all" && <span className="hidden truncate text-base font-medium @min-[1056px]/clips:inline">{creatorLabel}</span>}
                  <Select value={creator} onValueChange={(v) => v && setCreator(String(v))}>
                    <SelectTrigger className="h-8 w-max min-w-36 @min-[1056px]/clips:hidden" size="sm" aria-label="Partner">
                      <SelectValue>{() => creatorLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent className="w-max min-w-44">
                      <SelectItem value="all" className="whitespace-nowrap">
                        All clips
                      </SelectItem>
                      <SelectItem value="saved" className="whitespace-nowrap">
                        Bookmarks
                      </SelectItem>
                      {CREATORS.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="whitespace-nowrap">
                          {c.name}
                        </SelectItem>
                      ))}
                      {signedIn && (
                        <SelectItem value="you" className="whitespace-nowrap">
                          Your library
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  {viewToggle}
                </div>
              }
              actions={
                <>
                  <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">{shown.length} clips</span>
                  <button type="button" aria-label="Refresh" title="Refresh" onClick={refresh} className="-ml-1 inline-flex size-8 items-center justify-center rounded-md text-slate-800 hover:bg-foreground/8 hover:text-foreground">
                    <RefreshCwIcon className={cn("size-3.5", refreshing && "animate-spin")} />
                  </button>
                  <button type="button" aria-label="Previous clip" title="Previous clip" disabled={!clips.length} onClick={() => step(-1)} className="inline-flex size-8 items-center justify-center rounded-md text-slate-800 hover:bg-foreground/8 hover:text-foreground disabled:opacity-40">
                    <ChevronLeftIcon className="size-4" />
                  </button>
                  <button type="button" aria-label="Next clip" title="Next clip" disabled={!clips.length} onClick={() => step(1)} className="-ml-1 inline-flex size-8 items-center justify-center rounded-md text-slate-800 hover:bg-foreground/8 hover:text-foreground disabled:opacity-40">
                    <ChevronRightIcon className="size-4" />
                  </button>
                </>
              }
            >
              <div className="flex min-h-0 flex-1 flex-col px-4">
                {creator === "you" && signedIn && uploads.length > 0 && (
                  <ul className="flex shrink-0 flex-col gap-1 pb-3 text-sm">
                    {uploads.map((u) => (
                      <li key={u.id} className="flex items-center gap-2">
                        <span className="truncate font-medium">{u.title}</span>
                        <span className="shrink-0 text-muted-foreground" title={u.error ?? undefined}>{u.status === "queued" ? "waiting for the worker box" : u.status === "running" ? "being cut" : u.status === "failed" ? "could not be cut" : `${u.clips ?? 0} clips`}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {creator === "you" && ready && !signedIn ? (
                  <Empty icon={<LockIcon className="size-6" />} text="Your library is yours. Sign in to see it.">
                    <Button render={<Link href="/sign-in" />} size="sm">
                      Sign in
                    </Button>
                  </Empty>
                ) : clips.length === 0 && !loaded ? (
                  <div className="flex justify-center py-16">
                    <LoadingFlag />
                  </div>
                ) : clips.length === 0 ? (
                  <Empty icon={<CameraIcon className="size-6" />} text={creator === "you" ? "Nothing recorded yet." : creator === "saved" ? "Nothing bookmarked yet." : "Nothing published yet."}>
                    {creator === "you" && (
                      <Button size="sm" onClick={record}>
                        Record the first one
                      </Button>
                    )}
                  </Empty>
                ) : view === "grid" ? (
                  <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto rounded-lg">
                    <Grid clips={shown} onOpen={goToPost} onSelect={(c) => select(c.id)} activeId={activeId} />
                  </div>
                ) : (
                  <Feed clips={shown} activeId={activeId} onActive={setActiveId} muted={muted} onMuted={setMuted} reactions={reactions} className={cn(FEED_HEIGHT[frame], "md:h-auto md:min-h-0 md:flex-1")} />
                )}

                {creator === "you" && active?.mine && view === "feed" && (
                  <div className="flex shrink-0 items-center gap-2 py-3 text-sm">
                    <span className="text-muted-foreground">{active.visibility === "public" ? "Everyone can see this." : "Only you can see this."}</span>
                    {!isKeptRecording(active.id) && (
                      <>
                        <Button variant="outline" size="sm" className="ml-auto" onClick={() => void publish(active)}>
                          {active.visibility === "public" ? "Make private" : "Publish"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => void remove(active)}>
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </PanelBlock>
          </div>
        </main>
      </div>

      <button type="button" onClick={record} aria-label="Record" className="fixed right-4 bottom-6 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background lg:hidden">
        <CameraIcon className="size-6" />
      </button>

      <Drawer open={sheet} onOpenChange={setSheet} showSwipeHandle>
        <DrawerContent className="h-[75dvh]">
          <DrawerTitle className="sr-only">Comments</DrawerTitle>
          {active && <EditThread clip={active} comments={commentsFor(active.id)} signedIn={signedIn} onPost={post} onLikeComment={likeComment} likedComments={likedComments} focusKey={focusKey} className="h-full" />}
        </DrawerContent>
      </Drawer>

      {reporting && <ReportDialog clip={reporting} open={!!reporting} onOpenChange={(o) => !o && setReporting(null)} defaultContact={account?.email ?? ""} />}
      {chooser && <TemplateChooser {...chooser} onClose={() => setChooser(null)} />}

      {mode === "capture" && (
        <Frame onClose={() => setMode(null)}>
          <Capture author={you} onSaved={saveRecording} onClose={() => setMode(null)} onUpload={() => setMode("upload")} />
        </Frame>
      )}
      {mode === "upload" && (
        <Frame onClose={() => setMode(null)}>
          <Upload onClose={() => setMode(null)} onUploaded={(u) => setUploads((list) => [{ ...list.find((x) => x.id === u.id), ...u } as UploadRow, ...list.filter((x) => x.id !== u.id)])} onCut={() => void loadFeed().then(applyFeed)} />
        </Frame>
      )}
      {mode === "generate" && (
        <Frame onClose={() => setMode(null)}>
          <Generate
            signedIn={signedIn}
            onClose={() => setMode(null)}
            onPosted={(clip) => {
              setMine((m) => [clip, ...m.filter((c) => c.id !== clip.id)])
              pendingId.current = clip.id
            }}
          />
        </Frame>
      )}
      {mode === "gate" && (
        <Frame onClose={() => setMode(null)}>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background p-8 text-center">
            <CameraIcon className="size-8 text-muted-foreground" />
            <p className="text-base font-medium">Sign in to take part</p>
            <p className="text-sm text-muted-foreground">Recording, clipping, liking and commenting are yours once you're signed in. What you record is private until you publish it.</p>
            <Button render={<Link href="/sign-in" />}>Sign in</Button>
            <Button variant="ghost" size="sm" onClick={() => setMode(null)}>
              Not now
            </Button>
          </div>
        </Frame>
      )}
    </div>
  )
}

function Empty({ icon, text, children }: { icon: React.ReactNode; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-20 text-center text-muted-foreground">
      {icon}
      <p className="text-sm">{text}</p>
      {children}
    </div>
  )
}
