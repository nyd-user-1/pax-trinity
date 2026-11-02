import type { Metadata } from "next"
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google"

import "@/ui/styles/globals.css"
import { LoadCurtainGate } from "@/components/load-curtain-gate"
import { Shell } from "@/components/shell"
import { DevInspector } from "@/components/dev/inspector-lazy"
import { THEME_SCRIPT } from "@/lib/theme"
import { EMBED_SCRIPT } from "@/lib/pane"
import { currentUser } from "@/lib/auth"
import { memberByEmail } from "@/lib/roles"

const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans" })
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata: Metadata = {
  title: { default: "PAX2", template: "%s · PAX2" },
  description: "Every advocacy video as a tested argument: a score that shows its math, evidence you can inspect, and the next test to run.",
}

export default async function RootLayout({ children, drawer }: LayoutProps<"/">) {
  const user = await currentUser()
  return (
    // The theme's class on <html> is set before paint by THEME_SCRIPT, so the server's class list differs by design.
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* A page open in the second panel is this app in a frame: only the page shows (lib/pane.ts). */}
        <script dangerouslySetInnerHTML={{ __html: EMBED_SCRIPT }} />
        {/* Every card's thumbnail comes from YouTube's image host; the handshake happens once, early. */}
        <link rel="preconnect" href="https://i.ytimg.com" />
      </head>
      <body className="min-h-dvh font-sans text-foreground antialiased">
        <LoadCurtainGate />
        <Shell drawer={drawer} signedIn={!!user} admin={!!user?.admin} superAdmin={!!user?.superAdmin} partner={!!user && memberByEmail(user.email)?.role === "partner"}>
          {children}
        </Shell>
        {/* GovBlock's inspector dock, bottom right, for admins (beside Housekeeping's pointer, to compare). */}
        {user?.admin && (
          <div data-chrome className="contents">
            <DevInspector />
          </div>
        )}
      </body>
    </html>
  )
}
