import * as React from "react"

import { CrossWaveLift, DualLift, LevelChart } from "@/components/report/charts"
import { Block, Box, Footnote, StoryBox, WaveChip } from "@/components/report/report-bits"
import { axis, count, countOf, dateRange, listed, monthYear, placeboOf, signed, toplineOf, treatmentsOf, wavesLine, word, Word } from "@/components/report/report-math"
import { armsLine, DimensionBlock, LevelsKey, Methodology, PairingCard, ShareBars, VideoCard } from "@/components/report/sections"
import type { ResultSet, Story } from "@/lib/results/types"
import { cn } from "@/lib/utils"

import { ContentsRail } from "./contents-rail"
import { WaveTabs } from "./wave-tabs"

// /reports-2/[study] — the readout of /reports, section-first: each section
// holds every wave once, side by side where its blocks are small, under wave
// chips where they are large, with a sticky contents rail at the left. The
// pieces are /reports' own (charts, sections, report-bits); what /reports keeps
// private (the summary's comprehension and setup blocks, the story helpers) is
// copied here so nothing in its render moves. Every figure comes from the
// ResultSets; the printed language renders verbatim; a story no section places
// renders at the foot.

const BALLOT = "ballot"
const COMPREHENSION = "comprehension"

/** The stories the page places by id; any other renders at the foot. */
const PLACED = [
  "study-subtitle", "caution-separate-studies", "caution-published-vs-approximate", "caution-campaign-ad", "seen-in-both",
  "flow-1", "flow-2", "flow-3", "flow-4", "flow-5", "question-trust", "question-vote", "question-understand",
  "overview-1", "overview-2", "overview-3", "overview-4", "card-iteration", "reading-a-lift", "between-videos", "frames-supplied",
  "step-1", "step-2", "step-3", "step-4", "step-5", "written-explanation",
  "breakdowns-levels", "breakdowns-comparisons", "breakdowns-small-cells", "breakdowns-description",
  "media-trust-wording", "media-trust-stated", "media-trust-experimental",
  "media-trust-self-selected", "media-trust-within-group", "media-trust-not-targeting",
]
const OVERVIEW = ["overview-1", "overview-2", "overview-3", "overview-4"]
const STEPS = ["step-1", "step-2", "step-3", "step-4", "step-5"]
const STRIP = ["breakdowns-levels", "breakdowns-comparisons", "breakdowns-small-cells", "breakdowns-description"]
const TRUST = ["media-trust-wording", "media-trust-stated", "media-trust-experimental", "media-trust-self-selected", "media-trust-within-group", "media-trust-not-targeting"]

const story = (rs: ResultSet | undefined, id: string): Story | undefined => rs?.stories.find((s) => s.id === id)
const stories = (rs: ResultSet | undefined, ids: string[]): Story[] => ids.map((id) => story(rs, id)).filter((s): s is Story => !!s)

const detectable = (rs: ResultSet, outcome: string) => treatmentsOf(rs).filter((a) => toplineOf(rs, a.id, outcome)?.verdict === "detectable")
const outcomeName = (rs: ResultSet, id: string) => rs.outcomes.find((o) => o.id === id)?.name ?? id
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)
const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
/** A label mid-sentence: "the source's 90% criterion"; an acronym or a figure keeps its case. */
const inline = (s: string) => (/^[A-Z][a-z]/.test(s) ? lower(s) : s)
const subgroups = (rs: ResultSet) => rs.dimensions.reduce((n, d) => n + d.categories.length, 0)
const hasLevels = (rs: ResultSet) => rs.outcomes.some((o) => toplineOf(rs, placeboOf(rs)?.id ?? "", o.id)?.levelPct != null)

type Axis = ReturnType<typeof axis>

export function ReportDoc2({ name, waves }: { name: string; waves: ResultSet[] }) {
  const latest = waves[waves.length - 1]
  const lw = latest.wave
  const isLatest = (rs: ResultSet) => rs.wave === lw
  // One lift scale for every wave's chart and card, both outcomes: the PDF's shared −5 to +20.
  const a = axis(waves.flatMap((rs) => rs.toplines.map((t) => t.liftPp).filter((v): v is number => v != null)))
  const treat = waves.flatMap((rs) => treatmentsOf(rs))
  const ballotHits = waves.reduce((n, rs) => n + detectable(rs, BALLOT).length, 0)
  const subtitle = story(latest, "study-subtitle")
  const self = latest.dimensions.find((d) => d.selfSelected)
  const tagline = listed([...latest.outcomes.map((o) => o.name), ...(self ? [self.name.replace(/\s*\(.*\)$/, "")] : [])].map((s, i) => (i === 0 ? s : lower(s))))
  const loose = (rs: ResultSet) => rs.stories.filter((s) => !PLACED.includes(s.id) || (!isLatest(rs) && s.id === "seen-in-both"))

  const has = {
    subgroups: waves.some((rs) => rs.dimensions.length > 0),
    pairings: waves.some((rs) => rs.pairings.length > 0),
    method: waves.some((rs) => stories(rs, STEPS).length > 0 || !!story(rs, "written-explanation")) || stories(latest, ["flow-1", "question-trust"]).length > 0,
  }
  const sections = [
    { id: "summary", label: "Summary" },
    { id: "videos", label: "The videos" },
    { id: "outcomes", label: "Outcomes" },
    ...(has.subgroups ? [{ id: "subgroups", label: "Subgroups" }] : []),
    ...(has.pairings ? [{ id: "pairings", label: "Pairings" }] : []),
    ...(has.method ? [{ id: "how-it-worked", label: "How the test worked" }] : []),
    { id: "establish", label: "What it can and cannot establish" },
  ]
  const label = (id: string) => sections.find((s) => s.id === id)!.label

  return (
    <div className="report-doc mx-auto w-full max-w-[1360px] px-6 py-10 text-[var(--paper-text)] sm:px-10 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12" data-report={name}>
      <ContentsRail items={sections} />
      <div className="report-2-body min-w-0">
        {/* Cover */}
        <header className="report-cover pb-10">
          <p className="text-[12px] font-semibold tracking-[0.18em] text-[var(--paper-strong)] uppercase">{monthYear(latest.fielded.end)}</p>
          <h1 className="mt-3 max-w-3xl text-[56px] leading-[1.02] font-semibold tracking-tight">{name}</h1>
          <p className="mt-4 text-[20px]">
            <span className="font-semibold">{wavesLine(waves.map((w) => w.wave))}</span>
            <span className="mx-3 text-[var(--paper-muted)]">|</span>
            <span className="text-[var(--paper-muted)]">{tagline}</span>
          </p>
          {subtitle && <p className="mt-5 max-w-3xl text-[16px] leading-relaxed text-[var(--paper-muted)]">{subtitle.body}</p>}
        </header>

        <div className="flex flex-col gap-20">
          <Section id="summary" title={label("summary")}>
            <WaveFacts waves={waves} lw={lw} />

            <Block title={`${countOf(ballotHits, treat.length)} treatment videos showed detectable ${lower(outcomeName(latest, BALLOT))} differences`}>
              <CrossWaveLift waves={waves} />
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {stories(latest, ["caution-separate-studies", "caution-published-vs-approximate", "caution-campaign-ad"]).map((s) => (
                  <StoryBox key={s.id} story={s} />
                ))}
              </div>
              <Footnote>No confidence intervals are shown: none are in the data.</Footnote>
            </Block>

            <Columns
              waves={waves}
              lw={lw}
              render={(rs) => {
                const ov = stories(rs, OVERVIEW)
                return (
                  <>
                    <p className="text-[17px] leading-snug font-semibold">{waveHeadline(rs)}</p>
                    {ov.length > 0 && (
                      <ol className="mt-4 flex flex-col gap-4">
                        {ov.map((s, i) => (
                          <li key={s.id} className="border-t-2 border-[var(--paper-strong)]/40 pt-3">
                            <p className="text-[15px] font-semibold">
                              {i + 1} · {s.title}
                            </p>
                            <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-line">{s.body}</p>
                          </li>
                        ))}
                      </ol>
                    )}
                  </>
                )
              }}
            />

            <ComprehensionSummary waves={waves} />
          </Section>

          <Section id="videos" title={label("videos")}>
            <div>
              <Columns
                waves={waves}
                lw={lw}
                aside={(rs) => `${word(treatmentsOf(rs).length)} videos`}
                render={(rs) => (
                  <div className="flex flex-col gap-5">
                    {treatmentsOf(rs).map((arm, i) => (
                      <VideoCard key={arm.id} rs={rs} arm={arm} index={i} a={a} />
                    ))}
                    {story(rs, "frames-supplied") && <StoryBox story={story(rs, "frames-supplied")!} />}
                  </div>
                )}
              />
              <Footnote>Results are versus placebo. A difference between two point estimates does not establish a statistically significant head-to-head difference.</Footnote>
            </div>
          </Section>

          <Section id="outcomes" title={label("outcomes")}>
            <OutcomeDefinitions waves={waves} lw={lw} />
            <WaveTabs tabs={waves.map((rs) => ({ id: rs.id, wave: rs.wave, latest: isLatest(rs), panel: <OutcomesPanel rs={rs} a={a} /> }))} />
          </Section>

          {has.subgroups && (
            <Section id="subgroups" title={label("subgroups")}>
              <WaveTabs tabs={waves.filter((rs) => rs.dimensions.length > 0).map((rs) => ({ id: rs.id, wave: rs.wave, latest: isLatest(rs), panel: <SubgroupsPanel rs={rs} /> }))} />
            </Section>
          )}

          {has.pairings && (
            <Section id="pairings" title={label("pairings")}>
              <div>
                <Columns
                  waves={waves}
                  lw={lw}
                  aside={(rs) => `${word(treatmentsOf(rs).length)} videos · ${subgroups(rs)} subgroups`}
                  render={(rs) =>
                    rs.pairings.length > 0 && (
                      <>
                        <div className="flex flex-col gap-3 print:gap-2">
                          {[...rs.pairings]
                            .sort((x, y) => x.rank - y.rank)
                            .map((p) => (
                              <PairingCard key={p.rank} rs={rs} p={p} />
                            ))}
                        </div>
                        <Footnote>
                          Significant = video vs placebo inside one subgroup at the {inline(rs.threshold.label)}, not videos vs each other. {subgroups(rs)} subgroups × {word(treatmentsOf(rs).length)} videos with no documented multiplicity adjustment, so some marks are likely chance.
                        </Footnote>
                      </>
                    )
                  }
                />
                {story(latest, "seen-in-both") && (
                  <div className="mt-6 max-w-2xl">
                    <StoryBox story={story(latest, "seen-in-both")!} />
                  </div>
                )}
              </div>
            </Section>
          )}

          {has.method && (
            <Section id="how-it-worked" title={label("how-it-worked")}>
              <SetupSummary waves={waves} />
              <Columns waves={waves} lw={lw} render={(rs, solo) => (stories(rs, STEPS).length > 0 || !!story(rs, "written-explanation")) && <StepsBlock rs={rs} solo={solo} />} />
            </Section>
          )}

          <Section id="establish" title={label("establish")}>
            <WaveTabs tabs={waves.map((rs) => ({ id: rs.id, wave: rs.wave, latest: isLatest(rs), panel: <Methodology rs={rs} /> }))} />
          </Section>

          <Columns
            waves={waves}
            lw={lw}
            render={(rs) =>
              loose(rs).length > 0 && (
                <div className="grid gap-4">
                  {loose(rs).map((s) => (
                    <StoryBox key={s.id} story={s} tone="line" />
                  ))}
                </div>
              )
            }
          />
        </div>
      </div>
    </div>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="report-part scroll-mt-6 border-t border-[var(--paper-rule)] pt-8">
      <h2 className="text-[34px] leading-tight font-semibold tracking-tight text-[var(--paper-text)]">{title}</h2>
      <div className="mt-8 flex flex-col gap-14 print:mt-5">{children}</div>
    </section>
  )
}

function WaveHead({ rs, latest, aside }: { rs: ResultSet; latest: boolean; aside?: string }) {
  return (
    <div className="report-keep mb-4 flex items-center gap-3">
      <WaveChip wave={rs.wave} latest={latest} />
      <span className="text-[18px] font-semibold">Wave {rs.wave}</span>
      {aside && <span className="ml-auto text-[12px] text-[var(--paper-muted)]">{aside}</span>}
    </div>
  )
}

/** The waves side by side, each under its chip; a wave with nothing to show drops out. */
function Columns({ waves, lw, render, aside }: { waves: ResultSet[]; lw: number; render: (rs: ResultSet, solo: boolean) => React.ReactNode; aside?: (rs: ResultSet) => string }) {
  const shown = waves.filter((rs) => {
    const n = render(rs, false)
    return n !== false && n != null
  })
  if (!shown.length) return null
  const solo = shown.length === 1
  return (
    <div className={cn("grid gap-8", !solo && "lg:grid-cols-2 print:grid-cols-2")}>
      {shown.map((rs) => (
        <div key={rs.id} className="min-w-0">
          <WaveHead rs={rs} latest={rs.wave === lw} aside={aside?.(rs)} />
          {render(rs, solo)}
        </div>
      ))}
    </div>
  )
}

function waveHeadline(rs: ResultSet) {
  const n = treatmentsOf(rs).length
  const b = detectable(rs, BALLOT).length
  const c = detectable(rs, COMPREHENSION).length
  const hasComp = rs.outcomes.some((o) => o.id === COMPREHENSION)
  return `${countOf(b, n)} videos showed detectable ${lower(outcomeName(rs, BALLOT))} differences${hasComp ? `; ${c ? `${word(c)} showed` : "none showed"} detectable ${lower(outcomeName(rs, COMPREHENSION))} differences` : ""}`
}

/** The fact boxes of every wave as one table: a row per fact, a column per wave. */
function WaveFacts({ waves, lw }: { waves: ResultSet[]; lw: number }) {
  const rows: [string, (rs: ResultSet) => React.ReactNode][] = [
    ["Population", (rs) => rs.population],
    ["Fielded", (rs) => dateRange(rs.fielded.start, rs.fielded.end)],
    ["Sample", (rs) => `${count(rs.sample.raw)} respondents · ${count(rs.sample.weighted)} weighted`],
    ["Videos", (rs) => armsLine(rs)],
    ["Control", (rs) => {
      const p = placeboOf(rs)
      return p ? `Placebo video · ${count(p.nWeighted)} weighted` : "—"
    }],
    ["Threshold", (rs) => rs.threshold.label],
  ]
  return (
    <div className="report-avoid overflow-x-auto rounded-xl border border-[var(--paper-rule)]/20">
      <table className="w-full text-[13px] leading-snug">
        <thead>
          <tr>
            <th className="w-[120px]" />
            {waves.map((rs) => (
              <th key={rs.id} scope="col" className="px-4 py-3 text-left font-normal">
                <span className="flex items-center gap-2">
                  <WaveChip wave={rs.wave} latest={rs.wave === lw} />
                  <span className="text-[15px] font-semibold">Wave {rs.wave}</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, f]) => (
            <tr key={k} className="border-t border-[var(--paper-rule)]/10">
              <th scope="row" className="px-4 py-2.5 text-left align-top text-[10px] font-semibold tracking-[0.14em] whitespace-nowrap text-[var(--paper-muted)] uppercase">
                {k}
              </th>
              {waves.map((rs) => (
                <td key={rs.id} className="px-4 py-2.5 align-top">
                  {f(rs)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Each outcome's definition once; where a wave words one differently, each wording under its wave. */
function OutcomeDefinitions({ waves, lw }: { waves: ResultSet[]; lw: number }) {
  const ids = [...new Set(waves.flatMap((rs) => rs.outcomes.map((o) => o.id)))]
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {ids.map((id) => {
        const by = waves.flatMap((rs) => rs.outcomes.filter((o) => o.id === id).map((o) => ({ rs, o })))
        const wordings = [...new Map(by.map((x): [string, typeof by] => [`${x.o.name}\u0000${x.o.definition}`, by.filter((y) => y.o.name === x.o.name && y.o.definition === x.o.definition)])).values()]
        return wordings.map((group) => (
          <Box
            key={`${id}-${group[0].rs.id}`}
            title={
              <span className="flex items-center gap-2">
                {group[0].o.name}
                {wordings.length > 1 && group.map(({ rs }) => <WaveChip key={rs.id} wave={rs.wave} latest={rs.wave === lw} />)}
              </span>
            }
          >
            {group[0].o.definition}
          </Box>
        ))
      })}
    </div>
  )
}

function OutcomesPanel({ rs, a }: { rs: ResultSet; a: Axis }) {
  const comprehension = rs.outcomes.find((o) => o.id === COMPREHENSION)
  return (
    <div className="flex flex-col gap-8">
      <DualLift rs={rs} a={a} />
      {hasLevels(rs) && rs.outcomes.map((o) => (
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
      {hasLevels(rs) && comprehension?.question && (
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
      <Footnote>
        The {inline(rs.threshold.label)} is a statistical decision rule. It does not mean there is a {Math.round(rs.threshold.level <= 1 ? rs.threshold.level * 100 : rs.threshold.level)}% chance any particular person changed their mind.
      </Footnote>
    </div>
  )
}

function SubgroupsPanel({ rs }: { rs: ResultSet }) {
  const strip = stories(rs, STRIP)
  const trustCards = stories(rs, TRUST)
  const groups = [...new Set(rs.dimensions.map((d) => d.group))]
  return (
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
  )
}

function StepsBlock({ rs, solo }: { rs: ResultSet; solo: boolean }) {
  const steps = stories(rs, STEPS)
  const explanation = story(rs, "written-explanation")
  if (!steps.length && !explanation) return null
  return (
    <div className={cn("grid gap-6", solo && "md:grid-cols-2")}>
      {steps.length > 0 && (
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
      )}
      {explanation && (
        <Box title={explanation.title || undefined}>
          <div className="space-y-2 whitespace-pre-line">{explanation.body}</div>
        </Box>
      )}
    </div>
  )
}

// ── Copied from /reports' report-doc, where they are private ─────────────
// The comprehension summary drops its level chart and the other waves' lift
// chips: Outcomes holds both, once per wave.

function ComprehensionSummary({ waves }: { waves: ResultSet[] }) {
  const withLevels = [...waves].reverse().find((rs) => rs.arms.some((arm) => toplineOf(rs, arm.id, COMPREHENSION)?.levelPct != null))
  const latest = waves[waves.length - 1]
  const iteration = [...waves].reverse().map((rs) => story(rs, "card-iteration")).find(Boolean)
  const hits = withLevels ? detectable(withLevels, COMPREHENSION).length : 0
  const name = outcomeName(latest, COMPREHENSION)
  if (!waves.some((rs) => rs.outcomes.some((o) => o.id === COMPREHENSION))) return null
  return (
    <Block title={withLevels ? `Wave ${withLevels.wave}: ${countOf(hits, treatmentsOf(withLevels).length, false)} videos showed detectable ${lower(name)} differences` : name}>
      <ol className="grid gap-4 md:grid-cols-3">
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
      {iteration && (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <StoryBox story={iteration} tone="line" />
          {/* The printed box beside the iteration is the wave's first limitation; the rest stand under What it can and cannot establish. */}
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
    <Block title={`${Word(qs.length || latest.outcomes.length + latest.dimensions.filter((d) => d.selfSelected && d.askedBeforeExposure).length)} questions, ${word(latest.outcomes.length)} outcomes`}>
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
