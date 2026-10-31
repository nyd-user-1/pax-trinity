// /docs' articles (Brendan, 2026-10-29; rebuilt as a help center on Notion's model, 2026-10-31). Each is markdown,
// written from the code as it stands: the pages themselves, src/lib/platform-guide.ts (the chat's own account of
// every page) and the commit history for the release notes. Revise an article when its page changes, as the
// platform guide is revised. The app speaks as I; the reader is you.

export type DocCategory = "get-started" | "results" | "research" | "surveys" | "video" | "tools" | "inbox" | "admin" | "partners" | "faq" | "releases" | "guides"

export type Doc = {
  slug: string
  title: string
  category: DocCategory
  /** The line under the title: what the article helps you do. */
  summary: string
  tags?: string[]
  /** Shown for pages only admins can open. */
  admins?: boolean
  body: string
}

/** A link to another article. */
export const doc = (slug: string) => `/docs/${slug}`
