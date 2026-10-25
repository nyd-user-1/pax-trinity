import { notFound } from "next/navigation"

import { TEST, drawArm } from "@/lib/tests/open-primaries"

import { Flow } from "./flow"

// /t/<id>: the page a test respondent walks — bare, outside the shell, with
// nothing of the product around it. The arm is drawn here, on the server, one
// per page load, so the assignment is settled before the first card renders.

export const dynamic = "force-dynamic"
export const metadata = { title: TEST.title }

export default async function RespondentPage({ params }: { params: Promise<{ id: string }> }) {
  if ((await params).id !== TEST.id) notFound()
  return <Flow arm={drawArm()} />
}
