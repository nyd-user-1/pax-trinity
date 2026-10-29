import Link from "next/link"

import type { ResultSet } from "@/lib/results/types"
import { ContentsRail } from "@/components/report-2/contents-rail"

import { StudyCover, studyAxis, studyParts, summarySections, waveSections, type ReportPart } from "./report-doc"

// A study's readout as pages (Brendan, 2026-10-29): the study's own page is the cover and a card per
// page, the executive summary and each wave; each of those pages is its sections, their contents in a
// sticky column at the left, and the study's other pages under Related at the foot.

type Study = { slug: string; name: string; waves: ResultSet[] }

const href = (study: Study, part: ReportPart) => `/reports/${study.slug}/${part.slug}`

/** A page of the study as a card: its kicker, what it found, and when and from whom. */
function PartCard({ study, part }: { study: Study; part: ReportPart }) {
  return (
    <Link href={href(study, part)} className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-e1 transition-shadow hover:shadow-e2">
      <span className="text-[11px] font-semibold tracking-[0.14em] text-pax2-blue uppercase">{part.kicker}</span>
      <span className="mt-2 text-[20px] leading-snug font-semibold tracking-tight text-slate-900 transition-colors group-hover:text-pax2-blue">{part.headline}</span>
      <span className="mt-auto pt-6 text-[13px] leading-relaxed text-slate-500">{part.meta}</span>
    </Link>
  )
}

/** The study's page: the cover, then a card per page. */
export function StudyLanding({ study }: { study: Study }) {
  const parts = studyParts(study.waves)
  return (
    <div className="report-doc mx-auto w-full max-w-[1120px] px-6 py-10 text-[var(--paper-text)] sm:px-10">
      <StudyCover name={study.name} waves={study.waves} />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {parts.map((p) => (
          <PartCard key={p.slug} study={study} part={p} />
        ))}
      </div>
    </div>
  )
}

/** The study's pages by slug, for the route's params. */
export const partSlugs = (study: Study) => studyParts(study.waves).map((p) => p.slug)

/** One page of the readout: its sections with their contents at the left, then Related. */
export function ReportPartPage({ study, slug }: { study: Study; slug: string }) {
  const parts = studyParts(study.waves)
  const part = parts.find((p) => p.slug === slug)
  if (!part) return null
  const waves = study.waves
  const lw = waves[waves.length - 1].wave
  const rs = waves.find((w) => `wave-${w.wave}` === slug)
  const sections = rs ? waveSections(rs, studyAxis(waves), rs.wave === lw) : summarySections(waves)
  const others = parts.filter((p) => p.slug !== slug)
  return (
    <article className="report-doc mx-auto w-full max-w-[1360px] px-6 py-10 text-[var(--paper-text)] sm:px-10 lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-12" data-report={`${study.name} · ${part.kicker}`}>
      <ContentsRail items={sections.map(({ id, label }) => ({ id, label }))} />
      <div className="min-w-0">
        <header className="pb-12">
          <p className="text-[12px] font-semibold tracking-[0.16em] text-[var(--paper-muted)] uppercase">
            <Link href={`/reports/${study.slug}`} className="text-pax2-blue hover:underline">
              {study.name}
            </Link>{" "}
            · {part.kicker}
          </p>
          <h1 className="mt-3 max-w-4xl text-[44px] leading-[1.06] font-semibold tracking-tight text-pax2-blue">{part.title}</h1>
          <p className="mt-4 text-[15px] text-[var(--paper-muted)]">{part.meta}</p>
        </header>
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
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              {others.map((p) => (
                <PartCard key={p.slug} study={study} part={p} />
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  )
}
