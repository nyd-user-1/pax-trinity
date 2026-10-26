import { listTests } from "@/lib/tests/store"

import { adminOrSignin } from "./admin"
import { TestsTable } from "./tests-table"

export const dynamic = "force-dynamic"
export const metadata = { title: "Message tests" }

export default async function MessageTestsPage() {
  await adminOrSignin("/message-tests")
  const { tests, reachable } = await listTests()
  return (
    <TestsTable
      reachable={reachable}
      tests={tests.map((t) => ({ id: t.id, title: t.title, status: t.status, arms: t.arms.length, targetPerArm: t.targetPerArm, updatedAt: t.updatedAt ?? null }))}
    />
  )
}
