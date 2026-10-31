"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, MessagesSquare, PlayCircle, Search } from "lucide-react"

import { cn } from "@/lib/utils"

// The help center's sidebar (Notion's, Brendan 2026-10-31): its search, the categories, each opening into its
// articles (the open article's category opens itself), then Learn by doing and Support.

export type NavDoc = { slug: string; title: string; admins?: boolean; find: string }
export type NavCategory = { id: string; title: string; docs: NavDoc[] }

const ROW = "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-[7px] text-left text-[15px] transition-colors"

export function DocsNav({ categories }: { categories: NavCategory[] }) {
  const path = usePathname()
  const here = path.startsWith("/docs/") ? path.slice(6) : null
  const home = categories.find((c) => c.docs.some((d) => d.slug === here))?.id
  const [open, setOpen] = React.useState<string[]>(home ? [home] : [])
  React.useEffect(() => {
    if (home) setOpen((o) => (o.includes(home) ? o : [...o, home]))
  }, [home])
  const [query, setQuery] = React.useState("")
  const q = query.trim().toLowerCase()
  const found = q ? categories.flatMap((c) => c.docs.filter((d) => q.split(/\s+/).every((w) => d.find.includes(w))).map((d) => ({ ...d, category: c.title }))) : []

  const link = (d: NavDoc, sub?: string) => (
    <Link
      key={d.slug}
      href={`/docs/${d.slug}`}
      aria-current={d.slug === here ? "page" : undefined}
      className={cn("block rounded-lg px-3 py-1.5 text-[14px] leading-snug transition-colors", d.slug === here ? "bg-pax2-lift font-medium text-pax2-blue shadow-e1" : "text-slate-500 hover:bg-pax2-lift/70 hover:text-slate-900")}
    >
      {d.title}
      {sub && <span className="mt-0.5 block text-[12px] text-slate-400">{sub}</span>}
    </Link>
  )

  return (
    <nav aria-label="Docs" className="flex h-full w-[284px] shrink-0 flex-col overflow-y-auto border-r border-slate-200 px-4 pt-5 pb-10">
      <label className="flex h-10 shrink-0 items-center gap-2.5 rounded-xl border border-slate-200 bg-pax2-surface px-3 shadow-e1 focus-within:border-slate-300">
        <Search aria-hidden className="size-4 shrink-0 text-slate-400" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search the docs" className="w-full min-w-0 bg-transparent text-[15px] text-slate-900 outline-none placeholder:text-slate-400" />
      </label>

      {q ? (
        <div className="mt-5 space-y-0.5">
          <p className="px-3 pb-1.5 text-[13px] text-slate-400">{found.length ? `${found.length} found` : "Nothing matches"}</p>
          {found.map((d) => link(d, d.category))}
        </div>
      ) : (
        <>
          <p className="mt-7 px-3 pb-1.5 text-[13px] text-slate-400">
            <Link href="/docs" className="hover:text-slate-700">
              Help Center
            </Link>
          </p>
          <ul className="space-y-0.5">
            {categories.map((c) => {
              const on = open.includes(c.id)
              return (
                <li key={c.id}>
                  <button type="button" aria-expanded={on} onClick={() => setOpen((o) => (on ? o.filter((x) => x !== c.id) : [...o, c.id]))} className={cn(ROW, "text-slate-800 hover:bg-pax2-lift/70")}>
                    {c.title}
                    <ChevronRight aria-hidden className={cn("size-4 shrink-0 text-slate-400 transition-transform duration-200", on && "rotate-90")} />
                  </button>
                  {on && <div className="mt-0.5 mb-2 ml-3 space-y-0.5 border-l border-slate-200 pl-2">{c.docs.map((d) => link(d))}</div>}
                </li>
              )
            })}
          </ul>

          <p className="mt-8 px-3 pb-1.5 text-[13px] text-slate-400">Learn by doing</p>
          <Link href="/docs/video-guides" aria-current={here === "video-guides" ? "page" : undefined} className={cn(ROW, here === "video-guides" ? "bg-pax2-lift font-medium text-pax2-blue shadow-e1" : "text-slate-800 hover:bg-pax2-lift/70")}>
            Video guides
            <PlayCircle aria-hidden className="size-4 shrink-0 text-slate-400" />
          </Link>

          <p className="mt-8 px-3 pb-1.5 text-[13px] text-slate-400">Support</p>
          <Link href="/chat" className={cn(ROW, "text-slate-800 hover:bg-pax2-lift/70")}>
            Ask PAX in Chat
            <MessagesSquare aria-hidden className="size-4 shrink-0 text-slate-400" />
          </Link>
        </>
      )}
    </nav>
  )
}
