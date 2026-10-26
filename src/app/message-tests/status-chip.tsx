import type { Status } from "@/lib/tests/types"
import { cn } from "@/ui/lib/utils"

const DRESS: Record<Status, string> = {
  draft: "bg-slate-100 text-slate-600",
  fielding: "bg-emerald-50 text-emerald-700",
  closed: "bg-pax2-lavender text-pax2-blue",
}

export function StatusChip({ status }: { status: Status }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium", DRESS[status])}>{status[0].toUpperCase() + status.slice(1)}</span>
}
