import * as React from "react"

import type { ResultSet, Story } from "@/lib/results/types"
import { cn } from "@/lib/utils"

import { CrossWaveLift, DualLift, LevelChart } from "./charts"
import { Block, Box, Footnote, StoryBox, WaveChip } from "./report-bits"
import { approx, axis, count, countOf, dateRange, listed, monthYear, signed, toplineOf, treatmentsOf, wavesLine, word, Word } from "./report-math"
import { armsLine, DimensionBlock, FactBoxes, LevelsKey, Methodology, PairingCard, ShareBars, VideoCard } from "./sections"

// /reports/[study] — the wave readout, in three pages (Brendan, 2026-10-29):
// the executive summary across waves, then each wave in full, each page its
// sections (src/components/report/report-pages.tsx lays them out, the
// contents at the left, the other pages under Related). Every figure comes
// from the ResultSets; the printed language (stories, notes, pairings, the
// chart readings) renders verbatim. A story a wave does not place still
// renders, at the foot of its last section.

const BALLOT = "ballot"
const COMPREHENSION = "comprehension"

/** The stories the page places by id; any other renders at its wave's foot. */
const PLACED = [
  "study-subtitle", "caution-separate-studies", "caution-published-vs-approximate", "caution-campaign-ad", "seen-in-both",
  "flow-1", "flow-2", "flow-3", "flow-4", "flow-5", "question-trust", "question-vote", "question-understand",
  "overview-1", "overview-2", "overview-3", "overview-4", "card-iteration", "reading-a-lift", "between-videos", "frames-supplied",
  "step-1", "step-2", "step-3", "step-4", "step-5", "written-explanation",
  "breakdowns-levels", "breakdowns-comparisons", "breakdowns-small-cells", "breakdowns-description",
  "media-trust-wording", "media-trust-stated", "media-trust-experimental",
  "media-trust-self-selected", "media-trust-within-group", "media-trust-not-targeting",
]
const story = (rs: ResultSet | undefined, id: string): Story | undefined => rs?.stories.find((s) => s.id === id)
const stories = (rs: ResultSet | undefined, ids: string[]): Story[] => ids.map((id) => story(rs, id)).filter((s): s is Story => !!s)

const detectable = (rs: ResultSet, outcome: string) => treatmentsOf(rs).filter((a) => toplineOf(rs, a.id, outcome)?.verdict === "detectable")
const outcomeName = (rs: ResultSet, id: string) => rs.outcomes.find((o) => o.id === id)?.name ?? id
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
/** A label mid-sentence: "the source's 90% criterion"; an acronym or a figure keeps its case. */
const inline = (s: string) => (/^[A-Z][a-z]/.test(s) ? lower(s) : s)

/** One page of a study's readout: the summary, or a wave. */
export type ReportPart = { slug: string; kicker: string; title: string; headline: string; meta: string }
/** One section of a page: its anchor, its name in the contents, and what it shows. */
export type ReportSection = { id: string; label: string; node: React.ReactNode }

/** The study's one lift scale, every wave's overview and card on it: the PDF's shared −5 to +20. */
export const studyAxis = (waves: ResultSet[]) => axis(waves.flatMap((rs) => rs.toplines.map((t) => t.liftPp).filter((v): v is number => v != null)))

const summaryHeadline = (waves: ResultSet[]) => {
  const latest = waves[waves.length - 1]
  const treat = waves.flatMap((rs) => treatmentsOf(rs))
  const hits = waves.reduce((n, rs) => n + detectable(rs, BALLOT).length, 0)
  return `${countOf(hits, treat.length)} treatment videos showed detectable ${lower(outcomeName(latest, BALLOT))} differences`
}

const waveHeadline = (rs: ResultSet) => {
  const treat = treatmentsOf(rs)
  const b = detectable(rs, BALLOT).length
  const c = detectable(rs, COMPREHENSION).length
  const hasComp = rs.outcomes.some((o) => o.id === COMPREHENSION)
  return `${countOf(b, treat.length)} videos showed detectable ${lower(outcomeName(rs, BALLOT))} differences${hasComp ? `; ${c ? `${word(c)} showed` : "none showed"} detectable ${lower(outcomeName(rs, COMPREHENSION))} differences` : ""}`
}

const waveMeta = (rs: ResultSet) => `${dateRange(rs.fielded.start, rs.fielded.end)} · ${count(rs.sample.raw)} respondents (${count(rs.sample.weighted)} weighted) · ${armsLine(rs)}`

/** The study's pages in order: the summary across waves (where there are two or more), then each wave. */
export function studyParts(waves: ResultSet[]): ReportPart[] {
  const latest = waves[waves.length - 1]
  const summary: ReportPart[] =
    waves.length > 1 ? [{ slug: "summary", kicker: "Executive summary", title: summaryHeadline(waves), headline: summaryHeadline(waves), meta: `${waves.length === 2 ? "Both waves" : "Every wave"} · ${latest.population} · separate samples` }] : []
  return [...summary, ...waves.map((rs) => ({ slug: `wave-${rs.wave}`, kicker: `Wave ${rs.wave}`, title: rs.title, headline: waveHeadline(rs), meta: waveMeta(rs) }))]
}

/** The study's cover: when it was fielded, its name, its waves and what they measured. */
export function StudyCover({ name, waves }: { name: string; waves: ResultSet[] }) {
  const latest = waves[waves.length - 1]
  const self = latest.dimensions.find((d) => d.selfSelected)
  const tagline = listed([...latest.outcomes.map((o) => o.name), ...(self ? [self.name.replace(/\s*\(.*\)$/, "")] : [])].map((s, i) => (i === 0 ? s : lower(s))))
  return (
    <header className="pb-10">
      <p className="text-[12px] font-semibold tracking-[0.18em] text-[var(--paper-strong)] uppercase">{monthYear(latest.fielded.end)}</p>
      <h1 className="mt-3 max-w-3xl text-[56px] leading-[1.02] font-semibold tracking-tight text-[var(--paper-strong)]">{name}</h1>
      <p className="mt-4 text-[20px]">
        <span className="font-semibold">{wavesLine(waves.map((w) => w.wave))}</span>
        <span className="mx-3 text-[var(--paper-muted)]">|</span>
        <span className="text-[var(--paper-muted)]">{tagline}</span>
      </p>
    </header>
  )
}

/** The executive summary's sections, across every wave. */
export function summarySections(waves: ResultSet[]): ReportSection[] {
  const latest = waves[waves.length - 1]
  const lw = latest.wave
  const out: ReportSection[] = [
    {
      id: "ballot",
      label: outcomeName(latest, BALLOT),
      node: (
        <Block level={2} title={`${outcomeName(latest, BALLOT)}, every wave against its own placebo`}>
          <CrossWaveLift waves={waves} />
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {stories(latest, ["caution-separate-studies", "caution-published-vs-approximate", "caution-campaign-ad"]).map((s) => (
              <StoryBox key={s.id} story={s} />
            ))}
          </div>
          <Footnote>No confidence intervals are shown: none are in the data.</Footnote>
        </Block>
      ),
    },
    { id: "comprehension", label: outcomeName(latest, COMPREHENSION), node: <ComprehensionSummary waves={waves} /> },
  ]
  const asked =
    stories(latest, ["flow-1", "flow-2", "flow-3", "flow-4", "flow-5", "question-trust", "question-vote", "question-understand"]).length > 0 ||
    waves.some((rs) => rs.dimensions.some((d) => d.selfSelected && d.categories.some((c) => c.sharePct != null)))
  if (asked) out.push({ id: "questions", label: "The questions", node: <SetupSummary waves={waves} /> })
  if (waves.some((rs) => rs.pairings.length > 0))
    out.push({
      id: "pairings",
      label: "Pairings",
      node: (
        <Block level={2} title="Video–audience pairings to test">
          <div className={cn("grid gap-6", waves.filter((w) => w.pairings.length).length > 1 && "lg:grid-cols-2 print:grid-cols-2")}>
            {waves.filter((w) => w.pairings.length > 0).map((rs) => (
              <div key={rs.id}>
                <div className="mb-3 flex items-center gap-3">
                  <WaveChip wave={rs.wave} latest={rs.wave === lw} />
                  <span className="text-[18px] font-semibold">Wave {rs.wave}</span>
                  <span className="ml-auto text-[12px] text-[var(--paper-muted)]">
                    {word(treatmentsOf(rs).length)} videos · {rs.dimensions.reduce((n, d) => n + d.categories.length, 0)} subgroups
                  </span>
                </div>
                <div className="flex flex-col gap-3 print:gap-2">
                  {[...rs.pairings]
                    .sort((x, y) => x.rank - y.rank)
                    .slice(0, 6)
                    .map((p) => (
                      <PairingCard key={p.rank} rs={rs} p={p} />
                    ))}
                </div>
              </div>
            ))}
          </div>
          {story(latest, "seen-in-both") && (
            <div className="mt-4 print:mt-3">
              <StoryBox story={story(latest, "seen-in-both")!} />
            </div>
          )}
        </Block>
      ),
    })
  return out
}

function ComprehensionSummary({ waves }: { waves: ResultSet[] }) {
  const withLevels = [...waves].reverse().find((rs) => rs.arms.some((arm) => toplineOf(rs, arm.id, COMPREHENSION)?.levelPct != null))
  const context = waves.filter((rs) => rs !== withLevels && rs.toplines.some((t) => t.outcomeId === COMPREHENSION))
  const latest = waves[waves.length - 1]
  const iteration = [...waves].reverse().map((rs) => story(rs, "card-iteration")).find(Boolean)
  const hits = withLevels ? detectable(withLevels, COMPREHENSION).length : 0
  const name = outcomeName(latest, COMPREHENSION)
  return (
    <Block level={2} title={withLevels ? `Wave ${withLevels.wave}: ${countOf(hits, treatmentsOf(withLevels).length, false)} videos showed detectable ${lower(name)} differences` : name}>
      <ol className="mb-6 grid gap-4 md:grid-cols-3">
        {waves.map((rs, i) => {
          const hit = detectable(rs, COMPREHENSION)
          const arms = treatmentsOf(rs)
          const lifts = arms.map((arm) => toplineOf(rs, arm.id, COMPREHENSION)).filter((t) => t?.liftPp != null)
          const lo = Math.min(...lifts.map((t) => t!.liftPp!))
          const hi = Math.max(...lifts.map((t) => t!.liftPp!))
          const mark = lifts.some((t) => t!.derivation === "derived_from_rounded") ? "≈ " : ""
          const unread = arms.length - lifts.length
          const range = !lifts.length ? null : lo === hi ? `Lifts of ${mark}${signed(lo)} pp` : `Lifts from ${mark}${signed(lo)} to ${mark}${signed(hi)} pp`
          return (
            <li key={rs.id} className="flex gap-3 border-t border-[var(--paper-rule)]/40 pt-3">
              <span className="text-[22px] leading-none font-semibold text-[var(--paper-strong)]">{i + 1}</span>
              <span className="text-[14px] leading-snug">
                <span className="font-semibold">
                  Wave {rs.wave}: {countOf(hit.length, arms.length, false)} videos detectable.
                </span>
                <span className="mt-1 block text-[13px] text-[var(--paper-muted)]">
                  {sentence([hit.length ? listed(hit.map((a) => a.name)) : range && `${range}, all inconclusive`, unread ? `${word(unread)} without a lift to read` : null].filter(Boolean).join("; "))}.
                </span>
              </span>
            </li>
          )
        })}
      </ol>
      {withLevels && <LevelChart rs={withLevels} outcomeId={COMPREHENSION} />}
      {context.map((rs) => (
        <div key={rs.id} className="mt-4">
          <p className="mb-2 text-[13px]">
            <span className="font-semibold">Wave {rs.wave} {lower(name)} lifts, for context</span>
            {detectable(rs, COMPREHENSION).length === 0 && <span className="text-[var(--paper-muted)]"> — all inconclusive</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            {treatmentsOf(rs).map((arm) => {
              const t = toplineOf(rs, arm.id, COMPREHENSION)
              if (t?.liftPp == null) return null
              return (
                <span key={arm.id} className="inline-flex h-7 items-center rounded-full bg-[var(--r-tint)] px-3 text-[12px] tabular-nums">
                  {arm.name} {approx(t.derivation)}
                  {signed(t.liftPp)}
                </span>
              )
            })}
          </div>
        </div>
      ))}
      {iteration && (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <StoryBox story={iteration} tone="line" />
          {/* The printed box beside the iteration is the wave's first limitation; the rest stand on its methodology page. */}
          {latest.notes.limitations[0] && (
            <Box title="Limitation" tone="line" className="border-[var(--paper-text)]">
              <p className="text-[15px] font-semibold">{latest.notes.limitations[0]}</p>
            </Box>
          )}
        </div>
      )}
    </Block>
  )
}

function SetupSummary({ waves }: { waves: ResultSet[] }) {
  const latest = waves[waves.length - 1]
  const flow = stories(latest, ["flow-1", "flow-2", "flow-3", "flow-4", "flow-5"])
  const qs = stories(latest, ["question-trust", "question-vote", "question-understand"])
  const self = waves.map((rs) => ({ rs, d: rs.dimensions.find((d) => d.selfSelected && d.categories.some((c) => c.sharePct != null)) })).filter((x): x is { rs: ResultSet; d: NonNullable<typeof x.d> } => !!x.d)
  if (!flow.length && !qs.length && !self.length) return null
  return (
    <Block level={2} title={`${Word(qs.length || latest.outcomes.length + latest.dimensions.filter((d) => d.selfSelected && d.askedBeforeExposure).length)} questions, ${word(latest.outcomes.length)} outcomes`}>
      {flow.length > 0 && (
        <ol className="report-avoid grid gap-3 sm:grid-cols-3 lg:grid-cols-5 print:grid-cols-5">
          {flow.map((s, i) => {
            // A step's number prints once: the story's own where its title is one, else its place.
            const numbered = /^\d+$/.test(s.title.trim())
            return (
              <li key={s.id} className={cn("rounded-xl border border-[var(--paper-rule)]/25 p-3", i === flow.length - 1 && "border-[var(--paper-text)] bg-[var(--r-tint)]")}>
                <span className="block text-[11px] text-[var(--paper-muted)] tabular-nums">{numbered ? s.title.trim() : String(i + 1).padStart(2, "0")}</span>
                <span className="mt-1 block text-[13px] leading-snug font-semibold">{numbered ? s.body : s.title}</span>
                {!numbered && s.body && <span className="mt-1 block text-[12px] text-[var(--paper-muted)]">{s.body}</span>}
              </li>
            )
          })}
        </ol>
      )}
      {qs.length > 0 && (
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {qs.map((s) => {
            const before = s.id === "question-trust"
            return (
              <div key={s.id} className="flex flex-col rounded-xl border border-[var(--paper-rule)]/25 p-4">
                <span className={cn("mb-3 inline-flex h-6 w-fit items-center rounded-full px-3 text-[10px] font-semibold tracking-[0.12em] uppercase", before ? "border border-[var(--paper-rule)]/30 text-[var(--paper-muted)]" : "bg-[var(--paper-text)] text-[var(--paper)]")}>
                  {before ? "Before the video" : "After the video"}
                </span>
                <h4 className="text-[19px] leading-snug font-semibold">{s.title}</h4>
                {s.body && <p className="mt-2 text-[13px] leading-relaxed whitespace-pre-line text-[var(--paper-muted)]">{s.body}</p>}
              </div>
            )
          })}
        </div>
      )}
      {self.length > 0 && (
        <div className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-[19px] font-semibold">{self[self.length - 1].d.name}</h4>
            <span className="inline-flex h-6 items-center rounded-full bg-[var(--paper-text)] px-3 text-[10px] font-semibold tracking-[0.12em] text-[var(--paper)] uppercase">Asked before watching any video</span>
          </div>
          <ShareBars waves={self} latest={latest.wave} />
          <Footnote>Shares of respondents choosing each answer — not ballot support or persuasion results.</Footnote>
        </div>
      )}
    </Block>
  )
}

/** A wave's sections, in the PDF's order: what the test found, the videos, how it worked, the outcomes,
 *  the pairings, the subgroups, and what it can and cannot establish (any story it does not place at the foot). */
export function waveSections(rs: ResultSet, a: ReturnType<typeof axis>, latest: boolean): ReportSection[] {
  const treat = treatmentsOf(rs)
  const headline = waveHeadline(rs)
  const steps = stories(rs, ["step-1", "step-2", "step-3", "step-4", "step-5"])
  const explanation = story(rs, "written-explanation")
  const strip = stories(rs, ["breakdowns-levels", "breakdowns-comparisons", "breakdowns-small-cells", "breakdowns-description"])
  const trustCards = stories(rs, ["media-trust-wording", "media-trust-stated", "media-trust-experimental", "media-trust-self-selected", "media-trust-within-group", "media-trust-not-targeting"])
  const groups = [...new Set(rs.dimensions.map((d) => d.group))]
  const loose = rs.stories.filter((s) => !PLACED.includes(s.id) || (!latest && s.id === "seen-in-both"))
  const comprehension = rs.outcomes.find((o) => o.id === COMPREHENSION)
  const out: ReportSection[] = [
    {
      id: "results",
      label: "What the test found",
      node: (
      <Block level={2} title={headline}>
        <FactBoxes rs={rs} />
        <div className="mt-6 print:mt-4">
          <DualLift rs={rs} a={a} />
        </div>
        {stories(rs, ["overview-1", "overview-2", "overview-3", "overview-4"]).length > 0 && (
          <ol className="mt-6 grid gap-5 md:grid-cols-2 print:mt-4 print:gap-3">
            {stories(rs, ["overview-1", "overview-2", "overview-3", "overview-4"]).map((s, i) => (
              <li key={s.id} className="border-t-2 border-[var(--paper-strong)]/40 pt-3">
                <p className="text-[15px] font-semibold">
                  {i + 1} · {s.title}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-line">{s.body}</p>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-6 grid gap-4 md:grid-cols-2 print:mt-3">
          {rs.outcomes.map((o) => (
            <Box key={o.id} title={o.name}>
              {o.definition}
            </Box>
          ))}
        </div>
        <Footnote>
          The {inline(rs.threshold.label)} is a statistical decision rule. It does not mean there is a {Math.round(rs.threshold.level <= 1 ? rs.threshold.level * 100 : rs.threshold.level)}% chance any particular person changed their mind.
        </Footnote>
      </Block>
      ),
    },
    {
      id: "videos",
      label: "The videos",
      node: (
      <Block level={2} title={`The ${word(treat.length)} videos and their results`}>
        {/* Rows that close: three across for six, two across for four. */}
        <div className={cn("grid gap-5 sm:grid-cols-2", treat.length % 3 === 0 && "lg:grid-cols-3 print:grid-cols-3")}>
          {treat.map((arm, i) => (
            <VideoCard key={arm.id} rs={rs} arm={arm} index={i} a={a} />
          ))}
        </div>
        {story(rs, "frames-supplied") && (
          <div className="mt-4 max-w-xl">
            <StoryBox story={story(rs, "frames-supplied")!} />
          </div>
        )}
        <Footnote>Results are versus placebo. A difference between two point estimates does not establish a statistically significant head-to-head difference.</Footnote>
      </Block>
      ),
    },
  ]
  if (steps.length > 0 || explanation)
    out.push({
      id: "how-it-worked",
      label: "How the test worked",
      node: (
        <Block level={2} title="How the test worked">
          <div className="grid gap-6 md:grid-cols-2">
            <ol className="flex flex-col gap-4">
              {steps.map((s, i) => (
                <li key={s.id} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-[var(--paper-rule)]/30 text-[12px] font-semibold">{i + 1}</span>
                  <span>
                    <span className="block text-[14px] font-semibold">{s.title}</span>
                    <span className="block text-[13px] leading-relaxed whitespace-pre-line text-[var(--paper-muted)]">{s.body}</span>
                  </span>
                </li>
              ))}
            </ol>
            {explanation && (
              <Box title={explanation.title || undefined}>
                <div className="space-y-2 whitespace-pre-line">{explanation.body}</div>
              </Box>
            )}
          </div>
        </Block>
      ),
    })
  if (rs.outcomes.some((o) => toplineOf(rs, rs.arms.find((x) => x.role === "placebo")?.id ?? "", o.id)?.levelPct != null))
    out.push({
      id: "outcomes",
      label: "Outcomes in detail",
      node: (
        <Block level={2} title={`${Word(rs.outcomes.length)} outcomes in detail`}>
          <div className="flex flex-col gap-8">
            {rs.outcomes.map((o) => (
              <div key={o.id}>
                <LevelChart rs={rs} outcomeId={o.id} />
                {o.id === BALLOT && stories(rs, ["reading-a-lift", "between-videos"]).length > 0 && (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    {stories(rs, ["reading-a-lift", "between-videos"]).map((s) => (
                      <StoryBox key={s.id} story={s} />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {comprehension?.question && (
              <div className="max-w-xl rounded-xl border border-[var(--paper-rule)]/25 p-4">
                <p className="text-[14px] font-semibold">{comprehension.question}</p>
                {comprehension.options && (
                  <ul className="mt-3 space-y-2 text-[13px]">
                    {comprehension.options.map((opt) => (
                      <li key={opt} className="grid grid-cols-[70px_minmax(0,1fr)] gap-2">
                        <span className="text-[10px] font-semibold tracking-[0.12em] text-[var(--r-detect)] uppercase">{opt === comprehension.correct ? "Correct" : ""}</span>
                        <span className={cn(opt === comprehension.correct ? "font-medium" : "text-[var(--paper-muted)]")}>{opt}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </Block>
      ),
    })
  if (rs.pairings.length > 0)
    out.push({
      id: "pairings",
      label: "Pairings",
      node: (
        <Block level={2} title={`${Word(rs.pairings.length)} video–audience pairings to test`}>
          <div className="grid gap-4 md:grid-cols-2">
            {[...rs.pairings]
              .sort((x, y) => x.rank - y.rank)
              .map((p) => (
                <PairingCard key={p.rank} rs={rs} p={p} />
              ))}
          </div>
          <Footnote>
            Significant = video vs placebo inside one subgroup at the {inline(rs.threshold.label)}, not videos vs each other. {rs.dimensions.reduce((n, d) => n + d.categories.length, 0)} subgroups × {word(treat.length)} videos with no documented multiplicity adjustment, so some marks are likely chance.
          </Footnote>
        </Block>
      ),
    })
  if (groups.length > 0)
    out.push({
      id: "subgroups",
      label: "Subgroups",
      node: (
        <Block level={2} title="Subgroup results">
          <div className="flex flex-col gap-6">
            <LevelsKey rs={rs} />
            {strip.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
                {strip.map((s) => (
                  <p key={s.id} className="text-[12px] leading-relaxed">
                    <span className="font-semibold">{s.title}</span> {s.body}
                  </p>
                ))}
              </div>
            )}
            {groups.map((g) => {
              const ds = rs.dimensions.filter((d) => d.group === g)
              return (
                <section key={g} className="report-group flex flex-col gap-6">
                  {ds.length > 1 && <h4 className="text-[24px] font-semibold tracking-tight">{listed(ds.map((d, i) => (i === 0 ? d.name.replace(/\s*\(.*\)$/, "") : lower(d.name.replace(/\s*\(.*\)$/, "")))))}</h4>}
                  {ds.map((d) => (
                    <DimensionBlock key={d.id} rs={rs} d={d} stories={d.selfSelected ? trustCards : []} />
                  ))}
                </section>
              )
            })}
          </div>
        </Block>
      ),
    })
  out.push({
    id: "establish",
    label: "What it can and cannot establish",
    node: (
      <div className="flex flex-col gap-10">
      <Block level={2} title="What the study can and cannot establish">
        <Methodology rs={rs} />
      </Block>
      {loose.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {loose.map((s) => (
            <StoryBox key={s.id} story={s} tone="line" />
          ))}
        </div>
      )}
      </div>
    ),
  })
  return out
}
