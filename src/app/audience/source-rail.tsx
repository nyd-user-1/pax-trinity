"use client"

import { Folder } from "lucide-react"

import { BankRail, RailGroup, RailRow } from "@/components/bank/bank-rail"

import { SEGMENT_SEED, shortSource, UNTAGGED, type SourceGroup } from "./audience-data"

// The rail leads with topics (Brendan, 2026-10-27: "the first rail collapsed
// into understandable question topics"): one row per topic across the whole
// bank, its question count at the right. The source folders drop to the
// bottom, likely on their way out. One thing is open at a time — a topic or a
// folder.

export function SourceRail({
  topics,
  topic,
  groups,
  source,
  onTopic,
  onSource,
}: {
  /** The collapsed topics with their question counts across every source. */
  topics: { topic: string; count: number }[]
  topic: string | null
  groups: SourceGroup[]
  source: string | null
  onTopic: (t: string) => void
  onSource: (s: string) => void
}) {
  return (
    <BankRail title="Topics">
      <RailGroup>
        {topics.map((t) => (
          <RailRow key={t.topic} on={topic === t.topic} onClick={() => onTopic(t.topic)} label={t.topic} count={t.count} dim={t.topic === UNTAGGED} />
        ))}
      </RailGroup>
      <RailGroup label="Folders">
        {groups.map((g) => (
          <RailRow key={g.source} on={source === g.source} onClick={() => onSource(g.source)} icon={Folder} label={shortSource(g.source)} count={SEGMENT_SEED[g.source]} />
        ))}
      </RailGroup>
    </BankRail>
  )
}
