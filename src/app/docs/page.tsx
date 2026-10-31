import Link from "next/link"
import { redirect } from "next/navigation"
import { PlayCircle } from "lucide-react"

import { ICONS } from "@/components/docs/icons"
import { CATEGORIES, docBySlug, inCategory } from "@/lib/docs"
import { DOCS_MEDIA, GUIDES } from "@/lib/docs/media"

export const metadata = { title: "Docs" }


// The first three to read, each with its picture.
const START = [
  { slug: "welcome", shot: "lift" },
  { slug: "lift-analysis", shot: "lift-analysis" },
  { slug: "find-your-way", shot: "sidebar" },
]

// /docs: the Help Center's front page (Notion's, Brendan 2026-10-31): start here, the categories, the video
// guides. The old ?page= addresses land on their articles.
export default async function DocsHome({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page } = await searchParams
  const old = docBySlug(page)
  if (old) redirect(`/docs/${old.slug}`)

  return (
    <div className="mx-auto max-w-[1120px] px-10 pt-14 pb-24">
      <h1 className="text-[44px] leading-tight font-bold tracking-tight text-slate-900">How can I help?</h1>

      <section className="mt-12">
        <h2 className="mb-5 text-[13px] font-medium tracking-[0.08em] text-slate-500 uppercase">Start here</h2>
        <div className="grid gap-5 md:grid-cols-3">
          {START.map(({ slug, shot }) => {
            const d = docBySlug(slug)!
            return (
              <Link key={slug} href={`/docs/${slug}`} className="lift group overflow-hidden rounded-2xl border border-slate-200 bg-pax2-surface shadow-e1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${DOCS_MEDIA}/shots/${shot}.jpg`} alt="" loading="lazy" className="aspect-[16/10] w-full border-b border-slate-200 object-cover object-left-top" />
                <div className="p-5">
                  <p className="text-[17px] font-semibold text-slate-900 group-hover:text-pax2-blue">{d.title}</p>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-slate-500">{d.summary}</p>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="mb-5 text-[13px] font-medium tracking-[0.08em] text-slate-500 uppercase">Browse by topic</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CATEGORIES.map((c) => {
            const Icon = ICONS[c.id]
            const docs = inCategory(c.id)
            return (
              <Link key={c.id} id={c.id} href={`/docs/${docs[0]!.slug}`} className="lift group flex gap-4 rounded-2xl border border-slate-200 bg-pax2-surface p-5 shadow-e1">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-pax2-lavender text-pax2-blue">
                  <Icon aria-hidden className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[16px] font-semibold text-slate-900 group-hover:text-pax2-blue">{c.title}</span>
                  <span className="mt-1 block text-[14px] leading-relaxed text-slate-500">{c.blurb}</span>
                  <span className="mt-2 block text-[13px] text-slate-400">{docs.length === 1 ? "1 article" : `${docs.length} articles`}</span>
                </span>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="mt-16">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="text-[13px] font-medium tracking-[0.08em] text-slate-500 uppercase">Video guides</h2>
          <Link href="/docs/video-guides" className="text-[14px] font-medium text-pax2-light-blue hover:underline">
            See all
          </Link>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {GUIDES.slice(0, 3).map((g) => (
            <Link key={g.name} href={`/docs/${g.article}`} className="lift group overflow-hidden rounded-2xl border border-slate-200 bg-pax2-surface shadow-e1">
              <span className="relative block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`${DOCS_MEDIA}/videos/${g.name}.jpg`} alt="" loading="lazy" className="aspect-[16/10] w-full border-b border-slate-200 object-cover" />
                <PlayCircle aria-hidden className="absolute right-3 bottom-3 size-8 fill-white/90 text-pax2-blue" />
              </span>
              <span className="block p-5">
                <span className="block text-[16px] font-semibold text-slate-900 group-hover:text-pax2-blue">{g.title}</span>
                <span className="mt-1 block text-[14px] text-slate-500">{g.summary}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
