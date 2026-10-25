"use client"

import * as React from "react"
import Link from "next/link"
import { BookmarkIcon, HeartIcon, MessageCircleIcon, MoreHorizontalIcon, SendIcon } from "lucide-react"

import { ReactionButton } from "@govblock/ui/components/animbits/reaction-button"

import { Avatar, AvatarFallback, AvatarImage } from "@govblock/ui/components/nova/avatar"
import { Button } from "@govblock/ui/components/nova/button"
import { cn } from "@govblock/ui/lib/utils"

import { ClipMenu } from "./menu"
import { fmtAge, fmtCount, fmtWhen, type Clip, type Comment } from "./store"

// Instagram's post panel, as the page's right rail: the author with Follow
// and the menu, the caption as the first entry, the comments, the action row
// with the like count and the date, and a box to write in. Signed out, the
// box is a sentence with a sign-in link.

export function CommentsPanel({
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
  const [tab, setTab] = React.useState<"edit" | "report">("edit")
  const inputRef = React.useRef<HTMLInputElement>(null)
  React.useEffect(() => {
    if (focusKey) inputRef.current?.focus()
  }, [focusKey])
  React.useEffect(() => setText(""), [clip?.id])

  if (!clip) return <div className={cn("flex items-center justify-center p-6 text-sm text-muted-foreground", className)}>Nothing playing.</div>
  const likes = clip.likes + (liked ? 1 : 0)

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      {/* Edit and Report, side by side (Brendan, 2026-10-25): the edit thread and the
          cut's test readout share the panel; the clip menu keeps the corner. */}
      <div className="flex items-center gap-2.5 border-b px-4 py-3">
        <button type="button" onClick={() => setTab("edit")} className={cn("text-sm font-semibold", tab === "edit" ? "" : "text-muted-foreground")}>
          Edit Panel
        </button>
        <span className="text-muted-foreground">·</span>
        <button type="button" onClick={() => setTab("report")} className={cn("text-sm font-semibold", tab === "report" ? "" : "text-muted-foreground")}>
          Report Panel
        </button>
        <ClipMenu clip={clip} onGoToPost={onGoToPost} onDelete={onDelete} onReport={onReport} onTakeDown={onTakeDown}>
          <button type="button" className="ml-auto flex size-8 items-center justify-center rounded-full hover:bg-accent" aria-label="More">
            <MoreHorizontalIcon className="size-5" />
          </button>
        </ClipMenu>
      </div>

      {tab === "report" ? (
        <ReportView clip={clip} />
      ) : (
      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {EDITS.map((e) => (
          <div key={e.who + e.ago} className="pb-3 text-sm">
            <span className="font-semibold">{e.who}</span> <span className="text-xs text-muted-foreground">{e.ago}</span>
            <p className="mt-0.5">{e.text}</p>
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
        {comments.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No comments yet.</p>}
      </div>
      )}

      {tab === "edit" && (
      <div className="border-t px-4 py-3">
        <div className="flex items-center gap-1">
          <span className={cn("flex size-10 items-center justify-center rounded-full transition-colors hover:bg-accent", liked && "text-red-500")}>
            <ReactionButton Icon={HeartIcon} size={24} isLiked={liked} onToggle={onLike} />
          </span>
          <IconButton onClick={() => inputRef.current?.focus()} label="Comment">
            <MessageCircleIcon className="size-6 -scale-x-100" />
          </IconButton>
          <IconButton onClick={onGoToPost} label="Share">
            <SendIcon className="size-6" />
          </IconButton>
          <span className="ml-auto flex size-10 items-center justify-center rounded-full transition-colors hover:bg-accent">
            <ReactionButton Icon={BookmarkIcon} size={24} isLiked={saved} colors={{ initial: "currentColor", liked: "currentColor" }} onToggle={onSave} />
          </span>
        </div>
        <p className="mt-1 text-sm font-semibold">{fmtCount(likes)} likes</p>
        <p className="text-xs text-muted-foreground">{fmtWhen(clip.createdAt)}</p>
        {signedIn ? (
          <form
            className="mt-3 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const t = text.trim()
              if (!t) return
              onPost(t)
              setText("")
            }}
          >
            <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a comment…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            <Button type="submit" variant="ghost" size="sm" className="text-sky-600 disabled:opacity-40 dark:text-sky-400" disabled={!text.trim()}>
              Post
            </Button>
          </form>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            <Link href="/sign-in" className="font-medium text-sky-600 dark:text-sky-400">
              Sign in
            </Link>{" "}
            to like or comment.
          </p>
        )}
      </div>
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

function IconButton({ children, label, onClick, className }: { children: React.ReactNode; label: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={cn("flex size-10 items-center justify-center rounded-full transition-colors hover:bg-accent", className)}>
      {children}
    </button>
  )
}


// The edit thread's seed (Brendan's mock, 2026-10-25) — stand-in entries until edits are recorded for real.
const EDITS = [
  { who: "Admin", ago: "22h", text: "Frame 7 swapped, new vert added." },
  { who: "Sajeela", ago: "24h", text: "Swap frame 7 🎞️, settle down. 💅" },
  { who: "Ted", ago: "28h", text: "Act on 🧊 2 findings. I will fight you" },
  { who: "Garrett", ago: "36h", text: "This guy 👆 Also, MA-3 asked for an update" },
  { who: "Brendan", ago: "48h", text: "🎃 is not 🍕." },
]

// The cut's randomized-test readout: lifts against the wave's own placebo, the
// source's labels, nothing invented. Untested cuts say so.
function ReportView({ clip }: { clip: Clip }) {
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
