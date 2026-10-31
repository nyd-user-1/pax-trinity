import "server-only"

import { redirect } from "next/navigation"

import { currentUser, type SessionUser } from "@/lib/auth"

/** The admins' pages (Survey's message tests, Dashboard, Studio): anyone else, signed in or not, goes to sign in. */
export async function adminOrSignin(next: string): Promise<SessionUser> {
  const user = await currentUser()
  if (!user?.admin) redirect(`/signin?next=${encodeURIComponent(next)}`)
  return user
}
