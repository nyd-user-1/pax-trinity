// Who is who (Brendan, 2026-10-25). One super admin, three admins, two staff,
// three partner organizations. The admins' accounts sit in the app's Cognito pool
// (parallax) and its admins group (2026-10-29); the remaining YouTube channels
// fill in as they arrive.

export type Role = "superadmin" | "admin" | "staff" | "partner"

export type Member = { name: string; email?: string; role: Role }

export const MEMBERS: Member[] = [
  { name: "Brendan Stanton", email: "brendan@nysgpt.com", role: "superadmin" },
  { name: "Sajeela Padder", email: "sajeela@parallaxinnovations.com", role: "admin" },
  { name: "Garrett Hernandez Rimer", email: "garrett@parallaxinnovations.com", role: "admin" },
  { name: "Ted Delicath", email: "ted@parallaxinnovations.com", role: "admin" },
  { name: "Errin M Vasquez", role: "staff" },
  { name: "Sergio Gutierrez", role: "staff" },
]

export type Partner = { id: string; name: string; youtube: string | null }

export const PARTNERS: Partner[] = [
  { id: "voter-freedom", name: "Voter Freedom", youtube: "https://www.youtube.com/@voterfreedom" },
  { id: "unite-america", name: "Unite America", youtube: "https://www.youtube.com/@uniteamerica3047" },
  // The PAX channel does not exist yet; it gets made, then its URL lands here.
  { id: "pax", name: "PAX", youtube: null },
  { id: "yeson3", name: "Yes on 3", youtube: "https://www.youtube.com/@yeson3ma" },
]

export const memberByEmail = (email: string) => MEMBERS.find((m) => m.email?.toLowerCase() === email.toLowerCase())
