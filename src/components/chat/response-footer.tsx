"use client"

import * as React from "react"
import { Check, Copy, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react"

import { cn } from "@/ui/lib/utils"

// The row under each finished reply, after Code/hq's message menu (app/ui/block-menu.tsx): Copy, Good and
// Bad response, and Retry on the latest reply. Shown on the latest reply, on hover for the earlier ones.
// The model that wrote it is never named here (the standing rule, 2026-10-29); `model` stays in the props
// for the callers that pass it.

const BTN = "inline-flex size-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 [&_svg]:size-3.5"

export function ResponseFooter({ text, latest, onRetry }: { text: string; model?: string; latest: boolean; onRetry?: () => void }) {
  const [copied, setCopied] = React.useState(false)
  const [reaction, setReaction] = React.useState<"up" | "down" | null>(null)
  return (
    <div className={cn("mt-2 flex items-center gap-0.5 transition-opacity", latest ? "opacity-100" : "opacity-0 group-hover/reply:opacity-100 focus-within:opacity-100")}>
      <button
        type="button"
        aria-label="Copy"
        title="Copy"
        onClick={() => {
          navigator.clipboard.writeText(text)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1200)
        }}
        className={BTN}
      >
        {copied ? <Check className="text-pax2-light-blue" /> : <Copy />}
      </button>
      <button type="button" aria-label="Good response" title="Good response" aria-pressed={reaction === "up"} onClick={() => setReaction(reaction === "up" ? null : "up")} className={cn(BTN, reaction === "up" && "text-pax2-blue")}>
        <ThumbsUp className={reaction === "up" ? "fill-pax2-lavender" : undefined} />
      </button>
      <button type="button" aria-label="Bad response" title="Bad response" aria-pressed={reaction === "down"} onClick={() => setReaction(reaction === "down" ? null : "down")} className={cn(BTN, reaction === "down" && "text-pax2-red")}>
        <ThumbsDown className={reaction === "down" ? "fill-pax2-red-soft" : undefined} />
      </button>
      {latest && onRetry && (
        <button type="button" aria-label="Retry" title="Retry" onClick={onRetry} className={BTN}>
          <RotateCcw />
        </button>
      )}
    </div>
  )
}
