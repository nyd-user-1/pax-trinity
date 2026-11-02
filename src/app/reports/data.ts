import type { ResultSet } from "@/lib/results/types"
import { slugOf } from "@/components/report/report-math"

import { currentUser } from "@/lib/auth"
import { lensOf, sees, STUDY_SPONSOR, type Org } from "@/lib/partners/sponsors"
import { RESULT_SETS } from "@/lib/results"

// The one place /reports reads its data: the result sets, grouped into
// studies by their study string, waves in order. A partner's lens keeps its
// own sponsor's studies alone (lib/partners/sponsors.ts, 2026-11-02).

export type Study = { slug: string; name: string; waves: ResultSet[] }

export function studies(lens: Org | null = null): Study[] {
  const by = new Map<string, ResultSet[]>()
  for (const rs of RESULT_SETS) if (sees(lens, [STUDY_SPONSOR[rs.study]])) by.set(rs.study, [...(by.get(rs.study) ?? []), rs])
  return [...by.entries()].map(([name, waves]) => ({ slug: slugOf(name), name, waves: [...waves].sort((a, b) => a.wave - b.wave) }))
}

export const studyBySlug = (slug: string, lens: Org | null = null): Study | undefined => studies(lens).find((s) => s.slug === slug)

/** The signed-in reader's lens, for the reports' pages. */
export const readerLens = async () => lensOf(await currentUser())
