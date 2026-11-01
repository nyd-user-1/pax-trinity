"use client"

import * as React from "react"
import { Player } from "@remotion/player"
import { ChevronLeftIcon } from "lucide-react"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@govblock/ui/components/nova/dialog"
import { cn } from "@govblock/ui/lib/utils"
import { useShellPanel } from "@/components/shell"
import { GetMp4 } from "@/components/video/get-mp4"
import { TemplatePlayer } from "@/components/video/TemplatePlayer"
import { whiteButton } from "@/components/white-button"
import { Skeleton } from "@/ui/components/nova/skeleton"
import { getTemplate, validate } from "@/video/registry"
import { overTake } from "@/lib/clips/template-pair"
import { YES_ON_3_FAMILY } from "@/video/specs"

// A recording in a Yes on 3 template (docs/briefs/record-template-flow.md). After a take is kept, and on
// /clips for a clip that plays from a file, two of the four templates are offered over the take, the pair
// drawn by /api/clips/template-pair (lib/clips/template-pair.ts), which writes the offer once per recording
// and each pick. Each choice plays live with the take under it; picking one opens it in the Player, with
// Get MP4 for anyone signed in (the render route's gate, Brendan 2026-11-01). Nothing waits on it: the take
// is kept before it opens, and closing it is the skip.

export type Take = { id: string; src: string; seconds?: number | null }
export type From = "record" | "rail" | "menu"
export { overTake }


const post = (body: Record<string, unknown>) => fetch("/api/clips/template-pair", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })

// One offer per recording per page load, however often its chooser or its rail draws.
const offers = new Map<string, Promise<string[] | null>>()

/** The recording's pair: undefined until it arrives, null when it cannot be had (signed out, offline). */
export function useTemplatePair(recording: string | null, from: From): string[] | null | undefined {
  const [shown, setShown] = React.useState<string[] | null | undefined>(undefined)
  React.useEffect(() => {
    if (!recording) return
    let live = true
    let p = offers.get(recording)
    if (!p) {
      p = post({ recording, from })
        .then((r) => (r.ok ? (r.json() as Promise<{ shown?: unknown }>) : null))
        .then((d) => (Array.isArray(d?.shown) ? (d.shown as string[]) : null))
        .catch(() => null)
      offers.set(recording, p)
      void p.then((s) => s || offers.delete(recording))
    }
    void p.then((s) => {
      if (live) setShown(s)
    })
    return () => {
      live = false
    }
  }, [recording, from])
  return shown
}

/** A pick, written to the ledger; the page never waits on it. */
export const logPick = (recording: string, shown: readonly string[], picked: string, from: From) => void post({ recording, from, shown, picked }).catch(() => {})

/** A template over the take, drawn small: live (muted, looping) when two are shown, held on a frame when four are. */
export function TemplateThumb({ templateId, props, live = true, onPick, className }: { templateId: string; props: Record<string, unknown>; live?: boolean; onPick: () => void; className?: string }) {
  const t = getTemplate(templateId)
  const v = React.useMemo(() => validate(templateId, props), [templateId, props])
  if (!t || !v.ok) return null
  return (
    <button type="button" onClick={onPick} title={t.name} aria-label={t.name} className={cn("relative block w-full overflow-hidden rounded-xl bg-black ring-1 ring-slate-200 transition-shadow hover:ring-2 hover:ring-pax2-blue", className)}>
      <Player
        component={t.component}
        inputProps={v.props as Record<string, unknown>}
        durationInFrames={v.durationInFrames}
        fps={t.fps}
        compositionWidth={t.width}
        compositionHeight={t.height}
        autoPlay={live}
        loop={live}
        initiallyMuted
        controls={false}
        clickToPlay={false}
        // Held, a template shows itself a second and a half in: the lower third is in, the hook is up.
        initialFrame={Math.min(Math.round(1.5 * t.fps), v.durationInFrames - 1)}
        style={{ width: "100%", aspectRatio: `${t.width} / ${t.height}` }}
      />
      {/* The Player keeps its own pointer events; the press is the button's. */}
      <span className="absolute inset-0" />
    </button>
  )
}

/** The choices, then the picked one in the Player. `shown` given (the menu's four) skips the pair;
 *  `picked` given (a rail thumbnail) opens on it and writes its pick. */
export function TemplateChoices({ take, from, shown: given, picked: handed }: { take: Take; from: From; shown?: readonly string[]; picked?: string }) {
  const { signedIn } = useShellPanel()
  const pair = useTemplatePair(given ? null : take.id, from)
  const shown = given ?? pair
  const [picked, setPicked] = React.useState<string | null>(handed ?? null)
  const wrote = React.useRef(false)
  React.useEffect(() => {
    if (!handed || !shown || wrote.current) return
    wrote.current = true
    logPick(take.id, shown, handed, from)
  }, [handed, shown, take.id, from])

  const pick = (id: string) => {
    setPicked(id)
    if (shown) logPick(take.id, shown, id, from)
  }

  if (picked) {
    const props = overTake(picked, take)
    return (
      <div className="flex flex-col gap-3">
        <TemplatePlayer templateId={picked} props={props} />
        <div className="mx-auto flex w-full max-w-[360px] items-center justify-between gap-2">
          {shown && shown.length > 1 ? (
            <button type="button" onClick={() => setPicked(null)} className={whiteButton("md", "px-4 py-1.5")}>
              <ChevronLeftIcon className="size-4" />
              Back
            </button>
          ) : (
            <span />
          )}
          {signedIn && <GetMp4 templateId={picked} props={props} />}
        </div>
      </div>
    )
  }

  if (shown === null) return <p className="text-sm text-muted-foreground">I couldn&apos;t load the templates.</p>
  const four = (shown?.length ?? 2) > 2
  return (
    <div className={cn("grid gap-3", four ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2")}>
      {shown
        ? shown.map((id) => <TemplateThumb key={id} templateId={id} props={overTake(id, take)} live={!four} onPick={() => pick(id)} />)
        : [0, 1].map((i) => <Skeleton key={i} className="aspect-[9/16] w-full rounded-xl" />)}
    </div>
  )
}

/** The /clips rail's two slots for a clip that plays from a file: its pair, small and held on a frame, drawn
 *  over a plain field (the clip already plays beside them). The offer is asked for when the clip is the one in
 *  view; the thumbnails draw only while it is near, so a long scroll does not pile up players. A press opens
 *  the chooser on that template. Nothing shows when the pair cannot be had. */
export function RailTemplates({ clip, active, near, onPick }: { clip: { id: string; src: string; duration?: number }; active: boolean; near: boolean; onPick: (pick: { shown: string[]; picked: string }) => void }) {
  const shown = useTemplatePair(active ? clip.id : null, "rail")
  if (shown === null) return null
  return (
    <>
      {[0, 1].map((i) => {
        const id = near ? shown?.[i] : undefined
        return id && shown ? (
          <TemplateThumb key={id} templateId={id} props={overTake(id, { src: clip.src, seconds: clip.duration }, false)} live={false} onPick={() => onPick({ shown, picked: id })} className="w-10 rounded-lg ring-white/40 lg:ring-slate-200" />
        ) : (
          <span key={i} className="block aspect-[9/16] w-10 rounded-lg bg-white/15 lg:bg-muted" />
        )
      })}
    </>
  )
}

/** The choices in a dialog: after Clips' Record keeps a take, from a rail thumbnail, or from the clip menu. */
export function TemplateChooser({ take, from, shown, picked, onClose }: { take: Take; from: From; shown?: readonly string[]; picked?: string; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn(shown && shown.length > 2 && !picked ? "sm:max-w-2xl" : "sm:max-w-md")}>
        <DialogHeader>
          <DialogTitle>Choose a template</DialogTitle>
        </DialogHeader>
        <TemplateChoices take={take} from={from} shown={shown} picked={picked} />
      </DialogContent>
    </Dialog>
  )
}

/** The menu's list: every template in the family. */
export const ALL_TEMPLATES: readonly string[] = YES_ON_3_FAMILY
