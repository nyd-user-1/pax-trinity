import { AudienceBlock } from "./audience-block"

export const metadata = { title: "Audience" }

export default function AudiencePage() {
  return (
    // The Block standard (Brendan, 2026-10-25): header 20px under the AppShellHeader,
    // footer 20px above the AppShell bottom — by filling the shell's fixed-height
    // column, never by viewport arithmetic.
    <div className="flex min-h-0 flex-1 flex-col px-5 pt-5 pb-5 md:px-10">
      <AudienceBlock />
    </div>
  )
}
