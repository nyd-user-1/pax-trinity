import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react"

import { DocMarkdown } from "@/components/docs/doc-markdown"
import { DocsToc } from "@/components/docs/docs-toc"
import { categoryOf, DOCS, docBySlug, headingsOf, neighbors, readMinutes } from "@/lib/docs"

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug }))
}

export async function generateMetadata({ params }: Props) {
  const d = docBySlug((await params).slug)
  return { title: d ? `${d.title} · Docs` : "Docs" }
}

// A help center article (Notion's, Brendan 2026-10-31): the trail to its category, the title, the line under it,
// its tags and reading time, the article, the articles either side; its contents at the right.
export default async function DocPage({ params }: Props) {
  const { slug } = await params
  const d = docBySlug(slug)
  if (!d) notFound()
  if (d.slug !== slug) redirect(`/docs/${d.slug}`)
  const category = categoryOf(d.category)
  const { prev, next } = neighbors(d.slug)
  const tags = [...(d.admins ? ["Staff"] : []), ...(d.tags ?? []).filter((t) => !(d.admins && t === "Staff"))]

  return (
    <div className="mx-auto flex max-w-[1260px] gap-16 px-10 pt-10 pb-28">
      <article className="min-w-0 max-w-[780px] flex-1">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[15px] text-slate-500">
          <Link href="/docs" className="hover:text-slate-900">
            Help Center
          </Link>
          <ChevronRight aria-hidden className="size-4 text-slate-400" />
          <Link href={category ? `/docs#${category.id}` : "/docs/video-guides"} className="text-slate-800 hover:text-slate-900">
            {category?.title ?? "Video guides"}
          </Link>
        </nav>

        <h1 className="mt-6 text-[42px] leading-[1.12] font-bold tracking-tight text-balance text-slate-900">{d.title}</h1>
        <p className="mt-5 text-[20px] leading-relaxed text-slate-500">{d.summary}</p>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {tags.map((t) => (
            <span key={t} className="rounded-md bg-pax2-mist px-2 py-0.5 text-[13px] font-medium text-slate-600">
              {t}
            </span>
          ))}
          <span className="ml-1 flex items-center gap-1.5 text-[14px] text-slate-500">
            <BookOpen aria-hidden className="size-4" />
            {readMinutes(d.body)} min read
          </span>
        </div>
        <hr className="mt-9 mb-10 border-slate-200" />

        <DocMarkdown>{d.body}</DocMarkdown>

        {(prev || next) && (
          <div className="mt-16 grid gap-4 border-t border-slate-200 pt-8 sm:grid-cols-2">
            {prev ? (
              <Link href={`/docs/${prev.slug}`} className="group rounded-xl border border-slate-200 px-5 py-4 transition-colors hover:border-pax2-light-blue">
                <span className="flex items-center gap-1 text-[13px] text-slate-500">
                  <ChevronLeft aria-hidden className="size-4" />
                  Previous
                </span>
                <span className="mt-1 block font-medium text-slate-900 group-hover:text-pax2-blue">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link href={`/docs/${next.slug}`} className="group rounded-xl border border-slate-200 px-5 py-4 text-right transition-colors hover:border-pax2-light-blue">
                <span className="flex items-center justify-end gap-1 text-[13px] text-slate-500">
                  Next
                  <ChevronRight aria-hidden className="size-4" />
                </span>
                <span className="mt-1 block font-medium text-slate-900 group-hover:text-pax2-blue">{next.title}</span>
              </Link>
            )}
          </div>
        )}
      </article>
      <aside className="hidden w-[230px] shrink-0 pt-[120px] xl:block">
        <DocsToc headings={headingsOf(d.body)} />
      </aside>
    </div>
  )
}
