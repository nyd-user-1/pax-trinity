"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Archive, Check, Copy, Crosshair, ImagePlus, Loader2, MapPin, Pencil, RotateCcw, SendHorizontal, SquareTerminal, X } from "lucide-react"

import { cn } from "@/ui/lib/utils"
import { goToComment, HOUSEKEEPING_CHANGED, HOUSEKEEPING_OPEN, shrink, takeFocus, togglePointer } from "./tool"

// Housekeeping in the right panel (Brendan, 2026-10-30): a chat stream. "Everyone" is the stream
// every admin reads and writes, pointed comments included; each other person opens a one-to-one
// thread. The list holds what is open; resolving moves a message to the archive (the box icon),
// where reopening brings it back. A pointed comment's pin opens its page with its element outlined.
// The super admin alone resolves, reopens and edits, and sees beside each message the prompt that
// would address it (the terminal icon), or "Prompt unavailable" where no change could be read.
// Screenshots attach by paste, drop or the image button.

const PROMPT_UNAVAILABLE = "Prompt unavailable"

type Person = { email: string; name: string; role: string; photo?: string }
type Message = {
  pk: string
  sk: string
  id: string
  author: string
  authorName: string
  text: string
  kind: "comment" | "message"
  route?: string
  target?: string
  path?: string
  images?: string[]
  status: "open" | "resolved"
  resolvedBy?: string
  editedAt?: string
  createdAt: string
  prompt?: string
}
type Thread = { me: { email: string; superAdmin: boolean }; people: Person[]; messages: Message[] }

const when = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

/** A textarea as tall as its text. */
function grow(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = "auto"
  el.style.height = `${el.scrollHeight + 2}px`
}

export function HousekeepingView() {
  const router = useRouter()
  const [withEmail, setWith] = React.useState<string | null>(null)
  const [archive, setArchive] = React.useState(false)
  const [thread, setThread] = React.useState<Thread | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [text, setText] = React.useState("")
  const [shots, setShots] = React.useState<{ mime: string; data: string }[]>([])
  const [sending, setSending] = React.useState(false)
  const [editing, setEditing] = React.useState<{ id: string; field: "text" | "prompt"; text: string } | null>(null)
  // Messages showing their prompt in place of their text, and prompts being written.
  const [showing, setShowing] = React.useState<Set<string>>(new Set())
  const [writing, setWriting] = React.useState<Set<string>>(new Set())
  const [focus, setFocus] = React.useState<string | null>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const load = React.useCallback(async () => {
    const res = await fetch(`/api/housekeeping${withEmail ? `?with=${encodeURIComponent(withEmail)}` : ""}`, { cache: "no-store" })
    const body = await res.json().catch(() => ({ error: "Housekeeping did not answer." }))
    if (!res.ok) return setError(body.error ?? "Housekeeping did not load.")
    setError(null)
    setThread(body as Thread)
  }, [withEmail])

  React.useEffect(() => {
    setThread(null)
    void load()
    const t = window.setInterval(() => void load(), 15000)
    const changed = () => void load()
    window.addEventListener(HOUSEKEEPING_CHANGED, changed)
    return () => {
      window.clearInterval(t)
      window.removeEventListener(HOUSEKEEPING_CHANGED, changed)
    }
  }, [load])

  // A comment just sent, or a page marker pressed: the stream, with that message in view.
  React.useEffect(() => {
    const take = () => {
      const id = takeFocus()
      if (!id) return
      setWith(null)
      setArchive(false)
      setFocus(id)
    }
    take()
    window.addEventListener(HOUSEKEEPING_OPEN, take)
    return () => window.removeEventListener(HOUSEKEEPING_OPEN, take)
  }, [])

  const list = (thread?.messages ?? []).filter((m) => (archive ? m.status === "resolved" : m.status !== "resolved"))

  // The newest message in view whenever the list grows, or the focused one once it has arrived.
  const count = list.length
  React.useEffect(() => {
    if (focus) {
      const el = listRef.current?.querySelector(`[data-message="${focus}"]`)
      if (!el) return
      el.scrollIntoView({ block: "center", behavior: "smooth" })
      const t = window.setTimeout(() => setFocus(null), 2400)
      return () => window.clearTimeout(t)
    }
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [count, withEmail, archive, focus])

  const addFiles = async (files: FileList | File[]) => {
    const images = [...files].filter((f) => f.type.startsWith("image/")).slice(0, 4 - shots.length)
    const read = await Promise.all(
      images.map(
        (f) =>
          new Promise<{ mime: string; data: string }>((resolve) => {
            const r = new FileReader()
            r.onload = () => resolve({ mime: f.type, data: String(r.result) })
            r.readAsDataURL(f)
          }),
      ),
    )
    setShots((prev) => [...prev, ...read].slice(0, 4))
  }

  const send = async () => {
    if (sending || (!text.trim() && !shots.length)) return
    setSending(true)
    const images = await Promise.all(shots.map(shrink))
    const res = await fetch("/api/housekeeping", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "message", text, to: withEmail, images }) })
    setSending(false)
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "That did not send.")
    setText("")
    setShots([])
    setArchive(false)
    await load()
  }

  const change = async (m: Message, patch: { status?: "open" | "resolved"; text?: string; prompt?: string }) => {
    const res = await fetch("/api/housekeeping", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pk: m.pk, sk: m.sk, ...patch }) })
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "That did not save.")
    setEditing(null)
    await load()
  }

  /** Shows a message's prompt in place of its text (or its text again), writing it first if none is stored. */
  const togglePrompt = async (m: Message) => {
    const next = new Set(showing)
    if (next.has(m.id)) next.delete(m.id)
    else next.add(m.id)
    setShowing(next)
    if (!next.has(m.id) || m.prompt || writing.has(m.id)) return
    setWriting((w) => new Set(w).add(m.id))
    const res = await fetch("/api/housekeeping/prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pk: m.pk, sk: m.sk }) })
    setWriting((w) => {
      const n = new Set(w)
      n.delete(m.id)
      return n
    })
    if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "The prompt was not written.")
    await load()
  }

  const me = thread?.me
  const people = thread?.people ?? []
  const others = people.filter((p) => p.email !== me?.email)
  const partner = others.find((p) => p.email === withEmail)
  const photoOf = (email: string) => people.find((p) => p.email === email)?.photo

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The threads: everyone's stream, then one-to-one with each person; the pointer and the archive at the right. */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 px-5 pb-3">
        <ThreadChip on={!withEmail} onClick={() => setWith(null)}>
          Everyone
        </ThreadChip>
        {others.map((p) => (
          <ThreadChip key={p.email} on={withEmail === p.email} onClick={() => setWith(p.email)}>
            {p.name.split(" ")[0]}
          </ThreadChip>
        ))}
        <span className="ml-auto flex gap-1.5">
          <button type="button" onClick={() => void togglePointer()} className="flex size-8 items-center justify-center rounded-full bg-surface text-pax2-blue shadow-e1 transition-colors hover:bg-pax2-lavender" aria-label="Point at something on the page" title="Point at something on the page">
            <Crosshair className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => setArchive((a) => !a)}
            aria-pressed={archive}
            className={cn("flex size-8 items-center justify-center rounded-full shadow-e1 transition-colors", archive ? "bg-pax2-blue text-white" : "bg-surface text-pax2-blue hover:bg-pax2-lavender")}
            aria-label={archive ? "Back to open messages" : "Archive: resolved messages"}
            title={archive ? "Back to open messages" : "Archive: resolved messages"}
          >
            <Archive className="size-4" />
          </button>
        </span>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto border-t border-slate-200/70 px-5 py-4">
        {archive && <p className="mb-3 text-xs font-semibold tracking-wide text-slate-500 uppercase">Archive</p>}
        {error && <p className="mb-3 rounded-lg bg-surface px-3 py-2 text-xs text-pax2-red shadow-e1">{error}</p>}
        {!thread && !error && <Loader2 className="mx-auto mt-6 size-5 animate-spin text-pax2-blue" />}
        {thread && list.length === 0 && (
          <p className="mt-6 text-center text-sm text-slate-500">
            {archive ? "Nothing resolved here yet." : partner ? `No messages with ${partner.name} yet.` : "Nothing open. Point at something on any page, or write below."}
          </p>
        )}
        <div className="flex flex-col gap-4">
          {list.map((m) => {
            const resolved = m.status === "resolved"
            const photo = photoOf(m.author)
            const asPrompt = !!me?.superAdmin && showing.has(m.id)
            const isWriting = writing.has(m.id)
            const shown = asPrompt ? m.prompt : m.text
            return (
              <div key={m.id} data-message={m.id} className={cn("group -mx-2 flex gap-3 rounded-xl px-2 py-1 transition-colors duration-700", focus === m.id && "bg-pax2-lavender")}>
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a 32px headshot from public/
                  <img src={photo} alt="" className="mt-0.5 size-8 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-pax2-blue text-[11px] font-semibold text-white">{initials(m.authorName)}</span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-slate-900">{m.authorName}</span>
                    <span className="text-[11px] text-slate-400">{when(m.createdAt)}</span>
                    {m.editedAt && <span className="text-[11px] text-slate-400">edited</span>}
                    {me?.superAdmin && editing?.id !== m.id && (
                      <span className="ml-auto flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        {asPrompt && m.prompt && m.prompt !== PROMPT_UNAVAILABLE && (
                          <IconAction label="Copy the prompt" onClick={() => void navigator.clipboard.writeText(m.prompt!)}>
                            <Copy className="size-3.5" />
                          </IconAction>
                        )}
                        <IconAction label={resolved ? "Reopen" : "Resolve"} onClick={() => void change(m, { status: resolved ? "open" : "resolved" })}>
                          {resolved ? <RotateCcw className="size-3.5" /> : <Check className="size-3.5" />}
                        </IconAction>
                        {!(asPrompt && !m.prompt) && (
                          <IconAction label={asPrompt ? "Edit the prompt" : "Edit"} onClick={() => setEditing({ id: m.id, field: asPrompt ? "prompt" : "text", text: (asPrompt ? m.prompt : m.text) ?? "" })}>
                            <Pencil className="size-3.5" />
                          </IconAction>
                        )}
                      </span>
                    )}
                  </div>
                  {((m.kind === "comment" && m.route && m.path) || me?.superAdmin) && (
                    <div className="mt-1 flex gap-1.5">
                      {m.kind === "comment" && m.route && m.path && (
                        <Chip label={`Go to the comment on ${m.route}`} onClick={() => goToComment(m.route!, m.path!, m.target, (href) => router.push(href))}>
                          <MapPin className="size-3.5" />
                        </Chip>
                      )}
                      {me?.superAdmin && (
                        <Chip label={asPrompt ? "Show the comment" : "Show the prompt"} on={asPrompt} onClick={() => void togglePrompt(m)}>
                          <SquareTerminal className="size-3.5" />
                        </Chip>
                      )}
                    </div>
                  )}
                  {editing?.id === m.id ? (
                    <div className="mt-1.5">
                      <textarea
                        ref={grow}
                        value={editing.text}
                        onChange={(e) => {
                          setEditing({ ...editing, text: e.target.value })
                          grow(e.target)
                        }}
                        className={cn("w-full resize-y overflow-hidden rounded-lg border border-slate-200 bg-surface p-2 text-sm outline-none focus:border-pax2-light-blue", editing.field === "prompt" && "font-mono text-[12px]")}
                      />
                      <div className="mt-1 flex justify-end gap-2 text-xs">
                        <button type="button" onClick={() => setEditing(null)} className="rounded-md px-2 py-1 text-slate-500 hover:bg-surface">
                          Cancel
                        </button>
                        <button type="button" onClick={() => void change(m, editing.field === "prompt" ? { prompt: editing.text } : { text: editing.text })} className="rounded-md bg-pax2-blue px-2.5 py-1 font-medium text-white">
                          Save
                        </button>
                      </div>
                    </div>
                  ) : asPrompt && !m.prompt ? (
                    <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-slate-500">
                      {isWriting ? <Loader2 className="size-3.5 animate-spin" /> : null}
                      {isWriting ? "Writing the prompt…" : PROMPT_UNAVAILABLE}
                    </p>
                  ) : (
                    shown && (
                      <p
                        className={cn(
                          "mt-1 text-sm whitespace-pre-wrap text-slate-700",
                          resolved && "text-slate-400",
                          asPrompt && "rounded-lg bg-surface px-2.5 py-2 font-mono text-[12px] leading-relaxed shadow-e1",
                          asPrompt && shown === PROMPT_UNAVAILABLE && "font-sans text-slate-400 italic",
                        )}
                      >
                        {shown}
                      </p>
                    )
                  )}
                  {m.images?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.images.map((k) => (
                        <a key={k} href={`/api/housekeeping/image?key=${encodeURIComponent(k)}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-200 bg-surface">
                          {/* eslint-disable-next-line @next/next/no-img-element -- a private screenshot through its signed link */}
                          <img src={`/api/housekeeping/image?key=${encodeURIComponent(k)}`} alt="Screenshot" className="h-24 w-auto max-w-[220px] object-cover" />
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* The composer: to the stream, or to the one person picked above. */}
      <div
        className="shrink-0 px-4 pb-4 pt-2"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          void addFiles(e.dataTransfer.files)
        }}
      >
        <div className="rounded-2xl border border-slate-200 bg-surface px-3 pt-2.5 pb-2 shadow-e1 focus-within:border-pax2-light-blue">
          {shots.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {shots.map((s, i) => (
                <span key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a pasted screenshot before it is sent */}
                  <img src={s.data} alt="" className="h-14 w-auto rounded-md border border-slate-200" />
                  <button type="button" aria-label="Remove" onClick={() => setShots((prev) => prev.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-night-900 text-white">
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              if (e.clipboardData.files.length) {
                e.preventDefault()
                void addFiles(e.clipboardData.files)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void send()
              }
            }}
            rows={2}
            placeholder={partner ? `Message ${partner.name}…` : "Message everyone…"}
            className="w-full resize-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => fileRef.current?.click()} className="flex size-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Attach a screenshot" title="Attach a screenshot">
              <ImagePlus className="size-4" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && void addFiles(e.target.files)} />
            <button type="button" onClick={() => void send()} disabled={sending || (!text.trim() && !shots.length)} className="flex size-8 items-center justify-center rounded-xl bg-pax2-blue text-white disabled:opacity-30" aria-label="Send">
              {sending ? <Loader2 className="size-4 animate-spin" /> : <SendHorizontal className="size-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ThreadChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition-[color,background-color,box-shadow]", on ? "bg-surface text-pax2-blue shadow-e1" : "text-slate-500 hover:bg-surface/70 hover:text-pax2-blue")}
    >
      {children}
    </button>
  )
}

/** An icon-only chip under a message's name: its element, its prompt. */
function Chip({ label, on = false, onClick, children }: { label: string; on?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={on}
      title={label}
      className={cn("flex h-7 w-9 items-center justify-center rounded-lg shadow-e1 transition-colors", on ? "bg-pax2-blue text-white" : "bg-surface text-pax2-blue hover:bg-pax2-lavender")}
    >
      {children}
    </button>
  )
}

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="flex size-6 items-center justify-center rounded-md text-slate-500 hover:bg-surface hover:text-pax2-blue">
      {children}
    </button>
  )
}
