import { MODEL_CARDS } from "@/lib/model-cards"

import { ModelList } from "./model-list"

export const metadata = { title: "Models" }

// /models (Brendan, 2026-10-29): a card for every model PAX carries, in /settings' blocks: the chat's model
// picker, the video models and the PAX Series 1.0 (lib/model-cards.ts). One list A to Z under a search,
// every card in the same dress (2026-11-02, where three tabs were).
export default function Models() {
  return (
    <div className="mx-auto w-full max-w-[920px] space-y-8 pb-10">
      <ModelList cards={MODEL_CARDS} />
    </div>
  )
}
