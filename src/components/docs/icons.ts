import { ChartColumn, CircleHelp, Clapperboard, Globe, Handshake, Inbox, LayoutGrid, PlayCircle, Rocket, Sparkles, Vote, Wrench, type LucideIcon } from "lucide-react"

import type { DocCategory } from "@/lib/docs"

/** Each help center category's icon. */
export const ICONS: Record<DocCategory, LucideIcon> = {
  "get-started": Rocket,
  results: ChartColumn,
  research: Globe,
  surveys: Vote,
  video: Clapperboard,
  tools: LayoutGrid,
  inbox: Inbox,
  admin: Wrench,
  partners: Handshake,
  faq: CircleHelp,
  releases: Sparkles,
  guides: PlayCircle,
}
