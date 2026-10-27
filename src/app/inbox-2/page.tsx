import { redirect } from "next/navigation"

// /inbox-2 became /audience, now /america-thinks (2026-10-27).
export default function Inbox2Page() {
  redirect("/america-thinks")
}
