import { DocsPage } from "@/components/docs-page"
import { TabRail, type RailTab } from "@/components/tab-rail"
import { currentUser } from "@/lib/auth"
import { conversation, conversations } from "@/lib/consensus/store"

import { AdminPanel } from "./_panels/admin"
import { QuestionsPanel } from "./_panels/questions"
import { ResultsPanel } from "./_panels/results"
import { SurveysPanel } from "./_panels/surveys"

// /consensus — one page, four tabs (the 2026-10-27 consolidation): Surveys,
// the conversations as a directory; Questions, where one is voted on;
// Results, what it thought; Admin, building and watching one, for admins
// only. ?tab= picks the panel and ?c= the conversation; the old sub-routes
// (/consensus/survey, /report, /admin) answer a redirect into their tab.
const title = "Consensus"
const description = "Opinion gathered at scale: people vote on each other's statements, and the groups emerge from the votes rather than from who spoke loudest."

export const metadata = { title, description }

const TABS = [
  { key: "surveys", label: "Surveys" },
  { key: "questions", label: "Questions" },
  { key: "results", label: "Results" },
  { key: "admin", label: "Admin", admin: true },
] as const
type Tab = (typeof TABS)[number]["key"]

export default async function ConsensusPage({ searchParams }: { searchParams: Promise<{ tab?: string; c?: string }> }) {
  const { tab, c: slug } = await searchParams
  const admin = !!(await currentUser())?.admin
  const open = TABS.filter((t) => !("admin" in t) || admin)
  const current: Tab = open.find((t) => t.key === tab)?.key ?? "surveys"
  const all = await conversations()
  const c = (await conversation(slug ?? "")) ?? all[0]!
  const keep = slug ? `&c=${encodeURIComponent(slug)}` : ""
  const tabs: RailTab[] = open.map((t) => ({ key: t.key, label: t.label, href: t.key === "surveys" ? "/consensus" : `/consensus?tab=${t.key}${keep}` }))

  return (
    <DocsPage title={title} description={description} lead={<TabRail tabs={tabs} active={current} className="mt-4" />}>
      {current === "surveys" && <SurveysPanel all={all} admin={admin} />}
      {current === "questions" && <QuestionsPanel conversation={c} />}
      {current === "results" && <ResultsPanel conversation={c} />}
      {current === "admin" && <AdminPanel conversation={c} />}
    </DocsPage>
  )
}
