import { notFound } from "next/navigation"

import { getTest } from "@/lib/tests/store"

import { adminOrSignin } from "../../admin"
import { SetupForm } from "../../setup-form"

export const dynamic = "force-dynamic"
export const metadata = { title: "Edit message test" }

export default async function EditTestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await adminOrSignin(`/message-tests/${id}/edit`)
  const test = await getTest(id)
  if (!test) notFound()
  return (
    <div className="mx-auto w-full max-w-[773px]">
      <SetupForm mode="edit" initial={test} />
    </div>
  )
}
