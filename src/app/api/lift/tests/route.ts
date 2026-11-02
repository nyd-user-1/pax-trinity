import { NextResponse } from "next/server"

import type { SourceRow } from "@/app/america-thinks/audience-data"
import { currentUser } from "@/lib/auth"
import { readExport } from "@/lib/chat-data/america-thinks"
import { lensOf, sees, STUDY_SPONSOR } from "@/lib/partners/sponsors"
import { RESULT_SETS } from "@/lib/results"

// GET /api/lift/tests: Lift's Tests folder, the PAX test rows, through the reader's lens (Brendan, 2026-11-02): a
// partner gets its own sponsor's studies' rows alone, staff every row, as the export holds them. A row belongs to
// the register's wave fielded over its period (the rows carry their field period, lib/results' sets theirs), and
// the wave's study names the sponsor (lib/partners/sponsors.ts). The file is the one /audience-data/ serves, read
// where the server reads the export: this checkout's copy in development, the audience bucket's exports/ elsewhere.
// The static file stays public, America Thinks reading it, until Brendan rules on gating it.

export const dynamic = "force-dynamic"

const STUDY_BY_PERIOD = new Map(RESULT_SETS.map((s) => [`${s.fielded.start}|${s.fielded.end}`, s.study]))

export async function GET() {
  const lens = lensOf(await currentUser())
  const text = await readExport(["pax_test.json"]).catch((e) => {
    console.error("lift/tests: not read", e)
    return null
  })
  if (!text) return NextResponse.json({ error: "The tests could not be read." }, { status: 502 })
  const rows = JSON.parse(text) as SourceRow[]
  const shown = lens === null ? rows : rows.filter((r) => sees(lens, [STUDY_SPONSOR[STUDY_BY_PERIOD.get(`${r[2]}|${r[3]}`) ?? ""]]))
  return NextResponse.json(shown, { headers: { "cache-control": "private, no-store" } })
}
