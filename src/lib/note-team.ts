// A note to the team (Brendan, 2026-11-02, the ShiftNote brief): the note's text and the page it was written on,
// posted to one of three places: a Dev Comment on the page (the admins' stream, lib/housekeeping.ts), Slack's #pax2,
// or Discord's #pax through the agents' webhook. Client-safe: the places and the words that go out.

export type TeamPlace = "comments" | "slack" | "discord"

export const TEAM_PLACES: { place: TeamPlace; label: string; mark: string | null }[] = [
  { place: "comments", label: "Dev Comments", mark: null },
  { place: "slack", label: "Slack #pax2", mark: "/logos/slack.png" },
  { place: "discord", label: "Discord #pax", mark: "/logos/discord-icon.svg" },
]

/** #pax2, the channel a note posts to in Slack. */
export const TEAM_SLACK_CHANNEL = "C0CBK58L0NN"

export const isTeamPlace = (v: unknown): v is TeamPlace => v === "comments" || v === "slack" || v === "discord"

/** What goes out: the note, then the page's link; Discord's webhook posts under its own name, so the writer signs it. */
export function teamText(place: TeamPlace, note: string, url: string, writer: string): string {
  const body = `${note.trim()}\n\n${url}`
  return place === "discord" ? `${body}\n— ${writer}` : body
}
