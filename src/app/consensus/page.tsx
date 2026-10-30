import { ChartColumn, MessagesSquare, ShieldCheck, Vote } from "lucide-react"

import { PageTabs } from "@/components/settings/blocks"
import { currentUser } from "@/lib/auth"
import { conversation, conversations } from "@/lib/consensus/store"

import { AdminPanel } from "./_panels/admin"
import { QuestionsPanel } from "./_panels/questions"
import { ResultsPanel } from "./_panels/results"
import { SurveysPanel } from "./_panels/surveys"

// /consensus — one page, four tabs (the 2026-10-27 consolidation): Questions,
// where a conversation is voted on; Surveys, the conversations as a
// directory; Results, what it thought; Admin, building and watching one, for
// admins only. ?tab= picks the panel and ?c= the conversation; the old
// sub-routes (/consensus/survey, /report, /admin) answer a redirect into
// their tab. Since 2026-10-30 (Brendan) Questions comes first, on the bare
// address, and the page wears /models' layout: its tab row and its 920px
// column, every card a block.
export const metadata = {
  title: "Consensus",
  description: "Opinion gathered at scale: people vote on each other's statements, and the groups emerge from the votes rather than from who spoke loudest.",
}

const TABS = [
  { key: "questions", label: "Questions", icon: Vote },
  { key: "surveys", label: "Surveys", icon: MessagesSquare },
  { key: "results", label: "Results", icon: ChartColumn },
  { key: "admin", label: "Admin", icon: ShieldCheck, admin: true },
] as const
type Tab = (typeof TABS)[number]["key"]

export default async function ConsensusPage({ searchParams }: { searchParams: Promise<{ tab?: string; c?: string }> }) {
  const { tab, c: slug } = await searchParams
  const admin = !!(await currentUser())?.admin
  const open = TABS.filter((t) => !("admin" in t) || admin)
  const current: Tab = open.find((t) => t.key === tab)?.key ?? "questions"
  const all = await conversations()
  const c = (await conversation(slug ?? "")) ?? all[0]!
  // The survey's number, the first part of every card's code (components/consensus/question-code.ts).
  const survey = Math.max(0, all.findIndex((x) => x.slug === c.slug)) + 1
  const keep = slug ? `c=${encodeURIComponent(slug)}` : ""
  const hrefOf = (key: Tab) => (key === "questions" ? `/consensus${keep ? `?${keep}` : ""}` : `/consensus?tab=${key}${keep ? `&${keep}` : ""}`)

  return (
    <div className="mx-auto w-full max-w-[920px] space-y-8 pb-10">
      <PageTabs tabs={open.map((t) => ({ key: t.key, label: t.label, icon: t.icon, href: hrefOf(t.key) }))} active={current} />
      {current === "questions" && <QuestionsPanel conversation={c} survey={survey} />}
      {current === "surveys" && <SurveysPanel all={all} admin={admin} />}
      {current === "results" && <ResultsPanel conversation={c} survey={survey} />}
      {current === "admin" && <AdminPanel conversation={c} survey={survey} />}
    </div>
  )
}
