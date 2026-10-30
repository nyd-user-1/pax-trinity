// Who is who (Brendan, 2026-10-25). One super admin, three admins, two staff,
// three partner organizations. The admins' accounts sit in the app's Cognito pool
// (parallax) and its admins group (2026-10-29); the remaining YouTube channels
// fill in as they arrive.

export type Role = "superadmin" | "admin" | "staff" | "partner"

/** A member's sign-in address, and any others that are the same person (Brendan's Gmail). */
export type Member = { name: string; email?: string; aliases?: string[]; role: Role; /** The headshot in public/. */ photo?: string }

export const MEMBERS: Member[] = [
  { name: "Brendan Stanton", email: "brendan@nysgpt.com", aliases: ["brendan.stanton@gmail.com"], role: "superadmin", photo: "/brendan.jpg" },
  { name: "Sajeela Padder", email: "sajeela@parallaxinnovations.com", role: "admin", photo: "/sajeela.jpeg" },
  { name: "Garrett Hernandez Rimer", email: "garrett@parallaxinnovations.com", role: "admin", photo: "/garrett.jpeg" },
  { name: "Ted Delicath", email: "ted@parallaxinnovations.com", role: "admin", photo: "/ted.jpeg" },
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

export const memberByEmail = (email: string) => {
  const e = email.toLowerCase()
  return MEMBERS.find((m) => m.email?.toLowerCase() === e || m.aliases?.some((a) => a.toLowerCase() === e))
}

/** The super admin, the developer: the one role that edits and resolves (Brendan, 2026-10-30). */
export const isSuperAdmin = (email: string) => memberByEmail(email)?.role === "superadmin"
