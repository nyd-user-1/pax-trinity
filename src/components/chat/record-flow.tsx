'use client'

// The recording, inside the chat column: /record/camera's stages dressed as the chat's blocks
// (nova Card with the title header; camera-flow.tsx keeps the page version). Record on the script
// card opens the full-screen Teleprompter at once — closing it without a take leaves this card as
// the way back in, with the upload fallback. Watch-back and send happen in the card. Send keeps the
// take in Clips (Brendan's order, through the lead, 2026-10-29): the browser sends it to the clips
// bucket on a signed address, then its row joins the recorded catalog (src/app/recording-actions.ts),
// so it plays in Your library on /clips and an admin can make it a message test's arm. Keeping it
// needs an account; the sign-in opens in a new tab so the take stays here.

import * as React from 'react'
import { Check, CheckCircle2, Loader2, RotateCcw, Upload, Video } from 'lucide-react'
import Link from 'next/link'

import { myAnalysis, viewer } from '@/app/original-actions'
import { keepRecording, recordingUpload } from '@/app/recording-actions'
import { putSigned } from '@/components/clips/store'
import { TemplateChoices } from '@/components/clips/template-chooser'
import { ConsensusVote } from '@/components/consensus-vote'
import { Teleprompter } from '@/components/record/teleprompter'
import { useDraft } from '@/components/record/draft'
import { type VideoProvider } from '@/lib/video-model-options'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/ui/components/nova/card'

type Clip = { blob: Blob; url: string; seconds: number; mime: string }
export type Analysis = NonNullable<Awaited<ReturnType<typeof myAnalysis>>>

const TIPS = ['Find a quiet spot with light on your face, not behind you.', 'Hold your phone upright, around eye level.', 'Talk to the lens like you are talking to a friend.']

// The experience, judged one statement at a time — agree, disagree or pass — through Consensus.
const FEEDBACK = [
  { tid: 1, text: 'Building the script in the chat felt easy.' },
  { tid: 2, text: 'The questions asked were the right ones.' },
  { tid: 3, text: 'The teleprompter pace felt natural.' },
  { tid: 4, text: 'It was clear what would happen at each step.' },
  { tid: 5, text: 'Recording this way beats recording alone.' },
]

const CARD = 'my-3 animate-in fade-in slide-in-from-bottom-1 duration-300'
const FIELD = 'w-full rounded-lg border border-[var(--border)] bg-pax2-surface px-3 py-2 text-[15px] text-[var(--txt)] outline-none transition-colors placeholder:text-[var(--muted2)] focus:border-pax2-light-blue disabled:text-slate-500'

/** The script's first sentence, as the clip's title until the recorder names it. */
const titleOf = (script: string) => {
  const first = script.trim().split(/(?<=[.!?])\s+/)[0] ?? ''
  return first.length > 80 ? `${first.slice(0, 77).trimEnd()}…` : first
}

type Props = { script: string; onDone: (id: string) => void; videoModel?: VideoProvider; onAnalysis?: (a: Analysis) => void }

export function RecordFlow({ script, onDone }: Props) {
  const { draft } = useDraft()
  // Record on the script card means record: the teleprompter opens at once.
  const [prompter, setPrompter] = React.useState(true)
  const [clip, setClip] = React.useState<Clip | null>(null)
  const [stage, setStage] = React.useState<'ready' | 'sending' | 'done' | 'error'>('ready')
  const [err, setErr] = React.useState<string | null>(null)
  const [progress, setProgress] = React.useState(0)
  const [me, setMe] = React.useState<string | null | undefined>(undefined)
  const [title, setTitle] = React.useState(() => titleOf(script))
  const [name, setName] = React.useState('')
  const [lastName, setLastName] = React.useState('')
  const [kept, setKept] = React.useState<{ id: string; href: string; src: string; seconds: number | null } | null>(null)
  const file = React.useRef<HTMLInputElement>(null)
  // Who is signed in, read again when the tab comes back (a sign-in finished in the other tab).
  React.useEffect(() => {
    const read = () => void viewer().then((v) => setMe(v?.email ?? null))
    read()
    window.addEventListener('focus', read)
    return () => window.removeEventListener('focus', read)
  }, [])
  React.useEffect(() => {
    setName((n) => n || draft.name || '')
    setLastName((n) => n || draft.lastName || '')
  }, [draft.name, draft.lastName])

  const take = (f: File) => {
    const url = URL.createObjectURL(f)
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.onloadedmetadata = () => setClip({ blob: f, url, seconds: v.duration || 0, mime: f.type || 'video/mp4' })
    v.src = url
  }

  const ready = !!me && !!title.trim()

  const send = async () => {
    if (!clip || !ready) return
    setStage('sending')
    setErr(null)
    setProgress(0)
    try {
      const u = await recordingUpload(clip.mime)
      await putSigned(u.url, clip.blob, u.type, setProgress)
      const messenger = [name, lastName].map((x) => x.trim()).filter(Boolean).join(' ') || undefined
      const k = await keepRecording({ id: u.id, key: u.key, title, messenger, seconds: clip.seconds, script })
      setKept({ id: k.id, href: k.href, src: k.clip.src, seconds: k.clip.duration ?? clip.seconds })
      setStage('done')
      onDone(k.id)
    } catch (e) {
      setErr((e as Error).message)
      setStage('error')
    }
  }

  if (stage === 'done' && kept)
    return (
      <Card size="sm" className={CARD}>
        <CardHeader className="border-b [.border-b]:pb-2">
          <CardTitle>Your video is in Clips</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-slate-800">
          <p>It plays in your library, and only you can see it there. An admin can make it an arm of a message test.</p>
          <Link href={kept.href} className="flex w-fit items-center gap-1.5 rounded-full bg-pax2-blue px-5 py-2.5 font-medium text-white transition-opacity hover:opacity-85">
            Open it in Clips
          </Link>
          {/* Two of the four Yes on 3 templates over the take (the tracked pair); passing them by is the skip. */}
          <TemplateChoices take={{ id: kept.id, src: kept.src, seconds: kept.seconds }} from="record" />
        </CardContent>
      </Card>
    )

  if (stage === 'sending')
    return (
      <Card size="sm" className={CARD}>
        <CardHeader className="border-b [.border-b]:pb-2">
          <CardTitle>Sending</CardTitle>
          <CardAction>
            <Loader2 className="size-4 animate-spin text-pax2-blue" />
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-slate-800">
          <div className="h-1 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-pax2-blue transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p>While it sends, a few quick judgments would help make this better:</p>
          <ConsensusVote slug="record-experience" statements={FEEDBACK} voted={{}} finished="All five judged — thank you." />
        </CardContent>
      </Card>
    )

  if (clip)
    return (
      <Card size="sm" className={CARD}>
        <CardHeader className="border-b [.border-b]:pb-2">
          <CardTitle>Watch it back</CardTitle>
          <CardAction>
            <button type="button" onClick={() => setClip(null)} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-muted hover:text-pax2-blue">
              <RotateCcw className="size-3.5" /> Try again
            </button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <video src={clip.url} controls playsInline className="aspect-[9/16] w-full rounded-2xl bg-black object-cover" />
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-slate-800">{Math.round(clip.seconds)} seconds. Send it, or try again.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-800">First name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className={FIELD} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-slate-800">Last name</span>
                <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={FIELD} />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-slate-800">Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} className={FIELD} />
            </label>
            {me === null && (
              <p className="text-slate-800">
                <a href="/signin" target="_blank" rel="noopener" className="font-medium text-pax2-blue underline underline-offset-2">
                  Sign in
                </a>{' '}
                to keep it in Clips; your take stays here.
              </p>
            )}
            <div className="flex items-center gap-3">
              <button type="button" disabled={!ready} onClick={send} className="flex items-center gap-2 rounded-full bg-pax2-blue px-6 py-2.5 font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-40">
                <Check className="size-4" /> Send it
              </button>
              {err && <p className="text-destructive">{err}</p>}
            </div>
          </div>
        </CardContent>
      </Card>
    )

  return (
    <>
      <Card size="sm" className={CARD}>
        <CardHeader className="border-b [.border-b]:pb-2">
          <CardTitle>Record with the teleprompter</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <button type="button" onClick={() => setPrompter(true)} className="flex items-center justify-center gap-2 rounded-full bg-pax2-blue py-3.5 font-medium text-white shadow-lg transition-opacity hover:opacity-90">
            <Video className="size-4" /> Start recording
          </button>
          <button type="button" onClick={() => file.current?.click()} className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 bg-pax2-surface/60 px-4 py-3 text-left transition-colors hover:border-pax2-light-blue">
            <Upload className="size-4 shrink-0 text-pax2-blue" />
            <span className="text-sm text-slate-800">Already recorded it? Choose a file.</span>
            <input ref={file} type="file" accept="video/*" className="hidden" onChange={(e) => e.target.files?.[0] && take(e.target.files[0])} />
          </button>
          <ul className="flex flex-col gap-1.5">
            {TIPS.map((t) => (
              <li key={t} className="flex items-center gap-2 text-sm text-slate-800">
                <CheckCircle2 className="size-3.5 shrink-0 text-pax2-blue" /> {t}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
      {prompter && (
        <Teleprompter
          text={script}
          onClose={() => setPrompter(false)}
          onDone={(blob, seconds, mime) => {
            setPrompter(false)
            setClip({ blob, url: URL.createObjectURL(blob), seconds, mime })
          }}
        />
      )}
    </>
  )
}
