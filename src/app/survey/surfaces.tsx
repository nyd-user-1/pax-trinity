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
import { StatusControls } from "@/app/message-tests/status-controls"
import { LifeChip } from "@/components/life-chip"
import { lifecycleOf } from "@/lib/lifecycle/store"
import { sendCounts } from "@/lib/sends/engine"
import { TestsTable } from "@/app/message-tests/tests-table"
import { currentUser } from "@/lib/auth"
import { lensOf, seesConversation, seesTopline } from "@/lib/partners/sponsors"
import { armRecordings } from "@/lib/clips/recorded"
import { PRETRAININGS } from "@/lib/consensus/pretrainings"
import { conversation, conversations } from "@/lib/consensus/store"
import { takenBy } from "@/lib/consensus/taken"
import { BANK, CONSENSUS_TABS, editTestHref, newTestHref, testHref, testsHref, type ConsensusTab, type Surface } from "@/lib/survey-links"
import { consensusOrigin, pretrainingOrigin, surveyOrigin, testOrigin, type Origin } from "@/lib/surveys/question-bank"
import type { InstrumentKind } from "@/lib/lifecycle/rules"
import { SURVEYS } from "@/lib/surveys/catalog"
import { getTest, listTests } from "@/lib/tests/store"
import { blankTest } from "@/lib/tests/types"
import { buttonVariants } from "@/ui/components/nova/button"

import { QuestionBank } from "./question-bank"

// The pages /survey's rail opens inside its inbox (Brendan, 2026-10-31): Consensus's four surfaces (Questions,
// where a conversation is voted on; Surveys, the conversations as a directory, each card opening /s/<slug>; Results, what it thought; Admin,
// for admins) and the message tests (the list, a new test, a test's monitor and its edit form, admins only).
// They were /consensus and /message-tests; the panels and forms are theirs, unchanged, read from where they stand.

const isConsensusTab = (s: Surface): s is ConsensusTab => (CONSENSUS_TABS as readonly string[]).includes(s)

/** The entry questions whose balance across arms a test's monitor shows. */
const BALANCE = ["party", "vote2024"]

/** The page `s` names, for the inbox to show in place of its list; null where there is none (Admin for a non-admin). */
export async function surfacePage({ s, c, id }: { s: Surface; c?: string; id?: string }): Promise<ReactNode> {
  if (isConsensusTab(s)) {
    const user = await currentUser()
    const admin = !!user?.admin
    if (s === "admin" && !admin) return null
    // A partner's lens: its own sponsor's surveys alone, the one asked for only if it is theirs.
    const lens = lensOf(user)
    const all = (await conversations()).filter((x) => seesConversation(lens, x.slug))
    const asked = await conversation(c ?? "")
    const open = (asked && seesConversation(lens, asked.slug) ? asked : null) ?? all[0]
    if (!open) return null
    // The survey's number, the first part of every card's code (components/consensus/question-code.ts).
    const survey = Math.max(0, all.findIndex((x) => x.slug === open.slug)) + 1
    // No one takes a survey twice (Brendan, 2026-11-02): the reader's kept answers, where they have any.
    if (s === "questions") return <QuestionsPanel conversation={open} survey={survey} taken={user ? await takenBy(open.slug, user.email) : null} keep={!!user} state={(await lifecycleOf("consensus", open.slug)).state} />
    if (s === "surveys") {
      const taken = user ? (await Promise.all(all.map(async (x) => ((await takenBy(x.slug, user.email)) ? x.slug : null)))).filter((x): x is string => !!x) : []
      const states = Object.fromEntries(await Promise.all(all.map(async (x) => [x.slug, (await lifecycleOf("consensus", x.slug)).state] as const)))
      return <SurveysPanel all={all} taken={taken} states={states} />
    }
    if (s === "results") return <ResultsPanel conversation={open} survey={survey} />
    return <AdminPanel conversation={open} survey={survey} />
  }

  // The Question Bank: the topline surveys, the Consensus surveys, the pretrainings and, for an admin, the
  // message tests (theirs alone, as their pages are). The browser adds its own draft.
  if (s === BANK) {
    const user = await currentUser()
    const admin = !!user?.admin
    // A partner's bank lists its own instruments' questions alone: its toplines and surveys, no seed pretraining.
    const lens = lensOf(user)
    const [every, tests] = await Promise.all([conversations(), admin ? listTests().then((r) => r.tests) : []])
    const all = every.filter((x) => seesConversation(lens, x.slug))
    // Each place with its lifecycle state, as its chip says it.
    const at = async (o: Origin, kind: InstrumentKind, id: string): Promise<Origin> => ({ ...o, state: (await lifecycleOf(kind, id)).state })
    const origins = await Promise.all([
      ...SURVEYS.filter((x) => seesTopline(lens, x.slug)).map((x) => at(surveyOrigin(x), "survey", x.slug)),
      ...all.map((x) => at(consensusOrigin(x), "consensus", x.slug)),
      ...tests.map((x) => at(testOrigin(x), "test", x.id)),
      ...(lens === null ? PRETRAININGS : []).map((x) => at(pretrainingOrigin(x), "pretraining", x.slug)),
    ])
    return <QuestionBank origins={origins} />
  }

  // The message tests are admins' alone; anyone else goes to sign in, and comes back here.
  const here = s === "test" && id ? testHref(id) : s === "edit-test" && id ? editTestHref(id) : s === "new-test" ? newTestHref() : testsHref()
  const user = await adminOrSignin(here)

  if (s === "tests") {
    const { tests, reachable } = await listTests()
    // Each test's state, and under an Open one the counts of what its sends have done.
    const rows = await Promise.all(
      tests.map(async (t) => {
        const { state } = await lifecycleOf("test", t.id)
        const sent = state === "Open" ? await sendCounts("test", t.id).catch(() => null) : null
        return { id: t.id, title: t.title, state, arms: t.arms.length, targetPerArm: t.targetPerArm, updatedAt: t.updatedAt ?? null, sent }
      }),
    )
    return <TestsTable reachable={reachable} tests={rows} />
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
  // Its lifecycle (lib/lifecycle): the chip says where it stands, the controls its next step.
  const life = await lifecycleOf("test", test.id)
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">{test.title}</h2>
        <LifeChip state={life.state} />
        <span className="font-mono text-xs text-slate-400">{test.id}</span>
        <div className="ml-auto flex items-center gap-2">
          <StatusControls id={test.id} state={life.state} superAdmin={user.superAdmin} />
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
