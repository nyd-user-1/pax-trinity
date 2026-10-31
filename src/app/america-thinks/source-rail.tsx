"use client"

import {
  Briefcase,
  Church,
  CircleDashed,
  Database,
  DollarSign,
  Film,
  Flag,
  FlaskConical,
  Gavel,
  Globe,
  GraduationCap,
  Handshake,
  Heart,
  HeartPulse,
  House,
  IdCard,
  Landmark,
  Leaf,
  MapPin,
  Scale,
  Search,
  Shapes,
  Star,
  Users,
  UsersRound,
  Vote,
  type LucideIcon,
} from "lucide-react"

import { BankRail, RailGroup, RailRow } from "@/components/bank/bank-rail"
import { DropdownMenuItem } from "@govblock/ui/components/ny4/dropdown-menu"

import { SEGMENT_SEED, shortSource, UNTAGGED, type SourceGroup } from "./audience-data"

// The rail in the shell menu's dress (Brendan, 2026-10-27, pass 2): the shell's
// search bar on top (the list's own search), then the construct table's link
// and the two selections, Favorites and Important; the topics under Index,
// each with its icon and a kebab holding its count; the source folders under
// Data, folded shut by default, the electorate slice's row heading them. One
// thing is open at a time — a selection, a topic or a folder.

/** The rail's two selections, carried in the topic slot. */
export const FAVORITES = "__favorites"
export const IMPORTANT = "__important"

const TOPIC_ICONS: Record<string, LucideIcon> = {
  "America & the world": Globe,
  "Community & connections": UsersRound,
  "Crime & punishment": Gavel,
  Demographics: IdCard,
  "Economy & inequality": DollarSign,
  "Education & knowledge": GraduationCap,
  "Elections & voting": Vote,
  Environment: Leaf,
  "Family & household": House,
  "Gender & sexuality": Heart,
  "Health & wellbeing": HeartPulse,
  "Home & place": MapPin,
  "Media & leisure": Film,
  "Politics & government": Landmark,
  "Race, ethnicity & immigration": Users,
  "Religion & spirituality": Church,
  "Rights & liberties": Scale,
  "Science & technology": FlaskConical,
  "Trust & values": Handshake,
  "Work & jobs": Briefcase,
  [UNTAGGED]: CircleDashed,
}

export function SourceRail({
  topics,
  topic,
  groups,
  source,
  favorites,
  important,
  query,
  onQuery,
  onTopic,
  onSource,
}: {
  /** The collapsed topics with their question counts across every source. */
  topics: { topic: string; count: number }[]
  topic: string | null
  groups: SourceGroup[]
  source: string | null
  /** How many questions are pinned and marked important. */
  favorites: number
  important: number
  /** The list's search, which the rail's search bar carries too. */
  query: string
  onQuery: (q: string) => void
  onTopic: (t: string) => void
  onSource: (s: string) => void
}) {
  // The shell's ⌘K bar, exactly (shell.tsx's HeaderSearch); the keys are its dress.
  const search = (
    <div className="flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-pax2-surface px-3 shadow-e1 transition-colors focus-within:border-slate-300">
      <Search className="size-4 shrink-0 text-slate-400" />
      <input
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder="Search…"
        aria-label="Search questions"
        className="w-full min-w-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
      />
      <span aria-hidden className="flex shrink-0 gap-1">
        <kbd className="rounded-md border border-slate-200 bg-pax2-mist px-1.5 py-0.5 text-[11px] text-slate-500">⌘</kbd>
        <kbd className="rounded-md border border-slate-200 bg-pax2-mist px-1.5 py-0.5 text-[11px] text-slate-500">K</kbd>
      </span>
    </div>
  )

  return (
    <BankRail header={search}>
      <RailGroup>
        <RailRow href="/constructs" icon={Shapes} label="Constructs" />
        <RailRow on={topic === FAVORITES} onClick={() => onTopic(FAVORITES)} icon={Star} label="Favorites" count={favorites} />
        <RailRow on={topic === IMPORTANT} onClick={() => onTopic(IMPORTANT)} icon={Flag} label="Important" count={important} />
      </RailGroup>
      <RailGroup label="Index">
        {topics.map((t) => (
          <RailRow
            key={t.topic}
            on={topic === t.topic}
            onClick={() => onTopic(t.topic)}
            icon={TOPIC_ICONS[t.topic]}
            label={t.topic}
            count={t.count}
            dim={t.topic === UNTAGGED}
            menu={<DropdownMenuItem disabled>{t.count.toLocaleString("en-US")} questions</DropdownMenuItem>}
          />
        ))}
      </RailGroup>
      {/* Shut by default; open on arrival when the address opened a folder (/electorate's links do). */}
      <RailGroup label="Data" collapsible defaultOpen={source != null}>
        <RailRow href="/electorate" icon={UsersRound} label="Electorate" />
        {groups.map((g) => (
          <RailRow key={g.source} on={source === g.source} onClick={() => onSource(g.source)} icon={Database} label={shortSource(g.source)} count={SEGMENT_SEED[g.source]} />
        ))}
      </RailGroup>
    </BankRail>
  )
}
