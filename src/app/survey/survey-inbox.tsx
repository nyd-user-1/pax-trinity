"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChartColumn, ClipboardCheck, ClipboardList, FileText, FlaskConical, MessagesSquare, Plus, Shield, Vote } from "lucide-react"

import { BankFrame, BankSplit, RailToggle } from "@/components/bank/bank-frame"
import { BankRail, RailGroup, RailRow } from "@/components/bank/bank-rail"
import { CardList, type Card, type Split } from "@/components/bank/card-list"
import { PaneTitleRow, RefreshButton } from "@/components/bank/pane-bars"
import { SplitBar, SplitLegend } from "@/components/consensus/split-bar"
import { Button } from "@govblock/ui/components/nova/button"
import { agreement, consensusStatements, divisiveness, divisiveStatements, share, type Conversation, type Statement } from "@/lib/consensus/data"
import { readDraft, type SurveyDraft } from "@/lib/consensus/draft"
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
// here, rendered by the server (surfaces.tsx), in place of the list.
// It wears America Thinks' anatomy (Brendan, 2026-10-31): one bar all the way
// down, the rows alone on load, a question opening the split, the split's
// kebab giving the question the screen, and Back going one layer up.

export type SurveyMeta = { slug: string; title: string; statements: number }

const DRAFT = "draft"

export function SurveyInbox({ surveys, open, admin, surface, page }: { surveys: SurveyMeta[]; open: Conversation | null; admin: boolean; surface: Surface | null; page: React.ReactNode }) {
  const router = useRouter()
  const [draft, setDraft] = React.useState<SurveyDraft | null>(null)
  // The open folder: a survey's slug (the server's open one) or the draft.
  const [folder, setFolder] = React.useState<string | null>(open?.slug ?? null)
  const [selected, setSelected] = React.useState<string | null>(null)
  const [split, setSplit] = React.useState<Split>("none")
  const [query, setQuery] = React.useState("")
  // The open question's title row carries the search, as America Thinks' does.
  const [paneSearch, setPaneSearch] = React.useState(false)

  // The draft lives in this browser's localStorage, so it is read after mount.
  React.useEffect(() => setDraft(readDraft()), [])
  // A survey the server has just opened takes the folder.
  const openSlug = open?.slug ?? null
  React.useEffect(() => {
    if (openSlug) setFolder(openSlug)
  }, [openSlug])
  React.useEffect(() => setSelected(null), [folder])

  const onDraft = folder === DRAFT
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
    const all = onDraft ? (draft?.questions ?? []).map((x, i) => ({ id: String(i), text: x.text })) : (open?.statements ?? []).map((s) => ({ id: String(s.tid), text: s.text }))
    return all.filter((x) => !q || x.text.toLowerCase().includes(q)).map((x) => x.id)
  }, [onDraft, draft, open, query])

  const statementOf = (id: string) => open?.statements.find((s) => String(s.tid) === id) ?? null
  const draftQuestionOf = (id: string) => draft?.questions[Number(id)] ?? null

  const cardOf = (id: string): Card => {
    if (onDraft) {
      const dq = draftQuestionOf(id)
      const n = dq?.options.length ?? 0
      return { title: dq?.text ?? "", hint: dq?.text, chip: n ? `${n} ${n === 1 ? "option" : "options"}` : null }
    }
    const s = statementOf(id)
    if (!s) return { title: "" }
    const v = share(s.votes)
    return {
      title: s.text,
      hint: s.text,
      chip: verdicts.get(s.tid) ?? null,
      span: s.votes.seen ? `${Math.round(v.agree)}% agree` : null,
      detail: `${Math.round(v.disagree)}% disagree · ${Math.round(v.pass)}% pass · ${fmtNumber(s.votes.seen)} saw it`,
    }
  }

  const openSurvey = (slug: string) => {
    setFolder(slug)
    // From one of the rail's pages, a folder brings the inbox back.
    if (surface || slug !== open?.slug) router.push(`/survey?c=${encodeURIComponent(slug)}`, { scroll: false })
  }

  const folderName = onDraft ? (draft?.title ?? "Draft survey") : (open?.title ?? "")
  const rail = (
    <BankRail title="Surveys">
      <RailGroup label="Toplines">
        {SURVEYS.map((s) => (
          <RailRow key={s.slug} href={`/survey/${s.slug}`} icon={FileText} label={s.title} count={s.questions.length} />
        ))}
      </RailGroup>
      <RailGroup>
        {surveys.map((s) => (
          <RailRow key={s.slug} on={!surface && folder === s.slug} onClick={() => openSurvey(s.slug)} icon={ClipboardList} label={s.title} count={s.statements} />
        ))}
      </RailGroup>
      <RailGroup label="Pretrainings">
        {draft?.questions.length ? (
          <RailRow
            on={!surface && onDraft}
            onClick={() => {
              setFolder(DRAFT)
              if (surface) router.push("/survey", { scroll: false })
            }}
            icon={FlaskConical}
            label={draft.title}
            count={draft.questions.length}
          />
        ) : (
          <p className="px-3 py-2 text-sm text-slate-400">None yet</p>
        )}
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

  // Back, one layer up: the full screen to the split, the split to the rows.
  const back = selected && (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Back"
      title="Back"
      className="-ml-1.5 shrink-0"
      onClick={() => {
        if (split === "vertical") {
          setSelected(null)
          setSplit("none")
        } else setSplit("vertical")
      }}
    >
      <ArrowLeft className="size-4" />
    </Button>
  )
  const pane = (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col">
      <PaneTitleRow
        title={statement?.text ?? draftQuestion?.text ?? folderName}
        leading={back || undefined}
        search={{
          query,
          onQuery: setQuery,
          placeholder: "Search questions…",
          open: paneSearch,
          onOpen: () => setPaneSearch(true),
          onClose: () => {
            setQuery("")
            setPaneSearch(false)
          },
        }}
      >
        {!onDraft && <RefreshButton onRefresh={() => router.refresh()} />}
      </PaneTitleRow>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {statement && open ? (
          <StatementResults statement={statement} conversation={open} />
        ) : draftQuestion ? (
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

/** One statement's results: everyone's split, the report's two measures, each opinion group's split. */
function StatementResults({ statement: s, conversation: c }: { statement: Statement; conversation: Conversation }) {
  const groups = c.groups.filter((g) => s.byGroup[String(g.id)])
  return (
    <div className="flex flex-col gap-6 p-5">
      <SplitLegend />
      <div className="flex flex-col gap-2">
        <SplitBar votes={s.votes} />
        <p className="text-xs text-muted-foreground tabular-nums">
          {fmtNumber(s.votes.seen)} saw it · {fmtNumber(s.votes.agree)} agreed · {fmtNumber(s.votes.disagree)} disagreed · {fmtNumber(s.votes.pass)} passed
        </p>
        {s.moderated === -1 && <p className="text-xs text-pax2-red">Held back by a moderator: its votes stand, but the results leave it out.</p>}
      </div>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 border-t pt-3 text-[13px]">
        <dt className="text-muted-foreground">Agreement in the least agreeable group</dt>
        <dd className="text-right font-semibold tabular-nums">{Math.round(agreement(s))}%</dd>
        <dt className="text-muted-foreground">Gap between the furthest groups</dt>
        <dd className="text-right font-semibold tabular-nums">{Math.round(divisiveness(s))} points</dd>
      </dl>
      {groups.length > 0 && (
        <div className="flex flex-col gap-2.5 border-t pt-3">
          {groups.map((g) => (
            <SplitBar key={g.id} votes={s.byGroup[String(g.id)]} label={`Group ${String.fromCharCode(65 + g.id)} · ${fmtNumber(g.size)}`} compact />
          ))}
        </div>
      )}
    </div>
  )
}
