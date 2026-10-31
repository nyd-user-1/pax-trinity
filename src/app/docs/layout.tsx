import { DocsNav, type NavCategory } from "@/components/docs/docs-nav"
import { CATEGORIES, inCategory } from "@/lib/docs"

// The help center's frame (Notion's Help Center, Brendan 2026-10-31): the sidebar, then the article's own column,
// which scrolls on its own (#docs-scroll, the contents' scroll-spy reads it). The shell lays /docs full-bleed.
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const categories: NavCategory[] = CATEGORIES.map((c) => ({
    id: c.id,
    title: c.title,
    docs: inCategory(c.id).map((d) => ({ slug: d.slug, title: d.title, admins: d.admins, find: `${d.title} ${d.summary} ${(d.tags ?? []).join(" ")}`.toLowerCase() })),
  }))
  return (
    <div className="flex min-h-0 flex-1">
      <div className="hidden md:block">
        <DocsNav categories={categories} />
      </div>
      <div id="docs-scroll" className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
