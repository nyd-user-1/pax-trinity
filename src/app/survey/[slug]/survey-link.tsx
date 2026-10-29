"use client"

import * as React from "react"
import Link from "next/link"
import { CheckIcon, CopyIcon } from "lucide-react"

// The survey's respondent link: copied whole, or opened.
export function SurveyLink({ path }: { path: string }) {
  const [copied, setCopied] = React.useState(false)
  const copy = () => {
    void navigator.clipboard.writeText(`${window.location.origin}${path}`)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <button type="button" onClick={copy} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[var(--paper-rule)]/40 px-3 font-medium hover:bg-[var(--paper-quiet)]">
        {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
        {copied ? "Copied" : "Copy link"}
      </button>
      <Link href={path} className="inline-flex h-8 items-center rounded-full bg-[var(--paper-text)] px-3 font-medium text-[var(--paper)] hover:opacity-90">
        Open survey
      </Link>
    </div>
  )
}
