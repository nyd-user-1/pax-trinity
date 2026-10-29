import { notFound } from "next/navigation"

import { getTest } from "@/lib/tests/store"

import { armRecordings } from "@/lib/clips/recorded"
import { adminOrSignin } from "../../admin"
import { SetupForm } from "../../setup-form"

export const dynamic = "force-dynamic"
export const metadata = { title: "Edit message test" }

export default async function EditTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await adminOrSignin(`/message-tests/${id}/edit`)
  const recorded = (await armRecordings(user).catch(() => [])).map((c) => ({ id: c.id, title: c.title, duration: c.duration ?? null }))
  const test = await getTest(id)
  if (!test) notFound()
  return (
    <div className="mx-auto w-full max-w-[773px]">
      <SetupForm mode="edit" initial={test} recorded={recorded} />
    </div>
  )
}
