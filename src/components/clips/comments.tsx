"use client"

import * as React from "react"
import Link from "next/link"
import { AtSignIcon, BoldIcon, CodeIcon, HeartIcon, ItalicIcon, Link2Icon, ListIcon, ListOrderedIcon, PlusIcon, SendHorizontalIcon, SmileIcon, SquareCodeIcon, StrikethroughIcon, TextQuoteIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@govblock/ui/components/nova/avatar"
import { cn } from "@govblock/ui/lib/utils"

import { ClipTest, drawnTest, testsOf } from "./clip-test"
import { fmtAge, type Clip, type Comment } from "./store"

// A clip's edit thread (Brendan's mock, 2026-10-25): the team's notes on the cut, the record's links, the
// readers' comments, and a box to write in. Signed out, the box is a sentence with a sign-in link. It reads
// in Tools' Edits (the shell's right panel) and in the phone's sheet; the page's Edit Panel is gone
// (Brendan, 2026-10-31).
export function EditThread({
  clip,
  comments,
  signedIn,
  onPost,
  onLikeComment,
  likedComments,
  focusKey,
  className,
}: {
  clip: Clip | null
  comments: Comment[]
  signedIn: boolean
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

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
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

      {signedIn && (
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

// The cut's readout (clip-test.tsx): the register's arm where it joins the clip, else the panel drawn for it.
// Tools' Reports opens it (the shell's right panel).
export function ClipReport({ clip }: { clip: Clip }) {
  const tests = testsOf(clip.id)
  return <ClipTest tests={tests.length ? tests : [drawnTest(clip)]} />
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
