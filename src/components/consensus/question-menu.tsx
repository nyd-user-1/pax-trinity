"use client"

import { Copy, EllipsisVertical } from "lucide-react"

import { AddToBlocksRow } from "@/components/dash/card-tools"
import { KebabMenu, MenuFoot, MenuHeader, MenuRow, MenuSeparator } from "@/components/kebab-menu"

/** A question card's three-dot menu, in the model cards' kebab dress: its code to copy, Copy the question and Add to
 *  Blocks (Brendan, 2026-11-02: every card's menu carries both), and the survey and the question's number at the
 *  foot. Every question card wears it: the vote card, the walkthrough's and Results' StatementCard. */
export function QuestionMenu({ n, title, code, text, anchor }: { n?: number; title?: string; code?: string; text: string; anchor: string }) {
  const name = n != null ? `Question ${n}` : "Statement"
  return (
    <KebabMenu label={`${name} options`} trigger={<EllipsisVertical className="size-4" />} triggerClassName="inline-flex size-8 shrink-0 self-start items-center justify-center rounded-md text-slate-800 outline-none hover:bg-foreground/8 hover:text-foreground aria-expanded:bg-foreground/8">
      {code && (
        <>
          <MenuHeader text={code} copy={code} />
          <MenuSeparator />
        </>
      )}
      <MenuRow icon={<Copy />} label="Copy the question" onClick={() => void navigator.clipboard.writeText(text)} />
      <AddToBlocksRow title={title ? `${title}, ${name}` : text} anchor={anchor} />
      {title && (
        <>
          <MenuSeparator />
          <MenuFoot title={title} sub={name} />
        </>
      )}
    </KebabMenu>
  )
}
