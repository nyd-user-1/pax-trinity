// Who is who (Brendan, 2026-10-25). One super admin, three admins, two staff,
// three partner organizations. The admins' accounts sit in the app's Cognito pool
// (parallax) and its admins group (2026-10-29); the remaining YouTube channels
// fill in as they arrive.

export type Role = "superadmin" | "admin" | "staff" | "partner"

/** A member's sign-in address, and any others that are the same person (Brendan's Gmail). */
export type Member = { name: string; email?: string; aliases?: string[]; role: Role; /** The headshot in public/. */ photo?: string; /** A partner account's organization (PARTNERS' id). */ partner?: string }

export const MEMBERS: Member[] = [
  { name: "Brendan Stanton", email: "brendan@nysgpt.com", aliases: ["brendan.stanton@gmail.com"], role: "superadmin", photo: "/brendan.jpg" },
  { name: "Sajeela Padder", email: "sajeela@parallaxinnovations.com", role: "admin", photo: "/sajeela.jpeg" },
  { name: "Garrett Hernandez Rimer", email: "garrett@parallaxinnovations.com", role: "admin", photo: "/garrett.jpeg" },
  { name: "Ted Delicath", email: "ted@parallaxinnovations.com", role: "admin", photo: "/ted.jpeg" },
  // Ted's second account (Brendan, 2026-10-30): the Parallax address is his admin account, this one his
  // Unite America partner account. Two people to the app, never aliases of each other.
  { name: "Ted Delicath", email: "ted@uniteamerica.org", role: "partner", partner: "unite-america", photo: "/ted.jpeg" },
  // The partner demo accounts (Brendan, 2026-11-02): one per partner organization, each seeing its own sponsor's
  // material alone (lib/partners/sponsors.ts). Users in the parallax pool, first sign-in by Forgot password; not on
  // the mail allowlist, so they receive in the app only.
  { name: "Unite America (demo)", email: "unite-demo@nysgpt.com", role: "partner", partner: "unite-america" },
  { name: "Yes on 3 (demo)", email: "yeson3-demo@nysgpt.com", role: "partner", partner: "yeson3" },
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
