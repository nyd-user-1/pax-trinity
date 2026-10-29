import "server-only"

import { PUBLISHED } from "@/components/clips/catalog"
import { PLACEBO } from "@/lib/tests/types"

/** An arm as people say it: the placebo, or the cut's messenger (else its title). */
export const armName = (id: string) => (id === PLACEBO ? "Placebo" : (PUBLISHED.find((c) => c.id === id)?.messenger ?? PUBLISHED.find((c) => c.id === id)?.title ?? id))
