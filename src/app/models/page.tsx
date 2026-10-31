import type * as React from "react"
import { Clapperboard, MessageSquareText, Sparkles } from "lucide-react"

import { PaxMark } from "@/components/pax-mark"
import { Block, Fact, PageTabs, Passage } from "@/components/settings/blocks"
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

// The badges in every theme: on the darks the blue reads in the link blue, and the amber is a dim wash
// with light type instead of the light theme's pale chip.
const BADGE = {
  blue: "bg-pax2-lavender text-pax2-blue ring-pax2-blue/20 dark:text-pax2-light-blue",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/25 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/25",
} as const
const ModelBadge = ({ tone, children }: { tone: keyof typeof BADGE; children: React.ReactNode }) => (
  <span className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset ${BADGE[tone]}`}>{children}</span>
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

const PaxTile = () => (
  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-pax2-surface">
    <PaxMark size={11} />
  </span>
)

function ModelCard({ m, short }: { m: CommercialCard; short: boolean }) {
  return (
    <Block stretch title={m.name} sub={m.maker} lead={<Logo src={m.logo} />} badge={m.badge && <ModelBadge tone={m.badge.tone}>{m.badge.label}</ModelBadge>}>
      {m.facts.map(([label, value]) => (
        <Fact key={label} label={label} mono={label === "Model ID"}>
          {label === "Model ID" && short ? <span title={value}>{shortId(value)}</span> : value}
        </Fact>
      ))}
    </Block>
  )
}

// Trial on /models only (Brendan, 2026-10-31): the fixes he approved from docs/migration/theme-cleanup-list.md
// for the shell around this page. Each moves into its component or lib/theme.ts once he approves it. The
// <style> leaves with the page. !important outranks the theme's inline --t-* on <html> and the inline icon colours.
const TRIAL_CSS = [
  // The sidebar and the right panel take the page's colour on PAX Dark and VS Code, as the other four themes have it.
  `:root:root[data-theme="pax-dark"]{--t-sidebar:#121a2b!important}`,
  // VS Code's brand, #0e639c, could not be read as type: PAX Dark's blue, with a deeper wash under it.
  `:root:root[data-theme="vscode"]{--t-sidebar:#1e1e1e!important;--t-accent:#3b82f6!important;--t-wash:#1a2d4d!important}`,
  // The header's chat and crosshair icons take the theme's blue; they carried a fixed navy inline.
  `[aria-label="Open the discussion"] svg{color:var(--pax2-blue)!important;fill:var(--pax2-lavender)!important}`,
  `[aria-label="Comment on the page"] svg{color:var(--pax2-blue)!important}`,
  // Hovers on the sidebar and panel ground take the Selected colour; the Main colour they had is the ground itself on most themes.
  `[aria-label="Back"]:hover,[aria-label="Account menu"]:hover,[aria-label="Account menu"][data-popup-open]{background-color:var(--pax2-lift)!important}`,
  // One divider under the three headers, their shadow: the panel's Theme and Chat views drop the rule they added.
  `[data-panel-body],[data-theme-controls]{border-top-width:0!important}`,
].join("")

export default async function Models({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  const current = TABS.find((t) => t.key === tab)?.key ?? "llm"
  return (
    <div className="mx-auto w-full max-w-[920px] space-y-8 pb-10">
      <style>{TRIAL_CSS}</style>
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
