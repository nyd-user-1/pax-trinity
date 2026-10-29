import { FAQ } from "./faq"
import { FEATURES } from "./features"
import { GETTING_STARTED } from "./getting-started"
import { PARTNERS } from "./partners"
import { RELEASE_NOTES } from "./release-notes"
import type { Doc, DocSection } from "./types"

export type { Doc, DocSection } from "./types"

export const SECTIONS: DocSection[] = ["Getting started", "Partner onboarding", "Features", "FAQ", "Release notes"]
export const DOCS: Doc[] = [...GETTING_STARTED, ...PARTNERS, ...FEATURES, ...FAQ, ...RELEASE_NOTES]
export const docBySlug = (slug: string | undefined) => DOCS.find((d) => d.slug === slug)
