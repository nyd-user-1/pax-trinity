import type { ResultSet } from "@/lib/results/types"
import { slugOf } from "@/components/report/report-math"

import { RESULT_SETS } from "@/lib/results"

// The one place /reports reads its data: the result sets, grouped into
// studies by their study string, waves in order.

export type Study = { slug: string; name: string; waves: ResultSet[] }

export function studies(): Study[] {
  const by = new Map<string, ResultSet[]>()
  for (const rs of RESULT_SETS) by.set(rs.study, [...(by.get(rs.study) ?? []), rs])
  return [...by.entries()].map(([name, waves]) => ({ slug: slugOf(name), name, waves: [...waves].sort((a, b) => a.wave - b.wave) }))
}

export const studyBySlug = (slug: string): Study | undefined => studies().find((s) => s.slug === slug)
