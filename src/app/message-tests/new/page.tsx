import { blankTest } from "@/lib/tests/types"

import { adminOrSignin } from "../admin"
import { SetupForm } from "../setup-form"

export const dynamic = "force-dynamic"
export const metadata = { title: "New message test" }

export default async function NewTestPage() {
  await adminOrSignin("/message-tests/new")
  return (
    <div className="mx-auto w-full max-w-[773px]">
      <SetupForm mode="create" initial={blankTest()} />
    </div>
  )
}
