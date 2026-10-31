"use client"

import * as React from "react"

// Drawn notes (Brendan, 2026-10-31): Shift and a drag anywhere draws a note's card (components/notes/draw-notes.tsx);
// it keeps itself as one of the reader's own notes (app/note-actions.ts), listed in the Inbox under My notes.

/** Told when a drawn note is kept or deleted, so My notes reads again. */
export const NOTES_CHANGED = "pax2-notes-changed"
/** Asks the shell to open a kept note as a card. */
export const NOTE_OPEN = "pax2-note-open"

export function openDrawnNote(id: string) {
  window.dispatchEvent(new CustomEvent(NOTE_OPEN, { detail: { id } }))
}

// The notes starred from a note's menu, kept in this browser as the sidebar's favorites are (lib/nav-favorites.ts):
// My notes lists them first.
const FAV_KEY = "pax2-note-favorites"
const FAV_EVENT = "pax2-note-favorites"
const readFavs = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]") as string[]
  } catch {
    return []
  }
}

export function useNoteFavorites() {
  const [favs, setFavs] = React.useState<string[]>([])
  React.useEffect(() => {
    const on = () => setFavs(readFavs())
    on()
    window.addEventListener(FAV_EVENT, on)
    window.addEventListener("storage", on)
    return () => {
      window.removeEventListener(FAV_EVENT, on)
      window.removeEventListener("storage", on)
    }
  }, [])
  const toggle = React.useCallback((id: string) => {
    const now = readFavs()
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(now.includes(id) ? now.filter((x) => x !== id) : [...now, id]))
    } catch {}
    window.dispatchEvent(new Event(FAV_EVENT))
  }, [])
  return { favs, toggle }
}
