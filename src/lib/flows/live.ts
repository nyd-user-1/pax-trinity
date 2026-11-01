import "server-only"

import { TEMPLATES } from "@/lib/agents/templates"
import { FLOWS } from "@/lib/flows/defs"
import { putOnce, query } from "@/lib/ledger"
import { fill, sendMail } from "@/lib/mail/send"

import type { FlowDeps } from "./engine"

/** The engine's production wiring: the ledger, real mail behind the allowlist, worker-1's flows and templates. */
export const liveDeps = (): FlowDeps => ({
  flows: FLOWS,
  templates: TEMPLATES,
  store: { putOnce, query },
  mail: sendMail,
  fill,
  now: Date.now,
})
