import type { ReactNode } from "react"
import Link from "next/link"
import { headers } from "next/headers"
import { notFound } from "next/navigation"

import { AdminPanel } from "@/app/consensus/_panels/admin"
import { QuestionsPanel } from "@/app/consensus/_panels/questions"
import { ResultsPanel } from "@/app/consensus/_panels/results"
import { SurveysPanel } from "@/app/consensus/_panels/surveys"
import { adminOrSignin } from "@/app/message-tests/admin"
import { FieldKit } from "@/app/message-tests/field-kit"
import { Monitor } from "@/app/message-tests/monitor"
import { SetupForm } from "@/app/message-tests/setup-form"
import { StatusChip } from "@/app/message-tests/status-chip"
import { StatusControls } from "@/app/message-tests/status-controls"
import { TestsTable } from "@/app/message-tests/tests-table"
import { currentUser } from "@/lib/auth"
import { armRecordings } from "@/lib/clips/recorded"
import { PRETRAININGS } from "@/lib/consensus/pretrainings"
import { conversation, conversations } from "@/lib/consensus/store"
import { BANK, CONSENSUS_TABS, editTestHref, newTestHref, testHref, testsHref, type ConsensusTab, type Surface } from "@/lib/survey-links"
import { consensusOrigin, pretrainingOrigin, surveyOrigin, testOrigin } from "@/lib/surveys/question-bank"
import { SURVEYS } from "@/lib/surveys/catalog"
import { getTest, listTests } from "@/lib/tests/store"
import { blankTest } from "@/lib/tests/types"
import { buttonVariants } from "@/ui/components/nova/button"

import { QuestionBank } from "./question-bank"

// The pages /survey's rail opens inside its inbox (Brendan, 2026-10-31): Consensus's four surfaces (Questions,
// where a conversation is voted on; Surveys, the conversations as a directory; Results, what it thought; Admin,
// for admins) and the message tests (the list, a new test, a test's monitor and its edit form, admins only).
// They were /consensus and /message-tests; the panels and forms are theirs, unchanged, read from where they stand.

const isConsensusTab = (s: Surface): s is ConsensusTab => (CONSENSUS_TABS as readonly string[]).includes(s)

/** The entry questions whose balance across arms a test's monitor shows. */
const BALANCE = ["party", "vote2024"]

/** The page `s` names, for the inbox to show in place of its list; null where there is none (Admin for a non-admin). */
export async function surfacePage({ s, c, id }: { s: Surface; c?: string; id?: string }): Promise<ReactNode> {
  if (isConsensusTab(s)) {
    const admin = !!(await currentUser())?.admin
    if (s === "admin" && !admin) return null
    const all = await conversations()
    const open = (await conversation(c ?? "")) ?? all[0]
    if (!open) return null
    // The survey's number, the first part of every card's code (components/consensus/question-code.ts).
    const survey = Math.max(0, all.findIndex((x) => x.slug === open.slug)) + 1
    if (s === "questions") return <QuestionsPanel conversation={open} survey={survey} />
    if (s === "surveys") return <SurveysPanel all={all} admin={admin} />
    if (s === "results") return <ResultsPanel conversation={open} survey={survey} />
    return <AdminPanel conversation={open} survey={survey} />
  }

  // The Question Bank: the topline surveys, the Consensus surveys, the pretrainings and, for an admin, the
  // message tests (theirs alone, as their pages are). The browser adds its own draft.
  if (s === BANK) {
    const admin = !!(await currentUser())?.admin
    const [all, tests] = await Promise.all([conversations(), admin ? listTests().then((r) => r.tests) : []])
    return <QuestionBank origins={[...SURVEYS.map(surveyOrigin), ...all.map(consensusOrigin), ...tests.map(testOrigin), ...PRETRAININGS.map(pretrainingOrigin)]} />
  }

  // The message tests are admins' alone; anyone else goes to sign in, and comes back here.
  const here = s === "test" && id ? testHref(id) : s === "edit-test" && id ? editTestHref(id) : s === "new-test" ? newTestHref() : testsHref()
  const user = await adminOrSignin(here)

  if (s === "tests") {
    const { tests, reachable } = await listTests()
    return <TestsTable reachable={reachable} tests={tests.map((t) => ({ id: t.id, title: t.title, status: t.status, arms: t.arms.length, targetPerArm: t.targetPerArm, updatedAt: t.updatedAt ?? null }))} />
  }

  const recorded = (await armRecordings(user).catch(() => [])).map((r) => ({ id: r.id, title: r.title, duration: r.duration ?? null }))
  if (s === "new-test") return <SetupForm mode="create" initial={blankTest()} recorded={recorded} />

  const test = id ? await getTest(id) : null
  if (!test) notFound()
  if (s === "edit-test") return <SetupForm mode="edit" initial={test} recorded={recorded} />

  // A recording kept in Clips names its own arm on the monitor.
  const kept = Object.fromEntries(recorded.filter((r) => test.arms.includes(r.id)).map((r) => [r.id, r.title]))
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.)/.test(host) ? "http" : "https")
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">{test.title}</h2>
        <StatusChip status={test.status} />
        <span className="font-mono text-xs text-slate-400">{test.id}</span>
        <div className="ml-auto flex items-center gap-2">
          <StatusControls id={test.id} status={test.status} />
          <Link href={editTestHref(test.id)} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Edit
          </Link>
        </div>
      </div>
      <FieldKit entryUrl={`${proto}://${host}/test/${test.id}?pid={PID}`} panel={test.panel} />
      <Monitor
        id={test.id}
        arms={test.arms}
        titles={kept}
        targetPerArm={test.targetPerArm}
        balance={test.entry.filter((q) => BALANCE.includes(q.key)).map((q) => ({ key: q.key, choices: q.choices }))}
      />
    </div>
  )
}
