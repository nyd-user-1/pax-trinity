"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { Copy, EllipsisVertical, GripVertical, Trash2, X } from "lucide-react"

import { createMyNote, removeNote, saveNote } from "@/app/note-actions"
import { KebabMenu, MenuFoot, MenuRow, MenuSeparator } from "@/components/kebab-menu"
import { NOTES_CHANGED } from "@/lib/drawn-notes"
import { TaskSurface, TaskToolbar, useTaskEditor } from "@/registry/blocks/sidebar-09/components/rich-body"

// A drawn note (Brendan, 2026-10-31): the card a Shift-drag draws (draw-notes.tsx), where it was drawn and as large,
// in the model card's shape as Nav is: the tinted frame titled Note, the inbox rows' grip before it and the three-dot
// menu opposite, and in the white card the Agentic Inbox compose's editor (TipTap, markdown in and out) under its
// toolbar. It keeps itself once there is something in it, 700ms after the last keystroke, as one of the reader's
// own notes, the Inbox's My notes.

export type Rect = { x: number; y: number; w: number; h: number }

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })

export function FloatingNote({ rect, id: firstId, body: firstBody, onClose }: { rect: Rect; id: string | null; body: string; onClose: () => void }) {
  const [body, setBody] = React.useState(firstBody)
  const [saved, setSaved] = React.useState<string | null>(null)
  // The last save failed: the next keystroke tries again.
  const [failed, setFailed] = React.useState(false)
  const [pos, setPos] = React.useState({ left: rect.x, top: rect.y })
  const editor = useTaskEditor({ value: firstBody, onChange: setBody, placeholder: "Write a note…" })
  React.useEffect(() => {
    editor?.commands.focus("end")
  }, [editor])

  // Saves run one after another, so the first one's id is there for the next.
  const id = React.useRef(firstId)
  const chain = React.useRef<Promise<void>>(Promise.resolve())
  const kept = React.useRef(firstBody)
  const latest = React.useRef(firstBody)
  latest.current = body
  const save = React.useCallback(() => {
    chain.current = chain.current.then(async () => {
      const md = latest.current
      if (md === kept.current) return
      try {
        const note = id.current ? await saveNote(id.current, md) : await createMyNote(md)
        if (!note) return
        id.current = note.id
        kept.current = md
        setSaved(note.updatedAt)
        setFailed(false)
        window.dispatchEvent(new Event(NOTES_CHANGED))
      } catch {
        setFailed(true)
      }
    })
    return chain.current
  }, [])
  React.useEffect(() => {
    if (body === kept.current) return
    const t = window.setTimeout(save, 700)
    return () => window.clearTimeout(t)
  }, [body, save])
  // Closing keeps what was typed since the last save.
  const close = () => void save().finally(onClose)

  // The grip moves the card, held inside the window.
  const box = React.useRef<HTMLDivElement>(null)
  const drag = React.useRef<{ dx: number; dy: number } | null>(null)
  const grip = {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      drag.current = { dx: e.clientX - pos.left, dy: e.clientY - pos.top }
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!drag.current) return
      setPos({ left: Math.max(8, Math.min(e.clientX - drag.current.dx, window.innerWidth - rect.w - 8)), top: Math.max(8, Math.min(e.clientY - drag.current.dy, window.innerHeight - rect.h - 8)) })
    },
    onPointerUp: () => void (drag.current = null),
  }

  return createPortal(
    <div
      ref={box}
      data-note
      role="dialog"
      aria-label="Note"
      style={{ left: pos.left, top: pos.top, width: rect.w, height: rect.h }}
      className="fixed z-[55] flex flex-col rounded-[18px] border border-slate-200 bg-slate-50 p-1 shadow-e3"
    >
      <div className="flex shrink-0 items-center gap-1.5 pt-1.5 pr-1.5 pb-2 pl-2">
        <span {...grip} aria-label="Move" title="Move" className="flex size-6 shrink-0 cursor-grab touch-none items-center justify-center text-slate-400 active:cursor-grabbing">
          <GripVertical className="size-4" />
        </span>
        <h3 className="min-w-0 flex-1 text-[15px] font-semibold text-slate-900">Note</h3>
        <KebabMenu label="Note options" width="w-52" trigger={<EllipsisVertical className="size-4" />} triggerClassName="inline-flex size-8 items-center justify-center rounded-md text-slate-800 outline-none hover:bg-foreground/8 hover:text-foreground aria-expanded:bg-foreground/8">
          <MenuRow icon={<Copy />} label="Copy as Markdown" onClick={() => void navigator.clipboard.writeText(body)} />
          <MenuRow
            icon={<Trash2 />}
            label="Delete note"
            danger
            onClick={async () => {
              if (id.current) await removeNote(id.current)
              window.dispatchEvent(new Event(NOTES_CHANGED))
              onClose()
            }}
          />
          <MenuSeparator />
          <MenuRow icon={<X />} label="Close" onClick={close} />
          <MenuSeparator />
          <MenuFoot title="My notes" sub={failed ? "Not saved: the notes store can't be reached" : saved ? `Saved ${time(saved)}` : id.current ? "Kept" : "Kept once you write"} />
        </KebabMenu>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[14px] border border-slate-200 bg-pax2-surface shadow-e1">
        <TaskToolbar editor={editor} className="shrink-0 border-b border-slate-200 px-2 py-1" />
        <div className="min-h-0 flex-1 cursor-text overflow-y-auto px-4 py-3" onClick={() => editor?.commands.focus()}>
          <TaskSurface editor={editor} className="min-h-full [&_.ProseMirror]:min-h-full" />
        </div>
      </div>
    </div>,
    document.body,
  )
}
