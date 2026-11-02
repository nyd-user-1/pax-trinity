"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChartColumn, ClipboardCheck, ClipboardList, Copy, FileText, FlaskConical, MessagesSquare, PanelRight, Plus, Shield, Vote } from "lucide-react"

import { BankFrame, BankSplit, RailToggle } from "@/components/bank/bank-frame"
import { BankRail, RailGroup, RailRow } from "@/components/bank/bank-rail"
import { CardList, type Card, type Split } from "@/components/bank/card-list"
import { MenuFoot, MenuHeader, MenuRow, MenuSeparator } from "@/components/kebab-menu"
import { PaneTitleRow, RefreshButton } from "@/components/bank/pane-bars"
import { questionCode, questionNumbers } from "@/components/consensus/question-code"
import { Button } from "@govblock/ui/components/nova/button"
import { consensusStatements, divisiveStatements, share, type Conversation } from "@/lib/consensus/data"
import { readDraft, type SurveyDraft } from "@/lib/consensus/draft"
import { PRETRAININGS } from "@/lib/consensus/pretrainings"
import { CONSENSUS, MASSACHUSETTS, statementRows } from "@/lib/consensus/rows"
import { buildInfo } from "@/app/america-thinks/audience-data"
import { AboutPanel, type About } from "@/app/america-thinks/audience-pane"
import { QuestionTable } from "@/app/america-thinks/question-table"
import { fmtNumber } from "@/lib/format"
import { consensusHref, newTestHref, testsHref, type Surface } from "@/lib/survey-links"
import { SURVEYS } from "@/lib/surveys/catalog"

// /survey — the second consensus experience on /audience's anatomy: the
// surveys and pretrainings as the rail's folders, the open one's questions as
// the middle cards (the statements of a survey; the questions of the draft
// built from /audience's Add to survey, the pretraining question set), and
// the open question's results in the pane — the split everyone gave, then
// each opinion group's. A card's chip is the report's own read: Agreement
// and Split are the Results tab's top six of each, Held back a moderator's.
// Since 2026-10-31 (Brendan) the rail also holds Consensus (Questions, Surveys,
// Results, Admin) and, for admins, the message tests: each row opens its page
// here, rendered by the server (surfaces.tsx), in place of the list. An open
// statement reads in America Thinks' own question pane (Brendan, 2026-10-31):
// its votes as that pane's rows (lib/consensus/rows.ts), with the Data,
// Crosstab, Trend, Topline and Global views and the About panel a clicked
// value opens.
// It wears America Thinks' anatomy (Brendan, 2026-10-31): one bar all the way
// down, the rows alone on load, a question opening the split, the split's
// kebab giving the question the screen, and Back going one layer up.

export type SurveyMeta = { slug: string; title: string; statements: number }

const DRAFT = "draft"
/** A seed pretraining's folder (lib/consensus/pretrainings.ts), apart from the surveys' slugs. */
const PRE = "pretraining:"

/** The rows' geographies, for the pane's baseline and its names. */
const GEO_LEVEL = new Map([
  ["US", "US"],
  [MASSACHUSETTS, "STATE"],
])
const place = (code: string) => (code === MASSACHUSETTS ? "Massachusetts" : code === "US" ? "United States" : code)

export function SurveyInbox({
  surveys,
  open,
  admin,
  surface,
  page,
  demo,
}: {
  surveys: SurveyMeta[]
  open: Conversation | null
  admin: boolean
  surface: Surface | null
  page: React.ReactNode
  /** The votes are the committed seed's invented ones: the rows add the demo's breakdowns and earlier waves. */
  demo: boolean
}) {
  const router = useRouter()
  const [draft, setDraft] = React.useState<SurveyDraft | null>(null)
  // The open folder: a survey's slug (the server's open one), a seed pretraining or the draft.
  const [folder, setFolder] = React.useState<string | null>(open?.slug ?? null)
  const [selected, setSelected] = React.useState<string | null>(null)
  const [split, setSplit] = React.useState<Split>("none")
  const [query, setQuery] = React.useState("")
  // The open question's title row carries the search, as America Thinks' does.
  const [paneSearch, setPaneSearch] = React.useState(false)
  // A clicked value's About panel, over the open question's view.
  const [about, setAbout] = React.useState<About | null>(null)
  React.useEffect(() => setAbout(null), [selected])

  // The draft lives in this browser's localStorage, so it is read after mount.
  React.useEffect(() => setDraft(readDraft()), [])
  // A survey the server has just opened takes the folder.
  const openSlug = open?.slug ?? null
  React.useEffect(() => {
    if (openSlug) setFolder(openSlug)
  }, [openSlug])
  React.useEffect(() => setSelected(null), [folder])

  // The open pretraining, the browser's draft or a seed one; its questions are the cards.
  const pretraining: SurveyDraft | null = folder === DRAFT ? draft : (PRETRAININGS.find((p) => PRE + p.slug === folder) ?? null)
  const onDraft = folder === DRAFT || !!folder?.startsWith(PRE)
  const verdicts = React.useMemo(() => {
    const m = new Map<number, string>()
    if (!open) return m
    for (const s of divisiveStatements(open)) m.set(s.tid, "Split")
    for (const s of consensusStatements(open)) m.set(s.tid, "Agreement")
    for (const s of open.statements) if (s.moderated === -1) m.set(s.tid, "Held back")
    return m
  }, [open])

  // The open folder's questions in its own order, through the search.
  const ids = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    const all = onDraft ? (pretraining?.questions ?? []).map((x, i) => ({ id: String(i), text: x.text })) : (open?.statements ?? []).map((s) => ({ id: String(s.tid), text: s.text }))
    return all.filter((x) => !q || x.text.toLowerCase().includes(q)).map((x) => x.id)
  }, [onDraft, pretraining, open, query])

  const statementOf = (id: string) => open?.statements.find((s) => String(s.tid) === id) ?? null
  const draftQuestionOf = (id: string) => pretraining?.questions[Number(id)] ?? null

  // The house row's kebab (Brendan, 2026-10-31): the question's code leads and copies, its survey at the foot.
  const rowMenu = (id: string, text: string, code: string | null, foot: string, sub?: string) => (
    <>
      {code && (
        <>
          <MenuHeader text={code} copy={code} />
          <MenuSeparator />
        </>
      )}
      <MenuRow icon={<PanelRight />} label="Open split view" onClick={() => openQuestion(id)} />
      <MenuRow icon={<Copy />} label="Copy the question" onClick={() => void navigator.clipboard.writeText(text)} />
      <MenuSeparator />
      <MenuFoot title={foot} sub={sub} />
    </>
  )
  const cardOf = (id: string): Card => {
    if (onDraft) {
      const dq = draftQuestionOf(id)
      const n = dq?.options.length ?? 0
      // A seed question names its America Thinks source under the pretraining at the menu's foot.
      const from = dq && "source" in dq ? String(dq.source) : undefined
      return { title: dq?.text ?? "", hint: dq?.text, chip: n ? `${n} ${n === 1 ? "option" : "options"}` : null, menu: dq ? rowMenu(id, dq.text, null, pretraining?.title ?? "Pretraining", from) : undefined }
    }
    const s = statementOf(id)
    if (!s) return { title: "" }
    const v = share(s.votes)
    const code = open && numbers.has(s.tid) ? questionCode(surveyNumber, numbers.get(s.tid) as number) : null
    return {
      title: s.text,
      hint: s.text,
      chip: verdicts.get(s.tid) ?? null,
      span: s.votes.seen ? `${Math.round(v.agree)}% agree` : null,
      detail: `${Math.round(v.disagree)}% disagree · ${Math.round(v.pass)}% pass · ${fmtNumber(s.votes.seen)} saw it`,
      menu: rowMenu(id, s.text, code, open?.title ?? "Survey", verdicts.get(s.tid)),
    }
  }

  const openSurvey = (slug: string) => {
    setFolder(slug)
    // From one of the rail's pages, a folder brings the inbox back.
    if (surface || slug !== open?.slug) router.push(`/survey?c=${encodeURIComponent(slug)}`, { scroll: false })
  }

  const folderName = onDraft ? (pretraining?.title ?? "Draft survey") : (open?.title ?? "")
  // A pretraining opens in the inbox; from one of the rail's pages it brings the inbox back, keeping the
  // open survey's ?c= so the server's open survey doesn't change and take the folder back.
  const openPretraining = (key: string) => {
    setFolder(key)
    if (surface) router.push(open ? `/survey?c=${encodeURIComponent(open.slug)}` : "/survey", { scroll: false })
  }
  const rail = (
    <BankRail title="Surveys">
      <RailGroup label="Toplines">
        {SURVEYS.map((s) => (
          <RailRow key={s.slug} href={`/survey/${s.slug}`} icon={FileText} label={s.title} count={s.questions.length} />
        ))}
      </RailGroup>
      <RailGroup>
        {surveys.map((s) => (
          <RailRow key={s.slug} on={!surface && folder === s.slug} onClick={() => openSurvey(s.slug)} pane={`/survey?c=${encodeURIComponent(s.slug)}`} icon={ClipboardList} label={s.title} count={s.statements} />
        ))}
      </RailGroup>
      <RailGroup label="Pretrainings">
        {PRETRAININGS.map((p) => (
          <RailRow key={p.slug} on={!surface && folder === PRE + p.slug} onClick={() => openPretraining(PRE + p.slug)} icon={FlaskConical} label={p.title} count={p.questions.length} />
        ))}
        {!!draft?.questions.length && <RailRow on={!surface && folder === DRAFT} onClick={() => openPretraining(DRAFT)} icon={FlaskConical} label={draft.title} count={draft.questions.length} />}
      </RailGroup>
      <RailGroup label="Consensus">
        <RailRow href={consensusHref("questions", open?.slug)} on={surface === "questions"} icon={Vote} label="Questions" />
        <RailRow href={consensusHref("surveys")} on={surface === "surveys"} icon={MessagesSquare} label="Surveys" />
        <RailRow href={consensusHref("results", open?.slug)} on={surface === "results"} icon={ChartColumn} label="Results" />
        {admin && <RailRow href={consensusHref("admin", open?.slug)} on={surface === "admin"} icon={Shield} label="Admin" />}
      </RailGroup>
      {admin && (
        <RailGroup label="Tests">
          <RailRow href={testsHref()} on={surface === "tests" || surface === "test" || surface === "edit-test"} icon={ClipboardCheck} label="All tests" />
          <RailRow href={newTestHref()} on={surface === "new-test"} icon={Plus} label="New test" />
        </RailGroup>
      )}
    </BankRail>
  )

  // A question opens beside the list, as a row on America Thinks does.
  const openQuestion = (id: string) => {
    setSelected(id)
    setSplit("vertical")
  }
  const list = (s: Split, searchInPane = false) => (
    <CardList
      ids={ids}
      card={cardOf}
      selected={selected}
      onOpen={openQuestion}
      split={s}
      onSplit={setSplit}
      query={query}
      onQuery={setQuery}
      placeholder="Search questions…"
      compact
      onSearch={searchInPane ? () => setPaneSearch(true) : undefined}
      loading={false}
      error={null}
      empty={query.trim() ? `Nothing matching “${query.trim()}”.` : surveys.length ? "No questions in this survey." : "No surveys on file."}
    />
  )

  const statement = selected && !onDraft ? statementOf(selected) : null
  const draftQuestion = selected && onDraft ? draftQuestionOf(selected) : null

  // The open statement as America Thinks' rows, its code (question, then survey) the metric's id.
  const numbers = React.useMemo(() => (open ? questionNumbers(open) : new Map<number, number>()), [open])
  const surveyNumber = Math.max(1, surveys.findIndex((x) => x.slug === open?.slug) + 1)
  const metric = statement && open ? (numbers.has(statement.tid) ? questionCode(surveyNumber, numbers.get(statement.tid) as number) : `${open.slug}-${statement.tid}`) : null
  const rows = React.useMemo(() => (statement && open && metric ? statementRows(open, statement, metric, demo) : []), [statement, open, metric, demo])
  const info = React.useMemo(() => buildInfo(rows, GEO_LEVEL), [rows])
  const sourceLabel = open ? `Consensus: ${open.title} (PAX)` : null

  // Back, one layer up: the full screen to the split, the split to the rows.
  const goBack = () => {
    if (split === "vertical") {
      setSelected(null)
      setSplit("none")
    } else setSplit("vertical")
  }
  const back = selected && (
    <Button variant="ghost" size="icon-sm" aria-label="Back" title="Back" className="-ml-1.5 shrink-0" onClick={goBack}>
      <ArrowLeft className="size-4" />
    </Button>
  )
  const search = {
    query,
    onQuery: setQuery,
    placeholder: "Search questions…",
    open: paneSearch,
    onOpen: () => setPaneSearch(true),
    onClose: () => {
      setQuery("")
      setPaneSearch(false)
    },
  }
  const statementInfo = metric ? info.get(metric) : undefined
  const pane =
    statement && metric && statementInfo ? (
      <QuestionTable
        rows={rows}
        title={statement.text}
        metric={metric}
        place={place}
        info={statementInfo}
        source={CONSENSUS}
        sourceLabel={sourceLabel}
        wording={statement.text}
        about={about}
        onPick={setAbout}
        onBack={goBack}
        search={search}
        local
        aboutLayer={
          about && (
            <AboutPanel
              layer
              about={about}
              onClose={() => setAbout(null)}
              source={CONSENSUS}
              groups={[{ source: CONSENSUS, label: sourceLabel ?? "Consensus", rows: rows.length, files: [] }]}
              files={{}}
              info={info}
              label={() => statement.text}
              place={place}
              geoLevel={GEO_LEVEL}
            />
          )
        }
      />
    ) : (
      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
        <PaneTitleRow title={draftQuestion?.text ?? folderName} leading={back || undefined} search={search}>
          {!onDraft && <RefreshButton onRefresh={() => router.refresh()} />}
        </PaneTitleRow>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {draftQuestion ? (
            <ul className="divide-y px-4">
              {draftQuestion.options.map((o) => (
                <li key={o} className="py-2.5 text-sm">
                  {o}
                </li>
              ))}
              {!draftQuestion.options.length && <li className="py-2.5 text-sm text-muted-foreground">No answer options on file.</li>}
            </ul>
          ) : (
            <div className="flex flex-col items-center px-8 py-16 text-center">
              <p className="text-lg">No question open</p>
              <p className="mt-3 text-sm text-muted-foreground">
                {ids.length.toLocaleString("en-US")} questions in {folderName}.
              </p>
            </div>
          )}
        </div>
      </div>
    )

  return (
    <BankFrame rail={rail} crumb="Survey" search={{ query, onQuery: setQuery, placeholder: "Search questions" }} bare tone="rail" railDefaultOpen={false}>
      {page ? (
        <>
          {/* A rail page has no list, so its one bar holds the sidebar's toggle. */}
          <div className="flex h-[52px] shrink-0 items-center gap-1 border-b px-3">
            <RailToggle />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[920px] px-5 py-6 md:px-8 md:py-8">{page}</div>
          </div>
        </>
      ) : selected ? (
        // The split off, the question has the screen and its title row leads with Back.
        <BankSplit list={split === "vertical" ? list("vertical", true) : undefined} pane={pane} />
      ) : (
        <BankSplit list={list(split)} pane={split === "vertical" && pane} fold={{ size: 420, min: 320, max: 640 }} />
      )}
    </BankFrame>
  )
}
