"use client"

import * as React from "react"
import { BanIcon, CodeIcon, ExternalLinkIcon, FlagIcon, LayoutTemplateIcon, LinkIcon, Share2Icon, StickyNoteIcon, Trash2Icon } from "lucide-react"

import { itemOf, useBasket } from "@/lib/note-basket"
import { clipCollect } from "@/lib/note-collect"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@govblock/ui/components/nova/dropdown-menu"

import type { Clip } from "./store"

// Instagram's "…" on a reel: Go to post, Share to…, Copy link, Embed. The
// post's address is the page with the clip's id, so the link and the embed
// both land on the clip itself.

export const clipUrl = (clip: Clip) => `${typeof window === "undefined" ? "" : window.location.origin}/clips?c=${encodeURIComponent(clip.id)}`

// `onDelete` is only handed over for a clip of the reader's own (Brendan,
// 2026-09-11); a published clip has no such row. Report is on every clip
// that is not the reader's, and Take down on a clip in Aurora for an admin
// (brief 2026-09-14: no upload before both exist). Apply a template is on a clip that plays from a file
// (template-chooser.tsx): all four Yes on 3 templates over it.
export function ClipMenu({ clip, onGoToPost, onDelete, onReport, onTakeDown, onApplyTemplate, children }: { clip: Clip; onGoToPost: () => void; onDelete?: () => void; onReport?: () => void; onTakeDown?: () => void; onApplyTemplate?: () => void; children: React.ReactElement }) {
  const copy = (text: string) => void navigator.clipboard?.writeText(text)
  // While a note collects (Brendan, 2026-11-02), the clip goes into its basket by its address.
  const basket = useBasket()
  const gather = clipCollect(clip)
  const noteKey = gather.key!
  const inNote = basket.has(noteKey)
  const share = async () => {
    const url = clipUrl(clip)
    if (navigator.share) {
      try {
        await navigator.share({ title: clip.title, text: clip.caption, url })
        return
      } catch {}
    }
    copy(url)
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={children} />
      <DropdownMenuContent align="end" className="w-max min-w-44">
        <DropdownMenuItem className="whitespace-nowrap" onClick={onGoToPost}>
          <ExternalLinkIcon /> Go to post
        </DropdownMenuItem>
        <DropdownMenuItem className="whitespace-nowrap" onClick={() => void share()}>
          <Share2Icon /> Share to…
        </DropdownMenuItem>
        <DropdownMenuItem className="whitespace-nowrap" onClick={() => copy(clipUrl(clip))}>
          <LinkIcon /> Copy link
        </DropdownMenuItem>
        {basket.open && (
          <DropdownMenuItem
            className="whitespace-nowrap"
            onClick={() => (inNote ? basket.remove(noteKey) : basket.add(itemOf(gather, "")))}
          >
            <StickyNoteIcon /> {inNote ? "Remove from the note" : "Add to the note"}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem className="whitespace-nowrap" onClick={() => copy(`<iframe src="${clipUrl(clip)}&embed=1" width="360" height="640" style="border:0;border-radius:12px" allow="autoplay; fullscreen"></iframe>`)}>
          <CodeIcon /> Embed
        </DropdownMenuItem>
        {onApplyTemplate && (
          <DropdownMenuItem className="whitespace-nowrap" onClick={onApplyTemplate}>
            <LayoutTemplateIcon /> Apply a template…
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem variant="destructive" className="whitespace-nowrap" onClick={onDelete}>
            <Trash2Icon /> Delete
          </DropdownMenuItem>
        )}
        {(onReport || onTakeDown) && <DropdownMenuSeparator />}
        {onReport && (
          <DropdownMenuItem className="whitespace-nowrap" onClick={onReport}>
            <FlagIcon /> Report
          </DropdownMenuItem>
        )}
        {onTakeDown && (
          <DropdownMenuItem variant="destructive" className="whitespace-nowrap" onClick={onTakeDown}>
            <BanIcon /> Take down
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
