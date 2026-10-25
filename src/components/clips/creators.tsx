"use client"

import * as React from "react"
import Link from "next/link"
import { CameraIcon, FileTextIcon, FilmIcon, LayoutGridIcon, LayoutTemplateIcon, PlayIcon, ScissorsIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@govblock/ui/components/nova/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@govblock/ui/components/nova/select"
import { Button } from "@govblock/ui/components/nova/button"
import { cn } from "@govblock/ui/lib/utils"

import type { Creator } from "./store"

// The left rail: who is making clips. All clips first, then each creator
// with a count, then the reader's own library when they are signed in.
// Picking one narrows the feed and the grid to them.

export type CreatorRow = Creator & { count: number }

export type ClipRow = { id: string; title: string; sub: string; poster?: string | null }

export type PartnerRow = { id: string; name: string; count: number }

export function Creators({ clips, partners, activeId, onOpenClip, selected, onSelect, you, onRecord, onUpload, onGenerate, className }: { clips: ClipRow[]; partners: PartnerRow[]; activeId: string | null; onOpenClip: (id: string) => void; selected: string; onSelect: (id: string) => void; you: CreatorRow | null; onRecord: () => void; onUpload?: () => void; onGenerate?: () => void; className?: string }) {
  const Item = ({ id, name, sub, image, fallback }: { id: string; name: string; sub: string; image?: string | null; fallback: React.ReactNode }) => (
    <button type="button" onClick={() => onSelect(id)} className={cn("flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent", selected === id && "bg-accent")}>
      <Avatar className="size-9">
        {image && <AvatarImage src={image} alt="" className="object-cover" />}
        <AvatarFallback className="bg-muted text-xs">{fallback}</AvatarFallback>
      </Avatar>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{name}</span>
        <span className="truncate text-xs text-muted-foreground">{sub}</span>
      </span>
    </button>
  )
  const current = partners.find((x) => x.id === selected) ?? partners[0]
  return (
    <div className={cn("flex h-full flex-col", className)}>
      {/* h-14: the center toolbar's row, so this label sits on the "46 clips" line and the first row lands at the grid's top. */}
      <p className="flex h-14 items-center px-2 text-xs font-medium text-muted-foreground">Partners</p>
      <div className="flex flex-col gap-0.5">
        {/* The context switcher: whose shelf the page shows (Brendan, 2026-10-25). */}
        <Select value={selected} onValueChange={(v) => v && onSelect(String(v))}>
          <SelectTrigger className="h-auto w-full justify-start gap-3 rounded-lg border-0 bg-accent px-2 py-2 shadow-none" aria-label="Partner">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-background"><LayoutGridIcon className="size-4" /></span>
            <span className="flex min-w-0 flex-1 flex-col text-left">
              <span className="truncate text-sm font-medium">{current?.name}</span>
              <span className="truncate text-xs text-muted-foreground">{current?.count} clips</span>
            </span>
          </SelectTrigger>
          <SelectContent className="w-(--anchor-width) min-w-44">
            {partners.map((x) => (
              <SelectItem key={x.id} value={x.id} className="whitespace-nowrap">
                {x.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {/* One row per video: pressing one brings the single-video view into focus. */}
        {clips.map((c) => (
          <button key={c.id} type="button" onClick={() => onOpenClip(c.id)} className={cn("group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent", activeId === c.id && "bg-accent")}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#dc2626] bg-white text-[#dc2626] transition-colors group-hover:bg-[#dc2626] group-hover:text-white">
              <PlayIcon className="size-4" fill="currentColor" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium">{c.title}</span>
              <span className="truncate text-xs text-muted-foreground">{c.sub}</span>
            </span>
          </button>
        ))}
        {you && (
          <>
            <p className="px-2 pt-4 pb-2 text-xs font-medium text-muted-foreground">You</p>
            <Item id="you" name={you.name} sub={`Your library · ${you.count}`} image={you.image} fallback={you.name.slice(0, 1)} />
          </>
        )}
      </div>
      <div className="mt-auto flex flex-col gap-2 pt-4">
        <Button className="w-full gap-1.5" onClick={onRecord}>
          <CameraIcon className="size-4" /> Record
        </Button>
        <div className="grid grid-cols-2 gap-2">
          {onUpload && (
            <Button variant="outline" className="gap-1.5" onClick={onUpload}>
              <ScissorsIcon className="size-4" /> Clip
            </Button>
          )}
          {onGenerate && (
            <Button variant="outline" className="gap-1.5" onClick={onGenerate}>
              <FilmIcon className="size-4" /> Generate
            </Button>
          )}
          <Button variant="outline" className="gap-1.5" render={<Link href="/clips/transcript" />} nativeButton={false}>
            <FileTextIcon className="size-4" /> Transcript
          </Button>
          <Button variant="outline" className="gap-1.5" render={<Link href="/clips/studio" />} nativeButton={false}>
            <LayoutTemplateIcon className="size-4" /> Studio
          </Button>
        </div>
      </div>
    </div>
  )
}
