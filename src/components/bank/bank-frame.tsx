"use client"

import * as React from "react"
import { PanelLeftIcon, Search, X } from "lucide-react"

import { PathBar } from "@/components/create/path-bar"
import { Button } from "@govblock/ui/components/nova/button"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@govblock/ui/components/ny4/resizable"
import { Separator } from "@govblock/ui/components/ny4/separator"
import { TooltipProvider } from "@govblock/ui/components/ny4/tooltip"

// The bank's frame — the Agentic Inbox's geometry laid by hand so the rail
// can ride a resizable handle (BlockShell cannot resize its sidebar): the
// rail full height on the left, the header from its right edge with the
// rail toggle, the crumb and trinity's header search (an icon until picked,
// then the bar's width), and the body below. /audience, /lift and /survey
// stand in it.

export function BankFrame({
  rail,
  crumb,
  search,
  overlay,
  children,
}: {
  rail: React.ReactNode
  crumb: string
  /** The header search: the surface's main filter. */
  search: { query: string; onQuery: (q: string) => void; placeholder: string }
  /** Floats over the frame's corner, the survey-draft bar's place. */
  overlay?: React.ReactNode
  children: React.ReactNode
}) {
  const [railOpen, setRailOpen] = React.useState(true)
  const [searching, setSearching] = React.useState(false)
  const close = () => {
    search.onQuery("")
    setSearching(false)
  }
  return (
    <TooltipProvider delayDuration={0}>
      <div className="relative flex h-full min-h-0 w-full overflow-hidden bg-sidebar [--sidebar:var(--pax2-mist)] [--header-height:calc(var(--spacing)*12)]">
        <ResizablePanelGroup orientation="horizontal" className="min-h-0 min-w-0 flex-1">
          {/* react-resizable-panels v4 reads bare numbers as pixels. */}
          {railOpen && (
            <ResizablePanel defaultSize={224} minSize={192} maxSize={420} className="flex min-w-0 flex-col bg-sidebar **:data-[slot=sidebar-content]:no-scrollbar">
              {rail}
            </ResizablePanel>
          )}
          {railOpen && <ResizableHandle withHandle />}
          <ResizablePanel className="min-w-0">
            <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
              <header className="relative z-10 flex h-(--header-height) shrink-0 items-center gap-2 border-b">
                <div className="flex w-full min-w-0 items-center gap-1 px-4 lg:gap-2 lg:px-6">
                  <Button variant="ghost" size="icon-sm" aria-label="Toggle sidebar" className="-ml-1 size-7" onClick={() => setRailOpen((v) => !v)}>
                    <PanelLeftIcon className="size-4" />
                  </Button>
                  <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
                  <div className="flex min-w-0 flex-1 items-center gap-1 text-base font-medium">
                    <PathBar crumbs={[{ label: crumb }]} folder onGo={() => {}} />
                    {searching ? (
                      <div className="ml-2 flex min-w-0 flex-1 items-center gap-2 rounded-full bg-muted px-3 py-1.5">
                        <Search className="size-4 shrink-0 text-muted-foreground" />
                        <input
                          autoFocus
                          value={search.query}
                          onChange={(event) => search.onQuery(event.target.value)}
                          onKeyDown={(event) => event.key === "Escape" && close()}
                          placeholder={search.placeholder}
                          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                        />
                        <button type="button" aria-label="Close the search" className="shrink-0 text-muted-foreground hover:text-foreground" onClick={close}>
                          <X className="size-4" />
                        </button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" aria-label={search.placeholder} className="ml-1" onClick={() => setSearching(true)}>
                        <Search className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </header>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
        {overlay}
      </div>
    </TooltipProvider>
  )
}

/** The list beside its pane on one handle, and the aside (About, Blocks) at the right edge. */
export function BankSplit({
  list,
  pane,
  aside,
  fold = { size: 380, min: 300, max: 560 },
}: {
  list?: React.ReactNode
  pane?: React.ReactNode
  aside?: React.ReactNode
  /** The folded list's width in pixels, where a pane stands beside it. */
  fold?: { size: number; min: number; max: number }
}) {
  return (
    <div className="relative flex h-full min-h-0 min-w-0">
      <ResizablePanelGroup orientation="horizontal" className="min-h-0 min-w-0 flex-1">
        {list && (
          <ResizablePanel defaultSize={pane ? fold.size : 100000} minSize={pane ? fold.min : 320} maxSize={pane ? fold.max : undefined} className="min-w-0">
            {list}
          </ResizablePanel>
        )}
        {list && pane && <ResizableHandle withHandle />}
        {pane && <ResizablePanel className="min-w-0">{pane}</ResizablePanel>}
      </ResizablePanelGroup>
      {aside}
    </div>
  )
}
