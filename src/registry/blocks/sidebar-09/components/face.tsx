import type { Address } from "@/lib/agents/inbox"
import { cn } from "@/lib/utils"

// A recipient's face, apart from the composer, so the template list draws faces without loading the editor.
// compose.tsx re-exports it.

/** Distinct background colours for each agent's monogram dot, matching the thread view. */
const AGENT_COLORS: Record<string, string> = {
  "bill-reader":          "bg-[#4285F4] text-white",
  "tracker":              "bg-[#34A853] text-white",
  "assistant":            "bg-[#F4511E] text-white",
}

/** A recipient's face: a staff photo, a partner's channel art, a channel's logo, or an agent's monogram. */
export function Face({ address, className = "size-8" }: { address: Address; className?: string }) {
  if (address.image)
    return <img src={address.image} alt="" className={cn("shrink-0 rounded-full bg-pax2-surface", address.kind === "channel" ? "object-contain p-1 ring-1 ring-border" : "object-cover", className)} />
  return (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full text-[10px] font-medium", AGENT_COLORS[address.agent] ?? (address.kind === "group" ? "bg-pax2-lavender text-pax2-blue" : "bg-muted text-foreground"), className)}>
      {address.monogram}
    </span>
  )
}
