"use client"

import { addressFor } from "@/lib/agents/inbox"
import { TEMPLATE_KINDS, TEMPLATES, type Template } from "@/lib/agents/templates"
import { Face } from "@/registry/blocks/sidebar-09/components/compose"
import { ScrollArea } from "@govblock/ui/components/ny4/scroll-area"

// The Templates folder: the messages kept in Resend (lib/agents/templates.ts),
// by kind, each with its sender, a person or an agent. Picking one opens the
// composer filled with it.
export function TemplateList({ onUse }: { onUse: (template: Template) => void }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[52px] shrink-0 items-center border-b px-4">
        <span className="ml-auto px-2 text-xs text-muted-foreground tabular-nums">
          1–{TEMPLATES.length} of {TEMPLATES.length}
        </span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {TEMPLATE_KINDS.map((kind) => (
          <section key={kind}>
            <h3 className="sticky top-0 z-10 border-b bg-muted/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">{kind}</h3>
            <ul className="divide-y">
              {TEMPLATES.filter((t) => t.kind === kind).map((template) => {
                const sender = addressFor(template.from)
                const snippet = template.body.split("\n\n").find((line) => !/^Hi /.test(line) && !/^\*\*/.test(line)) ?? ""
                return (
                  <li
                    key={template.id}
                    onClick={() => onUse(template)}
                    className="group/row relative flex cursor-pointer items-start gap-3 px-4 py-2.5 text-sm transition-[background-color,box-shadow] hover:z-10 hover:bg-accent/60 hover:shadow-[0_1px_2px_0_rgba(60,64,67,0.3),0_1px_3px_1px_rgba(60,64,67,0.15)]"
                  >
                    {sender && <Face address={sender} className="mt-0.5 size-8" />}
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{template.name}</span>
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">{sender?.name}</span>
                      </span>
                      <span className="truncate">{template.subject}</span>
                      <span className="truncate text-muted-foreground">{snippet}</span>
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </ScrollArea>
    </div>
  )
}
