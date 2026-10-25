import { PAPER_BRIDGE } from "@/components/editorial/PaperBridge"
import { LandingGrid } from "@/components/landing-grid"
import { RevealFx } from "@/components/reveal-fx"
import { HomeContents } from "@/app/HomeContents"
import { HomeMasthead } from "@/app/HomeMasthead"
import { SwitchboardProvider } from "@/components/SwitchboardPanel"
import { getDigest } from "@/lib/digest"
import { CARDS, LEDGER } from "@/lib/home-data"

import "./paper.css"

// The front door: the NYSgpt home — masthead plate over contents plate — on the
// pax grid, inside the appshell. The masthead's tool box opens the two tool
// boxes and its model box the six model boxes, both through the switchboard;
// the curtain in the root layout covers first paint.
export default async function HomePage() {
  const digest = await getDigest()
  return (
    <div className="nysgpt-app relative min-h-dvh" style={PAPER_BRIDGE}>
      <LandingGrid />
      <SwitchboardProvider cards={CARDS} digest={digest}>
        <div className="relative mx-auto w-full max-w-[1360px] px-6 pt-8 pb-16 sm:px-10 md:px-14">
          <RevealFx delay={0.08} translateY={6}>
            <HomeMasthead ledger={LEDGER} />
          </RevealFx>
          <RevealFx delay={0.22} translateY={5}>
            <HomeContents initial={CARDS} />
          </RevealFx>
        </div>
      </SwitchboardProvider>
    </div>
  )
}
