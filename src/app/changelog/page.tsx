import { redirect } from "next/navigation"

import { INSIGHTS, SHIPPED } from "@/lib/changelog"
import { currentUser } from "@/lib/auth"
import { memberByEmail } from "@/lib/roles"

import { ChangelogIndex, ChangelogProvider, ChangelogSteps } from "./stream"

// What has shipped, a step per change, newest first — every reader who is
// signed in gets the record of main; the insight tier joins the stream for
// the admins and the superadmin of src/lib/roles.ts.

export const dynamic = "force-dynamic"
export const metadata = { title: "Changelog" }

export default async function ChangelogPage() {
  const user = await currentUser()
  if (!user) redirect("/signin?next=/changelog")
  const role = memberByEmail(user.email)?.role
  const entries = [...(role === "superadmin" || role === "admin" ? INSIGHTS : []), ...SHIPPED].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  return (
    <ChangelogProvider entries={entries}>
      <div className="flex items-start gap-10">
        <div className="mx-auto flex w-full max-w-[773px] min-w-0 flex-1 flex-col gap-6 px-1 pb-6">
          <ChangelogSteps />
        </div>
        <aside className="sticky top-4 hidden max-h-[calc(100dvh-10rem)] w-52 shrink-0 overflow-y-auto xl:block">
          <ChangelogIndex />
        </aside>
      </div>
    </ChangelogProvider>
  )
}
