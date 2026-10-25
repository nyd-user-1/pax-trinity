import type * as React from "react"

// The center column only: title, description, the page's own cards and
// buttons. Govblock's docs shell around it (rails, sheets, prev/next,
// copy-page) stayed behind (Brendan, 2026-10-25). Extra props from the
// copied call sites are accepted and ignored.
export function DocsPage({
  title,
  description,
  lead,
  actions,
  children,
}: {
  title: string
  description: string
  lead?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  [key: string]: unknown
}) {
  return (
    <div className="mx-auto w-full max-w-[920px] pb-12">
      <div className="flex items-start justify-between gap-4 pt-2">
        <div className="min-w-0">
          <h1 className="font-display m-0 text-[26px] text-pax2-blue">{title}</h1>
          {lead ?? <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  )
}
