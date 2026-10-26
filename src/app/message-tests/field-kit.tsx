"use client"

import * as React from "react"
import { Check, Copy } from "lucide-react"

import { CardBlock } from "@/components/blocks"
import type { PanelConfig } from "@/lib/tests/types"

function CopyRow({ label, value }: { label: string; value: string | null }) {
  const [copied, setCopied] = React.useState(false)
  const copy = () => {
    if (!value) return
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800">{value ?? "Not set"}</code>
        <button
          type="button"
          onClick={copy}
          disabled={!value}
          aria-label={`Copy ${label}`}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-pax2-blue hover:text-pax2-blue disabled:opacity-40"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
    </div>
  )
}

/** The vendor handoff: the link the panel sends respondents to, and the three links they come back by. */
export function FieldKit({ entryUrl, panel }: { entryUrl: string; panel: PanelConfig | null }) {
  return (
    <CardBlock title="Field kit">
      <div className="flex flex-col gap-4 p-1">
        <CopyRow label="Entry link (the vendor puts its respondent id in place of {PID})" value={entryUrl} />
        <CopyRow label={`Complete redirect${panel?.vendor ? `, ${panel.vendor}` : ""}`} value={panel?.completeUrl ?? null} />
        <CopyRow label="Screenout redirect" value={panel?.screenoutUrl ?? null} />
        <CopyRow label="Quota-full redirect" value={panel?.quotaFullUrl ?? null} />
      </div>
    </CardBlock>
  )
}
