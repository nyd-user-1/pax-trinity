import type { ReactNode } from "react"
import Link from "next/link"

import type { ResultSet } from "@/lib/results/types"
import { studies } from "@/app/reports/data"
import { ContentsRail } from "@/components/report-2/contents-rail"

import { Block, Box, Footnote } from "./report-bits"
import { studyAxis, studyParts, summarySections, waveSections, type ReportPart, type ReportSection } from "./report-doc"
import { count, dateRange, listed } from "./report-math"

// The reports as pages (Brendan, 2026-10-29): each study's executive summary and each wave, and the
// methodology, each page its sections with their contents in a sticky column at the left, starting
// level with the first section's heading under the page's title, and the other reports under Related
// at the foot. /reports is every one of them as a card under its own title.

type Study = { slug: string; name: string; waves: ResultSet[] }

const href = (study: Study, part: ReportPart) => `/reports/${study.slug}/${part.slug}`
export const METHODOLOGY = "/reports/methodology"

/** A report as a card: where it goes, its kicker, what it found, and when and from whom. */
export type ReportCard = { href: string; kicker: string; headline: string; meta: string }

const METHODOLOGY_CARD: ReportCard = {
  href: METHODOLOGY,
  kicker: "Methodology",
  headline: "How every report tests a video against its own placebo, and how to read what it found",
  meta: "Design · lift · detectable · weighting · subgroups · sources",
}

/** Every report in order: each study of several waves, its summary and each wave; a study of one wave,
 *  that wave under the study's name; then the methodology. */
export function reportCards(): ReportCard[] {
  return [
    ...studies().flatMap((study) =>
      studyParts(study.waves).map((p) => ({ href: href(study, p), kicker: study.waves.length === 1 ? study.name : p.kicker, headline: p.headline, meta: p.meta })),
    ),
    METHODOLOGY_CARD,
  ]
}

/** /reports' head: the title and what the reports hold. */
export function ReportsCover() {
  const all = studies()
  const waves = all.flatMap((s) => s.waves)
  if (!waves.length) return null
  const first = all[0].waves[all[0].waves.length - 1]
  const self = first.dimensions.find((d) => d.selfSelected)
  const measured = listed([...first.outcomes.map((o) => o.name), ...(self ? [self.name.replace(/\s*\(.*\)$/, "")] : [])].map((s, i) => (i === 0 ? s : s.charAt(0).toLowerCase() + s.slice(1))))
  return (
    <header className="pb-10">
      <h1 className="text-[56px] leading-[1.02] font-semibold tracking-tight text-[var(--paper-strong)]">Reports</h1>
      <p className="mt-4 text-[20px]">
        <span className="font-semibold">
          {waves.length} {waves.length === 1 ? "wave" : "waves"} · {all.length} {all.length === 1 ? "study" : "studies"}
        </span>
        <span className="mx-3 text-[var(--paper-muted)]">|</span>
        <span className="text-[var(--paper-muted)]">{measured}</span>
      </p>
    </header>
  )
}

/** A report's card, in pax2's /scripts card dress: the raised surface (pax2.css .surface), rising 3px with the deeper shadow on hover (.lift). */
export function ReportCardLink({ card }: { card: ReportCard }) {
  return (
    <Link href={card.href} className="lift surface group flex flex-col p-6">
      <span className="text-[11px] font-semibold tracking-[0.14em] text-pax2-blue uppercase">{card.kicker}</span>
      <span className="mt-2 text-[20px] leading-snug font-semibold tracking-tight text-slate-900 transition-colors group-hover:text-pax2-blue">{card.headline}</span>
      <span className="mt-auto pt-6 text-[13px] leading-relaxed text-slate-500">{card.meta}</span>
    </Link>
  )
}

/** The study's pages by slug, for the route's params. */
export const partSlugs = (study: Study) => studyParts(study.waves).map((p) => p.slug)

/** A report page: the title row across the top, then the contents column beside the sections, then Related. */
function ReportPage({ here, kicker, title, meta, sections, label }: { here: string; kicker: ReactNode; title: string; meta: string; sections: ReportSection[]; label: string }) {
  const others = reportCards().filter((c) => c.href !== here)
  return (
    <article className="report-doc mx-auto w-full max-w-[1360px] px-6 py-10 text-[var(--paper-text)] sm:px-10 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-x-12" data-report={label}>
      {/* The title row sits over the sections' column; the contents column starts on the row below it. */}
      <header className="pb-12 lg:col-start-2">
        <p className="text-[12px] font-semibold tracking-[0.16em] text-[var(--paper-muted)] uppercase">{kicker}</p>
        <h1 className="mt-3 max-w-4xl text-[44px] leading-[1.06] font-semibold tracking-tight text-pax2-blue">{title}</h1>
        <p className="mt-4 text-[15px] text-[var(--paper-muted)]">{meta}</p>
      </header>
      <ContentsRail items={sections.map(({ id, label }) => ({ id, label }))} />
      <div className="min-w-0">
        <div className="flex flex-col gap-20">
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="report-section scroll-mt-6">
              {s.node}
            </section>
          ))}
        </div>
        {others.length > 0 && (
          <section aria-labelledby="related" className="report-related mt-24 border-t border-slate-200 pt-10">
            <h2 id="related" className="text-[22px] leading-snug font-semibold tracking-tight text-[var(--paper-text)]">
              Related
            </h2>
            <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {others.map((c) => (
                <ReportCardLink key={c.href} card={c} />
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  )
}

const ReportsLink = ({ children }: { children: ReactNode }) => (
  <Link href="/reports" className="text-pax2-blue hover:underline">
    {children}
  </Link>
)

/** One page of a study's readout. */
export function ReportPartPage({ study, slug }: { study: Study; slug: string }) {
  const part = studyParts(study.waves).find((p) => p.slug === slug)
  if (!part) return null
  const waves = study.waves
  const lw = waves[waves.length - 1].wave
  const rs = waves.find((w) => `wave-${w.wave}` === slug)
  const sections = rs ? waveSections(rs, studyAxis(waves), rs.wave === lw) : summarySections(waves)
  return (
    <ReportPage
      here={href(study, part)}
      kicker={
        <>
          <ReportsLink>{study.name}</ReportsLink> · {part.kicker}
        </>
      }
      title={part.title}
      meta={part.meta}
      sections={sections}
      label={`${study.name} · ${part.kicker}`}
    />
  )
}

// ── The methodology ──────────────────────────────────────────────────────

const P = ({ children }: { children: ReactNode }) => <p className="max-w-3xl text-[15px] leading-relaxed">{children}</p>

/** How the reports are made, from the result sets' own records and the code that computes them. */
function methodologySections(): ReportSection[] {
  const waves = studies().flatMap((s) => s.waves.map((rs) => ({ s, rs })))
  return [
    {
      id: "design",
      label: "How a test runs",
      node: (
        <Block level={2} title="Every respondent sees one video or the placebo">
          <div className="flex flex-col gap-4">
            <P>
              A respondent answers a few questions about themselves, is assigned at random to watch one of the test&apos;s videos or a placebo video, then answers the ballot question and one question that checks what they understood. Because the assignment is random, the difference between a video&apos;s viewers and the placebo&apos;s viewers is the video&apos;s effect alone.
            </P>
            <P>Each wave has its own placebo, and every lift in a wave is against that placebo. Waves are separate samples; a lift in one wave is never read against another wave&apos;s placebo.</P>
          </div>
        </Block>
      ),
    },
    {
      id: "lift",
      label: "What a lift is",
      node: (
        <Block level={2} title="A lift is the video's level minus the placebo's, in percentage points">
          <div className="grid gap-4 md:grid-cols-2">
            <Box title="Ballot support">The share choosing Yes on the ballot question, among the video&apos;s viewers, minus the same share among the placebo&apos;s.</Box>
            <Box title="Comprehension">The share identifying the change correctly, among the video&apos;s viewers, minus the same share among the placebo&apos;s.</Box>
          </div>
          <Footnote>
            A lift marked ≈ is derived from rounded published percentages. The computed waves carry a margin of 1.645 standard errors (a 90% interval); the source reports for Waves 1 and 2 supply no interval endpoints, so none are shown for them.
          </Footnote>
        </Block>
      ),
    },
    {
      id: "detectable",
      label: "Detectable and inconclusive",
      node: (
        <Block level={2} title="Detectable means the lift met the wave's stated criterion against its placebo">
          <div className="grid gap-4 md:grid-cols-2">
            <Box title="Detectable">
              Waves 1 and 2: the source&apos;s 90% statistical threshold. A computed wave: a two-sided two-proportion test on Kish effective sample sizes, p below 0.10, with at least 50 actual respondents on each side.
            </Box>
            <Box title="Inconclusive">The comparison did not meet the criterion. It is not evidence that the video had no effect.</Box>
          </div>
          <Footnote>The criterion is a statistical decision rule. It does not mean there is a 90% chance any particular person changed their mind.</Footnote>
        </Block>
      ),
    },
    {
      id: "weighting",
      label: "Weighting",
      node: (
        <Block level={2} title="Every level is weighted to the wave's population">
          <div className="flex flex-col gap-4">
            <P>Waves 1 and 2 were weighted by the source to age, gender, race, education, party and 2024 presidential vote.</P>
            <P>
              A computed wave is raked by iterative proportional fitting to targets for Massachusetts general adults (18+) on education, party and 2024 presidential vote, drawn from the audience store&apos;s sources. Weights are normalized to a mean of 1 and capped at 5.
            </P>
          </div>
          <Footnote>The weighted total is not an effective sample size.</Footnote>
        </Block>
      ),
    },
    {
      id: "subgroups",
      label: "Subgroups",
      node: (
        <Block level={2} title="A subgroup's bars are levels, not lifts">
          <div className="flex flex-col gap-4">
            <P>
              Each bar is the share choosing Yes inside one subgroup and one arm. A mark means that video differed from the placebo inside that subgroup at the wave&apos;s criterion; it does not compare videos with each other.
            </P>
            <P>
              A hatched bar is a small sample: the source&apos;s own flag for Waves 1 and 2, fewer than 50 actual respondents for a computed wave. No multiplicity adjustment is applied across subgroups, so with dozens of subgroup comparisons some marks are likely chance.
            </P>
          </div>
        </Block>
      ),
    },
    {
      id: "sources",
      label: "Sources",
      node: (
        <Block level={2} title="Where each report's numbers come from">
          <div className="overflow-hidden rounded-xl border border-slate-200">
            {waves.map(({ s, rs }) => (
              <div key={rs.id} className="grid gap-x-6 gap-y-1 border-t border-slate-200 px-4 py-3 text-[13px] leading-relaxed first:border-t-0 md:grid-cols-[220px_minmax(0,1fr)]">
                <span className="font-semibold">
                  {s.waves.length > 1 ? `${s.name}, Wave ${rs.wave}` : s.name}
                  <span className="block font-normal text-[var(--paper-muted)]">
                    {dateRange(rs.fielded.start, rs.fielded.end)} · {count(rs.sample.raw)} respondents
                  </span>
                </span>
                <span>{rs.sources[0]}</span>
              </div>
            ))}
          </div>
          {/* Both computed sets came from seeded demo runs (scripts/results/seed-demo.mjs), 2026-10-29. */}
          <Footnote>
            Waves 1 and 2 are transcribed from the source&apos;s reports. Wave 3 and the Open Primaries Message Test are computed from their tests&apos; own responses, and both came from seeded demo runs: their respondents are simulated, so their figures exercise the pipeline and are not measurements.
          </Footnote>
        </Block>
      ),
    },
  ]
}

/** The methodology page. */
export function MethodologyPage() {
  return (
    <ReportPage
      here={METHODOLOGY}
      kicker={
        <>
          <ReportsLink>Reports</ReportsLink> · Methodology
        </>
      }
      title="How the reports are made"
      meta="Randomized, placebo-controlled message tests, each video read against its own wave's placebo"
      sections={methodologySections()}
      label="Reports · Methodology"
    />
  )
}
