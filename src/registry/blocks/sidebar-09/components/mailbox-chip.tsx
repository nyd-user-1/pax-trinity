"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { AGENT_BOXES } from "@/lib/mail/client"
import { ORG_BOXES, orgBox } from "@/lib/partners/mailboxes"
import { memberByEmail } from "@/lib/roles"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui/components/nova/dropdown-menu"

// Whose mail the Inbox shows (Brendan, 2026-11-02): the account chip from the sidebar's foot
// (shell.tsx's AccountMenu), at the foot of the Inbox's rail. The super admin's opens upward to the
// four mailboxes, his own and the three agents', each with its mark; picking one swaps the whole
// surface. Since 2026-11-02 the partner organizations' mailboxes join his list, and a partner's chip
// opens to its own and its organization's (lib/partners/mailboxes.ts). Anyone else's is themselves alone.

/** The open mailbox's owner: "me" with the reader's name and address, or an agent by its slug. */
export type Owner = { box: string; name: string; email: string; image?: string }

/** The Pollster and the Analyst keep their coloured monograms; Pax wears its own mark. */
const AGENT_DOT: Record<string, string> = { "bill-reader": "bg-[#4285F4] text-white", tracker: "bg-[#34A853] text-white" }

/** A mailbox's mark: Pax's, an agent's monogram, an organization's initials, or the person's face. */
export function BoxMark({ owner, className }: { owner: Owner; className?: string }) {
  if (owner.box.startsWith("org:"))
    return (
      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-600 text-[10px] font-semibold text-white", className)}>
        {owner.name
          .split(/\s+/)
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()}
      </span>
    )
  if (owner.box === "assistant") return <img src="/pax-avatar.svg" alt="" className={cn("size-7 shrink-0 rounded-full", className)} />
  if (AGENT_DOT[owner.box])
    return <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium", AGENT_DOT[owner.box], className)}>{owner.name.slice(0, 1)}</span>
  return <img src={owner.image || "/avatars/default.jpg"} alt="" className={cn("size-7 shrink-0 rounded-full object-cover", className)} />
}

/** The mailboxes a reader can open, their own first: the super admin's own, the three agents' and every partner
 *  organization's; a partner's own and its organization's; anyone else's own alone. */
export function ownersFor(me: Owner, superAdmin: boolean): Owner[] {
  if (superAdmin) return [me, ...AGENT_BOXES.map((a) => ({ box: a.box, name: a.name, email: a.email })), ...ORG_BOXES.map((o) => ({ box: o.box, name: o.name, email: o.email }))]
  const m = memberByEmail(me.email)
  const org = m?.role === "partner" ? orgBox(m.partner) : undefined
  return org ? [me, { box: org.box, name: org.name, email: org.email }] : [me]
}

const CHIP = "flex w-full max-w-full items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-pax2-blue"

export function MailboxChip({ owner, me, superAdmin, onPick }: { owner: Owner; me: Owner; superAdmin: boolean; onPick: (box: string) => void }) {
  const owners = ownersFor(me, superAdmin)
  if (owners.length < 2)
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
        {owners.map((o) => (
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
