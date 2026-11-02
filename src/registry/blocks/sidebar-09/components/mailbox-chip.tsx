"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { AGENT_BOXES } from "@/lib/mail/client"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/components/nova/dropdown-menu"

// Whose mail the Inbox shows (Brendan, 2026-11-02): the account chip from the sidebar's foot
// (shell.tsx's AccountMenu), at the foot of the Inbox's rail. The super admin's opens upward to the
// four mailboxes, his own and the three agents', each with its mark; picking one swaps the whole
// surface. Anyone else's chip is themselves alone.

/** The open mailbox's owner: "me" with the reader's name and address, or an agent by its slug. */
export type Owner = { box: string; name: string; email: string; image?: string }

/** The Pollster and the Analyst keep their coloured monograms; Pax wears its own mark. */
const AGENT_DOT: Record<string, string> = { "bill-reader": "bg-[#4285F4] text-white", tracker: "bg-[#34A853] text-white" }

/** A mailbox's mark: Pax's, an agent's monogram, or the person's face. */
export function BoxMark({ owner, className }: { owner: Owner; className?: string }) {
  if (owner.box === "assistant") return <img src="/pax-avatar.svg" alt="" className={cn("size-7 shrink-0 rounded-full", className)} />
  if (AGENT_DOT[owner.box])
    return <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium", AGENT_DOT[owner.box], className)}>{owner.name.slice(0, 1)}</span>
  return <img src={owner.image || "/avatars/default.jpg"} alt="" className={cn("size-7 shrink-0 rounded-full object-cover", className)} />
}

/** The four mailboxes the super admin can open, his own first. */
export function ownersFor(me: Owner): Owner[] {
  return [me, ...AGENT_BOXES.map((a) => ({ box: a.box, name: a.name, email: a.email }))]
}

const CHIP = "flex w-full max-w-full items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-pax2-blue"

export function MailboxChip({ owner, me, superAdmin, onPick }: { owner: Owner; me: Owner; superAdmin: boolean; onPick: (box: string) => void }) {
  if (!superAdmin)
    return (
      <div className={CHIP} data-testid="mailbox-chip">
        <BoxMark owner={owner} />
        <span className="flex-1 truncate text-left text-sm font-semibold">{owner.name}</span>
      </div>
    )
  const item = "gap-2.5 rounded-lg px-2.5 py-2 text-sm"
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label="Mailbox" data-testid="mailbox-chip" className={cn(CHIP, "outline-none transition-colors hover:bg-pax2-lift data-[popup-open]:bg-pax2-lift")}>
        <BoxMark owner={owner} />
        <span className="flex-1 truncate text-left text-sm font-semibold">{owner.name}</span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-slate-400" />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-(--anchor-width) min-w-52 rounded-2xl border border-slate-500 bg-pax2-surface p-1.5 shadow-e2 ring-0">
        {ownersFor(me).map((o) => (
          <DropdownMenuItem key={o.box} onClick={() => onPick(o.box)} className={item}>
            <BoxMark owner={o} className="size-6" />
            <span className="min-w-0 flex-1 truncate">{o.box === me.box ? "My inbox" : o.name}</span>
            {o.box === owner.box && <Check className="size-4 shrink-0 text-pax2-light-blue" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
