import type { Metadata } from "next"

import { currentUser } from "@/lib/auth"
import { databaseKind } from "@/lib/policy/db"
import { conversations } from "@/lib/consensus/store"
import { isSurface } from "@/lib/survey-links"

import { surfacePage } from "./surfaces"
import { SurveyInbox } from "./survey-inbox"

export const metadata: Metadata = { title: "Survey", description: "The consensus surveys on the audience anatomy: a survey's questions as cards, each one's results beside them." }

// /survey — consensus on the inbox pattern (Brendan, 2026-10-27: the gmail
// pattern mapped onto surveys). The server reads the conversations and hands
// the client the list and the open one alone (?c=, the first by default), so
// a large room's statements travel only when it is opened. Since 2026-10-31
// (Brendan) Consensus and the message tests live here too: ?s= names the page
// the rail opened (lib/survey-links.ts), rendered here and shown in the inbox
// in place of its list.
export default async function SurveyPage({ searchParams }: { searchParams: Promise<{ c?: string; s?: string; id?: string }> }) {
  const { c: slug, s, id } = await searchParams
  const [all, user] = await Promise.all([conversations(), currentUser()])
  const open = all.find((c) => c.slug === slug) ?? all[0] ?? null
  const surface = isSurface(s) ? s : null
  const page = surface ? await surfacePage({ s: surface, c: slug, id }) : null
  return (
    <SurveyInbox
      surveys={all.map((c) => ({ slug: c.slug, title: c.title, statements: c.statements.length }))}
      open={open}
      admin={!!user?.admin}
      surface={page ? surface : null}
      page={page}
      demo={databaseKind() === "none"}
    />
  )
}
