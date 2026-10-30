"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Check, Crosshair, ImagePlus, Loader2, MapPin, Pencil, RotateCcw, SendHorizontal, X } from "lucide-react"

import { cn } from "@/ui/lib/utils"
import { goToComment, HOUSEKEEPING_CHANGED, shrink, togglePointer } from "./tool"

// Housekeeping in the right panel (Brendan, 2026-10-30): a chat stream. "Everyone" is the stream
// every admin reads and writes, pointed comments included; each other person opens a one-to-one
// thread. A pointed comment shows its page and element, and opens them. Only the super admin
// resolves, reopens or edits. Screenshots attach by paste, drop or the image button.

type Person = { email: string; name: string; role: string }
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

export function HousekeepingView() {
  const router = useRouter()
  const [withEmail, setWith] = React.useState<string | null>(null)
  const [thread, setThread] = React.useState<Thread | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [text, setText] = React.useState("")
  const [shots, setShots] = React.useState<{ mime: string; data: string }[]>([])
  const [sending, setSending] = React.useState(false)
  const [editing, setEditing] = React.useState<{ id: string; text: string } | null>(null)
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

  // The newest message in view whenever the thread grows.
  const count = thread?.messages.length ?? 0
  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [count, withEmail])

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
    await load()
  }

  const change = async (m: Message, patch: { status?: "open" | "resolved"; text?: string }) => {
    const res = await fetch("/api/housekeeping", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pk: m.pk, sk: m.sk, ...patch }) })
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error ?? "That did not save.")
    setEditing(null)
    await load()
  }

  const me = thread?.me
  const others = (thread?.people ?? []).filter((p) => p.email !== me?.email)
  const partner = others.find((p) => p.email === withEmail)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* The threads: everyone's stream, then one-to-one with each person. */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 px-5 pb-3">
        <ThreadChip on={!withEmail} onClick={() => setWith(null)}>
          Everyone
        </ThreadChip>
        {others.map((p) => (
          <ThreadChip key={p.email} on={withEmail === p.email} onClick={() => setWith(p.email)}>
            {p.name.split(" ")[0]}
          </ThreadChip>
        ))}
        <button
          type="button"
          onClick={() => void togglePointer()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-pax2-blue shadow-e1 transition-colors hover:bg-pax2-lavender"
          title="Point at something on the page (⌥⇧C)"
        >
          <Crosshair className="size-3.5" />
          Point at something
        </button>
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto border-t border-slate-200/70 px-5 py-4">
        {error && <p className="mb-3 rounded-lg bg-white px-3 py-2 text-xs text-pax2-red shadow-e1">{error}</p>}
        {!thread && !error && <Loader2 className="mx-auto mt-6 size-5 animate-spin text-pax2-blue" />}
        {thread && thread.messages.length === 0 && (
          <p className="mt-6 text-center text-sm text-slate-500">
            {partner ? `No messages with ${partner.name} yet.` : "Nothing yet. Point at something on any page, or write below."}
          </p>
        )}
        <div className="flex flex-col gap-4">
          {thread?.messages.map((m) => {
            const mine = m.author === me?.email
            const resolved = m.status === "resolved"
            return (
              <div key={m.id} className="group flex gap-3">
                <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", mine ? "bg-pax2-blue text-white" : "bg-white text-pax2-blue shadow-e1")}>{initials(m.authorName)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-slate-900">{m.authorName}</span>
                    <span className="text-[11px] text-slate-400">{when(m.createdAt)}</span>
                    {m.editedAt && <span className="text-[11px] text-slate-400">edited</span>}
                    {resolved && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        <Check className="size-3" />
                        Resolved
                      </span>
                    )}
                    {me?.superAdmin && editing?.id !== m.id && (
                      <span className="ml-auto flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <IconAction label={resolved ? "Reopen" : "Resolve"} onClick={() => void change(m, { status: resolved ? "open" : "resolved" })}>
                          {resolved ? <RotateCcw className="size-3.5" /> : <Check className="size-3.5" />}
                        </IconAction>
                        <IconAction label="Edit" onClick={() => setEditing({ id: m.id, text: m.text })}>
                          <Pencil className="size-3.5" />
                        </IconAction>
                      </span>
                    )}
                  </div>
                  {m.kind === "comment" && m.route && m.path && (
                    <button
                      type="button"
                      onClick={() => goToComment(m.route!, m.path!, (href) => router.push(href))}
                      className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-lg bg-white px-2 py-1 text-left text-[11px] text-pax2-blue shadow-e1 hover:bg-pax2-lavender"
                      title="Open the page with this element outlined"
                    >
                      <MapPin className="size-3 shrink-0" />
                      <span className="truncate">
                        {m.route} · {m.target}
                      </span>
                    </button>
                  )}
                  {editing?.id === m.id ? (
                    <div className="mt-1.5">
                      <textarea value={editing.text} onChange={(e) => setEditing({ id: m.id, text: e.target.value })} rows={3} className="w-full resize-none rounded-lg border border-slate-200 bg-white p-2 text-sm outline-none focus:border-pax2-light-blue" />
                      <div className="mt-1 flex justify-end gap-2 text-xs">
                        <button type="button" onClick={() => setEditing(null)} className="rounded-md px-2 py-1 text-slate-500 hover:bg-white">
                          Cancel
                        </button>
                        <button type="button" onClick={() => void change(m, { text: editing.text })} className="rounded-md bg-pax2-blue px-2.5 py-1 font-medium text-white">
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    m.text && <p className={cn("mt-1 text-sm whitespace-pre-wrap text-slate-700", resolved && "text-slate-400")}>{m.text}</p>
                  )}
                  {m.images?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {m.images.map((k) => (
                        <a key={k} href={`/api/housekeeping/image?key=${encodeURIComponent(k)}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-200 bg-white">
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
        <div className="rounded-2xl border border-slate-200 bg-white px-3 pt-2.5 pb-2 shadow-e1 focus-within:border-pax2-light-blue">
          {shots.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {shots.map((s, i) => (
                <span key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a pasted screenshot before it is sent */}
                  <img src={s.data} alt="" className="h-14 w-auto rounded-md border border-slate-200" />
                  <button type="button" aria-label="Remove" onClick={() => setShots((prev) => prev.filter((_, j) => j !== i))} className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-slate-900 text-white">
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
              if (e.key === "Enter" && !e.shiftKey) {
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
      className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition-[color,background-color,box-shadow]", on ? "bg-white text-pax2-blue shadow-e1" : "text-slate-500 hover:bg-white/70 hover:text-pax2-blue")}
    >
      {children}
    </button>
  )
}

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="flex size-6 items-center justify-center rounded-md text-slate-500 hover:bg-white hover:text-pax2-blue">
      {children}
    </button>
  )
}
