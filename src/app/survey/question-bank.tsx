"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ClipboardCheck, ClipboardList, Copy, FileText, FlaskConical, Search, type LucideIcon } from "lucide-react"

import { MenuFoot, MenuHeader, MenuRow, MenuSeparator } from "@/components/kebab-menu"
import { ROW, RowMenu } from "@/components/row-dress"
import { AddToBlocksRow } from "@/components/dash/card-tools"
import { FIELD } from "@/components/settings/blocks"
import { readDraft } from "@/lib/consensus/draft"
import { collectAttr } from "@/lib/note-collect"
import { LIFE_TONE } from "@/lib/lifecycle/rules"
import { buildBank, pretrainingOrigin, type Appearance, type BankQuestion, type Kind, type Origin } from "@/lib/surveys/question-bank"
import { cn } from "@/ui/lib/utils"

// Survey's Question Bank (Brendan via the lead, 2026-11-02): every question from every survey, test and
// pretraining, once each (lib/surveys/question-bank.ts), each row naming where it was asked. The server
// hands the places; this browser's own draft joins them after mount, as the rail's draft does.

/** Each place wears its rail row's icon. */
const ICON: Record<Kind, LucideIcon> = { survey: FileText, consensus: ClipboardList, test: ClipboardCheck, pretraining: FlaskConical }

/** The places a row shows before the rest fold into a count. */
const SHOWN = 2

function Place({ a }: { a: Appearance }) {
  const Icon = ICON[a.kind]
  const dress = "inline-flex max-w-[14rem] items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
  const body = (
    <>
      <Icon className="size-3 shrink-0" />
      <span className="truncate">{a.title}</span>
      {/* The place's state in the lifecycle's own word (lib/lifecycle). */}
      {a.state && <span className={cn("shrink-0 rounded-full px-1.5 text-[10px] leading-4 font-medium", LIFE_TONE[a.state])}>{a.state}</span>}
    </>
  )
  return a.href ? (
    <Link href={a.href} className={cn(dress, "transition-colors hover:bg-pax2-lavender hover:text-pax2-blue")}>
      {body}
    </Link>
  ) : (
    <span className={dress}>{body}</span>
  )
}

/** A bank row's id, for Blocks to open it at: its construct id where it has one, else its wording's first words. */
const bankAnchor = (q: BankQuestion) => `bank-${(q.id ?? q.text.slice(0, 48)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`

function BankRow({ q }: { q: BankQuestion }) {
  const router = useRouter()
  const rest = q.on.slice(SHOWN)
  return (
    <li id={bankAnchor(q)} className={cn(ROW, "flex items-center gap-3 pr-12 pl-4")} {...collectAttr({ kind: "question", title: `Question Bank: ${q.text}`, anchor: bankAnchor(q), question: { text: q.text, options: q.options } })}>
      <span className="min-w-0 flex-1 truncate text-sm" title={q.text}>
        {q.text}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {q.on.slice(0, SHOWN).map((a) => (
          <Place key={`${a.kind}:${a.title}`} a={a} />
        ))}
        {!!rest.length && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs tabular-nums text-slate-600" title={rest.map((a) => a.title).join(", ")}>
            +{rest.length}
          </span>
        )}
      </span>
      <span className="absolute top-1/2 right-3 -translate-y-1/2">
        <RowMenu label={`${q.text} options`}>
          {q.id && (
            <>
              <MenuHeader text={q.id} copy={q.id} />
              <MenuSeparator />
            </>
          )}
          <MenuRow icon={<Copy />} label="Copy the question" onClick={() => void navigator.clipboard.writeText(q.text)} />
          <AddToBlocksRow title={`Question Bank: ${q.text}`} anchor={bankAnchor(q)} kind="question" question={{ text: q.text, options: q.options }} />
          {q.on.some((a) => a.href) && <MenuSeparator />}
          {q.on.map((a) => {
            const Icon = ICON[a.kind]
            return a.href ? <MenuRow key={`${a.kind}:${a.title}`} icon={<Icon />} label={a.title} onClick={() => router.push(a.href as string)} /> : null
          })}
          {!!q.options.length && (
            <>
              <MenuSeparator />
              <MenuFoot title={q.options.join(" · ")} />
            </>
          )}
        </RowMenu>
      </span>
    </li>
  )
}

export function QuestionBank({ origins }: { origins: Origin[] }) {
  const [draft, setDraft] = React.useState<Origin | null>(null)
  React.useEffect(() => {
    const d = readDraft()
    if (d?.questions.length) setDraft({ ...pretrainingOrigin(d), state: "Draft" })
  }, [])
  const bank = React.useMemo(() => buildBank(draft ? [...origins, draft] : origins), [origins, draft])
  const [q, setQ] = React.useState("")
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const shown = words.length ? bank.filter((b) => words.every((w) => [b.text, b.id ?? "", ...b.on.map((a) => a.title)].join(" ").toLowerCase().includes(w))) : bank
  return (
    <div className="flex flex-col gap-4">
      <label className={cn(FIELD, "flex h-10 items-center gap-2 px-3")}>
        <Search className="size-4 shrink-0 text-slate-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${bank.length.toLocaleString("en-US")} ${bank.length === 1 ? "question" : "questions"}…`} aria-label="Search questions" className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400" />
      </label>
      {shown.length ? (
        <ul className="overflow-hidden rounded-[14px] border border-slate-200 bg-pax2-surface shadow-e1 [&>li:last-child]:border-b-0">
          {shown.map((b) => (
            <BankRow key={b.key} q={b} />
          ))}
        </ul>
      ) : (
        <p className="py-10 text-center text-sm text-slate-500">{bank.length ? `No question matches “${q.trim()}”.` : "No questions on file."}</p>
      )}
    </div>
  )
}
