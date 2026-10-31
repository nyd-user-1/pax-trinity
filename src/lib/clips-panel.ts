import * as React from "react"

import type { Clip, Comment } from "@/components/clips/catalog"

// What /clips hands the shell's right panel (Brendan, 2026-10-31): the Edit Panel and the Report Panel left
// the page for Tools' Edits and Reports, which live in the shell, outside the page's tree. The page publishes
// the clip playing and the thread's handlers here; the panel's views read them. Off /clips nothing is
// published, and the views say so.

export type ClipsPanel = {
  clip: Clip | null
  comments: Comment[]
  signedIn: boolean
  likedComments: Set<string>
  /** Bumped to put the cursor in the composer (a clip's comment button). */
  focusKey: number
  onPost: (text: string) => void
  onLikeComment: (id: string) => void
  /** Plays a clip on the page: a report opened from Reports while /clips is open. */
  onOpen: (id: string) => void
}

let current: ClipsPanel | null = null
const subs = new Set<() => void>()

export function publishClipsPanel(next: ClipsPanel | null) {
  current = next
  subs.forEach((f) => f())
}

export function useClipsPanel(): ClipsPanel | null {
  return React.useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    () => current,
    () => null,
  )
}

/** Opens the right panel on one of Tools' views (the shell and the panel listen), now or as the panel mounts. */
export const TOOLS_OPEN = "tools:open"
export type ToolsView = "edits" | "reports"
let pending: ToolsView | null = null
export function openTools(view: ToolsView) {
  pending = view
  window.dispatchEvent(new Event(TOOLS_OPEN))
}
export function takeTools(): ToolsView | null {
  const v = pending
  pending = null
  return v
}
