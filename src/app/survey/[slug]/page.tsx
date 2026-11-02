import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { fieldPeriod } from "@/app/lift/lift-data"
import { PAPER_BRIDGE } from "@/components/editorial/PaperBridge"
import { currentUser } from "@/lib/auth"
import { lensOf, seesTopline } from "@/lib/partners/sponsors"
import { surveyBySlug, SURVEYS } from "@/lib/surveys/catalog"
import { topline } from "@/lib/surveys/responses"

import "../../paper.css"

// /survey/<slug>: the survey as a topline document, in the shape Ipsos and Pew
// publish (the methodology block, then each question with its options and
// shares), stating only this survey's own state: who answered through its
// link, when, how many, and what they chose. It is a readout (2026-11-02): its
// Copy link and Open survey went once /s/<slug> became the consensus survey, and
// the Pollster's send mails the respondent link itself (/s/<slug>?pid=).

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return SURVEYS.map((s) => ({ slug: s.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: surveyBySlug((await params).slug)?.title ?? "Survey" }
}

export default async function SurveyDocPage({ params }: Props) {
  const survey = surveyBySlug((await params).slug)
  if (!survey) notFound()
  // A partner's lens: its own sponsor's toplines alone.
  if (!seesTopline(lensOf(await currentUser()), survey.slug)) notFound()
  const t = await topline(survey)
  const n = t?.n ?? 0
  // The margin of error a simple random sample of n would carry, at 95% confidence.
  const moe = n ? 1.96 * Math.sqrt(0.25 / n) * 100 : null
  const facts: [string, string][] = [
    ["Fielded by", survey.fieldedBy],
    ["Population", survey.population],
    ["Mode", survey.mode],
    ["Interview dates", !t ? "—" : t.first && t.last ? fieldPeriod(t.first, t.last) : "Not yet fielded"],
    ["Sample size", !t ? "—" : `${n.toLocaleString("en-US")} ${n === 1 ? "respondent" : "respondents"}`],
    ["Margin of error", moe == null ? "—" : `±${moe.toFixed(1)} percentage points`],
  ]
  return (
    <div className="nysgpt-app relative min-h-0 flex-1 overflow-y-auto" style={{ backgroundColor: "var(--paper)", ...PAPER_BRIDGE }}>
      <article className="mx-auto w-full max-w-[860px] px-6 py-10 text-[var(--paper-text)] sm:px-10" data-survey={survey.slug}>
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--paper-rule)] pb-6">
          <div>
            <p className="text-[12px] font-semibold tracking-[0.18em] text-[var(--paper-strong)] uppercase">Topline and methodology</p>
            <h1 className="mt-2 text-[44px] leading-[1.05] font-semibold tracking-tight">{survey.title}</h1>
          </div>
        </header>

        <dl className="mt-6 grid gap-x-10 gap-y-3 text-[14px] sm:grid-cols-2">
          {facts.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[130px_minmax(0,1fr)] gap-3">
              <dt className="text-[11px] font-semibold tracking-[0.12em] text-[var(--paper-muted)] uppercase">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {n > 0 && (
          <div className="mt-6 space-y-1.5 text-[13px] leading-relaxed text-[var(--paper-muted)]">
            <p>NOTE: All numbers are percentages unless otherwise noted. Percentages may not sum to 100 due to rounding.</p>
            <p>NOTE: Respondents chose to answer through the survey&apos;s link, and the results are unweighted. The margin of error is the one a random sample of this size would carry.</p>
          </div>
        )}

        <ol className="mt-10 flex flex-col gap-9">
          {survey.questions.map((q, i) => {
            const counts = t?.counts[q.id]
            return (
              <li key={q.id} data-question={q.id}>
                <p className="text-[16px] leading-snug font-semibold">
                  <span className="mr-1.5 tabular-nums">{i + 1}.</span>
                  {q.text}
                </p>
                <table className="mt-3 w-full max-w-lg text-[14px]">
                  {n > 0 && (
                    <thead>
                      <tr className="text-[11px] tracking-[0.12em] text-[var(--paper-muted)] uppercase">
                        <th />
                        <th className="pb-1.5 text-right font-semibold">Total (N={n.toLocaleString("en-US")})</th>
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {q.options.map((o) => (
                      <tr key={o} className="border-t border-[var(--paper-rule)]/20">
                        <td className="py-2">{o}</td>
                        {n > 0 && <td className="py-2 text-right font-semibold tabular-nums">{Math.round(((counts?.[o] ?? 0) / n) * 100)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </li>
            )
          })}
        </ol>
      </article>
    </div>
  )
}
