import { CardTools, UnlessDeleted } from "@/components/dash/card-tools"
import { PaxMark } from "@/components/pax-mark"
import { Badge, Block, Fact, Passage } from "@/components/settings/blocks"
import { cardRows, type CommercialCard, type OriginalCard } from "@/lib/model-cards"

// The model cards (Brendan, 2026-10-29), out of app/models/page.tsx (2026-11-02) so the survey's results
// can carry one. ModelCard is every card on /models; SeriesCard is the old Original tab's prose card.

// The makers' marks stand on white in every theme: Anthropic's, OpenAI's and Higgsfield's are black and
// vanished on the dark themes' tiles.
function Logo({ src }: { src: string | null }) {
  if (!src) return <span className="size-8 shrink-0 rounded-lg border border-slate-200 bg-white" />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={32} height={32} className="size-8 shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-0.5" />
}

export const PaxTile = () => (
  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-pax2-surface">
    <PaxMark size={11} />
  </span>
)

// A Bedrock model's id without its region, its maker's prefix, its version suffix and its date
// (us.anthropic.claude-haiku-4-5-20251001-v1:0 is claude-haiku-4-5); the full id shows on hover.
const shortId = (id: string) =>
  id
    .replace(/^(us|eu|apac|global)\./, "")
    .replace(/^[a-z0-9-]+\./, "")
    .replace(/(-v?\d+)?:\d+$/, "")
    .replace(/-v\d+$/, "")
    .replace(/-\d{8}$/, "")
    // The cards name no model Claude (Brendan, 2026-10-31): sonnet-4-6, not claude-sonnet-4-6.
    .replace(/^claude-/, "")

// A card's anchor, from its name: the LLMs' ids (us.amazon.nova-pro-v1:0) don't make one.
export const anchorOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")

/** A model's card, with the standard three-dot menu in its top right (Brendan, 2026-10-31), and the same five rows
 *  as every other card (2026-11-02). */
export function ModelCard({ m }: { m: CommercialCard }) {
  const anchor = anchorOf(m.name)
  const rows = cardRows(m)
  // Copy: the card as it reads, its name, the line under it and its five rows.
  const copy = [m.name, m.sub ?? m.maker, ...rows.map(([label, value]) => `${label}: ${label === "Model ID" && m.kind === "llm" ? shortId(value) : value}`)].join("\n")
  return (
    <UnlessDeleted anchor={anchor}>
      <Block stretch id={anchor} className="lift" title={m.name} sub={m.sub ?? m.maker} lead={m.kind === "original" ? <PaxTile /> : <Logo src={m.logo} />} badge={m.badge && <Badge tone={m.badge.tone}>{m.badge.label}</Badge>} action={<CardTools title={m.name} anchor={anchor} copy={copy} className="self-start" />}>
        {rows.map(([label, value]) => (
          <Fact key={label} label={label} mono={label === "Model ID"}>
            {label === "Model ID" && m.kind === "llm" ? <span title={value}>{shortId(value)}</span> : value}
          </Fact>
        ))}
      </Block>
    </UnlessDeleted>
  )
}

/** A PAX Series card in prose: what it does, who it's for, the proof and its uses. `children` runs first. With an
 *  `anchor` it carries the standard three-dot menu, Copy (`copy`, else its name and line) and Add to Blocks among it. */
export function SeriesCard({ m, children, className, anchor, copy, id, badge }: { m: Pick<OriginalCard, "name" | "tagline"> & Partial<OriginalCard>; children?: React.ReactNode; className?: string; anchor?: string; copy?: string; id?: string; badge?: React.ReactNode }) {
  const text = copy ?? [m.name, m.tagline, m.what, m.who && `Who it's for: ${m.who}`, m.proof && `The proof: ${m.proof}`, ...(m.uses ?? []).map((u) => `- ${u}`)].filter(Boolean).join("\n")
  return (
    <Block id={id ?? anchor} title={m.name} sub={m.tagline} lead={<PaxTile />} badge={badge} className={className} action={anchor ? <CardTools title={m.name} anchor={anchor} copy={text} className="self-start" /> : undefined}>
      {children}
      {m.what && <Passage>{m.what}</Passage>}
      {m.who && <Passage label="Who it's for">{m.who}</Passage>}
      {m.proof && <Passage label="The proof">{m.proof}</Passage>}
      {!!m.uses?.length && (
        <Passage label="Use cases">
          <ul className="space-y-1">
            {m.uses.map((u) => (
              <li key={u} className="flex gap-2.5">
                <span aria-hidden className="text-slate-300">
                  —
                </span>
                {u}
              </li>
            ))}
          </ul>
        </Passage>
      )}
    </Block>
  )
}
