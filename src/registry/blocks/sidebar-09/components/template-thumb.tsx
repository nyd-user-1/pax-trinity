"use client"

import * as React from "react"

import { designedHtml } from "@/lib/mail/design"

// A template's thumbnail (Brendan, 2026-10-31): the mail it sends, in its design, cut to the top of the card at the
// size of Lift's video frames in its rows.
export function TemplateThumb({ template }: { template: { body: string; subject: string } }) {
  const html = React.useMemo(() => designedHtml(template.body, "", template.subject), [template])
  return (
    <span aria-hidden className="relative h-6 w-9 shrink-0 overflow-hidden rounded-[3px] border border-slate-200 bg-[#f5f7fb]">
      <iframe srcDoc={html} tabIndex={-1} loading="lazy" title="" className="pointer-events-none absolute top-0 left-0 origin-top-left border-0" style={{ width: 600, height: 400, transform: "scale(0.06)" }} />
    </span>
  )
}
