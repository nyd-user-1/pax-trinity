"use client"

import * as React from "react"
import { Check, X } from "lucide-react"

import { Block, FIELD, SMALL_PRIMARY } from "@/components/settings/blocks"
import type { Todo } from "@/lib/todos"
import { cn } from "@/ui/lib/utils"

import { addTodoAction, removeTodoAction, toggleTodoAction } from "./todo-actions"

/** The admins' to-do list (Brendan, 2026-11-02): each row its tick, its text and its remove; a field to add one. The
 *  rows change at once and the server's list follows (lib/todos.ts, in the ledger). */
export function Todos({ initial }: { initial: Todo[] }) {
  const [items, setItems] = React.useState(initial)
  React.useEffect(() => setItems(initial), [initial])
  const [text, setText] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const [pending, start] = React.useTransition()
  const run = (fn: () => Promise<{ error?: string }>, undo: () => void) =>
    start(async () => {
      const r = await fn()
      if (r.error) {
        setError(r.error)
        undo()
      } else setError(null)
    })

  const toggle = (t: Todo) => {
    setItems((xs) => xs.map((x) => (x.id === t.id ? { ...x, done: !t.done } : x)))
    run(() => toggleTodoAction(t.id, !t.done), () => setItems((xs) => xs.map((x) => (x.id === t.id ? { ...x, done: t.done } : x))))
  }
  const drop = (t: Todo) => {
    setItems((xs) => xs.filter((x) => x.id !== t.id))
    run(() => removeTodoAction(t.id), () => setItems((xs) => [...xs, t].sort((a, b) => a.createdAt.localeCompare(b.createdAt))))
  }
  const add = () => {
    const t = text.trim()
    if (!t) return
    setText("")
    run(() => addTodoAction(t), () => setText(t))
  }

  return (
    <Block title="To-do">
      {items.map((t) => (
        <div key={t.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
          <button
            type="button"
            role="checkbox"
            aria-checked={t.done}
            aria-label={t.done ? `Mark “${t.text}” not done` : `Mark “${t.text}” done`}
            onClick={() => toggle(t)}
            className={cn("flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors", t.done ? "border-pax2-blue bg-pax2-blue text-white" : "border-slate-300 bg-pax2-surface hover:border-pax2-blue")}
          >
            {t.done && <Check className="size-3.5" strokeWidth={3} />}
          </button>
          <span className={cn("min-w-0 flex-1 text-sm", t.done ? "text-slate-400 line-through" : "text-slate-900")}>{t.text}</span>
          <button type="button" aria-label={`Remove “${t.text}”`} title="Remove" onClick={() => drop(t)} className="flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
            <X className="size-4" />
          </button>
        </div>
      ))}
      <form
        className="flex items-center gap-2 px-4 py-3 sm:px-5"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={200} placeholder="Add a to-do" aria-label="Add a to-do" className={cn(FIELD, "h-9 min-w-0 flex-1 px-3 outline-none placeholder:text-slate-400")} />
        <button type="submit" disabled={pending || !text.trim()} className={cn(SMALL_PRIMARY, "disabled:opacity-40")}>
          Add
        </button>
      </form>
      {error && <p className="px-4 py-2.5 text-[13px] text-pax2-red sm:px-5">{error}</p>}
    </Block>
  )
}
