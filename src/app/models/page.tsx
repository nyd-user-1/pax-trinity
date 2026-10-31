import { Clapperboard, MessageSquareText, Sparkles } from "lucide-react"

import { CardTools, UnlessDeleted } from "@/components/dash/card-tools"
import { PaxMark } from "@/components/pax-mark"
import { Badge, Block, Fact, PageTabs, Passage } from "@/components/settings/blocks"
import { LLM_CARDS, ORIGINAL_CARDS, PAX_SERIES, VISUAL_CARDS, type CommercialCard } from "@/lib/model-cards"

export const metadata = { title: "Models" }

// /models (Brendan, 2026-10-29): a card for every model PAX carries, in /settings' blocks. LLM is the
// chat's model picker, Visual the video models, Original the PAX Series 1.0 cards (lib/model-cards.ts).

const TABS = [
  { key: "llm", label: "LLM", icon: MessageSquareText, count: LLM_CARDS.length },
  { key: "visual", label: "Visual", icon: Clapperboard, count: VISUAL_CARDS.length },
  { key: "original", label: "Original", icon: Sparkles, count: ORIGINAL_CARDS.length },
] as const

// The makers' marks stand on white in every theme: Anthropic's, OpenAI's and Higgsfield's are black and
// vanished on the dark themes' tiles.
function Logo({ src }: { src: string | null }) {
  if (!src) return <span className="size-8 shrink-0 rounded-lg border border-slate-200 bg-white" />
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={32} height={32} className="size-8 shrink-0 rounded-lg border border-slate-200 bg-white object-contain p-0.5" />
}

// A Bedrock model's id without its region, its maker's prefix, its version suffix and its date
// (us.anthropic.claude-haiku-4-5-20251001-v1:0 is claude-haiku-4-5); the full id shows on hover.
const shortId = (id: string) =>
  id
    .replace(/^(us|eu|apac|global)\./, "")
    .replace(/^[a-z0-9-]+\./, "")
    .replace(/(-v?\d+)?:\d+$/, "")
    .replace(/-v\d+$/, "")
    .replace(/-\d{8}$/, "")

const PaxTile = () => (
  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-pax2-surface">
    <PaxMark size={11} />
  </span>
)

// A card's anchor, from its name: the LLMs' ids (us.amazon.nova-pro-v1:0) don't make one.
const anchorOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")

/** A model's card, with the standard three-dot menu in its top right (Brendan, 2026-10-31). */
function ModelCard({ m, short }: { m: CommercialCard; short: boolean }) {
  const anchor = anchorOf(m.name)
  return (
    <UnlessDeleted anchor={anchor}>
      <Block stretch id={anchor} className="lift" title={m.name} sub={m.maker} lead={<Logo src={m.logo} />} badge={m.badge && <Badge tone={m.badge.tone}>{m.badge.label}</Badge>} action={<CardTools title={m.name} anchor={anchor} className="self-start" />}>
        {m.facts.map(([label, value]) => (
          <Fact key={label} label={label} mono={label === "Model ID"}>
            {label === "Model ID" && short ? <span title={value}>{shortId(value)}</span> : value}
          </Fact>
        ))}
      </Block>
    </UnlessDeleted>
  )
}

export default async function Models({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  const current = TABS.find((t) => t.key === tab)?.key ?? "llm"
  return (
    <div className="mx-auto w-full max-w-[920px] space-y-8 pb-10">
      <PageTabs tabs={TABS.map((t) => ({ ...t, href: t.key === "llm" ? "/models" : `/models?tab=${t.key}` }))} active={current} />

      {current !== "original" && (
        <div className="grid gap-5 lg:grid-cols-2">
          {(current === "llm" ? LLM_CARDS : VISUAL_CARDS).map((m) => (
            <ModelCard key={m.id} m={m} short={current === "llm"} />
          ))}
        </div>
      )}

      {current === "original" && (
        <div className="space-y-8">
          <Block title="PAX Series 1.0" lead={<PaxTile />}>
            {PAX_SERIES.map(([label, value]) => (
              <Fact key={label} label={label}>
                {value}
              </Fact>
            ))}
          </Block>
          {ORIGINAL_CARDS.map((m) => (
            <Block key={m.id} title={m.name} sub={m.tagline} lead={<PaxTile />}>
              <Passage>{m.what}</Passage>
              <Passage label="Who it's for">{m.who}</Passage>
              <Passage label="The proof">{m.proof}</Passage>
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
            </Block>
          ))}
        </div>
      )}
    </div>
  )
}
