"use client"

import * as React from "react"
import Link from "next/link"

import { CardBlock } from "@/components/blocks"
import { PUBLISHED } from "@/components/clips/store"
import { formatEntry, formatSingle } from "@/lib/tests/text"
import { PID, PLACEBO, STATUSES, type TestRecord } from "@/lib/tests/types"
import { Button, buttonVariants } from "@/ui/components/nova/button"
import { Textarea } from "@/ui/components/nova/textarea"
import { cn } from "@/ui/lib/utils"

import { saveTestAction, type SaveState } from "./actions"

// The clips an arm can be: the clips store's PUBLISHED with a video file, by id, then the recordings
// kept in Clips (the page reads them on the server). A YouTube-only clip (empty src) can't play in the
// survey, so it isn't offered; the server refuses it too.
const CATALOG = PUBLISHED.filter((c) => c.src).map((c) => ({ id: c.id, title: c.title, duration: c.duration ?? null }))
export type ArmClip = { id: string; title: string; duration: number | null }
const NONE: ArmClip[] = []

const mmss = (s: number | null) => (s == null ? "" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`)
const input = "h-9 w-full rounded-lg border border-slate-200 bg-surface px-3 text-sm text-slate-900 outline-none focus:border-pax2-blue"

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={cn("flex flex-col gap-1.5", wide && "sm:col-span-2")}>
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  )
}

export function SetupForm({ mode, initial, recorded = NONE }: { mode: "create" | "edit"; initial: TestRecord; recorded?: ArmClip[] }) {
  const CLIPS = React.useMemo(() => [...recorded, ...CATALOG], [recorded])
  const CLIP_IDS = React.useMemo(() => new Set(CLIPS.map((c) => c.id)), [CLIPS])
  const [state, formAction, pending] = React.useActionState<SaveState, FormData>(saveTestAction, { errors: [] })
  const [v, setV] = React.useState({
    id: initial.id,
    title: initial.title,
    status: initial.status,
    targetPerArm: String(initial.targetPerArm),
    placeboSrc: initial.placeboSrc,
    entry: formatEntry(initial.entry),
    explanationTitle: initial.explanationTitle,
    explanation: initial.explanation,
    ballot: formatSingle(initial.ballot),
    comprehension: formatSingle(initial.comprehension, initial.comprehension.correct),
    vendor: initial.panel?.vendor ?? "",
    completeUrl: initial.panel?.completeUrl ?? "",
    screenoutUrl: initial.panel?.screenoutUrl ?? "",
    quotaFullUrl: initial.panel?.quotaFullUrl ?? "",
  })
  const [arms, setArms] = React.useState<string[]>(initial.arms.filter((a) => a !== PLACEBO))
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((p) => ({ ...p, [k]: e.target.value }))
  const toggle = (id: string) => setArms((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))
  // An arm saved earlier whose clip has since left the store shows here until it is unchecked.
  const missing = arms.filter((a) => !CLIP_IDS.has(a))
  const clips = [...CLIPS, ...missing.map((id) => ({ id, title: PUBLISHED.some((c) => c.id === id) ? "No video file (YouTube only)" : "Not in the clips store", duration: null }))]
  const [blocked, setBlocked] = React.useState(false)
  const submit = (e: React.FormEvent) => {
    if (missing.length) {
      e.preventDefault()
      setBlocked(true)
    }
  }

  return (
    <form action={formAction} onSubmit={submit} className="flex flex-col gap-6">
      <input type="hidden" name="mode" value={mode} />
      {arms.map((a) => (
        <input key={a} type="hidden" name="arm" value={a} />
      ))}

      <CardBlock title="Test">
        <div className="grid gap-4 p-1 sm:grid-cols-2">
          <Field label="Id">
            {mode === "create" ? (
              <input name="id" value={v.id} onChange={set("id")} placeholder="open-primaries-2" className={input} required />
            ) : (
              <>
                <input type="hidden" name="id" value={v.id} />
                <span className="flex h-9 items-center font-mono text-sm text-slate-700">{v.id}</span>
              </>
            )}
          </Field>
          <Field label="Title respondents see">
            <input name="title" value={v.title} onChange={set("title")} className={input} required />
          </Field>
          <Field label="Status">
            <select name="status" value={v.status} onChange={set("status")} className={input}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Target completes per arm">
            <input name="targetPerArm" type="number" min={1} step={1} value={v.targetPerArm} onChange={set("targetPerArm")} className={input} required />
          </Field>
        </div>
      </CardBlock>

      <CardBlock title="Arms">
        <div className="flex flex-col gap-4 p-1">
          <Field label="Placebo video (https)">
            <input name="placeboSrc" value={v.placeboSrc} onChange={set("placeboSrc")} className={input} required />
          </Field>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {clips.map((c) => (
              <li key={c.id}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:border-pax2-blue">
                  <input type="checkbox" checked={arms.includes(c.id)} onChange={() => toggle(c.id)} className="size-4 accent-pax2-blue" />
                  <span className="min-w-0 flex-1 truncate text-slate-900">{c.title}</span>
                  <span className="font-mono text-xs text-slate-400">{c.id}</span>
                  <span className="text-xs tabular-nums text-slate-500">{mmss(c.duration)}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="text-xs text-slate-500">{arms.length + 1} arms: the placebo and {arms.length} {arms.length === 1 ? "clip" : "clips"}.</p>
        </div>
      </CardBlock>

      <CardBlock title="Questions">
        <div className="flex flex-col gap-4 p-1">
          <p className="text-xs text-slate-500">
            One question per block, blocks apart by a blank line. Entry questions open with <code>key | prompt</code>; every choice is <code>- value | label</code>, and <code>*</code> in place of <code>-</code> marks the correct comprehension answer.
          </p>
          <Field label="Entry questions">
            <Textarea name="entry" value={v.entry} onChange={set("entry")} rows={16} className="font-mono text-xs" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Explanation title">
              <input name="explanationTitle" value={v.explanationTitle} onChange={set("explanationTitle")} className={input} />
            </Field>
          </div>
          <Field label="Explanation">
            <Textarea name="explanation" value={v.explanation} onChange={set("explanation")} rows={4} />
          </Field>
          <Field label="Ballot">
            <Textarea name="ballot" value={v.ballot} onChange={set("ballot")} rows={5} className="font-mono text-xs" />
          </Field>
          <Field label="Comprehension">
            <Textarea name="comprehension" value={v.comprehension} onChange={set("comprehension")} rows={6} className="font-mono text-xs" />
          </Field>
        </div>
      </CardBlock>

      <CardBlock title="Panel">
        <div className="grid gap-4 p-1 sm:grid-cols-2">
          <Field label="Vendor" wide>
            <input name="vendor" value={v.vendor} onChange={set("vendor")} className={input} />
          </Field>
          <Field label={`Complete redirect (contains ${PID})`} wide>
            <input name="completeUrl" value={v.completeUrl} onChange={set("completeUrl")} placeholder={`https://panel.example.com/complete?id=${PID}`} className={input} />
          </Field>
          <Field label={`Screenout redirect (contains ${PID})`} wide>
            <input name="screenoutUrl" value={v.screenoutUrl} onChange={set("screenoutUrl")} className={input} />
          </Field>
          <Field label={`Quota-full redirect (contains ${PID})`} wide>
            <input name="quotaFullUrl" value={v.quotaFullUrl} onChange={set("quotaFullUrl")} className={input} />
          </Field>
        </div>
      </CardBlock>

      {(state.errors.length > 0 || (blocked && missing.length > 0)) && (
        <ul role="alert" className="flex flex-col gap-1 rounded-xl border border-pax2-red/40 bg-pax2-red/5 px-4 py-3 text-sm text-pax2-red">
          {blocked && missing.map((id) => <li key={id}>The arm {id} isn't a playable published clip; uncheck it.</li>)}
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "create" ? "Create test" : "Save"}
        </Button>
        <Link href={mode === "create" ? "/message-tests" : `/message-tests/${initial.id}`} className={buttonVariants({ variant: "ghost" })}>
          Cancel
        </Link>
      </div>
    </form>
  )
}
