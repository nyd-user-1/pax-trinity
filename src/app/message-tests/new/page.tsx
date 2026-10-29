import { blankTest } from "@/lib/tests/types"

import { armRecordings } from "@/lib/clips/recorded"
import { adminOrSignin } from "../admin"
import { SetupForm } from "../setup-form"

export const dynamic = "force-dynamic"
export const metadata = { title: "New message test" }

export default async function NewTestPage() {
  const user = await adminOrSignin("/message-tests/new")
  const recorded = (await armRecordings(user).catch(() => [])).map((c) => ({ id: c.id, title: c.title, duration: c.duration ?? null }))
  return (
    <div className="mx-auto w-full max-w-[773px]">
      <SetupForm mode="create" initial={blankTest()} recorded={recorded} />
    </div>
  )
}
