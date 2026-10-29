import { SettingsPage, type SettingsTab } from "@/components/settings/settings-page"

export const metadata = { title: "Settings" }

// /settings — the account menu's Profile, Account, Notifications and Settings as one page of tabs
// (Brendan, 2026-10-29). ?tab= opens a tab; General has the bare address.
const TABS: SettingsTab[] = ["general", "profile", "members", "permissions", "notifications", "integrations"]

export default async function Settings({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  return <SettingsPage tab={TABS.find((t) => t === tab) ?? "general"} />
}
