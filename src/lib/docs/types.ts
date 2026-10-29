// /docs' articles (Brendan, 2026-10-29). Each is markdown, written from the code as it stands: the pages
// themselves, src/lib/platform-guide.ts (the chat's own account of every page), the sign-up and onboarding
// flow, and the commit history for the release notes. Revise an article when its page changes, as the
// platform guide is revised. The app speaks as I; the reader is you.

export type DocSection = "Getting started" | "Partner onboarding" | "Features" | "FAQ" | "Release notes"

export type Doc = {
  slug: string
  title: string
  section: DocSection
  /** Shown for pages only admins can open. */
  admins?: boolean
  body: string
}

/** A link to another article. */
export const doc = (slug: string) => `/docs?page=${slug}`
