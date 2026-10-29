"use client"

import * as React from "react"
import Link from "next/link"
import { AtSignIcon, BoldIcon, CodeIcon, HeartIcon, ItalicIcon, Link2Icon, ListIcon, ListOrderedIcon, PlusIcon, SendHorizontalIcon, SmileIcon, SquareCodeIcon, StrikethroughIcon, TextQuoteIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@govblock/ui/components/nova/avatar"
import { cn } from "@govblock/ui/lib/utils"

import { ClipTest, testsOf } from "./clip-test"
import { fmtAge, type Clip, type Comment } from "./store"

// Instagram's post panel, as the page's right rail: the author with Follow
// and the menu, the caption as the first entry, the comments, the action row
// with the like count and the date, and a box to write in. Signed out, the
// box is a sentence with a sign-in link.

export function CommentsPanel({
  tab,
  clip,
  comments,
  liked,
  saved,
  following,
  signedIn,
  onLike,
  onSave,
  onDelete,
  onReport,
  onTakeDown,
  onFollow,
  onGoToPost,
  onPost,
  onLikeComment,
  likedComments,
  focusKey,
  className,
}: {
  tab: "edit" | "report"
  clip: Clip | null
  comments: Comment[]
  liked: boolean
  saved: boolean
  following: boolean
  signedIn: boolean
  onLike: () => void
  onSave: () => void
  onDelete?: () => void
  onReport?: () => void
  onTakeDown?: () => void
  onFollow: () => void
  onGoToPost: () => void
  onPost: (text: string) => void
  onLikeComment: (id: string) => void
  likedComments: Set<string>
  focusKey?: number
  className?: string
}) {
  const [text, setText] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    if (focusKey) inputRef.current?.focus()
  }, [focusKey])
  React.useEffect(() => setText(""), [clip?.id])

  if (!clip) return <div className={cn("flex items-center justify-center p-6 text-sm text-muted-foreground", className)}>Nothing playing.</div>
  const likes = clip.likes + (liked ? 1 : 0)

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      {tab === "report" ? (
        <ReportView clip={clip} />
      ) : (
      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {EDITS.map((e) => (
          <div key={e.who + e.ago} className="flex gap-3 py-2">
            <Avatar className="size-8 shrink-0">
              <AvatarImage src={e.image} alt="" className="object-cover" />
              <AvatarFallback className="text-xs">{e.who.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 text-sm">
              <p className="leading-snug">
                <span className="font-semibold">{e.who}</span> <span className="text-muted-foreground">{e.ago}</span>
              </p>
              <p className="mt-0.5">{e.text}</p>
            </div>
          </div>
        ))}
        {!!clip.links?.length && (
          <div className="-mt-1 flex flex-col gap-1 pb-2 pl-11 text-sm">
            {clip.links.map((l) => (
              <Link key={l.href} href={l.href} className="text-sky-600 hover:underline dark:text-sky-400">
                {l.label}
              </Link>
            ))}
          </div>
        )}
        {comments.map((c) => (
          <Row key={c.id} author={c.author} at={c.at} likes={c.likes + (likedComments.has(c.id) ? 1 : 0)} liked={likedComments.has(c.id)} onLike={() => onLikeComment(c.id)}>
            {c.text}
          </Row>
        ))}
        {!signedIn && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            <Link href="/signin" className="font-medium text-sky-600 dark:text-sky-400">
              Sign in
            </Link>{" "}
            to like or comment.
          </p>
        )}
      </div>
      )}

      {tab === "edit" && signedIn && (
        <Composer
          placeholder={`Message #${clip.author.handle}`}
          value={text}
          onChange={setText}
          inputRef={inputRef}
          onSend={() => {
            const t = text.trim()
            if (!t) return
            onPost(t)
            setText("")
          }}
        />
      )}
    </div>
  )
}

function Row({ author, at, likes, liked, onLike, children }: { author: Comment["author"]; at: string; likes?: number; liked?: boolean; onLike?: () => void; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5">
      <Avatar className="size-8 shrink-0">
        <AvatarImage src={author.image ?? undefined} alt="" className="object-cover" />
        <AvatarFallback className="text-xs">{author.name.slice(0, 1)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 text-sm">
        <p className="leading-snug">
          <span className="font-semibold">{author.handle}</span> <span className="text-muted-foreground">{fmtAge(at)}</span>
        </p>
        <p className="mt-0.5 leading-snug break-words">{children}</p>
        {onLike && (
          <p className="mt-1 text-xs text-muted-foreground">
            {likes ? `${likes} ${likes === 1 ? "like" : "likes"}` : ""}
            {likes ? " · " : ""}
            <button type="button" className="font-medium">
              Reply
            </button>
          </p>
        )}
      </div>
      {onLike && (
        <button type="button" onClick={onLike} className={cn("mt-1 self-start text-muted-foreground", liked && "text-red-500")} aria-label="Like comment">
          <HeartIcon className={cn("size-3.5", liked && "fill-current")} />
        </button>
      )}
    </div>
  )
}



// The edit thread's seed (Brendan's mock, 2026-10-25) — stand-in entries until edits are recorded for real.
const EDITS = [
  { who: "Admin", ago: "22h", text: "Frame 7 swapped, new vert added.", image: "/pax-avatar.svg" },
  { who: "Sajeela", ago: "24h", text: "Swap frame 7 🎞️, settle down. 💅", image: "/sajeela.jpeg" },
  { who: "Ted", ago: "28h", text: "Act on 🧊 2 findings. I will fight you", image: "/ted.jpeg" },
  { who: "Garrett", ago: "36h", text: "This guy 👇 Also, MA-3 asked for an update", image: "/garrett.jpeg" },
  { who: "Brendan", ago: "48h", text: "🥘 is not 🍕.", image: "/avatars/default.jpg" },
]

// The cut's randomized-test readout: lifts against the wave's own placebo, the
// source's labels, nothing invented. A cut the results register tested reads
// its arm there (clip-test.tsx); untested cuts say so.
function ReportView({ clip }: { clip: Clip }) {
  const tests = testsOf(clip.id)
  if (tests.length) return <ClipTest tests={tests} />
  const r = clip.report
  if (!r)
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Untested. When this cut runs in a randomized test, its movement against the placebo lands here.
      </div>
    )
  return (
    <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <p className="text-xs text-muted-foreground">{r.study} · fielded {r.fielded}</p>
      <div className="mt-3 flex flex-col gap-3">
        {r.outcomes.map((o) => (
          <div key={o.name} className="rounded-lg border px-3 py-2.5">
            <p className="text-xs text-muted-foreground">{o.name}</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-semibold tabular-nums">{o.lift > 0 ? `+${o.lift}` : o.lift} pp</span>
              <span className={o.label === "Persuasive" ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700" : "rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"}>{o.label}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{r.armN} weighted saw this cut · {r.placeboN} weighted saw the placebo.</p>
      <p className="mt-2 text-xs text-muted-foreground">Lifts are against the wave's own placebo at the source's 90% criterion. "No measurable effect" means not detected — not proof of zero.</p>
    </div>
  )
}


// The Slack-dress composer (Brendan's mock, 2026-10-25): a formatting strip,
// the message line, and the senders' row. Only Send is wired.
function Composer({ placeholder, value, onChange, onSend, inputRef }: { placeholder: string; value: string; onChange: (v: string) => void; onSend: () => void; inputRef: React.RefObject<HTMLInputElement | null> }) {
  const tool = "flex size-7 items-center justify-center rounded text-slate-500 hover:bg-accent hover:text-foreground"
  return (
    <div className="px-3 pb-3">
      <form
        className="rounded-2xl border"
        onSubmit={(e) => {
          e.preventDefault()
          onSend()
        }}
      >
        <div className="flex items-center gap-0.5 border-b px-2 py-1.5">
          <span className={tool}><BoldIcon className="size-4" /></span>
          <span className={tool}><ItalicIcon className="size-4" /></span>
          <span className={tool}><StrikethroughIcon className="size-4" /></span>
          <span className="mx-1 h-4 w-px bg-border" />
          <span className={tool}><Link2Icon className="size-4" /></span>
          <span className="mx-1 h-4 w-px bg-border" />
          <span className={tool}><ListOrderedIcon className="size-4" /></span>
          <span className={tool}><ListIcon className="size-4" /></span>
          <span className="mx-1 h-4 w-px bg-border" />
          <span className={tool}><TextQuoteIcon className="size-4" /></span>
          <span className={tool}><CodeIcon className="size-4" /></span>
          <span className={tool}><SquareCodeIcon className="size-4" /></span>
        </div>
        <input ref={inputRef} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground" />
        <div className="flex items-center gap-1 px-2 pt-0.5 pb-2">
          <span className="flex size-8 items-center justify-center rounded-full bg-muted text-slate-600"><PlusIcon className="size-4" /></span>
          <span className="px-1 text-sm font-semibold text-pax2-blue">Aa</span>
          <span className={tool}><SmileIcon className="size-4" /></span>
          <span className={tool}><AtSignIcon className="size-4" /></span>
          <button type="submit" disabled={!value.trim()} aria-label="Send" className="ml-auto flex size-9 items-center justify-center rounded-full bg-pax2-lavender text-pax2-blue transition-colors hover:bg-pax2-blue hover:text-white disabled:opacity-50">
            <SendHorizontalIcon className="size-4" />
          </button>
        </div>
      </form>
    </div>
  )
}
