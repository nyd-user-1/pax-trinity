import { LIFE_TONE, type LifeState } from "@/lib/lifecycle/rules"
import { cn } from "@/ui/lib/utils"

/** An instrument's state, in the lifecycle's own word (lib/lifecycle/rules.ts): Draft, Approved, Open, Closed, Reported. */
export function LifeChip({ state, className }: { state: LifeState; className?: string }) {
  return <span className={cn("inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium", LIFE_TONE[state], className)}>{state}</span>
}
