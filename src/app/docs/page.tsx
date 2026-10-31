import Link from "next/link"

import { DocMarkdown } from "@/components/docs/doc-markdown"
import { Badge } from "@/components/settings/blocks"
import { DOCS, SECTIONS, docBySlug } from "@/lib/docs"
import { cn } from "@/ui/lib/utils"

export const metadata = { title: "Docs" }

// /docs (Brendan, 2026-10-29): the account menu's Docs, which was Help. The articles live in src/lib/docs,
// one file a section; ?page= opens one, the first by default. The layout is a stand-in until Brendan's
// reference arrives: the sections and their articles in a rail, the article beside them.

export default async function Docs({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page } = await searchParams
  const open = docBySlug(page) ?? DOCS[0]!
  return (
    <div className="mx-auto grid w-full max-w-[1080px] gap-10 pb-16 md:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Docs" className="space-y-6 md:self-start">
        {SECTIONS.map((section) => (
          <div key={section}>
            <p className="mb-1.5 px-2.5 text-[12px] font-semibold tracking-wide text-slate-400 uppercase">{section}</p>
            <ul>
              {DOCS.filter((d) => d.section === section).map((d) => (
                <li key={d.slug}>
                  <Link
                    href={d.slug === DOCS[0]!.slug ? "/docs" : `/docs?page=${d.slug}`}
                    scroll={false}
                    aria-current={d.slug === open.slug ? "page" : undefined}
                    className={cn(
                      "block rounded-lg px-2.5 py-1.5 text-sm transition-colors",
                      d.slug === open.slug ? "bg-pax2-surface font-medium text-pax2-blue shadow-e1" : "text-slate-600 hover:bg-pax2-surface/70 hover:text-slate-900",
                    )}
                  >
                    {d.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <article className="min-w-0 max-w-[720px]">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <h1 className="font-display m-0 text-[26px] text-pax2-blue">{open.title}</h1>
          {open.admins && <Badge tone="violet">Admins</Badge>}
        </div>
        <DocMarkdown>{open.body}</DocMarkdown>
      </article>
    </div>
  )
}
