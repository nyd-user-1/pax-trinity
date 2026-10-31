"use client"

// Drawn notes (Brendan, 2026-10-31): Shift and a drag anywhere draws a note's card (components/notes/draw-notes.tsx);
// it keeps itself as one of the reader's own notes (app/note-actions.ts), listed in the Inbox under My notes.

/** Told when a drawn note is kept or deleted, so My notes reads again. */
export const NOTES_CHANGED = "pax2-notes-changed"
/** Asks the shell to open a kept note as a card. */
export const NOTE_OPEN = "pax2-note-open"

export function openDrawnNote(id: string) {
  window.dispatchEvent(new CustomEvent(NOTE_OPEN, { detail: { id } }))
}
