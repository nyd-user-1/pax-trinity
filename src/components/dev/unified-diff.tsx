"use client"

import * as React from "react"
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react"

import { cn } from "@govblock/ui/lib/utils"
import { parseUnifiedDiff } from "@/lib/diff/unified"

import { DiffView } from "./diff-view"

// A unified diff (a commit's, as Claude's replies in Dev Comments carry it) drawn file by file in govblock's
// Changes framing (apps/web/components/create/bill-changes.tsx, ported 2026-11-01): each file a bordered
// section, its header the chevron that folds it, its path in monospace and the DiffBar of what it added and
// deleted, then GitHub's diff table (./diff-view.tsx). Text that is not a unified diff shows as it is.

/** GitHub's five squares: the share of the change that added (green) and deleted (red), with the counts. */
export function DiffBar({ added, deleted, className }: { added: number; deleted: number; className?: string }) {
  const total = added + deleted
  const green = total ? Math.round((5 * added) / total) : 0
  const red = total ? Math.min(5 - green, deleted ? Math.max(1, 5 - green) : 0) : 0
  return (
    <span className={cn("inline-flex items-center gap-2 text-xs tabular-nums", className)}>
      {added > 0 && <span className="text-green-600 dark:text-green-500">+{added.toLocaleString("en-US")}</span>}
      {deleted > 0 && <span className="text-red-600 dark:text-red-500">−{deleted.toLocaleString("en-US")}</span>}
      <span aria-hidden className="inline-flex gap-px">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={cn("size-2.5 rounded-[2px]", i < green ? "bg-green-600 dark:bg-green-500" : i < green + red ? "bg-red-600 dark:bg-red-500" : "bg-muted-foreground/25")} />
        ))}
      </span>
    </span>
  )
}

export function UnifiedDiff({ text, anchor = "diff", className }: { text: string; anchor?: string; className?: string }) {
  const files = React.useMemo(() => parseUnifiedDiff(text), [text])
  const [shut, setShut] = React.useState<Set<number>>(new Set())
  if (!files.length) return <pre className={cn("overflow-x-auto rounded-lg border p-3 font-mono text-xs whitespace-pre", className)}>{text}</pre>
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {files.map((f, i) => {
        const open = !shut.has(i)
        return (
          <section key={`${f.path}-${i}`} data-open={open} className="overflow-hidden rounded-lg border">
            <div className="flex items-center gap-2 bg-muted/40 px-3 py-2">
              <button
                type="button"
                aria-expanded={open}
                onClick={() =>
                  setShut((s) => {
                    const n = new Set(s)
                    if (open) n.add(i)
                    else n.delete(i)
                    return n
                  })
                }
                className="flex min-w-0 items-center gap-2 text-sm hover:underline"
              >
                {open ? <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" /> : <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />}
                <span className="truncate font-mono">{f.path}</span>
              </button>
              <span className="ml-auto flex items-center gap-2">
                {f.status !== "modified" && <span className="text-xs text-muted-foreground">{f.status === "renamed" && f.from ? `renamed from ${f.from}` : f.status}</span>}
                <DiffBar added={f.added} deleted={f.deleted} />
              </span>
            </div>
            {open && (
              <div className="border-t">
                {f.status === "binary" ? <p className="px-4 py-3 text-xs text-muted-foreground">A binary file; its change is not shown.</p> : <DiffView diff={f.diff} anchor={`${anchor}-${i}-`} />}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
